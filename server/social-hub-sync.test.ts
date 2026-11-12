/**
 * G1 – reports.sync közösségi ága és a profil external_ref-je (router-szint).
 * A DB-réteg mockolt (memóriabeli report_metrics), a Social Hub fetch rögzített válaszokkal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = { profileId: string; platform: string; date: Date; metricKey: string; value: number; dimension?: unknown };
const store: Row[] = [];

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(),
    listDataConnections: vi.fn(async () => []),
    // A kapcsolat-platformok tranzakciós cseréje (platformonként), memóriában.
    replaceReportMetrics: vi.fn(async (profileId: string, platform: string, from: string, to: string, rows: Row[]) => {
      const lo = new Date(from).getTime();
      const hi = new Date(to).getTime();
      for (let i = store.length - 1; i >= 0; i--) {
        const r = store[i];
        if (r.profileId === profileId && r.platform === platform && r.date.getTime() >= lo && r.date.getTime() <= hi) store.splice(i, 1);
      }
      store.push(...rows.map((r) => ({ ...r, profileId })));
      return { inserted: rows.length };
    }),
    // A valódi helper tranzakciós „törlés [from,to]-ban, majd beszúrás” viselkedése, memóriában.
    replaceSocialReportMetrics: vi.fn(async (profileId: string, from: string, to: string, rows: Row[]) => {
      const lo = new Date(from).getTime();
      const hi = new Date(to).getTime();
      for (let i = store.length - 1; i >= 0; i--) {
        const r = store[i];
        if (r.profileId === profileId && ["facebook", "instagram", "linkedin"].includes(r.platform)
          && r.date.getTime() >= lo && r.date.getTime() <= hi) store.splice(i, 1);
      }
      store.push(...rows.map((r) => ({ ...r, profileId })));
      return { inserted: rows.length };
    }),
    setProfileExternalRef: vi.fn(async () => ({ ok: true })),
    getReportById: vi.fn(),
  };
});

import * as db from "./db";
import { appRouter } from "./routers";
import { fetchMetrics } from "./reports/connectors";
import { EXTERNAL_REF_TAKEN_MESSAGE } from "./socialHub/externalRef";
import { buildReportContent, SOCIAL_SECTION_TITLE } from "./reports/content";
import type { TrpcContext } from "./_core/context";

const API_KEY = "sh_live_SECRET-sync-key";

function caller(profileId = "profile-a") {
  const appUser = {
    id: "user-a", email: "a@example.com", name: "A", role: "user", subscriptionPlan: "free",
    onboardingCompleted: true, profileId, active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  } as NonNullable<TrpcContext["appUser"]>;
  return appRouter.createCaller({ appUser, req: {} as any, res: {} as any } as unknown as TrpcContext);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function socialHubFetch() {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/clients")) {
      return json({ data: [{ id: "c-9", name: "VIBA", external_ref: "viba-team", accounts: [] }] });
    }
    const from = u.searchParams.get("from")!;
    return json({
      client_id: "c-9", from, to: u.searchParams.get("to"), posts: [],
      accounts: [
        { social_account_id: "fb-1", provider: "meta:facebook", days: [
          { day: "2026-10-01", metrics: { followers: 1000, reach: 300 } },
          { day: "2026-10-02", metrics: { followers: 1010, reach: 200 } },
        ] },
        { social_account_id: "ig-1", provider: "meta:instagram", days: [{ day: "2026-10-02", metrics: { impressions: 50 } }] },
      ],
    });
  });
}

const profile = (externalRef: string | null) => ({ id: "profile-a", name: "VIBA", appUserId: "user-a", externalRef });
const conn = { id: "conn-1", profileId: "profile-a", platform: "google_ads" } as any;

beforeEach(() => {
  store.length = 0;
  vi.mocked(db.getProfileById).mockResolvedValue(profile("viba-team") as any);
  vi.mocked(db.listDataConnections).mockResolvedValue([]);
  vi.stubEnv("SOCIAL_HUB_API_URL", "https://hub.example.test/api/v1");
  vi.stubEnv("SOCIAL_HUB_API_KEY", API_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reports.sync – közösségi ág", () => {
  it("a Social Hub soraival tölti a report_metrics-et; kétszeri sync nem duplikál", async () => {
    const fetchMock = socialHubFetch();
    vi.stubGlobal("fetch", fetchMock);
    const input = { profileId: "profile-a", from: "2026-10-01", to: "2026-10-31" };

    const first = await caller().reports.sync(input);
    expect(first.social).toEqual({ status: "synced", inserted: 5, skippedAccounts: 0 });
    expect(store).toHaveLength(5);
    const second = await caller().reports.sync(input);
    expect(second.social).toMatchObject({ status: "synced", inserted: 5 });
    expect(store).toHaveLength(5);
    expect(new Set(store.map((r) => r.platform))).toEqual(new Set(["facebook", "instagram"]));
    expect(store.every((r) => (r.dimension as any)?.socialAccountId)).toBe(true);
    // Bearer fejléc, a kulcs nem az URL-ben
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it.each([
    ["SOCIAL_HUB_API_URL hiányzik", { url: "", ref: "viba-team" }, "not_configured"],
    ["SOCIAL_HUB_API_KEY hiányzik", { key: "", ref: "viba-team" }, "not_configured"],
    ["nincs external_ref", { ref: null }, "no_external_ref"],
  ] as const)("%s → nincs hálózati hívás, ok-kód, a mock-sorok változatlanok", async (_name, setup, reason) => {
    if ("url" in setup) vi.stubEnv("SOCIAL_HUB_API_URL", setup.url);
    if ("key" in setup) vi.stubEnv("SOCIAL_HUB_API_KEY", setup.key);
    vi.mocked(db.getProfileById).mockResolvedValue(profile(setup.ref) as any);
    vi.mocked(db.listDataConnections).mockResolvedValue([conn]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await caller().reports.sync({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-03" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.social).toEqual({ status: "skipped", reason });
    const expected = await fetchMetrics(conn, "2026-10-01", "2026-10-03");
    expect(res.inserted).toBe(expected.length);
    expect(vi.mocked(db.replaceReportMetrics)).toHaveBeenCalledWith("profile-a", "google_ads", "2026-10-01", "2026-10-03", expected);
    expect(store.every((r) => r.platform === "google_ads")).toBe(true);
  });

  it("Social Hub-hiba nem dobja el a mutációt: failed + rövid ok, a mock-ág eredménye megmarad", async () => {
    vi.mocked(db.listDataConnections).mockResolvedValue([conn]);
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {} }, 401)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await caller().reports.sync({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-02" });
    expect(res.social).toEqual({ status: "failed", reason: "error", message: "Social Hub /clients: HTTP 401" });
    expect(res.inserted).toBe((await fetchMetrics(conn, "2026-10-01", "2026-10-02")).length);
    const logged = errors.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain(API_KEY);
    expect(logged).not.toContain("hub.example.test");
  });

  it("csak mock-platformot kérve a közösségi ág kimarad (not_requested)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await caller().reports.sync({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-02", platforms: ["ga4"] });
    expect(res.social).toEqual({ status: "skipped", reason: "not_requested" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a szinkronizált sorokból a riport (summary → content) és az előnézet ugyanazt a szakaszt adja", async () => {
    vi.stubGlobal("fetch", socialHubFetch());
    await caller().reports.sync({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31" });
    const { buildSummary } = await import("./routers/reports");
    const summaryData = buildSummary(store as any);
    // A közösségi sorok nem kerülnek a fizetett KPI-k közé.
    expect(summaryData.kpis.find((k) => k.key === "impressions")?.value).toBe(0);
    expect(summaryData.byPlatform).toEqual([]);

    vi.mocked(db.getReportById).mockResolvedValue({ id: "r-1", summaryData } as any);
    const preview = await caller().reports.get({ profileId: "profile-a", reportId: "r-1" });
    const content = buildReportContent({ clientName: "VIBA", periodFrom: "2026-10-01", periodTo: "2026-10-31", summaryData, aiSummary: null, demo: false });
    expect(content.sections.find((s) => s.title === SOCIAL_SECTION_TITLE)).toEqual(preview!.socialSection);
    expect(preview!.socialSection.blocks).toEqual([
      { kind: "subheading", text: "Facebook" },
      { kind: "table", rows: [["Követők (az időszak végén)", "1010"], ["Elérés", "500"]] },
      { kind: "subheading", text: "Instagram" },
      { kind: "table", rows: [["Megjelenés", "50"]] },
    ]);
  });
});

describe("profiles.setExternalRef", () => {
  beforeEach(() => vi.mocked(db.setProfileExternalRef).mockClear());

  it("trimel és kisbetűsít; az üres érték NULL-ként mentődik", async () => {
    await caller().profiles.setExternalRef({ id: "profile-a", externalRef: "  VIBA-Team " });
    expect(db.setProfileExternalRef).toHaveBeenLastCalledWith("profile-a", "viba-team");
    for (const empty of ["", "   ", null]) {
      const res = await caller().profiles.setExternalRef({ id: "profile-a", externalRef: empty });
      expect(res).toEqual({ externalRef: null });
      expect(db.setProfileExternalRef).toHaveBeenLastCalledWith("profile-a", null);
    }
  });

  it("formátumhibánál magyar üzenet, mentés nélkül", async () => {
    for (const bad of ["viba team", "ügyfél", "a".repeat(65), "x/../y"]) {
      await expect(caller().profiles.setExternalRef({ id: "profile-a", externalRef: bad })).rejects.toThrow(/csak kisbetű, szám és kötőjel/);
    }
    expect(db.setProfileExternalRef).not.toHaveBeenCalled();
  });

  it("ütközésnél CONFLICT, általános tegező üzenet, ami nem fedi fel a másik profilt", async () => {
    vi.mocked(db.setProfileExternalRef).mockResolvedValueOnce({ ok: false, reason: "taken" });
    const err = await caller().profiles.setExternalRef({ id: "profile-a", externalRef: "mmi" }).catch((e) => e);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe(EXTERNAL_REF_TAKEN_MESSAGE);
    expect(err.message).not.toMatch(/profile-|mmi/);
  });

  it("idegen profilra nem menthető (ownership)", async () => {
    vi.mocked(db.getProfileById).mockResolvedValue({ id: "profile-b", appUserId: "user-b" } as any);
    await expect(caller().profiles.setExternalRef({ id: "profile-b", externalRef: "mmi" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.setProfileExternalRef).not.toHaveBeenCalled();
  });
});
