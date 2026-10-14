/**
 * Facebook/Instagram OAuth visszatérés — hálózat és adatbázis nélkül.
 * - Graph API v26.0 (a v18.0 2026-01-26-án megszűnt),
 * - a long-lived token csere KÖTELEZŐ (különben 1 órás tokenek kerülnének mentésre),
 * - a Page-/IG-kapcsolat lejárat NÉLKÜL mentődik (a Page-token nem jár le).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fake = vi.hoisted(() => ({ inserted: [] as any[], updated: 0 }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const db = {
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
    update: () => ({ set: () => ({ where: async () => { fake.updated++; } }) }),
  };
  return { ...actual, getDb: vi.fn(async () => db) };
});
vi.mock("./authDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authDb")>();
  return { ...actual, getAppUserById: vi.fn(async () => ({ id: "user-a", role: "user", profileId: "profile-a" })) };
});

import { registerFacebookOAuthRoutes, signState } from "./facebookOAuth";
import { ENV } from "./_core/env";

type Handler = (req: any, res: any) => Promise<void>;
function routes() {
  const map = new Map<string, Handler>();
  registerFacebookOAuthRoutes({ get: (path: string, h: Handler) => map.set(path, h) } as any);
  return map;
}
async function callback(query: Record<string, string>) {
  const res: any = { redirectedTo: "", redirect(url: string) { this.redirectedTo = url; } };
  await routes().get("/api/oauth/facebook/callback")!({ query, headers: {} }, res);
  return res.redirectedTo as string;
}

const original = { id: ENV.facebookAppId, secret: ENV.facebookAppSecret };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fake.inserted = [];
  fake.updated = 0;
  ENV.facebookAppId = "app-id";
  ENV.facebookAppSecret = "app-secret";
});
afterEach(() => {
  ENV.facebookAppId = original.id;
  ENV.facebookAppSecret = original.secret;
  vi.unstubAllGlobals();
});

function stubFetch(handlers: Array<[RegExp, () => Response]>) {
  fetchMock = vi.fn(async (url: string) => {
    for (const [re, make] of handlers) if (re.test(url)) return make();
    throw new Error(`váratlan URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Facebook OAuth callback", () => {
  const state = () => signState({ profileId: "profile-a", userId: "user-a" });

  it("sikeres út: v26.0, Page + IG kapcsolat lejárat nélkül", async () => {
    stubFetch([
      [/oauth\/access_token\?.*code=/, () => json({ access_token: "short" })],
      [/oauth\/access_token\?.*fb_exchange_token=/, () => json({ access_token: "long", expires_in: 5184000 })],
      [/\/me\/accounts/, () => json({ data: [{ id: "page1", name: "G2A Marketing", access_token: "page-token", instagram_business_account: { id: "ig1" } }] })],
      [/\/ig1\?/, () => json({ username: "g2amarketing" })],
    ]);
    const to = await callback({ code: "c", state: state() });
    expect(to).toMatch(/\/beallitasok\?facebook=connected&pages=1&instagram=1$/);
    expect(fetchMock.mock.calls.every(([u]) => String(u).startsWith("https://graph.facebook.com/v26.0/"))).toBe(true);
    expect(fake.inserted).toEqual([
      expect.objectContaining({ platform: "facebook", platformUserId: "page1", platformUsername: "G2A Marketing", tokenExpiresAt: null, isActive: true }),
      expect.objectContaining({ platform: "instagram", platformUserId: "ig1", platformUsername: "g2amarketing", tokenExpiresAt: null, isActive: true }),
    ]);
  });

  it("ha a long-lived csere elbukik, hibát ad és SEMMIT nem ment (nincs 1 órás token)", async () => {
    stubFetch([
      [/oauth\/access_token\?.*code=/, () => json({ access_token: "short" })],
      [/oauth\/access_token\?.*fb_exchange_token=/, () => json({ error: { message: "nope" } }, 400)],
    ]);
    const to = await callback({ code: "c", state: state() });
    expect(to).toMatch(/facebook=error&reason=token_exchange_failed/);
    expect(fake.inserted).toEqual([]);
    expect(fake.updated).toBe(0);
  });

  it("hamis/aláíratlan state → invalid_state, nincs hálózati hívás", async () => {
    stubFetch([]);
    const to = await callback({ code: "c", state: "hamis.allapot" });
    expect(to).toMatch(/reason=invalid_state/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
