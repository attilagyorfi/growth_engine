/**
 * Időzítő + közzététel — hálózat és adatbázis nélkül.
 * Lefedi: szöveg-összeállítás hashtagekkel, hibabesorolás, kapcsolat-ellenőrzések,
 * a LinkedIn dokumentált képfeltöltése és X-RestLi-Id kezelése, valamint az
 * időzítő állapotgépe (foglalás, siker, újrapróbálás, feladás, elavult posztok).
 */
import { describe, it, expect, vi } from "vitest";
import { composePostText, classifyPublishError, publishWithConnection, PublishError } from "./publishing";
import { publishToLinkedIn } from "./socialPublisher";
import { runSchedulerTick, STALE_AFTER_MS, type SchedulerDeps, type DuePost } from "./scheduler";

describe("composePostText", () => {
  it("hozzáfűzi a még hiányzó hashtageket, a meglévőket nem duplázza (kis/nagybetűtől függetlenül)", () => {
    expect(composePostText("Szöveg #kkv", ["KKV", "B2Bmarketing", "#növekedés"])).toBe("Szöveg #kkv\n\n#B2Bmarketing #növekedés");
  });
  it("hashtag nélkül változatlan", () => {
    expect(composePostText("  Szöveg  ", [])).toBe("Szöveg");
    expect(composePostText("Szöveg", null)).toBe("Szöveg");
  });
});

describe("classifyPublishError", () => {
  it("401 / lejárt token → végleges, újracsatlakozást kér", () => {
    const r = classifyPublishError("linkedin", new Error("LinkedIn API error: 401 – {\"serviceErrorCode\":65600}"));
    expect(r.permanent).toBe(true);
    expect(r.message).toMatch(/LinkedIn-kapcsolat lejárt/);
    expect(classifyPublishError("facebook", new Error('Facebook API error: 400 – {"error":{"type":"OAuthException","code":190}}')).permanent).toBe(true);
  });
  it("429 / 5xx / hálózati hiba → átmeneti", () => {
    expect(classifyPublishError("linkedin", new Error("LinkedIn API error: 429 – throttled")).permanent).toBe(false);
    expect(classifyPublishError("linkedin", new Error("LinkedIn API error: 503 – unavailable")).permanent).toBe(false);
    expect(classifyPublishError("facebook", new Error("fetch failed")).permanent).toBe(false);
  });
  it("400 tartalmi elutasítás → végleges; PublishError változatlanul", () => {
    expect(classifyPublishError("linkedin", new Error("LinkedIn API error: 422 – duplicate")).permanent).toBe(true);
    expect(classifyPublishError("x", new PublishError("Saját üzenet", true))).toEqual({ message: "Saját üzenet", permanent: true });
  });
});

describe("publishWithConnection", () => {
  const base = { platform: "linkedin" as const, accessToken: "plain-token", platformUserId: "abc123", tokenExpiresAt: null, isActive: true };
  const publishers = () => ({
    publishToLinkedIn: vi.fn(async () => ({ postId: "urn:li:share:1" })),
    publishToFacebook: vi.fn(async () => ({ postId: "fb_1" })),
    publishToInstagram: vi.fn(async () => ({ postId: "ig_1" })),
  });

  it("LinkedIn: a visszafejtett tokennel és a person ID-val hívja a publikálót", async () => {
    const p = publishers();
    await expect(publishWithConnection(base, "Szia", null, { publishers: p })).resolves.toEqual({ postId: "urn:li:share:1" });
    expect(p.publishToLinkedIn).toHaveBeenCalledWith("plain-token", "abc123", "Szia", undefined);
  });

  it("lejárt token → végleges hiba, a platform nem hívódik", async () => {
    const p = publishers();
    const conn = { ...base, tokenExpiresAt: "2026-01-01T00:00:00.000Z" };
    await expect(publishWithConnection(conn, "Szia", null, { publishers: p, now: new Date("2026-10-13") }))
      .rejects.toMatchObject({ name: "PublishError", permanent: true });
    expect(p.publishToLinkedIn).not.toHaveBeenCalled();
  });

  it("hiányzó azonosító / Instagram kép nélkül / nem támogatott platform → végleges hiba", async () => {
    const p = publishers();
    await expect(publishWithConnection({ ...base, platformUserId: null }, "x", null, { publishers: p })).rejects.toMatchObject({ permanent: true });
    await expect(publishWithConnection({ ...base, platform: "instagram" }, "x", null, { publishers: p })).rejects.toThrow(/kép kell/);
    await expect(publishWithConnection({ ...base, platform: "tiktok" }, "x", null, { publishers: p })).rejects.toMatchObject({ permanent: true });
    await expect(publishWithConnection({ ...base, isActive: false }, "x", null, { publishers: p })).rejects.toMatchObject({ permanent: true });
  });
});

