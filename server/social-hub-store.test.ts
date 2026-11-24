/**
 * G2 – a Social Hub-kapcsolat és a küldési napló adatbázisos tárolója (0026).
 *
 * Valódi adatbázis és Social Hub nélkül: a valódi drizzle fut egy felvevő hamis mysql2-poolon,
 * így a kiadott SQL-t, a paramétereket és a tranzakciók határát ellenőrizzük (a valódi zárolást
 * nem). A HTTP mock.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableConfig } from "drizzle-orm/mysql-core";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-000000";
  return { db: null as any, posts: [] as any[] };
});
// Ha valami mégis kapcsolódni akarna, ne tudjon.
vi.mock("mysql2/promise", () => ({ default: { createPool: () => { throw new Error("tilos"); } } }));
vi.mock("./db", async (orig) => ({
  ...(await orig<typeof import("./db")>()),
  getDb: async () => h.db,
  getProfileById: async (id: string) => ({ id, name: "VIBA", appUserId: "u-a", externalRef: "viba" }),
  listProfileBrands: async () => [],
  getProfileBrand: async () => null,
  getContentByProfile: async (pid: string) => h.posts.filter((p) => p.profileId === pid),
}));

import { socialHubConnection, socialHubPostDeliveries, socialHubSendAttempts } from "../drizzle/schema";
import { PROFILE_OWNED_TABLES } from "./db";
import { appRouter } from "./routers";
import { encryptApiKey, resolveSocialHubConfig } from "./socialHub/config";
import { syncSocialMetrics } from "./socialHub/metrics";
import { getSocialHubStore, SocialHubStoreError, type ClaimInput } from "./socialHub/store";

const KEY = "sh_live_TITKOS-teszt-kulcs-9876";
const CLIENT = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-24T10:00:00Z");

// ─── Hamis mysql2-pool ───────────────────────────────────────────────────────

type Call = { conn: "pool" | "tx"; sql: string; params: unknown[] };
let calls: Call[];
/** Mit ad vissza egy lekérdezés: sorok (tömb) vagy eredményfejléc; alapból üres / minden sor érintett. */
let on: (sql: string, params: any[]) => any;
const fakeQuery = (conn: Call["conn"]) => async (q: any, params: any[] = []) => {
  const sql = typeof q === "string" ? q : q.sql;
  calls.push({ conn, sql, params });
  if (/^(begin|commit|rollback)/i.test(sql)) return [{}];
  return [on(sql, params) ?? (/^select/i.test(sql) ? [] : { affectedRows: 1 }), []];
};
const fakeDb = () => drizzle({
  query: fakeQuery("pool"), execute: fakeQuery("pool"),
  getConnection: async () => ({ query: fakeQuery("tx"), execute: fakeQuery("tx"), release: () => {} }),
} as any);
const find = (re: RegExp) => calls.filter((c) => re.test(c.sql));
const kinds = () => calls.map((c) => c.sql.split(" ").slice(0, 2).join(" ").toLowerCase());

/** MySQL-hiba, amelynek szövege mindent kiszivárogtatna. */
const leaky = (code: string, errno: number) => Object.assign(
  new Error(`${code}: insert into social_hub values ('enc:v1:SZIVARGAS', 'Szöveg a')`),
  { code, errno, sql: "insert into social_hub", sqlMessage: "enc:v1:SZIVARGAS" },
);
const noTable = () => leaky("ER_NO_SUCH_TABLE", 1146);

