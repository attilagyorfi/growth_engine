/**
 * G1 – Google Ads élő adatforrás: platformfüggő scope a meglévő Google OAuth-folyamatban,
 * fiókválasztás (listAccessibleCustomers), searchStream-adapter, újrapróbálás, csak-hibakódos
 * hibák, fail-closed. Kizárólag mock HTTP-válaszokkal; valós Google-hívás, fiók vagy token nincs.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import type { DataConnection, InsertDataConnection } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { encryptToken } from "./_core/tokenCrypto";
import { fetchMetrics } from "./reports/connectors";
import {
  GOOGLE_ADS_API_BASE,
  GOOGLE_ADS_API_VERSION,
  GoogleAdsApiError,
  buildGoogleAdsQuery,
  fetchGoogleAdsMetrics,
  getGoogleAdsConfig,
  googleAdsErrorCode,
  isGoogleAdsConfigured,
  listGoogleAdsCustomers,
  mapAccessibleCustomers,
  mapSearchStream,
  normalizeCustomerId,
  type GoogleAdsConfig,
} from "./reports/google/ads";
import { listGoogleAccounts } from "./reports/google/accounts";
import type { GoogleDeps } from "./reports/google/client";
import { GoogleSelectionError, saveGoogleTokens, selectGoogleAccount, type DataConnectionStore } from "./reports/google/connections";
import {
  GOOGLE_ADS_SCOPE,
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  getGoogleOAuthConfig,
  scopesFor,
  type GoogleOAuthConfig,
} from "./reports/google/oauth";
import { createGoogleOAuthHandlers, type GoogleOAuthRouteDeps } from "./reports/google/routes";
import { syncProfileMetrics, type SyncProfileDeps } from "./reports/syncProfile";

const NOW = new Date("2026-11-13T10:00:00Z");
const ACCESS = "ya29.ADS-ACCESS-TOKEN-SECRET";
const REFRESH = "1//ADS-REFRESH-TOKEN-SECRET";
const DEV_TOKEN = "DEV-TOKEN-SECRET-123";
const MARKER = "MARKER-ne-keruljon-naploba";
const ADS: GoogleAdsConfig = { developerToken: DEV_TOKEN, loginCustomerId: null };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function adsConn(patch: Partial<DataConnection> = {}): DataConnection {
  return {
    id: "c-ads", profileId: "p-1", platform: "google_ads",
    externalAccountId: "1234567890", externalAccountName: "123-456-7890", brandId: null,
    accessToken: encryptToken(ACCESS), refreshToken: encryptToken(REFRESH),
    tokenExpiry: new Date(NOW.getTime() + 30 * 60_000), scopes: [GOOGLE_ADS_SCOPE], connected: true,
    lastSyncedAt: null, lastSyncError: null, createdAt: NOW, updatedAt: NOW,
    ...patch,
  } as DataConnection;
}

function deps(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  const d: GoogleDeps & { calls: typeof calls } = {
    calls,
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (!next) throw new Error("váratlan hívás");
      return next;
    }),
    sleep: vi.fn(async () => {}),
    now: () => NOW,
    config: getGoogleOAuthConfig,
    saveAccessToken: vi.fn(async () => {}),
  };
  return d;
}

const headersOf = (init?: RequestInit) => (init?.headers ?? {}) as Record<string, string>;

const STREAM = [
  { results: [
    { segments: { date: "2026-11-01" }, customer: { currencyCode: "HUF" }, metrics: { costMicros: "12345670", impressions: "8000", clicks: "250", conversions: 5.5 } },
  ], fieldMask: "segments.date,customer.currencyCode,metrics.costMicros,metrics.impressions,metrics.clicks,metrics.conversions" },
  { results: [
    { segments: { date: "2026-11-02" }, customer: { currencyCode: "HUF" }, metrics: { costMicros: "1000000", impressions: "10", clicks: "1", conversions: 0 } },
  ] },
];

const adsFailure = (status: number, errorCode: Record<string, string>, grpcStatus = "PERMISSION_DENIED") => json(status, {
  error: {
    code: status, message: `${MARKER} ${ACCESS}`, status: grpcStatus,
    details: [{
      "@type": "type.googleapis.com/google.ads.googleads.v26.errors.GoogleAdsFailure",
      errors: [{ errorCode, message: `${MARKER} részletes hibaszöveg` }],
      requestId: "req-1",
    }],
  },
});

let logSpies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeAll(() => {
  // Biztosíték: a teszt egyetlen valós hálózati hívást sem indíthat.
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("valós hálózati hívás tiltva"); }));
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  ENV.cookieSecret = "test-jwt-secret-min-32-characters-000000";
  ENV.googleOAuthClientId = "test-client-id.apps.example";
  ENV.googleOAuthClientSecret = "TEST-CLIENT-SECRET-xyz";
  ENV.googleOAuthRedirectUrl = "https://app.example.test/api/oauth/google/callback";
  ENV.googleAdsDeveloperToken = "";
  ENV.googleAdsLoginCustomerId = "";
  logSpies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  const logged = JSON.stringify(logSpies.flatMap((s) => s.mock.calls));
  for (const secret of [ACCESS, REFRESH, DEV_TOKEN, MARKER, "TEST-CLIENT-SECRET-xyz"]) expect(logged).not.toContain(secret);
  logSpies.forEach((s) => s.mockRestore());
  ENV.googleAdsDeveloperToken = "";
  ENV.googleAdsLoginCustomerId = "";
});

// ─── Scope és OAuth-folyamat ────────────────────────────────────────────────

describe("platformfüggő scope a meglévő Google OAuth-ban", () => {
  const config: GoogleOAuthConfig = { clientId: "cid", clientSecret: "sec", redirectUrl: "https://app.example.test/cb" };
  const LEGACY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly";

  it("GA4 és Search Console: a scope paraméter bájtra a korábbi; Google Ads: csak adwords", () => {
    for (const platform of ["ga4", "search_console"] as const) {
      const url = buildGoogleAuthorizeUrl(config, "st", platform);
      expect(new URL(url).searchParams.get("scope")).toBe(LEGACY_SCOPE);
      expect(url).toContain(`scope=${encodeURIComponent(LEGACY_SCOPE).replace(/%20/g, "+")}&`);
    }
    const ads = new URL(buildGoogleAuthorizeUrl(config, "st", "google_ads")).searchParams;
    expect(ads.get("scope")).toBe("https://www.googleapis.com/auth/adwords");
    expect(ads.get("scope")).not.toMatch(/analytics|webmasters/);
    expect(ads.get("access_type")).toBe("offline");
    expect(ads.get("prompt")).toBe("consent");
  });

  it("a token-exchange scope-fallbackje platformfüggő", async () => {
    const noScope = () => vi.fn(async () => json(200, { access_token: "a", refresh_token: "r", expires_in: 3600 }));
    expect((await exchangeGoogleCode(config, "code", noScope(), "google_ads", NOW)).scopes).toEqual([GOOGLE_ADS_SCOPE]);
    expect((await exchangeGoogleCode(config, "code", noScope(), "ga4", NOW)).scopes).toEqual([...scopesFor("ga4")]);
    expect(scopesFor("search_console")).toEqual(scopesFor("ga4"));
  });

  function routeSetup(adsConfigured: boolean) {
    const rows: DataConnection[] = [];
    const store: DataConnectionStore = {
      async findByProfilePlatform(p, pl) { return rows.filter((r) => r.profileId === p && r.platform === pl); },
      async getById(id) { return rows.find((r) => r.id === id) ?? null; },
      async insert(v: InsertDataConnection) { rows.push({ brandId: null, lastSyncedAt: null, ...v } as DataConnection); },
      async update(id, patch) { Object.assign(rows.find((r) => r.id === id)!, patch); },
    };
    const fetch = vi.fn(async () => json(200, { access_token: ACCESS, refresh_token: REFRESH, expires_in: 3599, scope: GOOGLE_ADS_SCOPE }));
    const d: GoogleOAuthRouteDeps = {
      config: getGoogleOAuthConfig,
      getSessionUser: async () => ({ id: "user-a", role: "user", profileId: "p-1" }),
      assertOwnership: async (user, profileId) => { if (user.profileId !== profileId) throw new Error("FORBIDDEN"); },
      fetch, store, now: () => NOW.getTime(), appOrigin: () => "https://app.example.test",
      adsConfigured: () => adsConfigured,
    };
    const h = createGoogleOAuthHandlers(d);
    const jar = new Map<string, string>();
    const call = async (handler: "start" | "callback", query: Record<string, string>) => {
      const res: any = {
        redirectedTo: "", statusCode: 200, headersSent: false,
        redirect(url: string) { this.redirectedTo = url; },
        status(c: number) { this.statusCode = c; return this; },
        json() { return this; },
        cookie(name: string, value: string) { jar.set(name, value); return this; },
        clearCookie(name: string) { jar.delete(name); return this; },
      };
      const cookie = Array.from(jar.entries()).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
      await h[handler]({ query, headers: cookie ? { cookie } : {} } as any, res);
      return res;
    };
    return { rows, fetch, call, jar };
  }

  it("developer token nélkül a google_ads start nem indít OAuth-ot ('unavailable'), a GA4 igen", async () => {
    const ctx = routeSetup(false);
    const res = await ctx.call("start", { profileId: "p-1", platform: "google_ads" });
    expect(res.redirectedTo).toBe("https://app.example.test/riportok?google=unavailable&platform=google_ads");
    expect(ctx.jar.size).toBe(0);
    const ga4 = await ctx.call("start", { profileId: "p-1", platform: "ga4" });
    expect(ga4.redirectedTo).toMatch(/^https:\/\/accounts\.google\.com\//);
    expect(ctx.fetch).not.toHaveBeenCalled();
  });

  it("beállítva: ugyanaz a folyamat (aláírt state, nonce-süti) → pending google_ads-sor titkosított tokenekkel", async () => {
    const ctx = routeSetup(true);
    const start = await ctx.call("start", { profileId: "p-1", platform: "google_ads" });
    const params = new URL(start.redirectedTo).searchParams;
    expect(params.get("scope")).toBe(GOOGLE_ADS_SCOPE);
    expect(ctx.jar.size).toBe(1);
    const cb = await ctx.call("callback", { code: "4/CODE", state: params.get("state")! });
    expect(cb.redirectedTo).toBe("https://app.example.test/riportok?google=connected&platform=google_ads");
    expect(ctx.rows).toHaveLength(1);
    expect(ctx.rows[0]).toMatchObject({ platform: "google_ads", connected: false, scopes: [GOOGLE_ADS_SCOPE] });
    expect(ctx.rows[0].externalAccountId).toMatch(/^pending:/);
    expect(ctx.rows[0].accessToken).not.toContain(ACCESS);
  });

  it("isGoogleAdsConfigured: OAuth-env ÉS developer token is kell; érvénytelen MCC-id nem kerül a beállításba", () => {
    expect(isGoogleAdsConfigured()).toBe(false);
    expect(getGoogleAdsConfig()).toBeNull();
    ENV.googleAdsDeveloperToken = DEV_TOKEN;
    expect(isGoogleAdsConfigured()).toBe(true);
    ENV.googleAdsLoginCustomerId = "987-654-3210";
    expect(getGoogleAdsConfig()?.loginCustomerId).toBe("9876543210");
    ENV.googleAdsLoginCustomerId = "98765\r\nX-Evil: 1";
    expect(getGoogleAdsConfig()?.loginCustomerId).toBeNull();
    ENV.googleOAuthClientSecret = "";
    expect(isGoogleAdsConfigured()).toBe(false);
  });
});

// ─── Fiókválasztás ──────────────────────────────────────────────────────────

describe("fiókválasztás (listAccessibleCustomers)", () => {
  it("ügyfélazonosító normalizálása: csak a 10 számjegyes alakok", () => {
    expect(normalizeCustomerId("customers/1234567890")).toBe("1234567890");
    expect(normalizeCustomerId("123-456-7890")).toBe("1234567890");
    expect(normalizeCustomerId("customers/123-456-7890")).toBe("1234567890");
    for (const bad of ["123456789", "12345678901", "pending:c-ads", "customers/abc", "1-2-34567890", "", null, 1234567890]) {
      expect(normalizeCustomerId(bad)).toBeNull();
    }
  });

  it("a mock válaszból ('customers/…' és kötőjeles alak) választólista, duplikátum és hibás elem nélkül", async () => {
    expect(mapAccessibleCustomers({ resourceNames: ["customers/1234567890", "123-456-7890", "987-654-3210", "customers/12", 5] }))
      .toEqual([{ id: "1234567890", name: "123-456-7890" }, { id: "9876543210", name: "987-654-3210" }]);

    const d = deps([json(200, { resourceNames: ["customers/1234567890"] })]);
    ENV.googleAdsLoginCustomerId = "1112223333";
    ENV.googleAdsDeveloperToken = DEV_TOKEN;
    const list = await listGoogleAccounts(adsConn({ externalAccountId: "pending:c-ads", connected: false }), d);
    expect(list).toEqual([{ id: "1234567890", name: "123-456-7890" }]);
    expect(d.calls[0].url).toBe(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`);
    expect(d.calls[0].init?.method).toBe("GET");
    const h = headersOf(d.calls[0].init);
    expect(h.Authorization).toBe(`Bearer ${ACCESS}`);
    expect(h["developer-token"]).toBe(DEV_TOKEN);
    expect(h["login-customer-id"]).toBeUndefined();
  });

  it("developer token nélkül nincs Google-hívás (fail-closed)", async () => {
    const d = deps([]);
    await expect(listGoogleAdsCustomers(adsConn(), d, null)).rejects.toThrow(/nincs beállítva/);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  function store(rows: DataConnection[]) {
    const s: DataConnectionStore = {
      async findByProfilePlatform(p, pl) { return rows.filter((r) => r.profileId === p && r.platform === pl); },
      async getById(id) { return rows.find((r) => r.id === id) ?? null; },
      async insert(v) { rows.push(v as DataConnection); },
      async update(id, patch) { Object.assign(rows.find((r) => r.id === id)!, patch); },
    };
    return s;
  }

  it("kiválasztás: kötőjel nélkül tárolva; nem 10 számjegy / pending: elutasítva; más profil kapcsolata tiltott", async () => {
    const rows = [
      adsConn({ externalAccountId: "pending:c-ads", connected: false, externalAccountName: null }),
      adsConn({ id: "c-other", profileId: "p-2", externalAccountId: "pending:c-other", connected: false }),
    ];
    const s = store(rows);
    for (const bad of ["123456789", "pending:c-ads", "customers/12345678901", "properties/123"]) {
      await expect(selectGoogleAccount(s, { profileId: "p-1", connectionId: "c-ads", externalAccountId: bad }))
        .rejects.toMatchObject({ code: "BAD_REQUEST", message: "Válassz egy Google Ads-fiókot." });
    }
    expect(rows[0].connected).toBe(false);

    await expect(selectGoogleAccount(s, { profileId: "p-1", connectionId: "c-other", externalAccountId: "1234567890" }))
      .rejects.toBeInstanceOf(GoogleSelectionError);
    await expect(selectGoogleAccount(s, { profileId: "p-1", connectionId: "c-other", externalAccountId: "1234567890" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows[1].externalAccountId).toBe("pending:c-other");

    const res = await selectGoogleAccount(s, { profileId: "p-1", connectionId: "c-ads", externalAccountId: "123-456-7890" });
    expect(res.externalAccountId).toBe("1234567890");
    expect(rows[0]).toMatchObject({ externalAccountId: "1234567890", externalAccountName: "123-456-7890", connected: true });
  });

  it("újracsatlakozás ugyanazt a sort viszi vissza kiválasztásra (saveGoogleTokens újrahasznosítva)", async () => {
    const rows = [adsConn()];
    await saveGoogleTokens(store(rows), {
      profileId: "p-1", platform: "google_ads",
      tokens: { accessToken: ACCESS, refreshToken: null, expiresAt: NOW, scopes: [GOOGLE_ADS_SCOPE] },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalAccountId: "pending:c-ads", connected: false });
  });
});

// ─── searchStream ───────────────────────────────────────────────────────────

describe("searchStream-adapter", () => {
  it("POST …/{API_VERSION}/customers/{id}/googleAds:searchStream, developer-token + Bearer, GAQL a [from,to]-ra", async () => {
    const d = deps([json(200, STREAM)]);
    const rows = await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-02", d, ADS);
    expect(d.calls).toHaveLength(1);
    expect(d.calls[0].url).toBe(`${GOOGLE_ADS_API_BASE}/customers/1234567890/googleAds:searchStream`);
    expect(GOOGLE_ADS_API_BASE).toBe(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`);
    expect(d.calls[0].init?.method).toBe("POST");
    const h = headersOf(d.calls[0].init);
    expect(h.Authorization).toBe(`Bearer ${ACCESS}`);
    expect(h["developer-token"]).toBe(DEV_TOKEN);
    expect(h["login-customer-id"]).toBeUndefined();
    const { query } = JSON.parse(String(d.calls[0].init?.body));
    for (const field of ["segments.date", "metrics.cost_micros", "metrics.impressions", "metrics.clicks", "metrics.conversions"]) {
      expect(query).toContain(field);
    }
    expect(query).toContain("WHERE segments.date BETWEEN '2026-11-01' AND '2026-11-02'");
    expect(rows).toHaveLength(8);
  });

  it("login-customer-id: beállítva kötőjel nélkül megy, érvénytelen értéknél nem", async () => {
    const ok = deps([json(200, [])]);
    await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-01", ok, { developerToken: DEV_TOKEN, loginCustomerId: normalizeCustomerId("111-222-3333") });
    expect(headersOf(ok.calls[0].init)["login-customer-id"]).toBe("1112223333");

    const bad = deps([json(200, [])]);
    await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-01", bad, { developerToken: DEV_TOKEN, loginCustomerId: "111-222-3333" });
    expect(headersOf(bad.calls[0].init)["login-customer-id"]).toBeUndefined();
  });

  it("a dátumok YYYY-MM-DD-re validáltak (injekció ellen), az ügyfélazonosító 10 számjegy — különben nincs hívás", async () => {
    expect(() => buildGoogleAdsQuery("2026-11-01' OR 1=1 --", "2026-11-02")).toThrow(/érvénytelen dátum/);
    expect(() => buildGoogleAdsQuery("2026-11-01", "2026-13-45")).toThrow(/érvénytelen dátum/);
    const d = deps([]);
    await expect(fetchGoogleAdsMetrics(adsConn(), "20261101", "2026-11-02", d, ADS)).rejects.toThrow(/érvénytelen dátum/);
    await expect(fetchGoogleAdsMetrics(adsConn({ externalAccountId: "123-456-7890" }), "2026-11-01", "2026-11-02", d, ADS)).rejects.toThrow(/ügyfélazonosító/);
    await expect(fetchGoogleAdsMetrics(adsConn({ externalAccountId: "pending:c-ads" }), "2026-11-01", "2026-11-02", d, ADS)).rejects.toThrow(/ügyfélazonosító/);
    await expect(fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-02", d, null)).rejects.toThrow(/nincs beállítva/);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("több batch, string int64 mezők → napi NormalizedMetricRow-k; cost_micros '12345670' → spend 12.34567", () => {
    const rows = mapSearchStream(STREAM);
    const day1 = new Date("2026-11-01");
    expect(rows.slice(0, 4)).toEqual([
      { platform: "google_ads", date: day1, metricKey: "spend", value: 12.34567, currency: "HUF", dimension: null },
      { platform: "google_ads", date: day1, metricKey: "impressions", value: 8000, currency: null, dimension: null },
      { platform: "google_ads", date: day1, metricKey: "clicks", value: 250, currency: null, dimension: null },
      { platform: "google_ads", date: day1, metricKey: "conversions", value: 5.5, currency: null, dimension: null },
    ]);
    expect(rows[4]).toMatchObject({ date: new Date("2026-11-02"), metricKey: "spend", value: 1, currency: "HUF" });
    expect(typeof rows[5].value).toBe("number");
    expect(mapSearchStream([])).toEqual([]);
    expect(mapSearchStream([{ results: [{ segments: { date: "rossz" }, metrics: { costMicros: "1" } }] }])).toEqual([]);
  });

  it("élesítés csak LIVE_METRIC_PLATFORMS-szal: alapból mock, élőként a valós adapter fut", async () => {
    const conn = adsConn();
    const mock = await fetchMetrics(conn, "2026-11-01", "2026-11-01");
    expect(mock.map((r) => r.metricKey)).toEqual(["spend", "impressions", "clicks", "conversions"]);
    const d = deps([json(200, STREAM)]);
    const live = await fetchMetrics(conn, "2026-11-01", "2026-11-02", {
      live: new Set(["google_ads"]),
      adapters: { google_ads: (c, f, t) => fetchGoogleAdsMetrics(c, f, t, d, ADS) },
    });
    expect(live.find((r) => r.metricKey === "spend")?.value).toBe(12.34567);
  });
});

// ─── Újrapróbálás és hibák ──────────────────────────────────────────────────

describe("újrapróbálás és csak-hibakódos hibák", () => {
  it("429: legfeljebb 3 újrapróbálás (összesen 4 hívás) injektált várakozással, utána hiba", async () => {
    const d = deps([1, 2, 3, 4].map(() => adsFailure(429, { quotaError: "RESOURCE_EXHAUSTED" }, "RESOURCE_EXHAUSTED")));
    const err = await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-02", d, ADS).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleAdsApiError);
    expect(err.message).toBe("Google Ads-hiba: QUOTA_ERROR/RESOURCE_EXHAUSTED");
    expect(d.fetch).toHaveBeenCalledTimes(4);
    expect(d.sleep).toHaveBeenCalledTimes(3);
  });

  it("RESOURCE_EXHAUSTED (tömbbe csomagolt hibával is) → újrapróbál, majd sikeres", async () => {
    const d = deps([
      json(400, [{ error: { code: 400, status: "RESOURCE_EXHAUSTED", message: MARKER } }]),
      json(200, STREAM),
    ]);
    const rows = await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-02", d, ADS);
    expect(rows).toHaveLength(8);
    expect(d.fetch).toHaveBeenCalledTimes(2);
    expect(d.sleep).toHaveBeenCalledTimes(1);
  });

  it("más hibánál (403) nincs újrapróbálás; a hiba csak a hibakódot viszi", async () => {
    const d = deps([adsFailure(403, { authorizationError: "USER_PERMISSION_DENIED" })]);
    const err = await fetchGoogleAdsMetrics(adsConn(), "2026-11-01", "2026-11-02", d, ADS).catch((e) => e);
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.sleep).not.toHaveBeenCalled();
    expect(err.message).toBe("Google Ads-hiba: AUTHORIZATION_ERROR/USER_PERMISSION_DENIED");
    for (const secret of [MARKER, ACCESS, DEV_TOKEN]) expect(err.message + err.stack).not.toContain(secret);
  });

  it("hibakód-kinyerés: GoogleAdsFailure → kategória/kód, ennek híján gRPC-státusz, végül HTTP-státusz", () => {
    expect(googleAdsErrorCode({ error: { status: "INVALID_ARGUMENT", details: [{ errors: [{ errorCode: { queryError: "REQUESTED_METRICS_FOR_MANAGER" }, message: MARKER }] }] } }, 400))
      .toBe("QUERY_ERROR/REQUESTED_METRICS_FOR_MANAGER");
    expect(googleAdsErrorCode({ error: { status: "UNAUTHENTICATED", message: MARKER } }, 401)).toBe("UNAUTHENTICATED");
    expect(googleAdsErrorCode({ error: { status: `${MARKER} x`, message: MARKER } }, 400)).toBe("HTTP 400");
    expect(googleAdsErrorCode(null, 502)).toBe("HTTP 502");
    expect(googleAdsErrorCode({ error: { details: [{ errors: [{ errorCode: { authorizationError: `${MARKER} x` } }] }] } }, 403)).toBe("AUTHORIZATION_ERROR");
  });

  it("szinkron: a lastSyncError és a napló csak a hibakódot kapja (kezelői fiók: REQUESTED_METRICS_FOR_MANAGER), a többi platform fut", async () => {
    const google = deps([adsFailure(400, { queryError: "REQUESTED_METRICS_FOR_MANAGER" }, "INVALID_ARGUMENT")]);
    const marked: Array<[string, string | null]> = [];
    const replaced: string[] = [];
    const d: SyncProfileDeps = {
      listConnections: async () => [adsConn(), { id: "c-meta", profileId: "p-1", platform: "meta_ads", externalAccountId: "act", connected: true } as DataConnection],
      fetchMetrics: (conn, from, to) => fetchMetrics(conn, from, to, {
        live: new Set(["google_ads"]),
        adapters: { google_ads: (c, f, t) => fetchGoogleAdsMetrics(c, f, t, google, ADS) },
      }),
      replaceRows: async (_p, platform) => { replaced.push(platform); return { inserted: 1 }; },
      getProfile: async () => null,
      syncSocial: async () => ({ status: "skipped", reason: "not_configured" } as any),
      markDisconnected: vi.fn(async () => {}),
      markSyncError: async (id, msg) => { marked.push([id, msg]); },
    };
    const res = await syncProfileMetrics("p-1", "2026-11-01", "2026-11-02", undefined, d);
    expect(marked).toEqual([["c-ads", "Google Ads-hiba: QUERY_ERROR/REQUESTED_METRICS_FOR_MANAGER"]]);
    expect(d.markDisconnected).not.toHaveBeenCalled();
    expect(res.errors).toEqual([{ platform: "google_ads", name: "GoogleAdsApiError", message: "Google Ads-hiba: QUERY_ERROR/REQUESTED_METRICS_FOR_MANAGER" }]);
    expect(replaced).toEqual(["meta_ads"]);
    expect(JSON.stringify(res)).not.toContain(MARKER);
  });

  it("sikeres lekérés törli a korábbi hibakódot", async () => {
    const google = deps([json(200, STREAM)]);
    const marked: Array<[string, string | null]> = [];
    const d: SyncProfileDeps = {
      listConnections: async () => [adsConn({ lastSyncError: "Google Ads-hiba: HTTP 500" })],
      fetchMetrics: (c, f, t) => fetchGoogleAdsMetrics(c, f, t, google, ADS),
      replaceRows: async () => ({ inserted: 8 }),
      getProfile: async () => null,
      syncSocial: async () => ({ status: "skipped", reason: "not_configured" } as any),
      markSyncError: async (id, msg) => { marked.push([id, msg]); },
    };
    const res = await syncProfileMetrics("p-1", "2026-11-01", "2026-11-02", undefined, d);
    expect(res.errors).toEqual([]);
    expect(marked).toEqual([["c-ads", null]]);
  });
});