describe("publishToLinkedIn (dokumentált API)", () => {
  const ok = (body: string, headers: Record<string, string> = {}, status = 201) => new Response(body, { status, headers });

  it("csak szöveg: az azonosító az X-RestLi-Id fejlécből jön, üres törzs mellett sem dob", async () => {
    const f = vi.fn(async () => ok("", { "x-restli-id": "urn:li:share:777" }));
    await expect(publishToLinkedIn("tok", "abc", "Szia", undefined, { fetch: f })).resolves.toEqual({ postId: "urn:li:share:777" });
    const body = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(body.author).toBe("urn:li:person:abc");
    expect(body.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory).toBe("NONE");
  });

  it("képpel: registerUpload → bináris feltöltés → a poszt az asset URN-t használja (nem originalUrl)", async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("registerUpload")) {
        return ok(JSON.stringify({ value: {
          uploadMechanism: { "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: "https://api.linkedin.com/mediaUpload/X" } },
          asset: "urn:li:digitalmediaAsset:IMG1",
        } }), {}, 200);
      }
      if (url.includes("mediaUpload")) return ok("", {}, 201);
      return ok("", { "x-restli-id": "urn:li:share:888" });
    });
    const loadImage = vi.fn(async () => ({ data: new Uint8Array([1, 2, 3]), contentType: "image/png" }));
    const r = await publishToLinkedIn("tok", "abc", "Képes", "https://cdn.example.com/a.png", { fetch: f, loadImage });
    expect(r.postId).toBe("urn:li:share:888");
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      "https://api.linkedin.com/mediaUpload/X",
      "https://api.linkedin.com/v2/ugcPosts",
    ]);
    expect(JSON.parse(calls[0].init.body).registerUploadRequest.owner).toBe("urn:li:person:abc");
    expect(calls[1].init.method).toBe("PUT");
    const share = JSON.parse(calls[2].init.body).specificContent["com.linkedin.ugc.ShareContent"];
    expect(share.shareMediaCategory).toBe("IMAGE");
    expect(share.media).toEqual([{ status: "READY", media: "urn:li:digitalmediaAsset:IMG1" }]);
  });

  it("a feltöltés 405-re POST-tal újrapróbál; a 401 hibát a státusszal együtt dobja", async () => {
    let uploads = 0;
    const f = vi.fn(async (url: string) => {
      if (url.includes("registerUpload")) return ok(JSON.stringify({ value: { uploadMechanism: { "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: "https://u" } }, asset: "urn:a" } }), {}, 200);
      if (url === "https://u") return ok("", {}, ++uploads === 1 ? 405 : 201);
      return ok("", { "x-restli-id": "id" });
    });
    await publishToLinkedIn("tok", "abc", "x", "https://i", { fetch: f, loadImage: async () => ({ data: new Uint8Array([1]), contentType: "image/jpeg" }) });
    expect(uploads).toBe(2);

    const denied = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    await expect(publishToLinkedIn("tok", "abc", "x", undefined, { fetch: denied })).rejects.toThrow(/401/);
  });
});

describe("runSchedulerTick", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  const post = (over: Partial<DuePost> = {}): DuePost => ({
    id: "p1", profileId: "prof", title: "Őszi ajánlat", platform: "linkedin", content: "Szöveg",
    hashtags: ["KKV"], imageUrl: null, scheduledAt: new Date(now.getTime() - 60_000), ...over,
  });
  const conn: any = { id: "c1", platform: "linkedin", isActive: true };

  function deps(posts: DuePost[], over: Partial<SchedulerDeps> = {}) {
    const d = {
      now: () => now,
      findDuePosts: vi.fn(async () => posts),
      claim: vi.fn(async () => true),
      requeue: vi.fn(async () => {}),
      findConnection: vi.fn(async () => conn),
      publish: vi.fn(async () => ({ postId: "urn:li:share:1" })),
      markPublished: vi.fn(async () => {}),
      logFailure: vi.fn(async () => {}),
      countFailures: vi.fn(async () => 0),
      notify: vi.fn(async () => {}),
      ...over,
    };
    return d as typeof d & SchedulerDeps;
  }

  it("esedékes poszt + kapcsolat → közzéteszi (hashtaggel), publikáltnak jelöli", async () => {
    const d = deps([post()]);
    expect(await runSchedulerTick(d)).toEqual({ published: 1, failed: 0, retried: 0, stale: 0 });
    expect(d.publish).toHaveBeenCalledWith(conn, "Szöveg\n\n#KKV", null);
    expect(d.markPublished).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), "urn:li:share:1");
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("ha egy másik futás már lefoglalta → nem posztol (nincs dupla közzététel)", async () => {
    const d = deps([post()], { claim: vi.fn(async () => false) });
    await runSchedulerTick(d);
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("nincs csatlakoztatott fiók → nem posztol, naplóz és értesít", async () => {
    const d = deps([post()], { findConnection: vi.fn(async () => null) });
    expect((await runSchedulerTick(d)).failed).toBe(1);
    expect(d.publish).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith("prof", "Nem sikerült közzétenni: „Őszi ajánlat”", expect.stringMatching(/Nincs csatlakoztatott LinkedIn-fiók/));
    expect(d.requeue).not.toHaveBeenCalled();
  });

  it("átmeneti hiba (1. próbálkozás) → visszaállítja ütemezettre, nem értesít", async () => {
    const d = deps([post()], { publish: vi.fn(async () => { throw new Error("LinkedIn API error: 503 – down"); }) });
    expect((await runSchedulerTick(d)).retried).toBe(1);
    expect(d.requeue).toHaveBeenCalledWith("p1");
    expect(d.logFailure).toHaveBeenCalledTimes(1);
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("átmeneti hiba a 3. próbálkozásnál → feladja és értesít", async () => {
    const d = deps([post()], {
      publish: vi.fn(async () => { throw new Error("fetch failed"); }),
      countFailures: vi.fn(async () => 2),
    });
    expect((await runSchedulerTick(d)).failed).toBe(1);
    expect(d.requeue).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith("prof", expect.any(String), expect.stringMatching(/3 próbálkozás után/));
  });

  it("végleges hiba (lejárt kapcsolat) → azonnal feladja és értesít", async () => {
    const d = deps([post()], { publish: vi.fn(async () => { throw new Error("LinkedIn API error: 401 – expired"); }) });
    await runSchedulerTick(d);
    expect(d.requeue).not.toHaveBeenCalled();
    expect(d.notify).toHaveBeenCalledWith("prof", expect.any(String), expect.stringMatching(/kapcsolat lejárt/));
  });

  it("24 óránál régebben lejárt posztokat NEM posztol utólag; profilonként egy összesítő értesítés", async () => {
    const old = (id: string, title: string) => post({ id, title, scheduledAt: new Date(now.getTime() - STALE_AFTER_MS - 3_600_000) });
    const d = deps([old("a", "Szeptemberi poszt"), old("b", "Másik régi")]);
    expect(await runSchedulerTick(d)).toEqual({ published: 0, failed: 0, retried: 0, stale: 2 });
    expect(d.publish).not.toHaveBeenCalled();
    expect(d.claim).toHaveBeenCalledTimes(2);
    expect(d.notify).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledWith("prof", "2 ütemezett poszt időpontja lejárt", expect.stringContaining("„Szeptemberi poszt”, „Másik régi”"));
  });
});
