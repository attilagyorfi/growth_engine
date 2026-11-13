/**
 * G1 – Google OAuth (GA4 + Search Console): authorize URL, aláírt/egyszer használható
 * state, callback-elutasítások, code→token csere titkosított mentéssel, fail-closed.
 * Kizárólag mock HTTP-válaszokkal és memóriabeli tárral; valós Google-hívás nincs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DataConnection, InsertDataConnection } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { decryptToken } from "./_core/tokenCrypto";
import { createGoogleOAuthHandlers, type GoogleOAuthRouteDeps, type SessionUser } from "./reports/google/routes";
import { GOOGLE_NONCE_COOKIE, getGoogleOAuthConfig, isGoogleOAuthConfigured, signGoogleState, verifyGoogleState, GOOGLE_STATE_TTL_MS } from "./reports/google/oauth";
import type { DataConnectionStore } from "./reports/google/connections";

const SECRET = "TEST-CLIENT-SECRET-xyz";
const CODE = "4/0AX-AUTH-CODE-SECRET";
const T0 = Date.parse("2026-11-13T10:00:00Z");

function setGoogleEnv(on = true) {
  ENV.cookieSecret = "test-jwt-secret-min-32-characters-000000";
  ENV.googleOAuthClientId = on ? "test-client-id.apps.example" : "";
  ENV.googleOAuthClientSecret = on ? SECRET : "";
  ENV.googleOAuthRedirectUrl = on ? "https://app.example.test/api/oauth/google/callback" : "";
}

function memoryStore(initial: DataConnection[] = []) {
  const rows = initial.map((r) => ({ ...r }));
  const store: DataConnectionStore & { rows: DataConnection[]; writes: number } = {
    rows,
    writes: 0,
    async findByProfilePlatform(profileId, platform) { return rows.filter((r) => r.profileId === profileId && r.platform === platform); },
    async getById(id) { return rows.find((r) => r.id === id) ?? null; },
    async insert(values: InsertDataConnection) { store.writes++; rows.push({ brandId: null, lastSyncedAt: null, ...values } as DataConnection); },
    async update(id, patch) { store.writes++; Object.assign(rows.find((r) => r.id === id)!, patch); },
  };
  return store;
}

const USER_A: SessionUser = { id: "user-a", role: "user", profileId: "profile-a" };

function setup(opts: { user?: SessionUser | null; store?: ReturnType<typeof memoryStore>; tokenResponse?: Response } = {}) {
  const store = opts.store ?? memoryStore();
  let now = T0;
  const fetch = vi.fn(async () => opts.tokenResponse ?? new Response(JSON.stringify({
    access_token: "ya29.ACCESS-SECRET", refresh_token: "1//REFRESH-SECRET", expires_in: 3599,
    scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly", token_type: "Bearer",
  }), { status: 200 }));
  const deps: GoogleOAuthRouteDeps = {
    config: getGoogleOAuthConfig,
    getSessionUser: vi.fn(async () => (opts.user === undefined ? USER_A : opts.user)),
    assertOwnership: vi.fn(async (user, profileId) => {
      if (user.profileId !== profileId) throw new Error("FORBIDDEN");
    }),
    fetch,
    store,
    now: () => now,
    appOrigin: () => "https://app.example.test",
  };
  const h = createGoogleOAuthHandlers(deps);
  // Egyszerű „böngésző-sütitár”: a start beállítja a nonce-sütit, a callback elküldi és törli.
  const jar = new Map<string, string>();
  const cookieOptions: Array<Record<string, unknown>> = [];
  const call = async (handler: "start" | "callback", query: Record<string, string>, opts: { cookies?: boolean } = {}) => {
    const res: any = {
      redirectedTo: "", statusCode: 200, body: null, headersSent: false,
      redirect(url: string) { this.redirectedTo = url; },
      status(c: number) { this.statusCode = c; return this; },
      json(b: unknown) { this.body = b; return this; },
      cookie(name: string, value: string, o: Record<string, unknown>) { jar.set(name, value); cookieOptions.push(o); return this; },
      clearCookie(name: string) { jar.delete(name); return this; },
    };
    const cookie = opts.cookies === false ? "" : Array.from(jar.entries()).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("; ");
    await h[handler]({ query, headers: cookie ? { cookie } : {} } as any, res);
    return res;
  };
  const startState = async (profileId = "profile-a", platform = "ga4") => {
    const res = await call("start", { profileId, platform });
    return new URL(res.redirectedTo).searchParams.get("state")!;
  };
  return { deps, store, fetch, call, startState, jar, cookieOptions, advance: (ms: number) => { now += ms; } };
}

let logSpies: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  setGoogleEnv(true);
  logSpies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  // Egyetlen console-hívás sem kaphat token-, code- vagy secret-értéket.
  const logged = JSON.stringify(logSpies.flatMap((s) => s.mock.calls));
  for (const secret of [SECRET, CODE, "ya29.ACCESS-SECRET", "1//REFRESH-SECRET"]) expect(logged).not.toContain(secret);
  vi.restoreAllMocks();
});

describe("authorize URL és state", () => {
  it("offline access, prompt=consent, include_granted_scopes, a két csak olvasó scope, redirect_uri és aláírt state", async () => {
    const { call } = setup();
    const res = await call("start", { profileId: "profile-a", platform: "search_console" });
    const url = new URL(res.redirectedTo);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("include_granted_scopes")).toBe("true");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("scope")!.split(" ")).toEqual([
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/webmasters.readonly",
    ]);
    expect(p.get("redirect_uri")).toBe("https://app.example.test/api/oauth/google/callback");
    expect(res.redirectedTo).not.toContain(SECRET);
    const state = verifyGoogleState(p.get("state")!, T0);
    expect(state).toMatchObject({ userId: "user-a", profileId: "profile-a", platform: "search_console" });
    expect(state!.nonce.length).toBeGreaterThan(10);
    expect(state!.exp).toBe(T0 + GOOGLE_STATE_TTL_MS);
    expect(GOOGLE_STATE_TTL_MS).toBeLessThanOrEqual(10 * 60 * 1000);
  });

  it("indítás: jogosulatlan profil → 403, session nélkül → 401, Google-hívás nélkül", async () => {
    const a = setup();
    expect((await a.call("start", { profileId: "profile-b", platform: "ga4" })).statusCode).toBe(403);
    const b = setup({ user: null });
    expect((await b.call("start", { profileId: "profile-a", platform: "ga4" })).statusCode).toBe(401);
    expect((await b.call("start", { profileId: "profile-a", platform: "meta_ads" })).statusCode).toBe(400);
    expect(a.fetch).not.toHaveBeenCalled();
  });
});

describe("callback – elutasítások (nincs token-hívás, nincs írás)", () => {
  const expectRejected = (ctx: ReturnType<typeof setup>, res: any) => {
    expect(res.redirectedTo).toMatch(/^https:\/\/app\.example\.test\/riportok\?google=error/);
    expect(ctx.fetch).not.toHaveBeenCalled();
    expect(ctx.store.writes).toBe(0);
  };

  it("hamis aláírású state", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    const [body] = state.split(".");
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state: `${body}.AAAA${state.slice(-10)}` }));
    // saját kulccsal „aláírt”, de idegen titokkal készült state
    const forged = signGoogleState({ userId: "user-a", profileId: "profile-a", platform: "ga4", nonce: "n", exp: T0 + 1000 }, "masik-titok-masik-titok-masik-titok");
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state: forged }));
  });

  it("lejárt state", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    ctx.advance(GOOGLE_STATE_TTL_MS + 1);
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }));
  });

  it("már felhasznált state (egyszer használható nonce)", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    const first = await ctx.call("callback", { code: CODE, state });
    expect(first.redirectedTo).toContain("google=connected");
    ctx.fetch.mockClear();
    const writes = ctx.store.writes;
    const second = await ctx.call("callback", { code: CODE, state });
    expect(second.redirectedTo).toContain("google=error");
    expect(ctx.fetch).not.toHaveBeenCalled();
    expect(ctx.store.writes).toBe(writes);
  });

  it("nonce-süti nélkül (pl. másik böngésző) vagy eltérő sütivel", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }, { cookies: false }));
    const other = setup();
    const otherState = await other.startState();
    // ctx sütitára üres lett az előző callbacktől; egy másik indítás nonce-ával sem fogad el
    ctx.jar.set(GOOGLE_NONCE_COOKIE, verifyGoogleState(otherState, T0)!.nonce);
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }));
  });

  it("a nonce-süti httpOnly, Lax, csak a Google OAuth-útvonalon, a state élettartamáig", async () => {
    const ctx = setup();
    await ctx.startState();
    expect(ctx.cookieOptions[0]).toMatchObject({
      httpOnly: true, secure: true, sameSite: "lax", path: "/api/oauth/google", maxAge: GOOGLE_STATE_TTL_MS,
    });
  });

  it("más felhasználó sessionjével", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    vi.mocked(ctx.deps.getSessionUser).mockResolvedValueOnce({ id: "user-b", role: "user", profileId: "profile-a" });
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }));
  });

  it("jogosulatlan profilhoz tartozó state (pl. a jogosultság közben megszűnt)", async () => {
    const ctx = setup();
    const started = verifyGoogleState(await ctx.startState(), T0)!;
    const state = signGoogleState({ ...started, profileId: "profile-b" });
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }));
  });

  it("ha a session-ellenőrzés dob, nincs kezeletlen hiba: error-állapot, titok nélküli napló", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    vi.mocked(ctx.deps.getSessionUser).mockRejectedValue(new Error(`jwt hiba token=${CODE}`));
    expectRejected(ctx, await ctx.call("callback", { code: CODE, state }));
    const start = await ctx.call("start", { profileId: "profile-a", platform: "ga4" });
    expect(start.redirectedTo).toBe("https://app.example.test/riportok?google=error");
  });

  it("a felhasználó elutasította a hozzáférést → denied, részlet nélkül", async () => {
    const ctx = setup();
    const state = await ctx.startState();
    const res = await ctx.call("callback", { error: "access_denied", error_description: "The user denied", state });
    expect(res.redirectedTo).toBe("https://app.example.test/riportok?google=denied&platform=ga4");
    expect(ctx.fetch).not.toHaveBeenCalled();
  });

  it("a token-végpont hibája → error, a Google-hibatörzs nem kerül URL-be/naplóba", async () => {
    const ctx = setup({ tokenResponse: new Response(JSON.stringify({ error: "invalid_client", error_description: `bad ${SECRET}` }), { status: 401 }) });
    const state = await ctx.startState();
    const res = await ctx.call("callback", { code: CODE, state });
    expect(res.redirectedTo).toBe("https://app.example.test/riportok?google=error&platform=ga4");
    expect(ctx.store.writes).toBe(0);
  });
});

describe("callback – sikeres csatlakozás", () => {
  it("titkosított tokenek, tokenExpiry, scopes; kiválasztásra vár (pending, connected=false); URL-ben csak állapotjelző", async () => {
    const ctx = setup();
    const state = await ctx.startState("profile-a", "ga4");
    const res = await ctx.call("callback", { code: CODE, state });
    expect(res.redirectedTo).toBe("https://app.example.test/riportok?google=connected&platform=ga4");
    expect(res.redirectedTo).not.toMatch(/code=|token|4\/0AX/);

    const [form] = ctx.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(ctx.fetch.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String((ctx.fetch.mock.calls[0] as any)[1].body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe(CODE);
    expect(form).not.toContain(CODE);

    expect(ctx.store.rows).toHaveLength(1);
    const row = ctx.store.rows[0];
    expect(row).toMatchObject({ profileId: "profile-a", platform: "ga4", connected: false, externalAccountId: `pending:${row.id}` });
    expect(row.accessToken!.startsWith("enc:v1:")).toBe(true);
    expect(row.refreshToken!.startsWith("enc:v1:")).toBe(true);
    expect(row.accessToken).not.toContain("ya29");
    expect(decryptToken(row.accessToken)).toBe("ya29.ACCESS-SECRET");
    expect(decryptToken(row.refreshToken)).toBe("1//REFRESH-SECRET");
    expect(row.tokenExpiry).toEqual(new Date(T0 + 3599_000));
    expect(row.scopes).toEqual([
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/webmasters.readonly",
    ]);
  });

  it("újracsatlakozás ugyanarra a profilra és platformra: nincs duplikált sor, a brandId megmarad", async () => {
    const existing = {
      id: "conn-1", profileId: "profile-a", platform: "search_console", externalAccountId: "https://example.hu/",
      externalAccountName: "example.hu", brandId: "brand-nissan", accessToken: "enc:v1:old", refreshToken: "enc:v1:old",
      tokenExpiry: null, scopes: [], connected: false, lastSyncError: "A Google-hozzáférés megszűnt.",
    } as unknown as DataConnection;
    const ctx = setup({ store: memoryStore([existing]) });
    const state = await ctx.startState("profile-a", "search_console");
    await ctx.call("callback", { code: CODE, state });
    expect(ctx.store.rows).toHaveLength(1);
    expect(ctx.store.rows[0]).toMatchObject({ id: "conn-1", brandId: "brand-nissan", externalAccountId: "pending:conn-1", connected: false, lastSyncError: null });
    expect(decryptToken(ctx.store.rows[0].accessToken)).toBe("ya29.ACCESS-SECRET");
  });
});

describe("fail-closed: Google-env nélkül", () => {
  for (const missing of ["googleOAuthClientId", "googleOAuthClientSecret", "googleOAuthRedirectUrl"] as const) {
    it(`${missing} hiányában az indítás és a callback is hibát ad, Google-hívás nélkül`, async () => {
      const ctx = setup();
      const state = await ctx.startState();
      ENV[missing] = "";
      expect(isGoogleOAuthConfigured()).toBe(false);
      const start = await ctx.call("start", { profileId: "profile-a", platform: "ga4" });
      expect(start.redirectedTo).toBe("https://app.example.test/riportok?google=unavailable&platform=ga4");
      const cb = await ctx.call("callback", { code: CODE, state });
      expect(cb.redirectedTo).toBe("https://app.example.test/riportok?google=unavailable");
      expect(ctx.fetch).not.toHaveBeenCalled();
      expect(ctx.store.writes).toBe(0);
    });
  }
});
