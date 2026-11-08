/**
 * A kliens képei a repóban vannak, nem külső tárhelyen — forrásszintű regressziós ellenőrzés.
 * - A Manus CloudFront CDN 403-at ad, ezért élesben törött képek látszottak.
 * - A gyökérrelatív src-k a client/public alatti, commitolt fájlra mutatnak.
 * - A saját SVG-makettek nem hivatkoznak külső erőforrásra.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const CLIENT_SRC = "client/src";
const CLIENT_PUBLIC = "client/public";

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

// URL-ben (http(s)://… vagy //…) előforduló cloudfront.net / manus — sima szövegegyezés nem számít.
const FORBIDDEN_URL = /(?:https?:)?\/\/[^\s"'`)]*(?:cloudfront\.net|manus)[^\s"'`)]*/i;
// <img src="https://…"> vagy src={"https://…"} — külső képtárhely.
const EXTERNAL_SRC = /\bsrc=\{?\s*["'`]https?:\/\//i;
// src="/…" — gyökérrelatív útvonal.
const ROOT_SRC = /\bsrc=\{?\s*["'`](\/[^"'`]+)["'`]/g;
// Külső hivatkozás egy SVG-ben; az SVG névtér (xmlns) kivétel.
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const NEW_SVGS = [
  "landing/dashboard.svg",
  "landing/content-calendar.svg",
  "brand/illustrations/analytics-preview.svg",
  "brand/illustrations/content-studio-preview.svg",
];

function rootSrcs(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return Array.from(source.matchAll(ROOT_SRC), (m) => m[1]);
}

function externalRefs(svg: string): string[] {
  return (svg.match(/https?:\/\/[^\s"'<>)]+/gi) ?? []).filter((url) => url !== SVG_NAMESPACE);
}

describe("client/src — nincs külső képtárhely", () => {
  const files = listFiles(CLIENT_SRC);

  it("a bejárás megtalálja a forrásfájlokat", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.map((f) => f.replace(/\\/g, "/"))).toContain("client/src/pages/Landing.tsx");
  });

  it("a minták a jó dolgot fogják meg", () => {
    expect(FORBIDDEN_URL.test("https://d2xsxph8kpxj0f.cloudfront.net/1/kep.webp")).toBe(true);
    expect(FORBIDDEN_URL.test("https://files.manuscdn.com/kep.png")).toBe(true);
    expect(FORBIDDEN_URL.test("// A Manus-maradványokat töröltük")).toBe(false);
    expect(EXTERNAL_SRC.test('<img src="https://example.com/a.png" />')).toBe(true);
    expect(EXTERNAL_SRC.test('<img src="/landing/dashboard.svg" />')).toBe(false);
  });

  it("egyik fájlban sincs cloudfront.net vagy manus URL, és nincs külső <img> src", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN_URL.test(source) || EXTERNAL_SRC.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("gyökérrelatív képek — a fájl a client/public alatt van", () => {
  it.each([
    ["client/src/pages/Landing.tsx", 2],
    ["client/src/pages/Analytics.tsx", 1],
    ["client/src/pages/ContentStudio.tsx", 1],
  ])("%s: minden src=\"/…\" létező fájlra mutat", (file, minCount) => {
    const srcs = rootSrcs(file);
    expect(srcs.length).toBeGreaterThanOrEqual(minCount);
    const missing = srcs.filter((src) => !existsSync(path.join(CLIENT_PUBLIC, src)));
    expect(missing).toEqual([]);
  });

  it("a landing a /landing/ alatti makettekre hivatkozik", () => {
    expect(rootSrcs("client/src/pages/Landing.tsx")).toEqual(
      expect.arrayContaining(["/landing/dashboard.svg", "/landing/content-calendar.svg"]),
    );
  });
});

describe("saját SVG-makettek", () => {
  it("a névtér-kivétel működik, más URL fennakad", () => {
    expect(externalRefs(`<svg xmlns="${SVG_NAMESPACE}"></svg>`)).toEqual([]);
    expect(externalRefs('<image href="https://example.com/a.png"/>')).toHaveLength(1);
  });

  it.each(NEW_SVGS)("%s: kicsi, önálló, csak mintaadat", (rel) => {
    const file = path.join(CLIENT_PUBLIC, rel);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(150 * 1024);

    const svg = readFileSync(file, "utf8");
    expect(externalRefs(svg)).toEqual([]);
    expect(svg).not.toMatch(/data:image|base64|@import|@font-face|<image\b/i);
    // Csak létező funkció: kikapcsolt csatornák, videó, hírlevél, árazás nem szerepelhet.
    for (const term of ["Facebook", "Instagram", "TikTok", "HeyGen", "videó", "hírlevél", "Ft/hó", "árazás"]) {
      expect(svg.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });
});
