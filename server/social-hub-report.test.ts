/**
 * G1 – közösségi szakasz a riportban (content → docx/PDF) és a DB-helperek
 * (tranzakciós csere, duplikált kulcs felismerése). Rögzített sorok, nincs DB és hálózat.
 */
import { describe, it, expect, vi } from "vitest";
import { replaceSocialReportMetrics, isDuplicateEntryError } from "./db";
import { reportMetrics } from "../drizzle/schema";
import {
  buildReportContent,
  buildSocialSection,
  buildSocialSummary,
  NO_SOCIAL_TEXT,
  SOCIAL_SECTION_TITLE,
  EXECUTIVE_SUMMARY_TITLE,
  type ReportContentInput,
} from "./reports/content";
import { buildReportDocx } from "./reports/docx";
import { buildReportPdfWithLayout } from "./reports/pdf";
import { inflateRawSync } from "node:zlib";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const rows = [
  { platform: "facebook", date: d("2026-10-01"), metricKey: "followers", value: 1000, dimension: { socialAccountId: "fb-1" } },
  { platform: "facebook", date: d("2026-10-31"), metricKey: "followers", value: 1100, dimension: { socialAccountId: "fb-1" } },
  { platform: "facebook", date: d("2026-10-15"), metricKey: "followers", value: 500, dimension: { socialAccountId: "fb-2" } },
  { platform: "facebook", date: d("2026-10-01"), metricKey: "reach", value: 12_000, dimension: { socialAccountId: "fb-1" } },
  { platform: "facebook", date: d("2026-10-02"), metricKey: "reach", value: 8_500, dimension: { socialAccountId: "fb-2" } },
  { platform: "linkedin", date: d("2026-10-03"), metricKey: "engagement", value: 42, dimension: { socialAccountId: "li-1" } },
  { platform: "linkedin", date: d("2026-10-03"), metricKey: "clicks_custom", value: 3, dimension: { socialAccountId: "li-1" } },
  { platform: "google_ads", date: d("2026-10-03"), metricKey: "impressions", value: 99_999 },
];

const base: ReportContentInput = {
  clientName: "VIBA-TEAM Kft.",
  periodFrom: "2026-10-01",
  periodTo: "2026-10-31",
  summaryData: { kpis: [], byPlatform: [{ platform: "google_ads", spend: 1000, conversions: 1 }], social: buildSocialSummary(rows) },
  aiSummary: "Stabil hónap.",
  demo: false,
};

const nbsp = (s: string) => s.replace(/[  ]/g, " ");

describe("buildSocialSummary / buildSocialSection", () => {
  it("forgalmi mutató összeg, követő fiókonként az utolsó nap; nem közösségi sor kimarad", () => {
    expect(buildSocialSummary(rows)).toEqual([
      { platform: "facebook", metrics: [{ key: "followers", value: 1600 }, { key: "reach", value: 20_500 }] },
      { platform: "linkedin", metrics: [{ key: "engagement", value: 42 }, { key: "clicks_custom", value: 3 }] },
    ]);
  });

  it("platformonként alcím + táblázat; közösségi sor nélkül rövid magyar jelzés", () => {
    const section = buildSocialSection(base.summaryData.social);
    expect(section.title).toBe(SOCIAL_SECTION_TITLE);
    expect(section.blocks.map((b) => (b.kind === "table" ? b.rows.map(([l, v]) => [l, nbsp(v)]) : b.text))).toEqual([
      "Facebook",
      [["Követők (az időszak végén)", "1600"], ["Elérés", "20 500"]],
      "LinkedIn",
      [["Interakció", "42"], ["clicks_custom", "3"]],
    ]);
    for (const empty of [undefined, null, [], buildSocialSummary([])]) {
      expect(buildSocialSection(empty)).toEqual({ title: SOCIAL_SECTION_TITLE, blocks: [{ kind: "note", text: NO_SOCIAL_TEXT }] });
    }
  });

  it("a szakasz a csatornák után, a Vezetői értékelés előtt áll", () => {
    const titles = buildReportContent(base).sections.map((s) => s.title);
    expect(titles).toEqual(["1. Google Ads", SOCIAL_SECTION_TITLE, EXECUTIVE_SUMMARY_TITLE]);
  });
});