let logs: string[];
beforeEach(() => {
  calls = []; logs = []; on = () => undefined;
  h.db = fakeDb(); h.posts = [];
  vi.stubEnv("DATABASE_URL", "mysql://teszt@localhost/teszt");
  vi.stubEnv("SOCIAL_HUB_API_URL", ""); vi.stubEnv("SOCIAL_HUB_API_KEY", "");
  for (const m of ["error", "warn"] as const) vi.spyOn(console, m).mockImplementation((...x) => { logs.push(x.map(String).join(" ")); });
});
afterEach(() => {
  expect(logs.join("\n")).not.toMatch(/SZIVARGAS|insert into|Failed query|Szöveg a|TITKOS/);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
const store = () => getSocialHubStore()!;

// ─── Migráció és séma ────────────────────────────────────────────────────────

describe("0026-os migráció", () => {
  const raw = readFileSync("drizzle/0026_social_hub_send.sql", "utf8").replace(/\r/g, "");
  const statements = raw.split("--> statement-breakpoint")
    .map((s) => s.split("\n").filter((l) => !l.startsWith("--")).join("\n").trim());
  const parse = (stmt: string) => {
    const body = stmt.slice(stmt.indexOf("(\n") + 2, stmt.lastIndexOf("\n)"));
    const lines = body.split("\n").map((l) => l.trim().replace(/,$/, ""));
    return {
      name: /^CREATE TABLE IF NOT EXISTS `(\w+)`/.exec(stmt)?.[1],
      columns: lines.filter((l) => l.startsWith("`")),
      constraints: lines.filter((l) => !l.startsWith("`")),
    };
  };
  const tables = statements.map(parse);

  it("pontosan három CREATE TABLE IF NOT EXISTS, a jóváhagyott oszlopokkal, más utasítás nélkül", () => {
    expect(statements).toHaveLength(3);
    for (const s of statements) {
      expect(s).toMatch(/^CREATE TABLE IF NOT EXISTS `\w+` \(\n[^;]*\n\);$/);
      expect(s).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|INDEX|REFERENCES)\b/i);
    }
    expect(Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.split("`")[1])]))).toEqual({
      social_hub_connection: ["id", "baseUrl", "apiKeyEnc", "apiKeyLast4", "updatedBy", "updatedAt"],
      social_hub_send_attempts: ["id", "profileId", "socialHubClientId", "baseUrlHash", "idempotencyKey", "body", "postIds", "status",
        "runToken", "firstTriedAt", "lastTriedAt", "lastError", "createdBy", "createdAt"],
      social_hub_post_deliveries: ["id", "profileId", "postId", "socialHubClientId", "status", "attemptId", "contentHash", "sentHash",
        "socialHubPostId", "sentAt"],
    });
    expect(tables.flatMap((t) => t.constraints)).toEqual([
      "CONSTRAINT `social_hub_connection_id` PRIMARY KEY(`id`)",
      "CONSTRAINT `social_hub_send_attempts_id` PRIMARY KEY(`id`)",
      "CONSTRAINT `social_hub_send_attempts_idempotencyKey_unique` UNIQUE(`idempotencyKey`)",
      "CONSTRAINT `social_hub_post_deliveries_id` PRIMARY KEY(`id`)",
      "CONSTRAINT `social_hub_post_deliveries_post_client_unique` UNIQUE(`postId`,`socialHubClientId`)",
    ]);
  });

  it("a schema.ts oszlopai (név, típus, kötelezőség, alapérték) egyeznek; nincs automatikus frissítés, text/json alapérték", () => {
    [socialHubConnection, socialHubSendAttempts, socialHubPostDeliveries].forEach((table, i) => {
      const config = getTableConfig(table);
      expect(config.name).toBe(tables[i].name);
      expect(config.columns.map((c) => `\`${c.name}\` ${c.getSQLType()}${c.notNull ? " NOT NULL" : " NULL"}${c.hasDefault ? " DEFAULT (now())" : ""}`))
        .toEqual(tables[i].columns);
      expect(config.columns.some((c: any) => c.hasOnUpdateNow)).toBe(false);
    });
    const columns = tables.flatMap((t) => t.columns).join("\n");
    expect(columns).not.toMatch(/ON UPDATE/i);
    expect(columns).not.toMatch(/(text|json)[^\n]*DEFAULT/i);
    expect(getTableConfig(socialHubSendAttempts).columns.find((c) => c.name === "idempotencyKey")!.isUnique).toBe(true);
    expect(getTableConfig(socialHubPostDeliveries).uniqueConstraints[0].columns.map((c) => c.name)).toEqual(["postId", "socialHubClientId"]);
  });

  it("a naplóban (journal) és a profiltörlés kaszkádjában is szerepel", () => {
    const { entries } = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    const [prev, last] = entries.slice(-2);
    expect(last).toMatchObject({ idx: 17, tag: "0026_social_hub_send", breakpoints: true });
    expect(prev.tag).toBe("0025_profile_brands");
    expect(last.when).toBeGreaterThan(prev.when);
    expect(PROFILE_OWNED_TABLES).toEqual(expect.arrayContaining(["socialHubSendAttempts", "socialHubPostDeliveries"]));
    expect(PROFILE_OWNED_TABLES).not.toContain("socialHubConnection");
  });
});

