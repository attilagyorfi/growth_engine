/**
 * G0: a HeyGen-videógyártás és a hírlevélküldés kapcsolóval befagyasztva (server/featureFlags.ts).
 * Kikapcsolva se HeyGen-hívás, se új videósor, se hírlevél-e-mail; a kapcsoló minden más
 * (plan, kvóta, DB, feliratkozók) előtt dönt. Az olvasó végpontok működnek. Bekapcsolva a régi út megy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fake = vi.hoisted(() => ({ rows: [] as any[], inserted: [] as any[], updated: 0 }));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const query = () => {
    const q: any = {
      from: () => q, where: () => q, orderBy: () => q,
      limit: async () => fake.rows,
      then: (res: any, rej: any) => Promise.resolve(fake.rows).then(res, rej),
    };
    return q;
  };
  const db = {
    select: () => query(),
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
    update: () => ({ set: () => ({ where: async () => { fake.updated++; } }) }),
  };
  return { ...actual, getDb: vi.fn(async () => db) };
});
// A HeyGen API-kulcs „be van állítva”: így csak a kapcsoló állíthatja meg a hívásokat.
vi.mock("./_core/heygen", () => ({
  isHeygenEnabled: vi.fn(() => true),
  listAvatars: vi.fn(async () => [{ avatar_id: "a1", avatar_name: "Anna" }]),
  listVoices: vi.fn(async () => [{ voice_id: "v1", name: "Hang", gender: "female" }]),
  createVideo: vi.fn(async () => ({ videoId: "hg-new" })),
  getVideoStatus: vi.fn(async () => ({ status: "completed", videoUrl: "https://video.example/x.mp4" })),
}));
vi.mock("./email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email")>();
  return { ...actual, sendNewsletterEmail: vi.fn(async () => true) };
});

import * as heygenCore from "./_core/heygen";
import { sendNewsletterEmail } from "./email";
import { getDb } from "./db";
import {
  FEATURE_FLAGS, HEYGEN_VIDEO_DISABLED_MESSAGE, NEWSLETTER_DISABLED_MESSAGE,
} from "./featureFlags";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const caller = (role: "user" | "super_admin" = "user") => appRouter.createCaller({
  appUser: {
    id: "user-a", email: "a@example.hu", name: "A", role, subscriptionPlan: "pro",
    onboardingCompleted: true, profileId: "profile-a", active: true,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

const videoInput = { title: "Bemutatkozó", script: "Szia, ez egy tesztszkript.", avatarId: "a1", voiceId: "v1" };
const campaignInput = { subject: "Novemberi tippek", htmlBody: "<p>Szia, itt a havi összefoglaló.</p>" };
const storedVideo = {
  id: "vid-1", userId: "user-a", status: "processing", heygenVideoId: "hg-1",
  title: "Régi videó", videoUrl: null, thumbnailUrl: null, createdAt: new Date(),
};

const original = { heygen: FEATURE_FLAGS.heygenVideo, newsletter: FEATURE_FLAGS.newsletter };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fake.rows = [];
  fake.inserted = [];
  fake.updated = 0;
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => { throw new Error("nem lehet hálózati hívás"); });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  FEATURE_FLAGS.heygenVideo = original.heygen;
  FEATURE_FLAGS.newsletter = original.newsletter;
  vi.unstubAllGlobals();
});

describe("alapérték", () => {
  it("env nélkül mindkét kapcsoló ki van kapcsolva", () => {
    if (process.env.HEYGEN_VIDEO_ENABLED === undefined) expect(original.heygen).toBe(false);
    if (process.env.NEWSLETTER_ENABLED === undefined) expect(original.newsletter).toBe(false);
  });
});

describe("HeyGen – kikapcsolt állapot", () => {
  beforeEach(() => { FEATURE_FLAGS.heygenVideo = false; });

  it("createVideo BAD_REQUEST-et ad, nem hív HeyGen-t és nem ír DB-be", async () => {
    await expect(caller().heygen.createVideo(videoInput))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: HEYGEN_VIDEO_DISABLED_MESSAGE });
    expect(heygenCore.createVideo).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
    expect(fake.inserted).toEqual([]);
  });

  it("isEnabled: enabled=false, featureEnabled=false, a hozzáférés változatlan", async () => {
    expect(await caller().heygen.isEnabled()).toEqual({ enabled: false, featureEnabled: false, hasAccess: true });
  });

  it("listAvatars és listVoices üres listát ad HeyGen-hívás nélkül", async () => {
    expect(await caller().heygen.listAvatars()).toEqual({ avatars: [] });
    expect(await caller().heygen.listVoices({ language: "hu" })).toEqual({ voices: [] });
    expect(heygenCore.listAvatars).not.toHaveBeenCalled();
    expect(heygenCore.listVoices).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("list és quotaStatus működik", async () => {
    fake.rows = [storedVideo];
    expect(await caller().heygen.list()).toEqual({ videos: [storedVideo] });
    expect(await caller().heygen.quotaStatus()).toMatchObject({ used: 1, limit: 5, remaining: 4, noAccess: false });
  });

  it("getStatus a DB-ben tárolt állapotot adja, feldolgozás alatt sem hív HeyGen-t", async () => {
    fake.rows = [storedVideo];
    expect(await caller().heygen.getStatus({ id: "vid-1" })).toEqual(storedVideo);
    expect(heygenCore.getVideoStatus).not.toHaveBeenCalled();
    expect(fake.updated).toBe(0);
  });
});

describe("HeyGen – bekapcsolt állapot (a régi viselkedés)", () => {
  beforeEach(() => { FEATURE_FLAGS.heygenVideo = true; });

  it("createVideo elindítja a generálást és elmenti a videót", async () => {
    await expect(caller().heygen.createVideo(videoInput))
      .resolves.toMatchObject({ heygenVideoId: "hg-new", status: "processing", demoMode: false });
    expect(heygenCore.createVideo).toHaveBeenCalledTimes(1);
    expect(fake.inserted).toEqual([expect.objectContaining({ heygenVideoId: "hg-new", status: "processing" })]);
  });

  it("isEnabled és a listák a HeyGen-állapotot tükrözik", async () => {
    expect(await caller().heygen.isEnabled()).toEqual({ enabled: true, featureEnabled: true, hasAccess: true });
    expect((await caller().heygen.listAvatars()).avatars).toHaveLength(1);
    expect((await caller().heygen.listVoices({ language: "hu" })).voices).toHaveLength(1);
  });

  it("getStatus feldolgozás alatt lekérdezi a HeyGen-t", async () => {
    fake.rows = [storedVideo];
    await expect(caller().heygen.getStatus({ id: "vid-1" })).resolves.toMatchObject({ status: "completed" });
    expect(heygenCore.getVideoStatus).toHaveBeenCalledWith("hg-1");
  });
});

describe("Hírlevél – kikapcsolt állapot", () => {
  beforeEach(() => { FEATURE_FLAGS.newsletter = false; });

  it("sendCampaign BAD_REQUEST-et ad, a feliratkozókat le sem kérdezi, e-mailt nem küld", async () => {
    fake.rows = [{ email: "x@example.hu", contact: "X", createdAt: new Date() }];
    await expect(caller("super_admin").newsletter.sendCampaign(campaignInput))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: NEWSLETTER_DISABLED_MESSAGE });
    expect(getDb).not.toHaveBeenCalled();
    expect(sendNewsletterEmail).not.toHaveBeenCalled();
  });

  it("feliratkozó nélkül is a kapcsoló hibája jön, nem a PRECONDITION_FAILED", async () => {
    await expect(caller("super_admin").newsletter.sendCampaign(campaignInput))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: NEWSLETTER_DISABLED_MESSAGE });
  });

  it("isEnabled false-t ad, a listSubscribers működik", async () => {
    fake.rows = [{ email: "x@example.hu", contact: "X", createdAt: new Date() }];
    expect(await caller("super_admin").newsletter.isEnabled()).toEqual({ enabled: false });
    expect(await caller("super_admin").newsletter.listSubscribers()).toEqual([
      expect.objectContaining({ email: "x@example.hu", contact: "X" }),
    ]);
  });

  it("isEnabled csak super_adminnak érhető el", async () => {
    await expect(caller("user").newsletter.isEnabled()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Hírlevél – bekapcsolt állapot (a régi viselkedés)", () => {
  beforeEach(() => { FEATURE_FLAGS.newsletter = true; });

  it("sendCampaign kiküldi a feliratkozóknak", async () => {
    fake.rows = [{ email: "x@example.hu", contact: "X", createdAt: new Date() }];
    await expect(caller("super_admin").newsletter.sendCampaign(campaignInput))
      .resolves.toMatchObject({ total: 1, sent: 1, failed: 0 });
    expect(sendNewsletterEmail).toHaveBeenCalledTimes(1);
    expect(await caller("super_admin").newsletter.isEnabled()).toEqual({ enabled: true });
  });

  it("feliratkozó nélkül a régi PRECONDITION_FAILED jön", async () => {
    await expect(caller("super_admin").newsletter.sendCampaign(campaignInput))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});
