/**
 * G1 Word-export — a dokumentum szerkezete (tiszta függvény, nincs DB/hálózat/LLM).
 * A DOCX egy ZIP; a word/document.xml-t a Node beépített zlib-jével bontjuk ki,
 * hogy ne kelljen új függőség.
 */
import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import {
  buildReportDocx,
  reportDocxFileName,
  channelInterpretation,
  summaryToBlocks,
  formatHuNumber,
  DEMO_NOTICE_TITLE,
  EXECUTIVE_SUMMARY_TITLE,
  NO_SUMMARY_TEXT,
  type ReportDocxInput,
} from "./reports/docx";

/** Minimális ZIP-olvasó (stored + deflate), a központi könyvtár alapján. */
function readZipEntry(buf: Buffer, name: string): string | null {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("nem ZIP");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const entryName = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      return (method === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** A document.xml bekezdései sima szövegként (a w:t elemek összefűzve). */
function paragraphs(xml: string): string[] {
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((p) => (p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(""))
    .map((t) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .filter((t) => t.length > 0);
}

const AI_SUMMARY = [
  "## Mi ment jól",
  "A **Google Ads** költséghatékonyan hozta a konverziókat: 1 234 500 Ft költésből 87 konverzió lett.",
  "",
  "- Erősíteni érdemes a keresési kampányokat.",
  "- A Meta-hirdetéseknél új kreatív kell.",
  "",
  "Összességében stabil hónap, a következő időszakban a [konverziós ráta](https://example.hu) javítása a cél.",
].join("\n");

const baseInput: ReportDocxInput = {
  clientName: "Kovács és Társa Kft.",
  periodFrom: "2026-10-01",
  periodTo: "2026-10-31",
  summaryData: {
    kpis: [
      { key: "spend", label: "Költés", value: 1_734_500, unit: "HUF" },
      { key: "impressions", label: "Megjelenés", value: 254_300 },
      { key: "clicks", label: "Kattintás", value: 8_120 },
      { key: "conversions", label: "Konverzió", value: 120 },
      { key: "sessions", label: "Munkamenet (GA4)", value: 15_870 },
    ],
    byPlatform: [
      { platform: "google_ads", spend: 1_234_500, conversions: 87 },
      { platform: "meta_ads", spend: 500_000, conversions: 0 },
      { platform: "ga4", spend: 0, conversions: 33 },
    ],
  },
  aiSummary: AI_SUMMARY,
  demo: false,
};

async function render(input: Partial<ReportDocxInput> = {}) {
  const buf = await buildReportDocx({ ...baseInput, ...input });
  const xml = readZipEntry(buf, "word/document.xml");
  return { buf, xml: xml ?? "", paras: paragraphs(xml ?? "") };
}

const headingTexts = (paras: string[]) => paras.filter((t) => /^\d+\. /.test(t));

describe("buildReportDocx – érvényes DOCX", () => {
  it("PK-val kezdődik és van benne word/document.xml", async () => {
    const { buf, xml } = await render();
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(xml).toContain("<w:document");
  });

  it("az elején az ügyfél neve és az időszak áll, helyes magyar ékezetekkel", async () => {
    const { paras, xml } = await render();
    expect(paras[0]).toBe("Havi teljesítményriport");
    expect(paras[1]).toBe("Kovács és Társa Kft.");
    expect(paras[2]).toBe("Időszak: 2026. 10. 01. – 2026. 10. 31.");
    // ékezetek UTF-8-ban, nem entitásként vagy kérdőjelként
    for (const ch of ["á", "é", "ő", "ö", "ó", "í", "ú"]) expect(xml).toContain(ch);
    expect(xml).toContain("Vezetői értékelés");
    expect(xml).toContain("Költség / konverzió");
    expect(xml).not.toContain("�");
  });

  it("ű, ü és nagybetűs ékezetek is helyesen jelennek meg az ügyfélnévben", async () => {
    const { paras, xml } = await render({ clientName: "Fűtés-Ügynökség ÁRVÍZTŰRŐ Kft." });
    expect(paras[1]).toBe("Fűtés-Ügynökség ÁRVÍZTŰRŐ Kft.");
    for (const ch of ["ű", "Ü", "Á", "Í", "Ű", "Ő"]) expect(xml).toContain(ch);
  });

  it("az oldalfejlécben is ott az ügyfél és az időszak", async () => {
    const { buf } = await render();
    const header = readZipEntry(buf, "word/header1.xml") ?? "";
    expect(paragraphs(header).join(" ")).toContain("Kovács és Társa Kft. · 2026. 10. 01. – 2026. 10. 31.");
  });
});

describe("buildReportDocx – csatornaszakaszok", () => {
  it("a byPlatform sorrendjében és elemszámával számozott szakaszok jönnek", async () => {
    const { paras } = await render();
    expect(headingTexts(paras)).toEqual(["1. Google Ads", "2. Meta Ads", "3. GA4 (analitika)"]);
  });

  it("nincs szakasz olyan csatornára, ami nincs a bemenetben", async () => {
    const { paras } = await render({
      summaryData: { kpis: [], byPlatform: [{ platform: "meta_ads", spend: 1000, conversions: 2 }] },
      aiSummary: null,
    });
    expect(headingTexts(paras)).toEqual(["1. Meta Ads"]);
    const text = paras.join("\n");
    expect(text).not.toContain("Google Ads");
    expect(text).not.toContain("Search Console");
    expect(text).not.toContain("GA4");
  });

  it("ismeretlen csatornakulcsnál maga a kulcs a cím", async () => {
    const { paras } = await render({
      summaryData: { kpis: [], byPlatform: [{ platform: "tiktok_ads", spend: 0, conversions: 0 }] },
    });
    expect(headingTexts(paras)).toEqual(["1. tiktok_ads"]);
  });

  it("a bemeneti számok hu-HU formában jelennek meg, a CPA csak konverzió > 0 esetén", async () => {
    const { paras } = await render();
    const text = paras.join("\n");
    expect(formatHuNumber(1_234_500)).toBe("1 234 500");
    // KPI-k
    expect(text).toContain("1 734 500 Ft");
    expect(text).toContain("254 300");
    expect(text).toContain("15 870");
    // Google Ads: költés, konverzió, költség/konverzió = 1 234 500 / 87 ≈ 14 190 Ft
    expect(text).toContain("1 234 500 Ft");
    expect(text).toContain("14 190 Ft");
    // Meta: 0 konverzió → nincs költség/konverzió sor a szakaszában
    const metaStart = paras.indexOf("2. Meta Ads");
    const metaEnd = paras.indexOf("3. GA4 (analitika)");
    const metaSection = paras.slice(metaStart, metaEnd);
    expect(metaSection).toContain("500 000 Ft");
    expect(metaSection).not.toContain("Költség / konverzió");
    expect(metaSection.join(" ")).toContain("nem volt mért konverzió");
  });

  it("minden csatornaszakaszban van sablonos értelmezés", async () => {
    const { paras } = await render();
    const total = 87 + 33;
    for (const p of baseInput.summaryData.byPlatform) {
      expect(paras).toContain(channelInterpretation(p, total));
    }
    expect(channelInterpretation({ platform: "google_ads", spend: 1_234_500, conversions: 87 }, total)).toBe(
      "A(z) Google Ads csatornán 1 234 500 Ft költésből 87 konverzió lett, egy konverzió átlagosan 14 190 Ft-ba került. Ez az összes konverzió 72,5%-a.",
    );
    expect(channelInterpretation({ platform: "ga4", spend: 0, conversions: 0 }, 0)).toBe(
      "A(z) GA4 (analitika) csatornán ebben az időszakban nem volt mért költés és konverzió.",
    );
  });
});

describe("buildReportDocx – Vezetői értékelés", () => {
  it("az utolsó szakasz, a tárolt AI-összefoglaló szövege változatlanul, markdown nélkül", async () => {
    const { paras, xml } = await render();
    const idx = paras.lastIndexOf(EXECUTIVE_SUMMARY_TITLE);
    expect(idx).toBeGreaterThan(paras.indexOf("3. GA4 (analitika)"));
    expect(paras.slice(idx + 1)).toEqual([
      "Mi ment jól",
      "A Google Ads költséghatékonyan hozta a konverziókat: 1 234 500 Ft költésből 87 konverzió lett.",
      "Erősíteni érdemes a keresési kampányokat.",
      "A Meta-hirdetéseknél új kreatív kell.",
      "Összességében stabil hónap, a következő időszakban a konverziós ráta javítása a cél.",
    ]);
    expect(xml).not.toContain("**");
    expect(xml).not.toContain("##");
    expect(xml).not.toContain("https://example.hu");
  });

  it("üres vagy hiányzó összefoglalónál semleges szöveg áll a helyén", async () => {
    for (const aiSummary of [null, "", "   \n "]) {
      const { paras } = await render({ aiSummary });
      expect(paras[paras.length - 2]).toBe(EXECUTIVE_SUMMARY_TITLE);
      expect(paras[paras.length - 1]).toBe(NO_SUMMARY_TEXT);
    }
  });

  it("summaryToBlocks: címsor, lista és bekezdés", () => {
    expect(summaryToBlocks("# Cím\n\nElső sor\nfolytatás *kiemelve*\n\n1. pont")).toEqual([
      { kind: "heading", text: "Cím" },
      { kind: "paragraph", text: "Első sor folytatás kiemelve" },
      { kind: "bullet", text: "pont" },
    ]);
  });
});

describe("buildReportDocx – mintaadat-jelölés", () => {
  it("demo: true esetén az elején jól látható Mintaadat-jelölés áll", async () => {
    const { paras, buf } = await render({ demo: true });
    const idx = paras.findIndex((t) => t.toLowerCase().includes("mintaadat"));
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(paras.indexOf("1. Google Ads"));
    expect(paras[idx]).toBe(DEMO_NOTICE_TITLE.toUpperCase());
    expect(readZipEntry(buf, "word/header1.xml")).toContain(DEMO_NOTICE_TITLE);
  });

  it("demo: false esetén nincs Mintaadat-jelölés", async () => {
    const { xml, buf } = await render({ demo: false });
    expect(xml.toLowerCase()).not.toContain("mintaadat");
    expect((readZipEntry(buf, "word/header1.xml") ?? "").toLowerCase()).not.toContain("mintaadat");
  });
});

describe("reportDocxFileName", () => {
  const SAFE = /^[a-z0-9-]+\.docx$/;

  it("ékezetmentes, biztonságos, benne az ügyfél és az időszak", () => {
    const name = reportDocxFileName("Kovács és Társa", "2026-10-01", "2026-10-31");
    expect(name).toBe("riport-kovacs-es-tarsa-2026-10-01-2026-10-31.docx");
    expect(name).toMatch(SAFE);
  });

  it("ő/ű és speciális karakterek, útvonal-trükkök kiszűrve", () => {
    const name = reportDocxFileName("Űrhajós Őrség & Fiai / ../\"Kft.\" ÁRVÍZTŰRŐ", "2026-10-01", "2026-10-31");
    expect(name).toBe("riport-urhajos-orseg-fiai-kft-arvizturo-2026-10-01-2026-10-31.docx");
    expect(name).toMatch(SAFE);
  });

  it("csak írásjelből álló név esetén is érvényes", () => {
    expect(reportDocxFileName("!!!", "2026-10-01", "2026-10-31")).toBe("riport-ugyfel-2026-10-01-2026-10-31.docx");
  });
});