// ─── Elérhetőség ─────────────────────────────────────────────────────────────

const claimInput = (over: Partial<ClaimInput> = {}): ClaimInput => ({
  id: "at-1", profileId: "p-a", socialHubClientId: CLIENT, baseUrlHash: "h", idempotencyKey: "ge:kulcs-1", runToken: "rt-1",
  firstTriedAt: NOW, lastTriedAt: NOW, createdBy: "u-a", buildBody: (drafts) => JSON.stringify({ drafts }),
  items: [
    { postId: "z", contentHash: "hash-z", draft: { text: "Z" }, expected: { status: "new", attemptId: null } },
    { postId: "a", contentHash: "hash-a", draft: { text: "A" }, expected: { status: "sent", attemptId: "at-0" } },
    { postId: "m", contentHash: "hash-m", draft: { text: "M" }, expected: { status: "new", attemptId: null } },
  ],
  ...over,
});

const everyOperation: [string, () => Promise<unknown>][] = [
  ["getConnection", () => store().getConnection()],
  ["saveConnection", () => store().saveConnection({ baseUrl: "https://hub.test", apiKeyEnc: "enc:v1:SZIVARGAS", apiKeyLast4: "9876", updatedBy: "u" })],
  ["deleteConnection", () => store().deleteConnection()],
  ["getDeliveries", () => store().getDeliveries(CLIENT, ["a"])],
  ["getAttempts", () => store().getAttempts(["at-1"])],
  ["claim", () => store().claim(claimInput())],
  ["reclaim", () => store().reclaim("at-1", "rt-1", "rt-2", NOW)],
  ["finishSent", () => store().finishSent("at-1", [{ postId: "a", socialHubPostId: "sh-a" }], NOW)],
  ["finishUnsent", () => store().finishUnsent("at-1", "rt-1", "failed", "hiba", NOW)],
];

describe("elérhetőség és hibák", () => {
  it("DATABASE_URL nélkül nincs tároló, azzal van", () => {
    expect(getSocialHubStore()).not.toBeNull();
    vi.stubEnv("DATABASE_URL", "");
    expect(getSocialHubStore()).toBeNull();
  });

  it.each(everyOperation)("%s: elérhetetlen adatbázisnál és SQL-hibánál is dob, rögzített szöveggel, ok nélkül", async (_name, work) => {
    h.db = null;
    await expect(work()).rejects.toBeInstanceOf(SocialHubStoreError);
    h.db = fakeDb();
    on = () => { throw leaky("ER_LOCK_DEADLOCK", 1213); };
    const err: any = await work().catch((e) => e);
    expect(err).toBeInstanceOf(SocialHubStoreError);
    expect(err.message).toBe("A Social Hub adatai most nem érhetők el. Próbáld újra.");
    expect(err.cause).toBeUndefined();
    expect(`${err.stack}${JSON.stringify(err)}`).not.toMatch(/SZIVARGAS|insert into/);
    expect(logs.join()).toContain("ER_LOCK_DEADLOCK");
  });

  it("hiányzó tábla (a drizzle a cause-ba csomagolja): csak a getConnection ad null-t", async () => {
    on = () => { throw noTable(); };
    expect(await store().getConnection()).toBeNull();
    h.db = { select: () => { throw Object.assign(new Error("Failed query: SZIVARGAS"), { cause: { cause: { errno: 1146 } } }); } };
    expect(await store().getConnection()).toBeNull();
    h.db = fakeDb();
    for (const [name, work] of everyOperation) {
      if (name !== "getConnection") await expect(work()).rejects.toThrow("A Social Hubba küldés még nem áll készen.");
    }
  });
});

