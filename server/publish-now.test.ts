/**
 * „Közzétesz most” (social.publishNow): a tartalom közzétettnek jelölődik, a
 * hashtagek kimennek, idegen tartalommal nem lehet posztolni, a hibák érthetőek.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  conn: { id: "c1", profileId: "profile-a", platform: "linkedin", isActive: true, accessToken: "t", platformUserId: "u" } as any,
  inserted: [] as any[],
  post: { id: "post-1", profileId: "profile-a", hashtags: ["KKV"] } as any,
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (fake.conn ? [fake.conn] : []) }) }) }),
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
  };
  return {
    ...actual,
    getDb: vi.fn(async () => db),
    getContentById: vi.fn(async (id: string) => (fake.post?.id === id ? fake.post : undefined)),
    updateContent: vi.fn(async () => undefined),
  };
});

vi.mock("./publishing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./publishing")>();
  return { ...actual, publishWithConnection: vi.fn(async () => ({ postId: "urn:li:share:42" })) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as publishing from "./publishing";

const caller = () => appRouter.createCaller({
  appUser: {
    id: "user-a", email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "pro",
    onboardingCompleted: true, profileId: "profile-a", active: true,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

beforeEach(() => {
  fake.inserted = [];
  fake.post = { id: "post-1", profileId: "profile-a", hashtags: ["KKV"] };
  vi.mocked(publishing.publishWithConnection).mockResolvedValue({ postId: "urn:li:share:42" });
  vi.mocked(db.updateContent).mockClear();
});

describe("social.publishNow", () => {
  it("közzéteszi a hashtagekkel, és a tartalmat „published”-re állítja + naplózza", async () => {
    const r = await caller().social.publishNow({ profileId: "profile-a", connectionId: "c1", text: "Szöveg", contentId: "post-1" });
    expect(r).toEqual({ success: true, postId: "urn:li:share:42" });
    expect(publishing.publishWithConnection).toHaveBeenCalledWith(fake.conn, "Szöveg\n\n#KKV", undefined);
    expect(db.updateContent).toHaveBeenCalledWith("post-1", expect.objectContaining({ status: "published" }));
    expect(fake.inserted).toEqual(expect.arrayContaining([
      expect.objectContaining({ contentPostId: "post-1", status: "success", platformPostId: "urn:li:share:42" }),
    ]));
  });

  it("másik profil tartalmával nem posztol (NOT_FOUND)", async () => {
    fake.post = { id: "post-1", profileId: "profile-b", hashtags: [] };
    await expect(caller().social.publishNow({ profileId: "profile-a", connectionId: "c1", text: "x", contentId: "post-1" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(publishing.publishWithConnection).not.toHaveBeenCalledWith(expect.anything(), "x", undefined);
  });

  it("lejárt kapcsolat → érthető, végleges hiba; a tartalom nem lesz közzétett", async () => {
    vi.mocked(publishing.publishWithConnection).mockRejectedValueOnce(new Error("LinkedIn API error: 401 – expired"));
    await expect(caller().social.publishNow({ profileId: "profile-a", connectionId: "c1", text: "x", contentId: "post-1" }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringMatching(/LinkedIn-kapcsolat lejárt/) });
    expect(db.updateContent).not.toHaveBeenCalled();
  });
});
