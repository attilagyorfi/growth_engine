/**
 * Élő teszt (2026-10-13) leletei: hashtag-normalizálás, a stratégia a Copilot és a
 * napi teendők kontextusában, SEO audit URL-/elérhetőség-/SPA-ellenőrzés.
 */
import { describe, it, expect } from "vitest";
import { normalizeHashtags, withNormalizedHashtags } from "./_core/hashtags";
import { formatStrategyForAssistant, formatStrategyForDailyTasks, rankedChannels } from "./_core/strategyContext";
import { auditUrlProblem, mainPageProblem, looksJsRendered } from "./routers/seo";

describe("normalizeHashtags", () => {
  it("leveszi a # jelet (Claude #-tel adja → a felületen ##Tag lett)", () => {
    expect(normalizeHashtags(["#B2BMarketing", "##KKV", "Növekedés"])).toEqual(["B2BMarketing", "KKV", "Növekedés"]);
  });

  it("szóközt, üres elemet és (kis/nagybetűtől független) ismétlést kiszűr", () => {
    expect(normalizeHashtags([" #mérhető eredmény ", "", "#", "kkv", "KKV", null])).toEqual(["mérhetőeredmény", "kkv"]);
  });

  it("nem tömb → üres tömb; withNormalizedHashtags csak a hashtags mezőt érinti", () => {
    expect(normalizeHashtags(undefined)).toEqual([]);
    expect(withNormalizedHashtags({ caption: "x", hashtags: ["#a"] })).toEqual({ caption: "x", hashtags: ["a"] });
    expect(withNormalizedHashtags({ caption: "x" })).toEqual({ caption: "x" });
  });
});

describe("stratégia-kontextus", () => {
  const strategy = {
    title: "Stratégia v2 – 2026. 10. 13.",
    executiveSummary: "A G2A Marketing adatvezérelt B2B ügynökség.",
    channelStrategy: [
      { channel: "Email marketing", priority: 4, rationale: "Lead-ápolás" },
      { channel: "LinkedIn", priority: 5, rationale: "Döntéshozók itt vannak" },
      { channel: "Facebook", priority: 4 },
      { channel: "Partneri program", priority: 2 },
    ],
    monthlyPriorities: [
      { month: "2026-09", priorities: ["Régi"] },
      { month: "2026-10", priorities: ["Célok rögzítése", "LinkedIn profil frissítése"] },
    ],
    nextActions: [{ title: "Célok és mérőszámok rögzítése", dueDate: "2026-10-16" }],
  };
  const now = new Date("2026-10-13T12:00:00");

  it("a csatornák fontossági sorrendben (5 = legfontosabb, holtversenyben az eredeti sorrend)", () => {
    expect(rankedChannels(strategy).map((c) => c.channel)).toEqual(["LinkedIn", "Email marketing", "Facebook", "Partneri program"]);
  });

  it("a Copilot-blokk tartalmazza a csatornákat, az e havi prioritásokat és a következő lépéseket", () => {
    const text = formatStrategyForAssistant(strategy, now);
    expect(text).toContain("1. LinkedIn (5/5)");
    expect(text).toContain("E havi (2026-10) prioritások: Célok rögzítése; LinkedIn profil frissítése");
    expect(text).not.toContain("Régi");
    expect(text).toContain("Célok és mérőszámok rögzítése (határidő: 2026-10-16)");
  });

  it("napi teendők: fő csatornák + e havi prioritások; stratégia nélkül egyértelmű jelzés", () => {
    expect(formatStrategyForDailyTasks(strategy, now)).toBe(
      "Aktív stratégia: Stratégia v2 – 2026. 10. 13. Fő csatornák: LinkedIn, Email marketing, Facebook. E havi prioritások: Célok rögzítése; LinkedIn profil frissítése.",
    );
    expect(formatStrategyForDailyTasks(null)).toBe("Nincs aktív stratégia.");
    expect(formatStrategyForAssistant(undefined)).toBe("");
  });

  it("hiányos/régi adatnál sem dob hibát", () => {
    expect(() => formatStrategyForAssistant({ title: "x", channelStrategy: "nem tömb", monthlyPriorities: null }, now)).not.toThrow();
  });
});

describe("SEO audit bemenet és elérhetőség", () => {
  it("az összeolvadt/elgépelt címet elutasítja (élő teszt esete)", () => {
    expect(auditUrlProblem("https://g2amhttps://g2amarketing.huarketing.hu")).toMatch(/Érvénytelen/);
    expect(auditUrlProblem("ftp://cegnev.hu")).toMatch(/Érvénytelen/);
    expect(auditUrlProblem("cegnev")).toMatch(/Érvénytelen/);
    expect(auditUrlProblem("https://g2amarketing.hu")).toBeNull();
    expect(auditUrlProblem("https://www.cegnev.hu/szolgaltatasok?x=1")).toBeNull();
  });

  it("elérhetetlen / hibás / üres fő oldalt nem pontozunk", () => {
    expect(mainPageProblem(null, "")).toMatch(/nem érhető el/);
    expect(mainPageProblem(404, "<html>")).toMatch(/HTTP 404/);
    expect(mainPageProblem(200, "   ")).toMatch(/üres/);
    expect(mainPageProblem(200, "<html><body>ok</body></html>")).toBeNull();
  });

  it("JavaScript-függő (SPA) üres vázat felismer, valódi oldalt nem jelöl", () => {
    expect(looksJsRendered({ hasAppRoot: true, wordCount: 26, linkCount: 0 })).toBe(true);
    expect(looksJsRendered({ hasAppRoot: true, wordCount: 3549, linkCount: 40 })).toBe(false); // SSR-es React oldal
    expect(looksJsRendered({ hasAppRoot: false, wordCount: 26, linkCount: 0 })).toBe(false); // egyszerűen rövid oldal
  });
});