// ─── Kapcsolat ───────────────────────────────────────────────────────────────

describe("kapcsolat", () => {
  it("egyetlen, fix azonosítójú sor, felülíró mentéssel; olvasás és törlés ugyanarra", async () => {
    const enc = encryptApiKey(KEY)!;
    await store().saveConnection({ baseUrl: "https://hub.test", apiKeyEnc: enc, apiKeyLast4: "9876", updatedBy: "u-admin" });
    const [insert] = find(/^insert into `social_hub_connection`/);
    expect(insert.sql).toContain("on duplicate key update");
    expect(insert.params).toEqual(expect.arrayContaining(["default", enc, "9876", "u-admin"]));
    expect(JSON.stringify(insert.params)).not.toContain(KEY);
    on = (sql) => (/^select/.test(sql) ? [["default", "https://hub.test", enc, "9876", "u-admin", "2026-11-24 10:00:00"]] : undefined);
    expect(await store().getConnection()).toEqual({ baseUrl: "https://hub.test", apiKeyEnc: enc, apiKeyLast4: "9876", updatedAt: NOW });
    expect(await resolveSocialHubConfig()).toMatchObject({ source: "stored", config: { apiKey: KEY } });
    await store().deleteConnection();
    expect(find(/^delete from `social_hub_connection` where/)[0].params).toEqual(["default"]);
  });
});

// ─── Foglalás és lezárás ─────────────────────────────────────────────────────

