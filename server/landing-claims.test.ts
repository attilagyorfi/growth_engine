/**
 * A landing csak létező funkciót ígérhet — forrásszintű regressziós ellenőrzés.
 * - A kivezetett modulok és az alá nem támasztott állítások nem kerülhetnek vissza.
 * - Az árazás rejtve marad, de a tartalma a külön komponensben visszakapcsolható.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const landing = readFileSync("client/src/pages/Landing.tsx", "utf8");
const pricing = readFileSync("client/src/components/landing/LandingPricing.tsx", "utf8");

// A Tailwind leading-* osztályai megmaradnak, minden más "lead" kezdetű szó tiltott.
const LEAD_WORD = /\blead(?!ing-)/i;

describe("Landing.tsx — tiltott ígéretek", () => {
  it.each([
    "10x", "Sales", "értékesítési", "HeyGen", "TikTok", "Hírlevél", "Videókészítő",
    "videó", "avatár", "Q3 2026", "Direkt Social Közzététel", "közzétett", "Analitika & KPI",
  ])("nem szerepel benne: %s", (term) => {
    expect(landing.toLowerCase()).not.toContain(term.toLowerCase());
  });

  it("nincs benne lead kezdetű szó, a leading-* osztály nem számít annak", () => {
    expect(LEAD_WORD.test("leading-tight leading-relaxed")).toBe(false);
    expect(LEAD_WORD.test("és leadeket generálni")).toBe(true);
    expect(LEAD_WORD.test("Lead & kampány")).toBe(true);
    expect(landing).not.toMatch(LEAD_WORD);
  });

  it("a szövegek végén nem maradt felesleges idézőjel", () => {
    expect(landing).not.toMatch(/\."\s*$/m);
  });
});

describe("Landing.tsx — amit ígér", () => {
  it("a statisztika sáv 3 csempés, a modulok a valósak", () => {
    expect(landing).toContain("md:grid-cols-3 gap-8 text-center");
    expect(landing).toContain("Stratégia, Tartalom, SEO");
  });

  it("a funkciókártyák között ott a SEO-audit és az AI Copilot", () => {
    expect(landing).toContain('title: "SEO-audit"');
    expect(landing).toContain('title: "AI Copilot"');
  });
});

describe("árazás", () => {
  it("a szekció és a nav link is a SHOW_PRICING kapcsolótól függ, ami ki van kapcsolva", () => {
    expect(landing).toMatch(/const SHOW_PRICING = false;/);
    expect(landing).toMatch(/\{SHOW_PRICING && <LandingPricing \/>\}/);
    expect(landing).toMatch(/\{SHOW_PRICING && \(\s*<a href="#pricing"/);
    expect(landing.match(/href="#pricing"/g)).toHaveLength(1);
    expect(landing.match(/<LandingPricing \/>/g)).toHaveLength(1);
  });

  it("a tartalom a LandingPricing komponensben megvan, a FadeIn külön fájlból jön", () => {
    for (const part of ["const PLANS", "ANNUAL_PRICES", "ANNUAL_MONTHLY_EQUIV", "setIsYearly", 'id="pricing"', "<PricingMatrix />"]) {
      expect(pricing).toContain(part);
    }
    expect(landing).toContain('from "@/components/landing/FadeIn"');
    expect(pricing).toContain('from "@/components/landing/FadeIn"');
  });
});
