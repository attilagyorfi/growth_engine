/**
 * G1 – napi riport-adatszinkron: közös szinkronmag (platformonkénti csere),
 * idempotens db-helper, ütemezési döntés, MySQL-zár, újrapróbálás és értesítés.
 * Minden függőség mockolt: nincs valós DB, Google/Meta-fiók vagy Social Hub-kulcs.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { reportMetrics, type DataConnection } from "../drizzle/schema";
import { replaceReportMetrics } from "./db";
import { syncProfileMetrics, describeError, type SyncProfileDeps, type SyncProfileResult } from "./reports/syncProfile";
import {
  budapestClock,
  collectSyncFailures,
  createDailyTicker,
  isReportSyncEnabled,
  rollingWindow,
  runDailyReportSync,
  shouldRunDailySync,
  withMysqlLock,
  MAX_SYNC_ATTEMPTS,
  REPORT_SYNC_LOCK_NAME,
  SYNC_FAILURE_TITLE,
  type LockConnection,
  type ReportSyncDeps,
} from "./reportSyncScheduler";

afterEach(() => vi.restoreAllMocks());

// ─── Közös szinkronmag ──────────────────────────────────────────────────────

type Row = { profileId: string; platform: string; date: Date; metricKey: string; value: number; dimension?: unknown };

const conn = (id: string, platform: DataConnection["platform"], externalAccountId = id) =>
  ({ id, profileId: "p-1", platform, externalAccountId } as unknown as DataConnection);

const rowsFor = (c: DataConnection, from: string, to: string) => {
  const out: any[] = [];
  for (let d = new Date(from); d <= new Date(to); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push({ platform: c.platform, date: new Date(d), metricKey: "clicks", value: 1, currency: null, dimension: { conn: c.id } });
  }
  return out;
};

/** Memóriabeli report_metrics a valódi „törlés [from,to]-ban, majd beszúrás” szemantikával. */
function memoryDeps(conns: DataConnection[], overrides: Partial<SyncProfileDeps> = {}) {
  const store: Row[] = [];
  const deps: SyncProfileDeps = {
    listConnections: vi.fn(async () => conns),
    fetchMetrics: vi.fn(async (c, from, to) => rowsFor(c, from, to)),
    replaceRows: vi.fn(async (profileId, platform, from, to, rows) => {
      const lo = new Date(from).getTime();
      const hi = new Date(to).getTime();
      for (let i = store.length - 1; i >= 0; i--) {
        const r = store[i];
        if (r.profileId === profileId && r.platform === platform && r.date.getTime() >= lo && r.date.getTime() <= hi) store.splice(i, 1);
      }
      store.push(...rows.map((r) => ({ ...r, profileId })));
      return { inserted: rows.length };
    }),
    getProfile: vi.fn(async () => ({ externalRef: null })),
    syncSocial: vi.fn(async () => ({ status: "skipped" as const, reason: "no_external_ref" as const })),
    ...overrides,
  };
  return { store, deps };
}