describe("claim", () => {
  const locked = (rows: [string, string, string | null][], affected = rows.length) => {
    on = (sql) => (/for update$/.test(sql) ? rows.map(([postId, status, attemptId]) => [`row-${postId}`, postId, status, attemptId])
      : /^update/.test(sql) ? { affectedRows: affected } : undefined);
  };

  it("egy tranzakció: INSERT IGNORE → SELECT … FOR UPDATE → feltételes UPDATE → kísérlet; a törzs a drafts sorrendjében", async () => {
    locked([["a", "sent", "at-0"], ["m", "new", null], ["z", "new", null]]);
    const attempt = await store().claim(claimInput());
    expect(kinds()).toEqual(["begin", "insert ignore", "select `id`,", "update `social_hub_post_deliveries`", "insert into", "commit"]);
    expect(calls.every((c) => c.conn === "tx")).toBe(true);

    const [ignore] = find(/^insert ignore into `social_hub_post_deliveries`/);
    expect(ignore.params.filter((p) => p === "z" || p === "a" || p === "m")).toEqual(["m", "z"]);
    const [lock] = find(/for update$/);
    expect(lock.sql).toMatch(/order by .*`postId` asc for update$/);
    expect(lock.params).toEqual([CLIENT, "a", "m", "z"]);
    // A foglalás nem az ON DUPLICATE KEY affectedRows-értékén múlik.
    expect(calls.some((c) => /on duplicate key/.test(c.sql))).toBe(false);

    const [update] = find(/^update `social_hub_post_deliveries`/);
    const [set, where] = update.sql.split(" where ");
    expect(set).not.toMatch(/sentHash|socialHubPostId|sentAt/); // a korábbi siker adatai megmaradnak
    expect(where.match(/`id` = \?/g)).toHaveLength(3);
    expect(where.match(/`status` = \?/g)).toHaveLength(3);
    expect(where.match(/`attemptId` <=> \?/g)).toHaveLength(3);
    expect(update.params).toEqual(["sending", "at-1", "z", "hash-z", "a", "hash-a", "m", "hash-m",
      "row-z", "new", null, "row-a", "sent", "at-0", "row-m", "new", null]);

    const body = JSON.stringify({ drafts: [{ text: "Z" }, { text: "A" }, { text: "M" }] });
    expect(attempt).toMatchObject({ id: "at-1", status: "sending", postIds: ["z", "a", "m"], body, idempotencyKey: "ge:kulcs-1", socialHubClientId: CLIENT });
    const [insert] = find(/^insert into `social_hub_send_attempts`/);
    expect(insert.params).toEqual(expect.arrayContaining(["at-1", "p-a", CLIENT, "ge:kulcs-1", body, JSON.stringify(["z", "a", "m"]), "sending", "rt-1", "u-a"]));
  });

  it("a már nem érvényes állapotú poszt kimarad a törzsből, és az állapotához nem nyúlunk", async () => {
    locked([["a", "sending", "at-9"], ["m", "new", null], ["z", "new", "at-8"]], 1);
    const attempt = await store().claim(claimInput());
    expect(attempt).toMatchObject({ postIds: ["m"], body: JSON.stringify({ drafts: [{ text: "M" }] }) });
    expect(find(/^update/)[0].params).toEqual(["sending", "at-1", "m", "hash-m", "row-m", "new", null]);
  });

  it("ha egy sem foglalható: null, kísérlet-sor és állapotváltás nélkül; a beszúrt sor „new”, ami nem blokkol", async () => {
    locked([["a", "sending", "at-9"], ["m", "sending", "at-9"], ["z", "sent", "at-9"]]);
    expect(await store().claim(claimInput())).toBeNull();
    expect(find(/social_hub_send_attempts/)).toHaveLength(0);
    expect(find(/^update/)).toHaveLength(0);
    const [ignore] = find(/^insert ignore/);
    expect(ignore.params).toContain("new");
    expect(ignore.params).not.toContain("sending");
    expect(ignore.params).not.toContain("at-1");
    calls = [];
    expect(await store().claim(claimInput({ items: [] }))).toBeNull();
    expect(find(/^(insert|update)/)).toHaveLength(0);
  });

  it("ha a feltételes UPDATE nem minden lefoglalt sort ér el, vagy a kísérlet nem tárolható: visszagördül és dob", async () => {
    locked([["a", "sent", "at-0"], ["m", "new", null], ["z", "new", null]], 2);
    await expect(store().claim(claimInput())).rejects.toBeInstanceOf(SocialHubStoreError);
    expect(kinds().slice(-1)).toEqual(["rollback"]);
    expect(find(/social_hub_send_attempts/)).toHaveLength(0);
    locked([["a", "sent", "at-0"], ["m", "new", null], ["z", "new", null]]);
    const base = on;
    on = (sql, p) => { if (/^insert into `social_hub_send_attempts`/.test(sql)) throw leaky("ER_DUP_ENTRY", 1062); return base(sql, p); };
    calls = [];
    await expect(store().claim(claimInput())).rejects.toBeInstanceOf(SocialHubStoreError);
    expect(kinds().slice(-1)).toEqual(["rollback"]);
  });
});

