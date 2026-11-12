/**
 * G1 szerveroldali PDF — buildReportPdf (pdf-lib + beágyazott DejaVu Sans).
 * A subsetelt betű miatt a nyers bájtokban nincs kereshető szöveg, ezért a
 * tartalmat a builder által kirajzolt sorok listáján ellenőrizzük, a fájlt
 * pedig pdf-lib-bel visszatöltjük.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  buildReportPdf,
  buildReportPdfWithLayout,
  reportPdfFileName,
  PDF_MIME_TYPE,
  type ReportPdfLayout,
} from "./reports/pdf";
import { DEMO_NOTICE_TITLE, EXECUTIVE_SUMMARY_TITLE, type ReportContentInput } from "./reports/content";
import { DEJAVU_SANS_BOLD_BASE64, DEJAVU_SANS_REGULAR_BASE64 } from "./reports/fonts/embedded";

const base: ReportContentInput = {
  clientName: "Ügyfél Kft. – Őszi ajánlat",
  periodFrom: "2026-10-01",
  periodTo: "2026-10-31",
  summaryData: {
    kpis: [
      { key: "spend", label: "Költés", value: 240000, unit: "HUF" },
      { key: "conversions", label: "Konverzió", value: 40 },
    ],
    byPlatform: [
      { platform: "google_ads", spend: 150000, conversions: 10 },
      { platform: "meta_ads", spend: 90000, conversions: 30 },
    ],
  },
  aiSummary: "## Összkép\n\nA **Google Ads** hozta a legtöbb űrlapkitöltést, a Meta Ads erősödött.\n- Ősszel érdemes a költést növelni.",
  demo: false,
};

// A hu-HU számformázás nem törő szóközzel tagol; az összevetéshez sima szóközre cseréljük.
const texts = (layout: ReportPdfLayout) => layout.lines.map((l) => l.text.replace(/[  ]/g, " "));
const joined = (layout: ReportPdfLayout) => texts(layout).join("\n");

describe("buildReportPdf – érvényes PDF", () => {
  it("%PDF- fejléccel kezdődik, %%EOF-fel zárul, pdf-lib-bel visszatölthető", async () => {
    const buf = await buildReportPdf(base);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain("Ügyfél Kft. – Őszi ajánlat");
  });

  it("a beágyazott betű subsetelve kerül a PDF-be (kicsi fájl)", async () => {
    const buf = await buildReportPdf(base);
    expect(buf.length).toBeLessThan(120_000);
  });
});

describe("buildReportPdf – tartalom és szerkezet (kirajzolt sorok)", () => {
  it("fejléc: ügyfélnév és időszak, ékezetekkel (ő/ű/Ő/Ű)", async () => {
    const { layout } = await buildReportPdfWithLayout({ ...base, clientName: "Űrhajó és Ősz Kft. – őszi űrlap" });
    expect(texts(layout)).toContain("Űrhajó és Ősz Kft. – őszi űrlap");
    expect(texts(layout)).toContain("Időszak: 2026. 10. 01. – 2026. 10. 31.");
    // az oldalfejlécben is ott az ügyfél és az időszak
    expect(layout.lines.some((l) => l.page === 1 && l.text.includes("Űrhajó és Ősz Kft.") && l.text.includes("2026. 10. 01."))).toBe(true);
  });

  it("számozott csatornaszakaszok a byPlatform sorrendjében, számokkal és értelmezéssel", async () => {
    const { layout } = await buildReportPdfWithLayout(base);
    const all = texts(layout);
    const i1 = all.indexOf("1. Google Ads");
    const i2 = all.indexOf("2. Meta Ads");
    const iExec = all.indexOf(EXECUTIVE_SUMMARY_TITLE);
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(iExec).toBeGreaterThan(i2);
    expect(all).toContain("Összesítés");
    expect(all).toContain("150 000 Ft");
    expect(all).toContain("15 000 Ft"); // költség/konverzió
    const text = joined(layout).replace(/\n/g, " ");
    expect(text).toContain("A(z) Google Ads csatornán 150 000 Ft költésből 10 konverzió lett");
    expect(text).toContain("Ez az összes konverzió 75%-a.");
  });

  it("a Vezetői értékelés az utolsó szakasz, a tárolt összefoglaló markdown nélkül", async () => {
    const { layout } = await buildReportPdfWithLayout(base);
    const text = joined(layout);
    expect(text).toContain("Összkép");
    expect(text).toContain("A Google Ads hozta a legtöbb űrlapkitöltést, a Meta Ads erősödött.");
    expect(text).toContain("Ősszel érdemes a költést növelni.");
    expect(text).not.toContain("**");
    expect(text).not.toContain("##");
  });

  it("üres összefoglalónál semleges szöveg áll a helyén", async () => {
    const { layout } = await buildReportPdfWithLayout({ ...base, aiSummary: "   " });
    expect(texts(layout)).toContain("Ehhez a riporthoz nem készült vezetői összefoglaló.");
  });

  it("demo: true esetén jól látható Mintaadat-jelölés, demo: false esetén nincs", async () => {
    const demo = await buildReportPdfWithLayout({ ...base, demo: true });
    expect(texts(demo.layout)).toContain(DEMO_NOTICE_TITLE.toUpperCase());
    expect(joined(demo.layout)).toContain("Mintaadat");
    const live = await buildReportPdfWithLayout({ ...base, demo: false });
    expect(joined(live.layout).toLowerCase()).not.toContain("mintaadat");
  });

  it("a betűben nem szereplő karakter (emoji) kimarad, a PDF hiba nélkül elkészül", async () => {
    const { buffer, layout } = await buildReportPdfWithLayout({ ...base, aiSummary: "Szuper hónap 🚀 – „idézet” ✓" });
    expect(joined(layout)).toContain("Szuper hónap – „idézet” ✓");
    expect(joined(layout)).not.toContain("🚀");
    await expect(PDFDocument.load(buffer)).resolves.toBeDefined();
  });
});

describe("buildReportPdf – oldaltörés és sortörés", () => {
  const many: ReportContentInput = {
    ...base,
    clientName: "Nagyon-hosszú-ügyfélnév-szóköz-nélkül-".repeat(4) + "Ő",
    summaryData: {
      kpis: base.summaryData.kpis,
      byPlatform: Array.from({ length: 14 }, (_, i) => ({ platform: `csatorna_${i + 1}`, spend: 10000 * (i + 1), conversions: i })),
    },
    aiSummary: Array.from({ length: 40 }, (_, i) =>
      `Bekezdés ${i + 1}: az őszi kampány árvíztűrő tükörfúrógép eredményei hosszabb szöveggel, hogy a sor biztosan tördelődjön a margón belül.`,
    ).join("\n\n"),
  };

  it("sok csatornával és hosszú összefoglalóval több oldalas lesz", async () => {
    const { buffer, layout } = await buildReportPdfWithLayout(many);
    expect(layout.pageCount).toBeGreaterThan(1);
    expect((await PDFDocument.load(buffer)).getPageCount()).toBe(layout.pageCount);
    expect(texts(layout)).toContain("14. csatorna_14");
    // a szakaszok és az összefoglaló vége is kirajzolódott
    expect(joined(layout)).toContain("Bekezdés 40:");
  });

  it("minden kirajzolt sor a margón belül marad", async () => {
    const { layout } = await buildReportPdfWithLayout(many);
    // a szóköz nélküli, hosszú ügyfélnév karakterenként tördelődött
    expect(layout.lines.filter((l) => l.text.startsWith("Nagyon-hosszú")).length).toBeGreaterThan(0);
    for (const l of layout.lines) {
      expect(l.width).toBeLessThanOrEqual(layout.contentWidth + 0.01);
      expect(l.x).toBeGreaterThanOrEqual(layout.marginLeft - 0.01);
      expect(l.x + l.width).toBeLessThanOrEqual(layout.marginLeft + layout.contentWidth + 0.01);
    }
  });
});

describe("fájlnév, MIME-típus és beágyazott betű", () => {
  it("ékezetmentes .pdf fájlnév, application/pdf", () => {
    expect(reportPdfFileName("Kovács és Társa", "2026-10-01", "2026-10-31")).toBe("riport-kovacs-es-tarsa-2026-10-01-2026-10-31.pdf");
    expect(reportPdfFileName("../../Ő", "2026-10-01", "2026-10-31")).toBe("riport-o-2026-10-01-2026-10-31.pdf");
    expect(PDF_MIME_TYPE).toBe("application/pdf");
  });

  it("az embedded.ts a repóban lévő TTF-ek pontos másolata (újragenerálva)", () => {
    const dir = join(__dirname, "reports", "fonts");
    expect(DEJAVU_SANS_REGULAR_BASE64).toBe(readFileSync(join(dir, "DejaVuSans.ttf")).toString("base64"));
    expect(DEJAVU_SANS_BOLD_BASE64).toBe(readFileSync(join(dir, "DejaVuSans-Bold.ttf")).toString("base64"));
    expect(readFileSync(join(dir, "LICENSE-DejaVu.txt"), "utf8")).toContain("Bitstream Vera");
  });

  it("hiányzó betűnél egyértelmű hibával áll le, nem készül csendben hibás PDF", async () => {
    vi.resetModules();
    vi.doMock("./reports/fonts/embedded", () => ({ DEJAVU_SANS_REGULAR_BASE64: "", DEJAVU_SANS_BOLD_BASE64: "" }));
    const { buildReportPdf: broken } = await import("./reports/pdf");
    await expect(broken(base)).rejects.toThrow(/Hiányzik vagy sérült a beágyazott betűkészlet/);
    vi.doUnmock("./reports/fonts/embedded");
    vi.resetModules();
  });
});