function docxText(buf: Buffer): string {
  // A document.xml kibontása (mint a reports-docx.test.ts-ben), a w:t szövegek összefűzve.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < buf.readUInt16LE(eocd + 10); n++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === "word/document.xml") {
      const off = buf.readUInt32LE(p + 42);
      const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const data = buf.subarray(start, start + buf.readUInt32LE(p + 20));
      const xml = (buf.readUInt16LE(p + 10) === 0 ? data : inflateRawSync(data)).toString("utf8");
      return (xml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("\n");
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return "";
}

describe("a .docx és a PDF ugyanazt a közösségi szakaszt mutatja", () => {
  const expected = [SOCIAL_SECTION_TITLE, "Facebook", "Követők (az időszak végén)", "1600", "Elérés", "20 500", "LinkedIn", "Interakció", "42"];

  it("Word", async () => {
    const text = nbsp(docxText(await buildReportDocx(base)));
    for (const t of expected) expect(text).toContain(t);
  });

  it("PDF", async () => {
    const { layout } = await buildReportPdfWithLayout(base);
    const text = nbsp(layout.lines.map((l) => l.text).join("\n"));
    for (const t of expected) expect(text).toContain(t);
  });

  it("közösségi adat nélkül mindkettőben a rövid jelzés", async () => {
    const input = { ...base, summaryData: { ...base.summaryData, social: [] } };
    expect(docxText(await buildReportDocx(input))).toContain(NO_SOCIAL_TEXT);
    const { layout } = await buildReportPdfWithLayout(input);
    expect(layout.lines.map((l) => l.text).join(" ")).toContain(NO_SOCIAL_TEXT.split(" ")[0]);
  });
});

describe("replaceSocialReportMetrics – tranzakció: előbb törlés, utána beszúrás", () => {
  it("egy tranzakcióban, a report_metrics táblán, profileId-vel", async () => {
    const calls: string[] = [];
    const inserted: any[] = [];
    const tx = {
      delete: vi.fn((table) => { expect(table).toBe(reportMetrics); return { where: vi.fn(async () => { calls.push("delete"); }) }; }),
      insert: vi.fn((table) => { expect(table).toBe(reportMetrics); return { values: vi.fn(async (v: any[]) => { calls.push("insert"); inserted.push(...v); }) }; }),
    };
    const fakeDb = { transaction: vi.fn(async (cb: (t: any) => Promise<void>) => { calls.push("begin"); await cb(tx); calls.push("commit"); }) };
    const res = await replaceSocialReportMetrics("p-1", "2026-10-01", "2026-10-31", [
      { platform: "facebook", date: d("2026-10-01"), metricKey: "reach", value: 1, currency: null, dimension: { socialAccountId: "fb-1" } },
    ], fakeDb as any);
    expect(res).toEqual({ inserted: 1 });
    expect(calls).toEqual(["begin", "delete", "insert", "commit"]);
    expect(inserted[0]).toMatchObject({ profileId: "p-1", platform: "facebook", metricKey: "reach" });
    expect(typeof inserted[0].id).toBe("string");
  });

  it("üres sorlistánál is töröl (a Social Hubban megszűnt adat ne maradjon), beszúrás nélkül", async () => {
    const calls: string[] = [];
    const tx = { delete: () => ({ where: async () => { calls.push("delete"); } }), insert: () => ({ values: async () => { calls.push("insert"); } }) };
    await replaceSocialReportMetrics("p-1", "2026-10-01", "2026-10-31", [], { transaction: async (cb: any) => cb(tx) } as any);
    expect(calls).toEqual(["delete"]);
  });
});

describe("isDuplicateEntryError", () => {
  it("felismeri a mysql2 ER_DUP_ENTRY hibát közvetlenül és a drizzle cause-láncában", () => {
    expect(isDuplicateEntryError(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY", errno: 1062 }))).toBe(true);
    expect(isDuplicateEntryError(new Error("Failed query", { cause: Object.assign(new Error("dup"), { errno: 1062 }) }))).toBe(true);
    expect(isDuplicateEntryError(new Error("más hiba"))).toBe(false);
    expect(isDuplicateEntryError(null)).toBe(false);
  });
});
