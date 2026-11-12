/**
 * G1 AI-narratíva — a bővített summaryData (prevValue, prevSpend, signals) nem töri el
 * a Word-, PDF- és előnézet-építést, és a „Vezetői értékelés” mindkét formátumban
 * pontosan a tárolt aiSummary szövege. Tiszta függvények, nincs DB/LLM.
 */
import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import { buildSummary } from "./routers/reports";
import { analyzeReportPeriod } from "./ai/reportSignals";
import { DEMO_SUMMARY_NOTICE } from "./ai/reportSummary";
import { buildReportDocx } from "./reports/docx";
import { buildReportPdfWithLayout } from "./reports/pdf";
import { buildReportContent, buildSocialSection, summaryToBlocks, EXECUTIVE_SUMMARY_TITLE, type ReportContentInput } from "./reports/content";

function docxText(buf: Buffer): string {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === "word/document.xml") {
      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(start, start + compSize);
      const xml = (method === 0 ? data : inflateRawSync(data)).toString("utf8");
      return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
        .map((para) => (para.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))
        .join("\n");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("nincs document.xml");
}

const rows = (platform: string, metricKey: string, total: number, from: string, days = 31) =>
  Array.from({ length: days }, (_, i) => ({
    platform,
    date: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
    metricKey,
    value: total / days,
  }));

const current = [
  ...rows("google_ads", "spend", 120_000, "2026-10-01"),
  ...rows("google_ads", "conversions", 12, "2026-10-01"),
  ...rows("facebook", "reach", 6000, "2026-10-01"),
];
const previous = [
  ...rows("google_ads", "spend", 150_000, "2026-08-31"),
  ...rows("google_ads", "conversions", 20, "2026-08-31"),
  ...rows("facebook", "reach", 10_000, "2026-08-31"),
];

const AI_SUMMARY = `${DEMO_SUMMARY_NOTICE}\n\n## Összkép\nA Google Ads konverziói 20-ról 12-re estek, az ok nem ismert.\n- A Facebook elérése 6000 volt.`;

const summaryData = {
  ...buildSummary(current, previous),
  signals: analyzeReportPeriod({ from: "2026-10-01", to: "2026-10-31", currentRows: current, previousRows: previous }),
};

const input: ReportContentInput = {
  clientName: "Kovács és Társa",
  periodFrom: "2026-10-01",
  periodTo: "2026-10-31",
  summaryData: summaryData as unknown as ReportContentInput["summaryData"],
  aiSummary: AI_SUMMARY,
  demo: true,
};

describe("bővített summaryData az exportokban", () => {
  it("a buildSummary előző időszaki mezői megvannak, a tartalom (és az előnézet közösségi szakasza) épül", () => {
    expect(summaryData.kpis.find((k) => k.key === "conversions")).toMatchObject({ value: 12, prevValue: 20 });
    expect(summaryData.byPlatform[0]).toMatchObject({ platform: "google_ads", spend: 120_000, prevSpend: 150_000, prevConversions: 20 });
    const content = buildReportContent(input);
    expect(content.sections.map((s) => s.title)).toEqual(["Összesítés", "1. Google Ads", "Közösségi média", EXECUTIVE_SUMMARY_TITLE]);
    expect(buildSocialSection(summaryData.social).blocks.length).toBeGreaterThan(0);
  });

  it("a Word és a PDF Vezetői értékelése pontosan a tárolt aiSummary szövege (a mintaadat-jelzéssel együtt)", async () => {
    const expected = summaryToBlocks(AI_SUMMARY).map((b) => b.text);
    const exec = buildReportContent(input).sections.at(-1)!;
    expect(exec.blocks.map((b) => ("text" in b ? b.text : ""))).toEqual(expected);

    const docx = docxText(await buildReportDocx(input));
    const { layout } = await buildReportPdfWithLayout(input);
    const pdf = layout.lines.map((l) => l.text).join(" ").replace(/\s+/g, " ");
    for (const text of expected) {
      expect(docx).toContain(text);
      expect(pdf).toContain(text);
    }
    expect(expected[0]).toBe(DEMO_SUMMARY_NOTICE);
  });
});