describe("syncProfileMetrics – közös mag", () => {
  it("kétszeri szinkron ugyanarra az időszakra nem növeli a sorszámot", async () => {
    const { store, deps } = memoryDeps([conn("c-1", "google_ads"), conn("c-2", "ga4")]);
    const first = await syncProfileMetrics("p-1", "2026-11-09", "2026-11-11", undefined, deps);
    expect(store).toHaveLength(6);
    const second = await syncProfileMetrics("p-1", "2026-11-09", "2026-11-11", undefined, deps);
    expect(store).toHaveLength(6);
    expect(second).toEqual(first);
    expect(first).toEqual({ platforms: ["google_ads", "ga4"], inserted: 6, social: { status: "skipped", reason: "no_external_ref" }, errors: [] });
  });

  it("egy platform két kapcsolatának sorai egyetlen cserével íródnak, mind megmaradnak", async () => {
    const { store, deps } = memoryDeps([conn("c-1", "google_ads", "acc-1"), conn("c-2", "google_ads", "acc-2")]);
    await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", undefined, deps);
    await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", undefined, deps);
    expect(deps.replaceRows).toHaveBeenCalledTimes(2); // futásonként egyszer
    expect(store).toHaveLength(4);
    expect(new Set(store.map((r) => (r.dimension as any).conn))).toEqual(new Set(["c-1", "c-2"]));
  });

  it("ha egy platform bármely kapcsolatának lekérése hibázik, arra a platformra nincs csere (a régi adat marad)", async () => {
    const conns = [conn("c-1", "google_ads", "acc-1"), conn("c-2", "google_ads", "acc-2"), conn("c-3", "ga4")];
    const { store, deps } = memoryDeps(conns);
    await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", undefined, deps);
    const before = store.filter((r) => r.platform === "google_ads").map((r) => ({ ...r }));
    vi.mocked(deps.fetchMetrics).mockImplementation(async (c, from, to) => {
      if (c.id === "c-2") throw new Error("Google Ads: HTTP 500 https://ads.example.test/x?access_token=SECRET-1");
      return rowsFor(c, from, to);
    });
    vi.mocked(deps.replaceRows).mockClear();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", undefined, deps);
    expect(vi.mocked(deps.replaceRows).mock.calls.map((c) => c[1])).toEqual(["ga4"]);
    expect(store.filter((r) => r.platform === "google_ads")).toEqual(before);
    expect(res.errors).toEqual([{ platform: "google_ads", name: "Error", message: "Google Ads: HTTP 500 [url]" }]);
    expect(res.inserted).toBe(2);
    expect(errors.mock.calls.flat().map(String).join("\n")).not.toContain("SECRET-1");
  });

  it("írási hiba is a hibalistába kerül, a mutáció-szerű hívás nem dob", async () => {
    const { deps } = memoryDeps([conn("c-1", "meta_ads")], { replaceRows: vi.fn(async () => { throw new Error("Deadlock"); }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", undefined, deps);
    expect(res.errors).toEqual([{ platform: "meta_ads", name: "Error", message: "Deadlock" }]);
  });

  it("a platformszűrő csak a kért platformokat cseréli, és a közösségi ágat nem kéri", async () => {
    const { deps } = memoryDeps([conn("c-1", "google_ads"), conn("c-3", "ga4")]);
    const res = await syncProfileMetrics("p-1", "2026-11-10", "2026-11-11", ["ga4"], deps);
    expect(res.platforms).toEqual(["ga4"]);
    expect(vi.mocked(deps.syncSocial).mock.calls[0][0]).toMatchObject({ requested: false });
  });
});

describe("collectSyncFailures – mi számít hibának az ütemezőnek", () => {
  const base: SyncProfileResult = { platforms: [], inserted: 0, social: { status: "synced", inserted: 0, skippedAccounts: 0 }, errors: [] };
  it("a social 'failed' és a kapcsolat-hiba hiba", () => {
    expect(collectSyncFailures({ ...base, social: { status: "failed", reason: "error", message: "Social Hub /clients: HTTP 401" } }))
      .toEqual([{ platform: "social", name: "SocialHubError", message: "Social Hub /clients: HTTP 401" }]);
    expect(collectSyncFailures({ ...base, errors: [{ platform: "ga4", name: "Error", message: "x" }] })).toHaveLength(1);
  });
  it.each(["not_configured", "no_external_ref", "no_match", "not_requested"] as const)("a skipped (%s) nem hiba", (reason) => {
    expect(collectSyncFailures({ ...base, social: { status: "skipped", reason } })).toEqual([]);
  });
});

describe("describeError – titokmentes napló", () => {
  it("URL-t és token-szerű értéket kitakar, rövidít, stacket nem ad", () => {
    const err = new TypeError("fetch failed https://x.test/a?key=SECRET-2 token=SECRET-3 " + "x".repeat(400));
    const info = describeError(err);
    expect(info.name).toBe("TypeError");
    expect(JSON.stringify(info)).not.toMatch(/SECRET|x\.test|at /);
    expect(info.message.length).toBeLessThanOrEqual(160);
  });
});

// ─── Idempotens db-helper ───────────────────────────────────────────────────

describe("replaceReportMetrics – tranzakció: előbb törlés, utána ~500-as batch-ek", () => {
  it("egy tranzakcióban töröl, majd batch-ekben szúr be, profileId-vel", async () => {
    const calls: string[] = [];
    const tx = {
      delete: vi.fn((table) => { expect(table).toBe(reportMetrics); return { where: vi.fn(async () => { calls.push("delete"); }) }; }),
      insert: vi.fn((table) => { expect(table).toBe(reportMetrics); return { values: vi.fn(async (v: any[]) => { calls.push(`insert:${v.length}`); expect(v[0].profileId).toBe("p-1"); }) }; }),
    };
    const fakeDb = { transaction: vi.fn(async (cb: (t: any) => Promise<void>) => { calls.push("begin"); await cb(tx); calls.push("commit"); }) };
    const rows = Array.from({ length: 1001 }, (_, i) => ({ platform: "google_ads" as const, date: new Date("2026-11-10"), metricKey: `m${i}`, value: i, currency: null, dimension: null }));
    const res = await replaceReportMetrics("p-1", "google_ads", "2026-11-09", "2026-11-11", rows, fakeDb as any);
    expect(res).toEqual({ inserted: 1001 });
    expect(calls).toEqual(["begin", "delete", "insert:500", "insert:500", "insert:1", "commit"]);
  });

  it("közösségi platformot és idegen platformú sort elutasít (azokat nem érinti)", async () => {
    const fakeDb = { transaction: vi.fn() };
    await expect(replaceReportMetrics("p-1", "facebook" as any, "2026-11-09", "2026-11-11", [], fakeDb as any)).rejects.toThrow();
    await expect(replaceReportMetrics("p-1", "ga4", "2026-11-09", "2026-11-11",
      [{ platform: "google_ads", date: new Date("2026-11-10"), metricKey: "x", value: 1 }], fakeDb as any)).rejects.toThrow();
    expect(fakeDb.transaction).not.toHaveBeenCalled();
  });
});

// ─── Ütemezési döntés ───────────────────────────────────────────────────────

describe("ütemezés – Europe/Budapest, naponta egyszer, hajnalban", () => {
  it("env-kapcsoló: alapból csak productionben, 'false' kikapcsolja", () => {
    expect(isReportSyncEnabled(undefined, true)).toBe(true);
    expect(isReportSyncEnabled(undefined, false)).toBe(false);
    expect(isReportSyncEnabled("false", true)).toBe(false);
    expect(isReportSyncEnabled(" TRUE ", false)).toBe(true);
  });

  it.each([
    ["nyári idő (CEST, UTC+2): 03:30 budapesti", "2026-07-15T01:30:00Z", true],
    ["nyári idő: 02:30 budapesti (UTC szerint már 00:30)", "2026-07-15T00:30:00Z", false],
    ["téli idő (CET, UTC+1): 03:30 budapesti", "2026-01-15T02:30:00Z", true],
    ["téli idő: 02:30 budapesti", "2026-01-15T01:30:00Z", false],
    ["06:00 budapesti már az ablakon kívül", "2026-01-15T05:00:00Z", false],
    ["DST-váltás napja, 03:10 CEST", "2026-03-29T01:10:00Z", true],
  ])("%s", (_name, iso, expected) => {
    expect(shouldRunDailySync(new Date(iso), null).run).toBe(expected);
  });

  it("budapesti óra és nap DST-biztosan", () => {
    expect(budapestClock(new Date("2026-07-14T22:30:00Z"))).toEqual({ day: "2026-07-15", hour: 0 });
    expect(budapestClock(new Date("2026-01-14T23:30:00Z"))).toEqual({ day: "2026-01-15", hour: 0 });
  });

  it("gördülő ablak: tegnap−2 … tegnap, budapesti dátum szerint", () => {
    expect(rollingWindow(new Date("2026-03-01T02:00:00Z"))).toEqual({ from: "2026-02-26", to: "2026-02-28" });
    // UTC szerint még 07-14, Budapesten már 07-15
    expect(rollingWindow(new Date("2026-07-14T22:30:00Z"))).toEqual({ from: "2026-07-12", to: "2026-07-14" });
    expect(rollingWindow(new Date("2026-03-29T01:30:00Z"))).toEqual({ from: "2026-03-26", to: "2026-03-28" });
    expect(rollingWindow(new Date("2026-01-01T02:30:00Z"))).toEqual({ from: "2025-12-29", to: "2025-12-31" });
  });

  it("a napi kapu naponta egyszer engedi; zárhibánál az ablakon belül újrapróbál", async () => {
    const done = { status: "done" as const, from: "", to: "", synced: 0, failed: 0, retried: 0, notified: 0 };
    const run = vi.fn(async () => done as any);
    const tick = createDailyTicker(run);
    expect(await tick(new Date("2026-11-12T01:59:00Z"))).toBeNull(); // 02:59
    await tick(new Date("2026-11-12T02:05:00Z")); // 03:05
    await tick(new Date("2026-11-12T02:15:00Z"));
    await tick(new Date("2026-11-12T04:50:00Z"));
    expect(run).toHaveBeenCalledTimes(1);
    await tick(new Date("2026-11-13T02:05:00Z")); // másnap
    expect(run).toHaveBeenCalledTimes(2);

    run.mockResolvedValueOnce({ status: "skipped", reason: "error" });
    await tick(new Date("2026-11-14T02:05:00Z"));
    await tick(new Date("2026-11-14T02:15:00Z"));
    expect(run).toHaveBeenCalledTimes(4);
    await tick(new Date("2026-11-14T02:25:00Z"));
    expect(run).toHaveBeenCalledTimes(4);
  });
});

// ─── MySQL-zár ──────────────────────────────────────────────────────────────

function fakePool(getLock: unknown | (() => never)) {
  const conn = {
    query: vi.fn(async (sql: string) => {
      if (sql.startsWith("SELECT GET_LOCK")) {
        if (typeof getLock === "function") (getLock as () => never)();
        return [[{ got: getLock }]];
      }
      return [[{ released: 1 }]];
    }),
    release: vi.fn(),
  } satisfies LockConnection;
  return { conn, pool: { getConnection: vi.fn(async () => conn) } };
}

describe("withMysqlLock – GET_LOCK/RELEASE_LOCK ugyanazon a kapcsolaton", () => {
  it("megszerzett zárnál lefut, utána felszabadít és visszaadja a kapcsolatot", async () => {
    const { conn, pool } = fakePool(1);
    const res = await withMysqlLock(pool, REPORT_SYNC_LOCK_NAME, async () => "ok");
    expect(res).toEqual({ acquired: true, value: "ok" });
    expect(conn.query.mock.calls).toEqual([
      ["SELECT GET_LOCK(?, 0) AS got", [REPORT_SYNC_LOCK_NAME]],
      ["SELECT RELEASE_LOCK(?)", [REPORT_SYNC_LOCK_NAME]],
    ]);
    expect(pool.getConnection).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["foglalt (0)", 0, "busy"],
    ["NULL", null, "error"],
    ["GET_LOCK hiba (pl. nem támogatott)", () => { throw new Error("FUNCTION get_lock does not exist"); }, "error"],
  ] as const)("%s → a futás kimarad, naplózódik, a kapcsolat visszakerül", async (_name, got, reason) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { conn, pool } = fakePool(got);
    const fn = vi.fn();
    const res = await withMysqlLock(pool, REPORT_SYNC_LOCK_NAME, fn);
    expect(res).toEqual({ acquired: false, reason });
    expect(fn).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
    if (reason === "error") expect(errors).toHaveBeenCalled();
  });

  it("a futás hibájánál is felszabadítja a zárat és visszaadja a kapcsolatot", async () => {
    const { conn, pool } = fakePool(1);
    await expect(withMysqlLock(pool, REPORT_SYNC_LOCK_NAME, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(conn.query).toHaveBeenLastCalledWith("SELECT RELEASE_LOCK(?)", [REPORT_SYNC_LOCK_NAME]);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});

// ─── A napi futás: újrapróbálás, értesítés, hibatűrés ───────────────────────

const ok = (): SyncProfileResult => ({ platforms: ["ga4"], inserted: 3, social: { status: "skipped", reason: "not_configured" }, errors: [] });
const failing = (): SyncProfileResult => ({ ...ok(), errors: [{ platform: "google_ads", name: "Error", message: "HTTP 503" }] });

type Notification = { appUserId: string; profileId: string; type: "system"; title: string; body: string; actionUrl: string; isRead: boolean };

function schedulerDeps(overrides: Partial<ReportSyncDeps> = {}, notifications: Notification[] = []) {
  const deps: ReportSyncDeps = {
    now: () => new Date("2026-11-12T02:30:00Z"),
    withLock: async (fn) => ({ acquired: true, value: await fn() }),
    listActiveProfileIds: vi.fn(async () => ["p-1"]),
    syncProfile: vi.fn(async () => ok()),
    listRecipients: vi.fn(async (profileId: string) => [`user-${profileId}`]),
    // DB-alapú dedup: olvasatlan, azonos appUserId + profileId + type + title
    hasUnreadNotification: vi.fn(async (appUserId: string, profileId: string, title: string) =>
      notifications.some((n) => n.appUserId === appUserId && n.profileId === profileId && n.type === "system" && n.title === title && !n.isRead)),
    notify: vi.fn(async (n) => { notifications.push({ ...n, type: "system", isRead: false }); }),
    sleep: vi.fn(async () => {}),
    baseDelayMs: 10,
    ...overrides,
  };
  return { deps, notifications };
}

describe("runDailyReportSync", () => {
  it("foglalt zárnál egyetlen profil szinkronja sem indul", async () => {
    const { deps } = schedulerDeps({ withLock: async () => ({ acquired: false, reason: "busy" }) });
    expect(await runDailyReportSync(deps)).toEqual({ status: "skipped", reason: "busy" });
    expect(deps.listActiveProfileIds).not.toHaveBeenCalled();
    expect(deps.syncProfile).not.toHaveBeenCalled();
  });

  it("a gördülő ablakra szinkronizál minden aktív profilt", async () => {
    const { deps } = schedulerDeps({ listActiveProfileIds: vi.fn(async () => ["p-1", "p-2"]) });
    const res = await runDailyReportSync(deps);
    expect(res).toMatchObject({ status: "done", from: "2026-11-09", to: "2026-11-11", synced: 2, failed: 0 });
    expect(deps.syncProfile).toHaveBeenCalledWith("p-2", "2026-11-09", "2026-11-11");
  });

  it("átmeneti hiba → siker a 2. próbára, exponenciális visszalépés, nincs értesítés", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const syncProfile = vi.fn().mockResolvedValueOnce(failing()).mockRejectedValueOnce(new Error("ETIMEDOUT")).mockResolvedValue(ok());
    const { deps, notifications } = schedulerDeps({ syncProfile });
    const res = await runDailyReportSync(deps);
    expect(syncProfile).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenNthCalledWith(1, 10);
    expect(deps.sleep).toHaveBeenNthCalledWith(2, 20);
    expect(res).toMatchObject({ synced: 1, failed: 0, retried: 1, notified: 0 });
    expect(notifications).toHaveLength(0);

    const once = vi.fn().mockResolvedValueOnce(failing()).mockResolvedValue(ok());
    const second = schedulerDeps({ syncProfile: once });
    await runDailyReportSync(second.deps);
    expect(once).toHaveBeenCalledTimes(2);
    expect(second.notifications).toHaveLength(0);
  });

  it("tartós hiba → legfeljebb N próbálkozás, és pontosan egy értesítés ismételt futásnál is", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const notifications: Notification[] = [];
    const run = async () => {
      // minden futás új deps-et kap (= újraindulás után üres memória), a DB-store közös
      const { deps } = schedulerDeps({ syncProfile: vi.fn(async () => failing()) }, notifications);
      const res = await runDailyReportSync(deps);
      expect(deps.syncProfile).toHaveBeenCalledTimes(MAX_SYNC_ATTEMPTS);
      return res;
    };
    expect(await run()).toMatchObject({ failed: 1, notified: 1 });
    expect(await run()).toMatchObject({ failed: 1, notified: 0 });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ appUserId: "user-p-1", profileId: "p-1", type: "system", title: SYNC_FAILURE_TITLE, actionUrl: "/riportok" });
    expect(notifications[0].body).toContain("Google Ads");
    expect(notifications[0].body).toContain("Holnap újra próbáljuk");

    // Ha elolvasta, és a hiba fennáll, a következő futás újra szól.
    notifications[0].isRead = true;
    expect(await run()).toMatchObject({ notified: 1 });
  });

  it("a social 'failed' tartós hibának számít, a 'skipped' nem", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const socialFailed = schedulerDeps({ syncProfile: vi.fn(async () => ({ ...ok(), social: { status: "failed" as const, reason: "error" as const, message: "Social Hub /metrics: HTTP 500" } })) });
    expect(await runDailyReportSync(socialFailed.deps)).toMatchObject({ failed: 1, notified: 1 });
    expect(socialFailed.notifications[0].body).toContain("közösségi média");

    const skipped = schedulerDeps({ syncProfile: vi.fn(async () => ({ ...ok(), social: { status: "skipped" as const, reason: "no_match" as const } })) });
    expect(await runDailyReportSync(skipped.deps)).toMatchObject({ synced: 1, failed: 0 });
    expect(skipped.deps.syncProfile).toHaveBeenCalledTimes(1);
  });

  it("egy profil tartós hibája mellett a többi aktív profil szinkronja lefut", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const syncProfile = vi.fn(async (profileId: string) => {
      if (profileId === "p-2") throw new Error("boom");
      return ok();
    });
    const { deps, notifications } = schedulerDeps({ listActiveProfileIds: vi.fn(async () => ["p-1", "p-2", "p-3"]), syncProfile });
    const res = await runDailyReportSync(deps);
    expect(res).toMatchObject({ synced: 2, failed: 1, notified: 1 });
    expect(syncProfile.mock.calls.map((c) => c[0])).toEqual(["p-1", "p-2", "p-2", "p-2", "p-3"]);
    expect(notifications.map((n) => n.profileId)).toEqual(["p-2"]);
  });

  it("címzett nélkül csak napló készül; az értesítés hibája sem állítja meg a többit", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const noRecipients = schedulerDeps({ syncProfile: vi.fn(async () => failing()), listRecipients: vi.fn(async () => []) });
    expect(await runDailyReportSync(noRecipients.deps)).toMatchObject({ failed: 1, notified: 0 });
    expect(noRecipients.deps.notify).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();

    const syncProfile = vi.fn(async (id: string) => (id === "p-1" ? failing() : ok()));
    const broken = schedulerDeps({ listActiveProfileIds: vi.fn(async () => ["p-1", "p-2"]), syncProfile, notify: vi.fn(async () => { throw new Error("db down"); }) });
    expect(await runDailyReportSync(broken.deps)).toMatchObject({ synced: 1, failed: 1 });
  });

  it("a naplóban nincs token, URL vagy stack — csak profil, platform, hibaosztály, rövid üzenet", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const secretErr = new Error("Request failed https://graph.example.test/v1?access_token=SECRET-TOKEN-9");
    const { deps } = schedulerDeps({ syncProfile: vi.fn(async () => { throw secretErr; }) });
    await runDailyReportSync(deps);
    const logged = errors.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
    expect(logged).toContain("profil=p-1");
    expect(logged).toContain("Error: Request failed [url]");
    expect(logged).not.toContain("SECRET-TOKEN-9");
    expect(logged).not.toContain("graph.example.test");
    expect(logged).not.toContain(" at ");
    for (const call of errors.mock.calls) expect(call.every((a) => typeof a === "string")).toBe(true);
  });
});
