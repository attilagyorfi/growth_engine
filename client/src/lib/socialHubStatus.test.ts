import { describe, expect, it } from "vitest";
import { SOCIAL_HUB_BADGE, socialHubBadge } from "./socialHubStatus";

describe("Social Hub-jelvény", () => {
  it("rövid, érthető szöveg minden állapothoz", () => {
    expect(Object.fromEntries(Object.entries(SOCIAL_HUB_BADGE).map(([k, v]) => [k, v.label]))).toEqual({
      approved: "Jóváhagyva a Social Hubban",
      changes_requested: "Módosítást kértek",
      published: "Megjelent",
      failed: "Nem sikerült megjelentetni",
    });
  });

  it("csak a saját posztjának állapotát mutatja", () => {
    const states = [{ postId: "a", status: "failed" as const }];
    expect(socialHubBadge(states, "a")).toBe(SOCIAL_HUB_BADGE.failed);
    expect(socialHubBadge(states, "b")).toBeNull();
    expect(socialHubBadge([], "a")).toBeNull();
  });
});
