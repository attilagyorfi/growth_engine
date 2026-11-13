/**
 * G1 – reports.connections (tokenmentes lista, upsert-szabályok) és a Google
 * property/site kiválasztás tRPC-szinten. A DB memóriában, a Google-válaszok mockolva.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fake = vi.hoisted(() => ({ rows: [] as any[], writes: 0 }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(async (id: string) => ({ "profile-a": { id, appUserId: "user-a" }, "profile-b": { id, appUserId: "user-b" } } as any)[id]),
    listDataConnections: vi.fn(async (profileId: string) => fake.rows.filter((r) => r.profileId === profileId)),
    upsertDataConnection: vi.fn(async (input: any) => ({ ...actual.dataConnectionWriteValues(input, "new-id") })),
    markDataConnectionDisconnected: vi.fn(async () => {}),
    dataConnectionStore: {
      findByProfilePlatform: async (p: string, pl: string) => fake.rows.filter((r) => r.profileId === p && r.platform === pl),
      getById: async (id: string) => fake.rows.find((r) => r.id === id) ?? null,
      insert: async (v: any) => { fake.writes++; fake.rows.push(v); },
      update: async (id: string, patch: any) => { fake.writes++; Object.assign(fake.rows.find((r) => r.id === id), patch); },
    },
  };
});

import * as db from "./db";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import { encryptToken, decryptToken } from "./_core/tokenCrypto";
import type { TrpcContext } from "./_core/context";

const userA = { id: "user-a", role: "user", profileId: "profile-a" } as NonNullable<TrpcContext["appUser"]>;
const userB = { id: "user-b", role: "user", profileId: "profile-b" } as NonNullable<TrpcContext["appUser"]>;
const caller = (u = userA) => appRouter.createCaller({ appUser: u, req: {} as any, res: {} as any } as unknown as TrpcContext);

const FUTURE = new Date(Date.now() + 3600_000);
const pendingRow = (id: string, platform: "ga4" | "search_console", profileId = "profile-a") => ({
  id, profileId, platform, externalAccountId: `pending:${id}`, externalAccountName: null, brandId: "brand-1",
  accessToken: encryptToken("ya29.ACCESS-SECRET"), refreshToken: encryptToken("1//REFRESH-SECRET"),
  tokenExpiry: FUTURE, scopes: ["https://www.googleapis.com/auth/analytics.readonly"], connected: false,
  lastSyncedAt: null, lastSyncError: null, createdAt: new Date(), updatedAt: new Date(),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn();
beforeEach(() => {
  ENV.cookieSecret = "test-jwt-secret-min-32-characters-000000";
  ENV.googleOAuthClientId = "test-client-id";
  ENV.googleOAuthClientSecret = "TEST-CLIENT-SECRET-xyz";
  ENV.googleOAuthRedirectUrl = "https://app.example.test/api/oauth/google/callback";
  fake.rows = [pendingRow("c-ga4", "ga4"), pendingRow("c-gsc", "search_console"), pendingRow("c-b", "ga4", "profile-b")];
  fake.writes = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("reports.connections.list – tokenmentes, explicit mezőlista", () => {
  it("a válaszban nincs accessToken / refreshToken / client secret", async () => {
    const list = await caller().reports.connections.list({ profileId: "profile-a" });
    expect(list).toHaveLength(2);
    expect(Object.keys(list[0]).sort()).toEqual([
      "brandId", "connected", "externalAccountId", "externalAccountName", "id", "lastSyncError",
      "lastSyncedAt", "needsSelection", "platform", "scopes", "tokenExpiry",
    ]);
    const raw = JSON.stringify(list);
    for (const s of ["enc:v1:", "ya29", "REFRESH-SECRET", "TEST-CLIENT-SECRET-xyz", "accessToken", "refreshToken"]) expect(raw).not.toContain(s);
    expect(list[0].needsSelection).toBe(true);
  });
});

describe("reports.connections.upsert", () => {
  it("ga4 / search_console: klienstől érkező token nem fogadott el", async () => {
    for (const platform of ["ga4", "search_console"] as const) {
      await expect(caller().reports.connections.upsert({ profileId: "profile-a", platform, externalAccountId: "properties/1", accessToken: "plain" }))
        .rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(db.upsertDataConnection).not.toHaveBeenCalled();
  });

  it("más platformnál a token titkosítva íródik, és a válaszban sincs token", async () => {
    const res = await caller().reports.connections.upsert({ profileId: "profile-a", platform: "meta_ads", externalAccountId: "123", accessToken: "plain-access", refreshToken: "plain-refresh" });
    const written = db.dataConnectionWriteValues({ profileId: "p", platform: "meta_ads", externalAccountId: "1", accessToken: "plain-access", refreshToken: "plain-refresh" }, "x");
    expect(written.accessToken!.startsWith("enc:v1:")).toBe(true);
    expect(decryptToken(written.accessToken)).toBe("plain-access");
    expect(decryptToken(written.refreshToken)).toBe("plain-refresh");
    expect(JSON.stringify(res)).not.toMatch(/plain-|enc:v1:/);
  });
});

describe("reports.connections.google", () => {
  it("status: csak egy boolean flag, env-érték nélkül", async () => {
    ENV.googleAdsDeveloperToken = "";
    expect(await caller().reports.connections.google.status()).toEqual({ googleConfigured: true, googleAdsConfigured: false });
    ENV.googleAdsDeveloperToken = "DEV-TOKEN-SECRET";
    const on = await caller().reports.connections.google.status();
    expect(on).toEqual({ googleConfigured: true, googleAdsConfigured: true });
    expect(JSON.stringify(on)).not.toContain("DEV-TOKEN-SECRET");
    ENV.googleOAuthRedirectUrl = "";
    expect(await caller().reports.connections.google.status()).toEqual({ googleConfigured: false, googleAdsConfigured: false });
    ENV.googleAdsDeveloperToken = "";
  });

  it("accounts (GA4): a mockolt accountSummaries-válaszból", async () => {
    fetchMock.mockResolvedValueOnce(json({
      accountSummaries: [{ account: "accounts/1", displayName: "Ste-Ba", propertySummaries: [
        { property: "properties/123", displayName: "Webshop" }, { property: "properties/456", displayName: "Blog" },
      ] }],
    }));
    const res = await caller().reports.connections.google.accounts({ profileId: "profile-a", connectionId: "c-ga4" });
    expect(res.accounts).toEqual([{ id: "properties/123", name: "Ste-Ba / Webshop" }, { id: "properties/456", name: "Ste-Ba / Blog" }]);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/analyticsadmin\.googleapis\.com\/v1beta\/accountSummaries/);
  });

  it("accounts (Search Console): a mockolt sites.list-válaszból, ellenőrizetlen tulajdon nélkül", async () => {
    fetchMock.mockResolvedValueOnce(json({ siteEntry: [
      { siteUrl: "https://example.hu/", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:example.hu", permissionLevel: "siteFullUser" },
      { siteUrl: "https://idegen.hu/", permissionLevel: "siteUnverifiedUser" },
    ] }));
    const res = await caller().reports.connections.google.accounts({ profileId: "profile-a", connectionId: "c-gsc" });
    expect(res.accounts.map((a) => a.id)).toEqual(["https://example.hu/", "sc-domain:example.hu"]);
  });

  it("select: a meglévő sort frissíti id alapján (GA4: properties/<id>), connected=true, brandId marad", async () => {
    await caller().reports.connections.google.select({ profileId: "profile-a", connectionId: "c-ga4", externalAccountId: "properties/123", externalAccountName: "Webshop" });
    await caller().reports.connections.google.select({ profileId: "profile-a", connectionId: "c-gsc", externalAccountId: "https://example.hu/" });
    expect(fake.rows).toHaveLength(3);
    expect(fake.rows[0]).toMatchObject({ id: "c-ga4", externalAccountId: "properties/123", externalAccountName: "Webshop", connected: true, brandId: "brand-1" });
    expect(fake.rows[1]).toMatchObject({ id: "c-gsc", externalAccountId: "https://example.hu/", externalAccountName: "https://example.hu/", connected: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("select: érvénytelen formátum → BAD_REQUEST, nincs írás", async () => {
    await expect(caller().reports.connections.google.select({ profileId: "profile-a", connectionId: "c-ga4", externalAccountId: "UA-1234" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().reports.connections.google.select({ profileId: "profile-a", connectionId: "c-gsc", externalAccountId: "pending:c-gsc" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.writes).toBe(0);
  });

  it("más profil vagy más felhasználó → FORBIDDEN, nincs írás", async () => {
    // idegen profil
    await expect(caller().reports.connections.google.select({ profileId: "profile-b", connectionId: "c-b", externalAccountId: "properties/1" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    // saját profil, de idegen kapcsolat
    await expect(caller().reports.connections.google.select({ profileId: "profile-a", connectionId: "c-b", externalAccountId: "properties/1" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    // más felhasználó az A profil kapcsolatára
    await expect(caller(userB).reports.connections.google.select({ profileId: "profile-a", connectionId: "c-ga4", externalAccountId: "properties/1" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(userB).reports.connections.google.accounts({ profileId: "profile-a", connectionId: "c-ga4" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accounts: visszavont hozzáférés → a kapcsolat bontott állapotba kerül, érthető hiba", async () => {
    fake.rows[0].tokenExpiry = new Date(0);
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    await expect(caller().reports.connections.google.accounts({ profileId: "profile-a", connectionId: "c-ga4" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.markDataConnectionDisconnected).toHaveBeenCalledWith("c-ga4", expect.any(String));
  });
});