describe("reclaim, finishSent, finishUnsent", () => {
  it("reclaim: csak érvényes runTokennel, nyitott kísérleten; a firstTriedAt nem változik", async () => {
    expect(await store().reclaim("at-1", "rt-1", "rt-2", NOW)).toBe(true);
    const [set, where] = find(/^update `social_hub_send_attempts`/)[0].sql.split(" where ");
    expect(set).not.toMatch(/firstTriedAt|idempotencyKey|body/);
    expect(where).toMatch(/`id` = \?.*`runToken` = \?.*`status` in \(\?, \?\)/);
    expect(find(/^update/)[0].params.slice(-4)).toEqual(["at-1", "rt-1", "sending", "uncertain"]);
    on = () => ({ affectedRows: 0 });
    expect(await store().reclaim("at-1", "regi", "rt-3", NOW)).toBe(false);
  });

  it("finishSent: egy tranzakció, csak a saját attemptId-jú, még nem lezárt sorok; ismételve ugyanaz", async () => {
    on = (sql) => (/for update$/.test(sql) ? [[CLIENT]] : undefined);
    const sent = [{ postId: "a", socialHubPostId: "sh-a" }, { postId: "m", socialHubPostId: "sh-m" }];
    await store().finishSent("at-1", sent, NOW);
    expect(kinds()).toEqual(["begin", "select `socialHubClientId`", "update `social_hub_send_attempts`", "update `social_hub_post_deliveries`", "commit"]
      .map((k) => k.toLowerCase()));
    expect(calls.every((c) => c.conn === "tx")).toBe(true);
    const [update] = find(/^update `social_hub_post_deliveries`/);
    const [set, where] = update.sql.split(" where ");
    expect(set).toMatch(/`sentHash` = `social_hub_post_deliveries`\.`contentHash`/);
    expect(set).toMatch(/`socialHubPostId` = case/);
    expect(set).toMatch(/`sentAt` = \?/);
    expect(where).toMatch(/`socialHubClientId` = \?.*`postId` in \(\?, \?\).*`attemptId` = \?.*`status` <> \?/);
    expect(update.params.slice(-5)).toEqual([CLIENT, "a", "m", "at-1", "sent"]);
    expect(update.params).toEqual(expect.arrayContaining(["sh-a", "sh-m"]));
    // A runToken nem feltétel: a késve érkező siker is rögzül.
    expect(calls.some((c) => c.sql.includes("runToken"))).toBe(false);
    const first = calls.map((c) => [c.sql, c.params]);
    calls = [];
    await store().finishSent("at-1", sent, NOW);
    expect(calls.map((c) => [c.sql, c.params])).toEqual(first);
    on = () => undefined;
    await expect(store().finishSent("nincs", sent, NOW)).rejects.toBeInstanceOf(SocialHubStoreError);
  });

  it("finishUnsent: csak a saját runTokennel és attemptId-val, a sent sort nem írja; a hibaszöveg rövid", async () => {
    on = (sql) => (/for update$/.test(sql) ? [[CLIENT, ["a", "m"]]] : undefined);
    await store().finishUnsent("at-1", "rt-1", "uncertain", "x".repeat(400), NOW);
    expect(calls.every((c) => c.conn === "tx")).toBe(true);
    for (const c of [...find(/for update$/), ...find(/^update `social_hub_send_attempts`/)]) {
      expect(c.sql).toMatch(/`id` = \?.*`runToken` = \?.*`status` in \(\?, \?\)/);
      expect(c.params.slice(-4)).toEqual(["at-1", "rt-1", "sending", "uncertain"]);
    }
    expect(find(/^update `social_hub_send_attempts`/)[0].params).toContain("x".repeat(255));
    const [update] = find(/^update `social_hub_post_deliveries`/);
    expect(update.sql).toMatch(/where .*`attemptId` = \?.*`status` <> \?/);
    expect(update.params).toEqual(["uncertain", CLIENT, "a", "m", "at-1", "sent"]);
    calls = [];
    on = () => undefined; // más vette át, vagy már lezárult
    await store().finishUnsent("at-1", "regi", "failed", "hiba", NOW);
    expect(find(/^update/)).toHaveLength(0);
  });

  it("getDeliveries és getAttempts a szerződés mezőit adja; üres listára nincs lekérdezés", async () => {
    on = (sql) => (/social_hub_post_deliveries/.test(sql)
      ? [["row-a", "p-a", "a", CLIENT, "sent", "at-1", "h", "h", "sh-a", "2026-11-24 10:00:00"]]
      : [["at-1", "p-a", CLIENT, "bh", "ge:kulcs-1", "{}", ["a"], "uncertain", "rt-1", "2026-11-24 10:00:00", "2026-11-24 10:00:00", "hiba", "u-a", "2026-11-24 10:00:00"]]);
    expect(await store().getDeliveries(CLIENT, ["a"])).toEqual([
      { postId: "a", socialHubClientId: CLIENT, status: "sent", attemptId: "at-1", contentHash: "h", sentHash: "h", socialHubPostId: "sh-a", sentAt: NOW },
    ]);
    expect(await store().getAttempts(["at-1"])).toEqual([{
      id: "at-1", profileId: "p-a", socialHubClientId: CLIENT, baseUrlHash: "bh", idempotencyKey: "ge:kulcs-1", body: "{}", postIds: ["a"],
      status: "uncertain", runToken: "rt-1", firstTriedAt: NOW, lastTriedAt: NOW,
    }]);
    calls = [];
    expect([await store().getDeliveries(CLIENT, []), await store().getAttempts([])]).toEqual([[], []]);
    expect(calls).toHaveLength(0);
  });
});

