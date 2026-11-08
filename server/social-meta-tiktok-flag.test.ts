/**
 * G0: a Facebook/Instagram/TikTok csatlakozás kapcsolóval kikapcsolva (server/featureFlags.ts).
 * Kikapcsolt állapotban se OAuth-indítás, se callback, se kézi token, se oldalválasztás
 * nem hoz létre új kapcsolatot; a LinkedIn változatlan. Bekapcsolva a régi út megy.
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
vi.mock("./routers/appAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routers/appAuth")>();
  return { ...actual, verifyAppToken: vi.fn(async () => ({ userId: "user-a" })) };
});
vi.mock("./authDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authDb")>();
  return { ...actual, getAppUserById: vi.fn(async () => ({ id: "user-a", role: "user", profileId: "profile-a" })) };
});

import { registerFacebookOAuthRoutes, signState } from "./facebookOAuth";
import { registerTikTokOAuthRoutes } from "./tiktokOAuth";
import { FEATURE_FLAGS, META_TIKTOK_DISABLED_MESSAGE } from "./featureFlags";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type Handler = (req: any, res: any) => Promise<void>;
function routes() {
  const map = new Map<string, Handler>();
  const app = { get: (path: string, h: Handler) => map.set(path, h) } as any;
  registerFacebookOAuthRoutes(app);
  registerTikTokOAuthRoutes(app);
  return map;
}
async function hit(path: string, query: Record<string, string>) {
  const res: any = {
    redirectedTo: "", statusCode: 200,
    redirect(url: string) { this.redirectedTo = url; },
    status(c: number) { this.statusCode = c; return this; },
    json() { return this; },
  };
  await routes().get(path)!({ query, headers: { cookie: "app_token=t" } }, res);
  return res as { redirectedTo: string; statusCode: number };
}

const caller = () => appRouter.createCaller({
  appUser: {
    id: "user-a", email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "pro",
    onboardingCompleted: true, profileId: "profile-a", active: true,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

const ENV_KEYS = ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const;
const original = {
  flag: FEATURE_FLAGS.metaTiktokConnect,
  env: Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])),
  fb: { id: ENV.facebookAppId, secret: ENV.facebookAppSecret },
  tt: { key: ENV.tiktokClientKey, secret: ENV.tiktokClientSecret },
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fake.inserted = [];
  fake.updated = 0;
  for (const k of ENV_KEYS) process.env[k] = `${k.toLowerCase()}-value`;
  ENV.facebookAppId = "app-id";
  ENV.facebookAppSecret = "app-secret";
  ENV.tiktokClientKey = "client-key";
  ENV.tiktokClientSecret = "client-secret";
  fetchMock = vi.fn(async () => { throw new Error("nem lehet hálózati hívás"); });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  FEATURE_FLAGS.metaTiktokConnect = original.flag;
  for (const k of ENV_KEYS) {
    if (original.env[k] === undefined) delete process.env[k];
    else process.env[k] = original.env[k];
  }
  ENV.facebookAppId = original.fb.id;
  ENV.facebookAppSecret = original.fb.secret;
  ENV.tiktokClientKey = original.tt.key;
  ENV.tiktokClientSecret = original.tt.secret;
  vi.unstubAllGlobals();
});

describe("alapérték", () => {
  it("env nélkül kikapcsolt", () => {
    if (process.env.SOCIAL_META_TIKTOK_ENABLED === undefined) expect(original.flag).toBe(false);
  });
});

describe("kikapcsolt állapot", () => {
  beforeEach(() => { FEATURE_FLAGS.metaTiktokConnect = false; });

  it.each(["facebook", "tiktok"])("/api/oauth/%s/start nem a platformra, hanem az Integrációk fülre irányít", async (p) => {
    const res = await hit(`/api/oauth/${p}/start`, { profileId: "profile-a" });
    expect(res.redirectedTo).toMatch(new RegExp(`/beallitasok\\?tab=integrations&${p}=unavailable$`));
    expect(res.redirectedTo).not.toMatch(/facebook\.com|tiktok\.com/);
  });

  it.each(["facebook", "tiktok"])("a %s callback nem cserél tokent és nem ment kapcsolatot", async (p) => {
    const state = signState({ profileId: "profile-a", userId: "user-a" });
    const res = await hit(`/api/oauth/${p}/callback`, { code: "c", state });
    expect(res.redirectedTo).toMatch(new RegExp(`${p}=unavailable$`));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.inserted).toEqual([]);
    expect(fake.updated).toBe(0);
  });

  it.each(["facebook", "instagram", "tiktok"] as const)("saveConnection (%s) érthető hibát ad és nem ment", async (platform) => {
    await expect(caller().social.saveConnection({ profileId: "profile-a", platform, accessToken: "tok" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: META_TIKTOK_DISABLED_MESSAGE });
    expect(fake.inserted).toEqual([]);
  });

  it("saveConnection LinkedIn-re továbbra is működik", async () => {
    await expect(caller().social.saveConnection({ profileId: "profile-a", platform: "linkedin", accessToken: "tok" }))
      .resolves.toEqual({ success: true });
    expect(fake.inserted).toEqual([expect.objectContaining({ platform: "linkedin" })]);
  });

  it("chooseFacebookPage nem ment Meta-kapcsolatot", async () => {
    await expect(caller().social.chooseFacebookPage({ selectionId: "abcdefghijkl", pageId: "p1" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.inserted).toEqual([]);
  });

  it("isPlatformConfigured: FB/IG/TikTok false + metaTiktokEnabled=false, a LinkedIn változatlan", async () => {
    expect(await caller().social.isPlatformConfigured()).toEqual({
      linkedin: true, facebook: false, instagram: false, tiktok: false, metaTiktokEnabled: false,
    });
  });
});

describe("bekapcsolt állapot (a régi viselkedés)", () => {
  beforeEach(() => { FEATURE_FLAGS.metaTiktokConnect = true; });

  it("a start route-ok a Meta/TikTok authorize URL-re irányítanak", async () => {
    expect((await hit("/api/oauth/facebook/start", { profileId: "profile-a" })).redirectedTo).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect((await hit("/api/oauth/tiktok/start", { profileId: "profile-a" })).redirectedTo).toMatch(/^https:\/\/www\.tiktok\.com\/v2\/auth\/authorize\//);
  });

  it("isPlatformConfigured a konfiguráltságot adja vissza", async () => {
    expect(await caller().social.isPlatformConfigured()).toEqual({
      linkedin: true, facebook: true, instagram: true, tiktok: true, metaTiktokEnabled: true,
    });
  });

  it("saveConnection Facebookra ment", async () => {
    await expect(caller().social.saveConnection({ profileId: "profile-a", platform: "facebook", accessToken: "tok" }))
      .resolves.toEqual({ success: true });
    expect(fake.inserted).toEqual([expect.objectContaining({ platform: "facebook" })]);
  });
});
