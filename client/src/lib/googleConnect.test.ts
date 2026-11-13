import { describe, it, expect } from "vitest";
import { connectionStatusText, googleConnectUrl, googleReturnNotice, GOOGLE_NOT_CONFIGURED_TEXT } from "./googleConnect";

describe("googleConnect", () => {
  it("az indító URL csak profilt és platformot visz", () => {
    expect(googleConnectUrl("p 1", "ga4")).toBe("/api/oauth/google/start?profileId=p+1&platform=ga4");
  });

  it("a visszatérés állapotjelzőjéből rövid, tegező üzenet", () => {
    expect(googleReturnNotice("?google=connected&platform=search_console")).toEqual({
      kind: "success", text: "Search Console csatlakoztatva. Válaszd ki, melyik tulajdon adatait húzzuk be.",
    });
    expect(googleReturnNotice("?google=unavailable")).toEqual({ kind: "error", text: GOOGLE_NOT_CONFIGURED_TEXT });
    expect(googleReturnNotice("?google=denied")?.kind).toBe("error");
    expect(googleReturnNotice("?google=bármi")?.text).toBe("Nem sikerült a Google-csatlakozás. Próbáld újra.");
    expect(googleReturnNotice("?tab=x")).toBeNull();
  });

  it("állapotszöveg", () => {
    expect(connectionStatusText({ connected: false, needsSelection: true })).toBe("Kiválasztásra vár");
    expect(connectionStatusText({ connected: true, needsSelection: false })).toBe("Csatlakoztatva");
    expect(connectionStatusText({ connected: false, needsSelection: false })).toBe("Nincs csatlakoztatva");
  });
});