// ─── A routeren át, élő tárolóval ────────────────────────────────────────────

describe("router az adatbázisos tárolóval", () => {
  const caller = (role = "user") => appRouter.createCaller({ appUser: { id: "u-a", role, profileId: "p-a" }, req: {}, res: {} } as any).socialHub;
  const account = { id: "00000000-0000-4000-8000-000000000010", platform: "linkedin", name: "LI", status: "CONNECTED" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  let http: { method: string; init: any }[];
  const sendInput = { profileId: "p-a", postIds: ["a"], targetId: "profile", expectedClientId: CLIENT };
  const posts = () => http.filter((c) => c.method === "POST");
  beforeEach(() => {
    http = [];
    h.posts = [{ id: "a", profileId: "p-a", title: "a", platform: "linkedin", content: "Szöveg a", hashtags: [], imageUrl: null, status: "approved", scheduledAt: NOW, pillar: null }];
    vi.stubEnv("SOCIAL_HUB_API_URL", "https://env.test/v1"); vi.stubEnv("SOCIAL_HUB_API_KEY", KEY);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      http.push({ method: init.method, init });
      return init.method === "GET" ? json({ data: [{ id: CLIENT, name: "VIBA SH", external_ref: "viba", accounts: [account] }] })
        : json({ data: [{ id: "sh-a" }] }, 201);
    }));
  });
  const workingDb = (sql: string) => (/for update$/.test(sql)
    ? (/social_hub_post_deliveries/.test(sql) ? [["row-a", "a", "new", null]] : [[CLIENT]]) : undefined);

  it("env-kapcsolattal is megy a küldés; a kulcs és a törzs a POST előtt tárolódott", async () => {
    on = workingDb;
    vi.mocked(fetch).mockImplementationOnce(async () => json({ data: [{ id: CLIENT, name: "VIBA SH", external_ref: "viba", accounts: [account] }] }));
    vi.mocked(fetch).mockImplementationOnce(async (_u: any, init: any) => {
      const [stored] = find(/^insert into `social_hub_send_attempts`/);
      expect(stored.params).toEqual(expect.arrayContaining([init.headers["Idempotency-Key"], init.body]));
      expect(calls[calls.length - 1].sql).toBe("commit");
      return json({ data: [{ id: "sh-a" }] }, 201);
    });
    const r = await caller().send(sendInput);
    expect(r.results).toMatchObject([{ postId: "a", outcome: "sent", socialHubPostId: "sh-a" }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("a végpontok a közös appRouteren élnek, amelyet a Vercel-belépő is használ", () => {
    const paths = Object.keys((appRouter as any)._def.procedures).filter((p) => p.startsWith("socialHub."));
    expect(paths.sort()).toEqual(["socialHub.available", "socialHub.connection.check", "socialHub.connection.disconnect", "socialHub.connection.get",
      "socialHub.connection.save", "socialHub.previewSend", "socialHub.repeat", "socialHub.send"]);
    expect(readFileSync("api/[...path].ts", "utf8")).toMatch(/router: appRouter/);
  });

  it("available: csak logikai érték; hiányzó kapcsolatnál hamis, olvashatatlannál igaz", async () => {
    expect(await caller().available()).toEqual({ available: true });
    vi.stubEnv("SOCIAL_HUB_API_KEY", "");
    expect(await caller().available()).toEqual({ available: false });
    expect(await caller("super_admin").connection.get()).toMatchObject({ available: true, source: "none" });
    h.db = null;
    expect(await caller().available()).toEqual({ available: true });
    vi.stubEnv("DATABASE_URL", "");
    expect(await caller().available()).toEqual({ available: false });
  });

  it("elérhetetlen adatbázis: nincs env-visszaesés, nincs HTTP", async () => {
    h.db = null;
    expect(await resolveSocialHubConfig()).toEqual({ status: "error" });
    await expect(caller().send(sendInput)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().previewSend({ profileId: "p-a", selection: { postId: "a" } })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().repeat({ profileId: "p-a", attemptId: "at-1" })).rejects.toThrow("most nem érhetők el");
    expect(await caller("super_admin").connection.check()).toMatchObject({ ok: false });
    expect(await syncSocialMetrics({ profileId: "p-a", externalRef: "viba", from: "2026-11-01", to: "2026-11-02" }, { replaceRows: vi.fn() })).toMatchObject({ status: "failed" });
    expect(http).toHaveLength(0);
  });

  it("hiányzó táblák: az env-kapcsolat és a metrika-szinkron él, a küldés érthető hiba, POST nélkül", async () => {
    on = () => { throw noTable(); };
    expect(await resolveSocialHubConfig()).toMatchObject({ status: "ok", source: "env" });
    const createClient = vi.fn(() => ({ listClients: async () => [], getClientMetricsRange: vi.fn() }));
    expect(await syncSocialMetrics({ profileId: "p-a", externalRef: "viba", from: "2026-11-01", to: "2026-11-02" }, { createClient: createClient as any, replaceRows: vi.fn() }))
      .toEqual({ status: "skipped", reason: "no_match" });
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ source: "env" }));
    expect(await caller("super_admin").connection.get()).toMatchObject({ available: true, source: "env" });
    for (const work of [() => caller().send(sendInput), () => caller().previewSend({ profileId: "p-a", selection: { month: "2026-11" } }),
      () => caller().repeat({ profileId: "p-a", attemptId: "at-1" })]) {
      await expect(work()).rejects.toThrow("A Social Hubba küldés még nem áll készen. Próbáld meg később.");
    }
    expect(posts()).toHaveLength(0);
  });

  it("tárolóhibánál sem a válasz, sem a napló nem tartalmaz SQL-t, paramétert, kulcsot vagy törzset", async () => {
    const boom = () => { throw leaky("ER_UNKNOWN_ERROR", 1105); };
    const failAt = (re: RegExp) => { on = (sql) => (re.test(sql) ? boom() : workingDb(sql)); };
    const answers: string[] = [];
    const record = async (work: () => Promise<unknown>) => {
      const value: any = await work().catch((e) => e);
      answers.push(value instanceof Error ? `${value.message}|${(value.cause as any)?.message}|${value.stack}|${(value.cause as any)?.cause}` : JSON.stringify(value));
      return value;
    };
    const admin = caller("super_admin").connection;
    // Kapcsolat: olvasás, mentés, ellenőrzés, bontás.
    on = boom;
    for (const work of [() => admin.get(), () => admin.save({ baseUrl: "https://93.184.216.34/v1", apiKey: KEY }), () => admin.check(), () => admin.disconnect()]) await record(work);
    // Előnézet és küldés: naplóolvasás, foglalás, lezárás hibája; ismétlés.
    failAt(/^select .*from `social_hub_post_deliveries`/);
    await record(() => caller().previewSend({ profileId: "p-a", selection: { postId: "a" } }));
    await record(() => caller().send(sendInput));
    failAt(/^insert into `social_hub_send_attempts`/);
    expect((await record(() => caller().send(sendInput))).results).toMatchObject([{ outcome: "not_started" }]);
    expect(posts()).toHaveLength(0);
    failAt(/social_hub_send_attempts`$|from `social_hub_send_attempts`/);
    await record(() => caller().repeat({ profileId: "p-a", attemptId: "at-1" }));
    expect((await record(() => caller().send(sendInput))).results).toMatchObject([{ outcome: "uncertain" }]);
    expect(posts()).toHaveLength(1);
    expect(answers.join("\n")).not.toMatch(/SZIVARGAS|insert into|Failed query|Szöveg a|TITKOS|enc:v1/);
  });
});
