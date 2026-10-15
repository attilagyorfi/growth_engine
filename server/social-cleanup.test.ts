/**
 * Social kapcsolatok takarítása — adatbázis és hálózat nélkül.
 * - Kikapcsoláskor (lecsatlakoztatás, csere) a kulcs is törlődik.
 * - Több Facebook-oldalnál a felhasználó választ; csak a kiválasztott mentődik,
 *   a függő választás a felhasználóhoz kötött, lejár és egyszer használható.
 * - Az egyszeri SQL-takarítás egyetlen, idempotens UPDATE.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const fake = vi.hoisted(() => ({ inserted: [] as any[], updateValues: [] as any[], conn: null as any }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (fake.conn ? [fake.conn] : []) }) }) }),
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
    update: () => ({ set: (v: any) => ({ where: async () => { fake.updateValues.push(v); } }) }),
  };
  return { ...actual, getDb: vi.fn(async () => db) };
});

import { savePendingPages, peekPendingPages, takePendingPages, resetPendingPages, saveMetaPageConnection, PENDING_TTL_MS } from "./metaPages";
import { DEACTIVATED_CONNECTION } from "./_core/socialConnectionState";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { parseStatements } from "../scripts/migrate-db.mjs";

const pages = [
  { id: "p1", name: "G2A Marketing", accessToken: "t1", instagramId: "ig1" },
  { id: "p2", name: "Ügyfél Kft.", accessToken: "t2" },
];

const caller = (userId = "user-a") => appRouter.createCaller({
  user: null,
  appUser: { id: userId, email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "pro", onboardingCompleted: true, profileId: "profile-a", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

beforeEach(() => {
  resetPendingPages();
  fake.inserted = [];
  fake.updateValues = [];
  fake.conn = null;
  vi.unstubAllGlobals();
});

describe("függő oldalválasztás (memória)", () => {
  it("csak a saját felhasználójának látszik, egyszer használható, lejár", () => {
    const now = 1_000_000;
    const id = savePendingPages({ profileId: "profile-a", userId: "user-a", pages }, now);
    expect(id.length).toBeGreaterThanOrEqual(20);
    expect(peekPendingPages(id, "user-b", now)).toBeNull();
    expect(peekPendingPages(id, "user-a", now)?.pages).toHaveLength(2);
    expect(takePendingPages(id, "user-a", now)).not.toBeNull();
    expect(peekPendingPages(id, "user-a", now)).toBeNull();

    const id2 = savePendingPages({ profileId: "profile-a", userId: "user-a", pages }, now);
    expect(peekPendingPages(id2, "user-a", now + PENDING_TTL_MS + 1)).toBeNull();
  });
});

describe("saveMetaPageConnection", () => {
  it("a régi FB/IG kulcsokat törli, az oldalt + Instagramot lejárat nélkül menti", async () => {
    const { getDb } = await import("./db");
    const f = vi.fn(async () => new Response(JSON.stringify({ username: "g2amarketingagency" }), { status: 200 }));
    const r = await saveMetaPageConnection((await getDb())!, "profile-a", pages[0], { fetch: f });
    expect(r).toEqual({ pageName: "G2A Marketing", instagramUsername: "g2amarketingagency" });
    expect(fake.updateValues).toEqual([DEACTIVATED_CONNECTION]);
    expect(fake.inserted).toEqual([
      expect.objectContaining({ platform: "facebook", platformUserId: "p1", tokenExpiresAt: null, isActive: true }),
      expect.objectContaining({ platform: "instagram", platformUserId: "ig1", platformUsername: "g2amarketingagency", tokenExpiresAt: null, isActive: true }),
    ]);
  });
});

describe("social router — oldalválasztás és lecsatlakoztatás", () => {
  it("a választható oldalak listája kulcsok nélkül jön vissza", async () => {
    const sel = savePendingPages({ profileId: "profile-a", userId: "user-a", pages });
    const r = await caller().social.facebookPendingPages({ selectionId: sel });
    expect(r.pages).toEqual([
      { id: "p1", name: "G2A Marketing", hasInstagram: true },
      { id: "p2", name: "Ügyfél Kft.", hasInstagram: false },
    ]);
    expect(JSON.stringify(r)).not.toMatch(/t1|t2/);
  });

  it("választás: csak a kiválasztott oldal mentődik, és a választás nem használható újra", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ username: "g2a" }), { status: 200 })));
    const sel = savePendingPages({ profileId: "profile-a", userId: "user-a", pages });
    await caller().social.chooseFacebookPage({ selectionId: sel, pageId: "p2" });
    expect(fake.inserted).toEqual([expect.objectContaining({ platform: "facebook", platformUserId: "p2", platformUsername: "Ügyfél Kft." })]);
    await expect(caller().social.chooseFacebookPage({ selectionId: sel, pageId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("más felhasználó nem fér hozzá a választáshoz", async () => {
    const sel = savePendingPages({ profileId: "profile-a", userId: "user-a", pages });
    await expect(caller("user-b").social.facebookPendingPages({ selectionId: sel })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller("user-b").social.chooseFacebookPage({ selectionId: sel, pageId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fake.inserted).toEqual([]);
  });

  it("lecsatlakoztatáskor a kulcs is törlődik", async () => {
    fake.conn = { id: "c1", profileId: "profile-a", platform: "facebook", isActive: true };
    await caller().social.disconnect({ connectionId: "c1" });
    expect(fake.updateValues).toEqual([DEACTIVATED_CONNECTION]);
  });
});

describe("egyszeri SQL-takarítás", () => {
  it("egyetlen UPDATE, csak inaktív sorokra", () => {
    const stmts = parseStatements(readFileSync("drizzle/0022_wipe_inactive_social_tokens.sql", "utf8"));
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toMatch(/UPDATE `social_connections` SET `accessToken` = '', `refreshToken` = NULL WHERE `isActive` = false/);
  });
});
