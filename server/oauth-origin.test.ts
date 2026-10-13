/**
 * OAuth visszairányító cím: APP_URL nélkül production-ben eddig
 * `http://localhost:5173` lett a redirect_uri → a LinkedIn/Facebook/TikTok
 * csatlakozás csendben elhasalt.
 */
import { describe, it, expect, afterEach } from "vitest";
import { ENV, getPublicAppOrigin, DEFAULT_PRODUCTION_ORIGIN } from "./_core/env";

const original = { appUrl: ENV.appUrl, isProduction: ENV.isProduction };
afterEach(() => {
  ENV.appUrl = original.appUrl;
  ENV.isProduction = original.isProduction;
});

describe("getPublicAppOrigin", () => {
  it("az APP_URL az elsődleges", () => {
    ENV.appUrl = "https://app.g2a.hu";
    ENV.isProduction = true;
    expect(getPublicAppOrigin()).toBe("https://app.g2a.hu");
  });

  it("APP_URL nélkül production-ben a Railway-domain, NEM localhost", () => {
    ENV.appUrl = "";
    ENV.isProduction = true;
    expect(getPublicAppOrigin()).toBe(DEFAULT_PRODUCTION_ORIGIN);
  });

  it("fejlesztéskor localhost", () => {
    ENV.appUrl = "";
    ENV.isProduction = false;
    expect(getPublicAppOrigin()).toBe("http://localhost:5173");
  });
});
