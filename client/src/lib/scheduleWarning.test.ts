import { describe, expect, it } from "vitest";
import { getScheduleWarning, isMetaTiktokPlatform, META_TIKTOK_PLATFORMS } from "./scheduleWarning";
import { META_TIKTOK_PLATFORMS as SERVER_META_TIKTOK_PLATFORMS } from "../../../server/featureFlags";

const scheduledAt = new Date("2026-12-01T10:00:00");
const later = "2027-01-01T00:00:00.000Z";
const before = "2026-11-20T00:00:00.000Z";

const base = { hasImage: true, scheduledAt, metaTiktokEnabled: false };

describe("getScheduleWarning", () => {
  it("LinkedIn kapcsolat nélkül: a régi »csatlakoztasd« üzenet marad", () => {
    expect(getScheduleWarning({ ...base, platform: "linkedin", connection: null })).toEqual({ kind: "notConnected" });
  });

  it("LinkedIn lejáró kapcsolattal: a régi »újracsatlakozás« üzenet marad", () => {
    const res = getScheduleWarning({ ...base, platform: "linkedin", connection: { tokenExpiresAt: before } });
    expect(res).toEqual({ kind: "expired", expiresAt: new Date(before) });
  });

  it("FB kapcsolat nélkül, kikapcsolt kapcsolóval: Social Hub", () => {
    expect(getScheduleWarning({ ...base, platform: "facebook", connection: undefined })).toEqual({ kind: "socialHub" });
  });

  it("FB lejáró kapcsolattal, kikapcsolt kapcsolóval: Social Hub (újracsatlakozni sem lehet)", () => {
    expect(getScheduleWarning({ ...base, platform: "facebook", connection: { tokenExpiresAt: before } })).toEqual({ kind: "socialHub" });
  });

  it("FB aktív, nem lejáró kapcsolattal: kimegy (a kapcsolótól függetlenül)", () => {
    expect(getScheduleWarning({ ...base, platform: "facebook", connection: { tokenExpiresAt: later } })).toEqual({ kind: "ok" });
    expect(getScheduleWarning({ ...base, platform: "facebook", connection: { tokenExpiresAt: null } })).toEqual({ kind: "ok" });
  });

  it("FB kapcsolat nélkül, bekapcsolt kapcsolóval: a régi »csatlakoztasd« üzenet", () => {
    expect(getScheduleWarning({ ...base, metaTiktokEnabled: true, platform: "facebook", connection: null })).toEqual({ kind: "notConnected" });
  });

  it("FB lejáró kapcsolattal, bekapcsolt kapcsolóval: a régi »újracsatlakozás« üzenet", () => {
    const res = getScheduleWarning({ ...base, metaTiktokEnabled: true, platform: "facebook", connection: { tokenExpiresAt: before } });
    expect(res).toEqual({ kind: "expired", expiresAt: new Date(before) });
  });

  it("Instagram kép nélkül: a »kép kell« ág változatlan (kapcsolattal és anélkül is)", () => {
    expect(getScheduleWarning({ ...base, hasImage: false, platform: "instagram", connection: { tokenExpiresAt: later } })).toEqual({ kind: "needsImage" });
    expect(getScheduleWarning({ ...base, hasImage: false, platform: "instagram", connection: null })).toEqual({ kind: "needsImage" });
  });

  it("TikTok kapcsolat nélkül, kikapcsolt kapcsolóval: Social Hub", () => {
    expect(getScheduleWarning({ ...base, platform: "tiktok", connection: null })).toEqual({ kind: "socialHub" });
  });

  it("dátum nélkül nem számít lejártnak", () => {
    expect(getScheduleWarning({ ...base, scheduledAt: null, platform: "linkedin", connection: { tokenExpiresAt: before } })).toEqual({ kind: "ok" });
  });
});

describe("META_TIKTOK_PLATFORMS", () => {
  it("egyezik a szerveres listával", () => {
    expect([...META_TIKTOK_PLATFORMS]).toEqual([...SERVER_META_TIKTOK_PLATFORMS]);
  });

  it("isMetaTiktokPlatform", () => {
    expect(isMetaTiktokPlatform("instagram")).toBe(true);
    expect(isMetaTiktokPlatform("linkedin")).toBe(false);
  });
});
