/**
 * G1 – GA4 + Search Console élő adapterek, LIVE_METRIC_PLATFORMS env-kapcsoló,
 * tokenfrissítés/visszavonás a szinkronban — kizárólag rögzített/mock HTTP-válaszokkal.
 * Valós Google API-t, kulcsot vagy fiókot nem használ.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import type { DataConnection } from "../drizzle/schema";
import { ENV } from "./_core/env";

ENV.cookieSecret = "test-jwt-secret-min-32-characters-000000";
ENV.googleOAuthClientId = "test-client-id";
ENV.googleOAuthClientSecret = "TEST-CLIENT-SECRET-xyz";
ENV.googleOAuthRedirectUrl = "https://app.example.test/api/oauth/google/callback";

import { fetchMetrics, getMetricsSource, isDemoData, mockMetrics, parseLivePlatforms, LIVE_METRIC_PLATFORMS } from "./reports/connectors";
import { fetchGa4Metrics, mapGa4Report } from "./reports/connectors/ga4";
import { fetchSearchConsoleMetrics, mapSearchAnalytics } from "./reports/connectors/searchConsole";
import { googleRequest, withGoogleAuth, type GoogleDeps } from "./reports/google/client";
import { GoogleApiError, GoogleAuthRevokedError, getGoogleOAuthConfig } from "./reports/google/oauth";
import { encryptToken, decryptToken } from "./_core/tokenCrypto";
import { syncProfileMetrics, REVOKED_SYNC_ERROR, isSyncableConnection, type SyncProfileDeps } from "./reports/syncProfile";

const NOW = new Date("2026-11-13T10:00:00Z");
const ACCESS = "ya29.OLD-ACCESS-TOKEN";
const REFRESH = "1//REFRESH-TOKEN-SECRET";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function googleConn(platform: "ga4" | "search_console", patch: Partial<DataConnection> = {}): DataConnection {
  return {
    id: `c-${platform}`, profileId: "p-1", platform,
    externalAccountId: platform === "ga4" ? "properties/123456" : "https://example.hu/",
    externalAccountName: null, brandId: null,
    accessToken: encryptToken(ACCESS), refreshToken: encryptToken(REFRESH),
    tokenExpiry: new Date(NOW.getTime() + 30 * 60_000), scopes: [], connected: true,
    lastSyncedAt: null, lastSyncError: null, createdAt: NOW, updatedAt: NOW,
    ...patch,
  } as DataConnection;
}

function deps(responses: Array<Response | ((url: string, init?: RequestInit) => Response)>, extra: Partial<GoogleDeps> = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  const d: GoogleDeps & { calls: typeof calls } = {
    calls,
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (!next) throw new Error("váratlan hívás");
      return typeof next === "function" ? next(url, init) : next;
    }),
    sleep: vi.fn(async () => {}),
    now: () => NOW,
    config: getGoogleOAuthConfig,
    saveAccessToken: vi.fn(async () => {}),
    ...extra,
  };
  return d;
}

const GA4_REPORT = {
  dimensionHeaders: [{ name: "date" }],
  metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }, { name: "engagementRate" }],
  rows: [
    { dimensionValues: [{ value: "20261102" }], metricValues: [{ value: "410" }, { value: "350" }, { value: "7" }, { value: "0.6123" }] },
    { dimensionValues: [{ value: "20261101" }], metricValues: [{ value: "450" }, { value: "380" }, { value: "8" }, { value: "0.5" }] },
  ],
};
const GSC_REPORT = {
  rows: [
    { keys: ["2026-11-01"], clicks: 85, impressions: 2200, ctr: 0.0386, position: 12.4 },
    { keys: ["2026-11-02"], clicks: 90, impressions: 2100, ctr: 0.0428, position: 11.9 },
  ],
};

// A változtatás előtti mock-generátor szó szerinti másolata — ehhez mérjük a „bájtra ugyanazt”.
function legacyMock(conn: { id: string; platform: string }, from: string, to: string) {
  const config: Record<string, Array<{ key: string; base: number; variance: number; currency?: string }>> = {
    google_ads: [{ key: "spend", base: 15000, variance: 0.3, currency: "HUF" }, { key: "impressions", base: 8000, variance: 0.4 }, { key: "clicks", base: 250, variance: 0.35 }, { key: "conversions", base: 5, variance: 0.6 }],
    meta_ads: [{ key: "spend", base: 12000, variance: 0.4, currency: "HUF" }, { key: "impressions", base: 15000, variance: 0.45 }, { key: "clicks", base: 320, variance: 0.4 }, { key: "conversions", base: 4, variance: 0.7 }],
    ga4: [{ key: "sessions", base: 450, variance: 0.3 }, { key: "users", base: 380, variance: 0.3 }, { key: "conversions", base: 8, variance: 0.5 }, { key: "engagementRate", base: 0.62, variance: 0.15 }],
    search_console: [{ key: "impressions", base: 2200, variance: 0.35 }, { key: "clicks", base: 85, variance: 0.4 }, { key: "ctr", base: 0.038, variance: 0.2 }, { key: "position", base: 12.5, variance: 0.15 }],
  };
  const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const days: string[] = [];
  for (const cur = new Date(from); cur <= new Date(to); cur.setDate(cur.getDate() + 1)) days.push(cur.toISOString().slice(0, 10));
  const rows: any[] = [];
  for (const day of days) for (const m of config[conn.platform] ?? []) {
    let s = hash(`${conn.id}:${day}:${m.key}`);
    s = (s * 1664525 + 1013904223) >>> 0;
    const value = m.base * (1 + m.variance * (s / 0x100000000 - 0.5) * 2);
    const rounded = ["engagementRate", "ctr", "position"].includes(m.key) ? Math.round(value * 10000) / 10000 : Math.round(value);
    rows.push({ platform: conn.platform, date: new Date(day), metricKey: m.key, value: rounded, currency: m.currency ?? null, dimension: null });
  }
  return rows;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("LIVE_METRIC_PLATFORMS – env-kapcsoló", () => {
  it("parseLivePlatforms: ga4,search_console → {ga4, search_console}; szóköz/nagybetű kezelve, ismeretlen kimarad", () => {
    expect(parseLivePlatforms("ga4,search_console")).toEqual(new Set(["ga4", "search_console"]));
    const ignored: string[] = [];
    expect(parseLivePlatforms(" GA4 , Search_Console ,, tiktok", (v) => ignored.push(v))).toEqual(new Set(["ga4", "search_console"]));
    expect(ignored).toEqual(["tiktok"]);
    expect(parseLivePlatforms(undefined).size).toBe(0);
    expect(parseLivePlatforms("").size).toBe(0);
  });

  it("google_ads élesíthető; a meta_ads env-ben is kimarad (nincs adapter) → mintaadat + DEMO marad", () => {
    const ignored: string[] = [];
    expect(parseLivePlatforms("google_ads,meta_ads", (v) => ignored.push(v))).toEqual(new Set(["google_ads"]));
    expect(ignored).toEqual(["meta_ads"]);
    expect(parseLivePlatforms("ga4,search_console,google_ads")).toEqual(new Set(["ga4", "search_console", "google_ads"]));
  });

  it("env nélkül: üres halmaz, 'mock' forrás, és minden platformra bájtra a korábbi mintaadat", async () => {
    expect(LIVE_METRIC_PLATFORMS.size).toBe(0);
    expect(getMetricsSource()).toBe("mock");
    expect(isDemoData()).toBe(true);
    for (const platform of ["google_ads", "ga4", "search_console", "meta_ads"] as const) {
      const conn = { id: `x-${platform}`, platform } as DataConnection;
      const rows = await fetchMetrics(conn, "2026-10-30", "2026-11-02");
      expect(JSON.stringify(rows)).toBe(JSON.stringify(legacyMock(conn, "2026-10-30", "2026-11-02")));
      expect(mockMetrics(conn, "2026-10-30", "2026-11-02")).toEqual(rows);
    }
  });

  it("LIVE_METRIC_PLATFORMS=ga4,search_console → 'mixed', DEMO-jelölés marad", async () => {
    vi.stubEnv("LIVE_METRIC_PLATFORMS", "ga4,search_console");
    vi.resetModules();
    const mod = await import("./reports/connectors");
    expect(mod.LIVE_METRIC_PLATFORMS).toEqual(new Set(["ga4", "search_console"]));
    expect(mod.getMetricsSource()).toBe("mixed");
    expect(mod.isDemoData()).toBe(true);
  });

  it("LIVE_METRIC_PLATFORMS=meta_ads → figyelmeztetés, 'mock', és a meta_ads (és env nélkül a google_ads) mintaadatot ad", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("LIVE_METRIC_PLATFORMS", "meta_ads");
    vi.resetModules();
    const mod = await import("./reports/connectors");
    expect(mod.LIVE_METRIC_PLATFORMS.size).toBe(0);
    expect(mod.getMetricsSource()).toBe("mock");
    expect(warn).toHaveBeenCalledTimes(1);
    for (const platform of ["meta_ads", "google_ads"] as const) {
      const conn = { id: "g", platform } as DataConnection;
      expect(await mod.fetchMetrics(conn, "2026-11-01", "2026-11-01")).toEqual(legacyMock(conn, "2026-11-01", "2026-11-01"));
    }
  });

  it("élő ga4 / search_console: a valós adapter fut (mock fetch-csel), nem a mock", async () => {
    const d = deps([json(200, GA4_REPORT), json(200, GSC_REPORT)]);
    const live = new Set(["ga4", "search_console"]);
    const adapters = {
      ga4: (c: DataConnection, f: string, t: string) => fetchGa4Metrics(c, f, t, d),
      search_console: (c: DataConnection, f: string, t: string) => fetchSearchConsoleMetrics(c, f, t, d),
    };
    const ga4 = await fetchMetrics(googleConn("ga4"), "2026-11-01", "2026-11-02", { live, adapters });
    const gsc = await fetchMetrics(googleConn("search_console"), "2026-11-01", "2026-11-02", { live, adapters });
    expect(ga4.find((r) => r.metricKey === "sessions")?.value).toBe(450);
    expect(gsc.find((r) => r.metricKey === "clicks")?.value).toBe(85);
    expect(d.calls.map((c) => c.url)).toEqual([
      "https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport",
      "https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.hu%2F/searchAnalytics/query",
    ]);
    expect(getMetricsSource(live)).toBe("mixed");
  });

  it("adapter nélküli élő platform (meta_ads) hangos hibát dob, nem ad csendben mintaadatot", async () => {
    await expect(fetchMetrics({ id: "m", platform: "meta_ads" } as DataConnection, "2026-11-01", "2026-11-01", { live: new Set(["meta_ads"]) }))
      .rejects.toThrow(/not implemented/);
  });
});

describe("GA4 runReport leképezés", () => {
  it("napi sorok sessions/users/conversions/engagementRate kulccsal, UTC dátummal, tört engagementRate-tel", () => {
    const rows = mapGa4Report(GA4_REPORT);
    expect(rows.slice(0, 4)).toEqual([
      { platform: "ga4", date: new Date("2026-11-01"), metricKey: "sessions", value: 450, currency: null, dimension: null },
      { platform: "ga4", date: new Date("2026-11-01"), metricKey: "users", value: 380, currency: null, dimension: null },
      { platform: "ga4", date: new Date("2026-11-01"), metricKey: "conversions", value: 8, currency: null, dimension: null },
      { platform: "ga4", date: new Date("2026-11-01"), metricKey: "engagementRate", value: 0.5, currency: null, dimension: null },
    ]);
    expect(rows[0].date.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(rows.find((r) => r.metricKey === "engagementRate" && r.date.getTime() === new Date("2026-11-02").getTime())?.value).toBe(0.6123);
    expect(rows).toHaveLength(8);
  });

  it("a metricKey-ek megegyeznek a mintaadat (METRIC_CONFIG) kulcsaival", () => {
    const mockKeys = new Set(mockMetrics({ id: "x", platform: "ga4" }, "2026-11-01", "2026-11-01").map((r) => r.metricKey));
    expect(new Set(mapGa4Report(GA4_REPORT).map((r) => r.metricKey))).toEqual(mockKeys);
    const gscKeys = new Set(mockMetrics({ id: "x", platform: "search_console" }, "2026-11-01", "2026-11-01").map((r) => r.metricKey));
    expect(new Set(mapSearchAnalytics(GSC_REPORT).map((r) => r.metricKey))).toEqual(gscKeys);
  });

  it("adat nélküli napra nem gyárt sort", () => {
    expect(mapGa4Report({ metricHeaders: GA4_REPORT.metricHeaders, rows: [] })).toEqual([]);
    expect(mapGa4Report({})).toEqual([]);
  });

  it("keyEvents híján (400) a conversions metrikára vált", async () => {
    const fallback = {
      ...GA4_REPORT,
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }, { name: "engagementRate" }],
    };
    const d = deps([json(400, { error: { status: "INVALID_ARGUMENT" } }), json(200, fallback)]);
    const rows = await fetchGa4Metrics(googleConn("ga4"), "2026-11-01", "2026-11-02", d);
    expect(JSON.parse(String(d.calls[0].init?.body)).metrics.map((m: any) => m.name)).toContain("keyEvents");
    expect(JSON.parse(String(d.calls[1].init?.body)).metrics.map((m: any) => m.name)).toContain("conversions");
    expect(rows.filter((r) => r.metricKey === "conversions").map((r) => r.value)).toEqual([8, 7]);
    expect(d.sleep).not.toHaveBeenCalled();
  });

  it("a runReport kérés: date dimenzió, időszak, Bearer token a fejlécben (nem az URL-ben)", async () => {
    const d = deps([json(200, GA4_REPORT)]);
    await fetchGa4Metrics(googleConn("ga4"), "2026-11-01", "2026-11-02", d);
    const body = JSON.parse(String(d.calls[0].init?.body));
    expect(body.dimensions).toEqual([{ name: "date" }]);
    expect(body.dateRanges).toEqual([{ startDate: "2026-11-01", endDate: "2026-11-02" }]);
    expect((d.calls[0].init?.headers as any).Authorization).toBe(`Bearer ${ACCESS}`);
    expect(d.calls[0].url).not.toContain(ACCESS);
  });
});

describe("Search Console searchAnalytics.query leképezés", () => {
  it("impressions, clicks, ctr (tört), position napi sorok", () => {
    const rows = mapSearchAnalytics(GSC_REPORT);
    expect(rows.slice(0, 4).map((r) => [r.metricKey, r.value])).toEqual([["impressions", 2200], ["clicks", 85], ["ctr", 0.0386], ["position", 12.4]]);
    expect(rows[0].date).toEqual(new Date("2026-11-01"));
    expect(rows.every((r) => r.platform === "search_console")).toBe(true);
  });

  it("dimensions=[date] a kérésben", async () => {
    const d = deps([json(200, GSC_REPORT)]);
    await fetchSearchConsoleMetrics(googleConn("search_console"), "2026-11-01", "2026-11-02", d);
    expect(JSON.parse(String(d.calls[0].init?.body))).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-02", dimensions: ["date"] });
  });
});

describe("Újrapróbálás (429 / RESOURCE_EXHAUSTED / 5xx)", () => {
  const req = (d: GoogleDeps) => googleRequest("GA4 runReport", "https://analyticsdata.googleapis.com/x", { method: "POST", accessToken: ACCESS, body: {} }, d);

  it("429 után injektált sleep-pel újrapróbál, majd sikerül", async () => {
    const d = deps([json(429, {}), json(200, { ok: 1 })]);
    await expect(req(d)).resolves.toEqual({ ok: 1 });
    expect(d.sleep).toHaveBeenCalledTimes(1);
  });

  it("RESOURCE_EXHAUSTED (nem 429-es státusszal is) újrapróbálható", async () => {
    const d = deps([json(403, { error: { status: "RESOURCE_EXHAUSTED" } }), json(200, { ok: 1 })]);
    await expect(req(d)).resolves.toEqual({ ok: 1 });
  });

  it("tartós 5xx: legfeljebb 3 újrapróbálás, utána érthető, titokmentes hiba", async () => {
    const d = deps([json(503, {}), json(503, {}), json(503, {}), json(503, { error: { message: `token ${ACCESS}` } })]);
    const err = await req(d).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.message).toMatch(/HTTP 503/);
    expect(err.message).not.toContain(ACCESS);
    expect(d.fetch).toHaveBeenCalledTimes(4);
    expect(d.sleep).toHaveBeenCalledTimes(3);
  });

  it("a beállított maxRetries-t tartja", async () => {
    const d = deps([json(500, {}), json(500, {})], { maxRetries: 1 });
    await expect(req(d)).rejects.toBeInstanceOf(GoogleApiError);
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it("más 4xx (pl. 403, 404) után nincs újrapróbálás", async () => {
    for (const status of [403, 404]) {
      const d = deps([json(status, { error: { status: "PERMISSION_DENIED" } })]);
      await expect(req(d)).rejects.toThrow(`HTTP ${status}`);
      expect(d.fetch).toHaveBeenCalledTimes(1);
      expect(d.sleep).not.toHaveBeenCalled();
    }
  });
});

describe("Tokenfrissítés és visszavonás", () => {
  const refreshed = () => json(200, { access_token: "ya29.NEW-ACCESS", expires_in: 3599, scope: "a b", token_type: "Bearer" });

  it("lejárt (vagy 60 mp-en belül lejáró) tokennél előbb frissít, és titkosítva visszaírja az új tokent + lejáratot", async () => {
    for (const expiry of [new Date(NOW.getTime() - 1000), new Date(NOW.getTime() + 30_000), null]) {
      const d = deps([refreshed(), json(200, GA4_REPORT)]);
      await fetchGa4Metrics(googleConn("ga4", { tokenExpiry: expiry }), "2026-11-01", "2026-11-02", d);
      expect(d.calls[0].url).toBe("https://oauth2.googleapis.com/token");
      const form = new URLSearchParams(String(d.calls[0].init?.body));
      expect(form.get("grant_type")).toBe("refresh_token");
      expect(form.get("refresh_token")).toBe(REFRESH);
      expect((d.calls[1].init?.headers as any).Authorization).toBe("Bearer ya29.NEW-ACCESS");
      const [id, enc, exp] = vi.mocked(d.saveAccessToken).mock.calls[0];
      expect(id).toBe("c-ga4");
      expect(enc.startsWith("enc:v1:")).toBe(true);
      expect(decryptToken(enc)).toBe("ya29.NEW-ACCESS");
      expect(exp).toEqual(new Date(NOW.getTime() + 3599_000));
    }
  });

  it("érvényes tokennél nem frissít", async () => {
    const d = deps([json(200, GA4_REPORT)]);
    await fetchGa4Metrics(googleConn("ga4"), "2026-11-01", "2026-11-02", d);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.saveAccessToken).not.toHaveBeenCalled();
  });

  it("401 → egyszeri frissítés és újrapróbálás", async () => {
    const d = deps([json(401, {}), refreshed(), json(200, GSC_REPORT)]);
    const rows = await fetchSearchConsoleMetrics(googleConn("search_console"), "2026-11-01", "2026-11-02", d);
    expect(rows).toHaveLength(8);
    expect(d.saveAccessToken).toHaveBeenCalledTimes(1);
  });

  it("frissítés utáni 401 → GoogleAuthRevokedError", async () => {
    const d = deps([json(401, {}), refreshed(), json(401, {})]);
    await expect(withGoogleAuth(googleConn("ga4"), d, (t) => googleRequest("x", "https://x.test", { method: "GET", accessToken: t }, d)))
      .rejects.toBeInstanceOf(GoogleAuthRevokedError);
  });

  it("invalid_grant → GoogleAuthRevokedError", async () => {
    const d = deps([json(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." })]);
    await expect(fetchGa4Metrics(googleConn("ga4", { tokenExpiry: null }), "2026-11-01", "2026-11-02", d))
      .rejects.toBeInstanceOf(GoogleAuthRevokedError);
  });

  it("Google-env nélkül nem hív semmit (fail-closed)", async () => {
    const d = deps([], { config: () => null });
    await expect(fetchGa4Metrics(googleConn("ga4"), "2026-11-01", "2026-11-02", d)).rejects.toThrow(/nincs beállítva/);
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe("Szinkron: visszavont és kiválasztásra váró kapcsolat", () => {
  function syncDeps(conns: DataConnection[], google: GoogleDeps) {
    const replaced: string[] = [];
    const d: SyncProfileDeps = {
      listConnections: vi.fn(async () => conns),
      fetchMetrics: vi.fn((conn, from, to) => fetchMetrics(conn, from, to, {
        live: new Set(["ga4", "search_console"]),
        adapters: {
          ga4: (c, f, t) => fetchGa4Metrics(c, f, t, google),
          search_console: (c, f, t) => fetchSearchConsoleMetrics(c, f, t, google),
        },
      })),
      replaceRows: vi.fn(async (_p, platform, _f, _t, rows) => { replaced.push(platform); return { inserted: rows.length }; }),
      getProfile: vi.fn(async () => ({ externalRef: null })),
      syncSocial: vi.fn(async () => ({ status: "skipped", reason: "not_configured" }) as any),
      markDisconnected: vi.fn(async () => {}),
    };
    return { d, replaced };
  }

  it("invalid_grant: connected=false + rövid lastSyncError, nem dob, a többi forrás megy tovább; titok nem kerül naplóba", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const google = deps([
      // ga4 (lejárt token) → frissítés → invalid_grant; utána a GSC rendben
      json(400, { error: "invalid_grant", error_description: `revoked ${REFRESH}` }),
      json(200, GSC_REPORT),
    ]);
    const { d, replaced } = syncDeps([
      googleConn("ga4", { tokenExpiry: new Date(NOW.getTime() - 1) }),
      googleConn("search_console"),
      { id: "c-ads", profileId: "p-1", platform: "google_ads", externalAccountId: "acc", connected: true } as DataConnection,
    ], google);
    const res = await syncProfileMetrics("p-1", "2026-11-01", "2026-11-02", undefined, d);
    expect(d.markDisconnected).toHaveBeenCalledWith("c-ga4", REVOKED_SYNC_ERROR);
    expect(REVOKED_SYNC_ERROR.length).toBeLessThan(120);
    expect(res.errors).toEqual([expect.objectContaining({ platform: "ga4", name: "GoogleAuthRevokedError" })]);
    expect(replaced).toEqual(["search_console", "google_ads"]);
    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    for (const secret of [REFRESH, ACCESS, "TEST-CLIENT-SECRET-xyz"]) expect(logged).not.toContain(secret);
  });

  it("a connected=false és a kiválasztásra váró (pending:) kapcsolat kimarad", async () => {
    const google = deps([]);
    const { d } = syncDeps([
      googleConn("ga4", { connected: false }),
      googleConn("search_console", { externalAccountId: "pending:c-search_console", connected: false }),
      googleConn("search_console", { id: "c-x", externalAccountId: "pending:c-x" }),
    ], google);
    const res = await syncProfileMetrics("p-1", "2026-11-01", "2026-11-02", ["ga4", "search_console"], d);
    expect(d.fetchMetrics).not.toHaveBeenCalled();
    expect(google.fetch).not.toHaveBeenCalled();
    expect(res.platforms).toEqual([]);
    expect(isSyncableConnection({ connected: true, externalAccountId: "properties/1" })).toBe(true);
  });
});

beforeAll(() => {
  // Biztosíték: a teszt egyetlen valós hálózati hívást sem indíthat.
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("valós hálózati hívás tiltva"); }));
});
