/**
 * G2A Growth Engine – havi riport PDF-exportja (G1, szerveroldali)
 *
 * `buildReportPdf(input)` tiszta JS (pdf-lib + @pdf-lib/fontkit), nincs headless
 * böngésző, DB, hálózat vagy LLM — Railway-en és Vercel serverlessen is fut. A
 * szerkezetet és minden szöveget a közös tartalmi modell (content.ts →
 * buildReportContent) adja, ugyanazt, amiből a Word-export (docx.ts) készül:
 * fejléc (ügyfélnév, időszak), Mintaadat-jelölés, Összesítés, számozott
 * csatornaszakaszok értelmezéssel, végül a Vezetői értékelés.
 *
 * Betű: DejaVu Sans normál + félkövér (Bitstream Vera / public domain licenc,
 * server/reports/fonts/LICENSE-DejaVu.txt), a fonts/embedded.ts modulba base64-ként
 * BEÁGYAZVA — így a dist/index.js-be és a Vercel-függvény bundle-jébe is bekerül,
 * fájlrendszer-útvonal nélkül. A PDF-be `subset: true`-val csak a használt
 * glifák kerülnek (ő/ű/Ő/Ű is helyes, nincs WinAnsi-korlát).
 *
 * A böngészős „Nyomtatás” (Reports.tsx + index.css print-szabályai) külön,
 * változatlanul megmarad; ez a fájl a letölthető / később e-mailben küldhető .pdf.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DEJAVU_SANS_BOLD_BASE64, DEJAVU_SANS_REGULAR_BASE64 } from "./fonts/embedded";
import {
  buildReportContent,
  reportFileName,
  TABLE_HEADER,
  type ReportBlock,
  type ReportContentInput,
} from "./content";

export const PDF_MIME_TYPE = "application/pdf";

/** pl. riport-kovacs-es-tarsa-2026-10-01-2026-10-31.pdf */
export function reportPdfFileName(clientName: string, periodFrom: string, periodTo: string): string {
  return reportFileName(clientName, periodFrom, periodTo, "pdf");
}

// ─── Betűk ──────────────────────────────────────────────────────────────────

type FontKey = "regular" | "bold";
type FontData = { bytes: Uint8Array; hasGlyph: (codePoint: number) => boolean };

function decodeFont(name: string, base64: string | undefined): FontData {
  const bytes = base64 ? Buffer.from(base64, "base64") : Buffer.alloc(0);
  // TrueType: 0x00010000 vagy 'true' a fájl elején.
  const magic = bytes.subarray(0, 4).toString("hex");
  if (bytes.length < 1024 || (magic !== "00010000" && magic !== "74727565")) {
    throw new Error(
      `[reports/pdf] Hiányzik vagy sérült a beágyazott betűkészlet (${name}). Generáld újra: node scripts/gen-report-fonts.mjs`,
    );
  }
  const font = fontkit.create(bytes);
  return { bytes, hasGlyph: (cp) => font.hasGlyphForCodePoint(cp) };
}

/**
 * A beágyazott betűk betöltése (néhány ms, ezért nincs gyorsítótár). Hiányzó vagy
 * sérült betűnél egyértelmű kivételt dob — nem készül csendben hibás PDF.
 */
export function loadReportFonts(): Record<FontKey, FontData> {
  return {
    regular: decodeFont("DejaVuSans.ttf", DEJAVU_SANS_REGULAR_BASE64),
    bold: decodeFont("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_BASE64),
  };
}

// ─── Oldal és tipográfia ────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28; // A4, pt
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 56;
/** A szedéstükör szélessége: minden sor ezen belül marad. */
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

const COLOR_TEXT = rgb(0.13, 0.13, 0.13);
const COLOR_MUTED = rgb(0.4, 0.4, 0.4);
const COLOR_RULE = rgb(0.82, 0.82, 0.82);
const COLOR_DEMO_TEXT = rgb(0xb4 / 255, 0x53 / 255, 0x09 / 255); // B45309, mint a docx-ben
const COLOR_DEMO_FILL = rgb(1, 0xf4 / 255, 0xce / 255); // FFF4CE

const SIZE = { title: 20, client: 14, body: 10.5, section: 14, subheading: 11, small: 8, demoTitle: 12 };
const LINE_GAP = 1.4;

/** Egy kirajzolt szövegsor — a tesztek ezen ellenőrzik a tartalmat és a margókat. */
export type RenderedLine = {
  /** 1-től számozott oldal */
  page: number;
  text: string;
  x: number;
  /** alapvonal, a lap aljától (pt) */
  y: number;
  width: number;
  size: number;
  bold: boolean;
};

export type ReportPdfLayout = {
  lines: RenderedLine[];
  pageCount: number;
  contentWidth: number;
  marginLeft: number;
};

type TextStyle = { font: FontKey; size: number; color?: RGB };

class PdfWriter {
  private page!: PDFPage;
  private y = 0;
  readonly lines: RenderedLine[] = [];
  readonly pages: PDFPage[] = [];

  constructor(
    private doc: PDFDocument,
    private fonts: Record<FontKey, PDFFont>,
    private glyphs: Record<FontKey, FontData>,
    private pageHeader: string,
  ) {
    this.newPage();
  }

  /** Vezérlő- és a betűben nem szereplő karakterek (pl. emoji) kiszűrése — nincs „tofu”. */
  clean(text: string, font: FontKey): string {
    let out = "";
    for (const ch of text.replace(/[\r\n\t]+/g, " ")) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
      if (this.glyphs[font].hasGlyph(cp)) out += ch;
    }
    return out.replace(/ {2,}/g, " ").trim();
  }

  width(text: string, style: TextStyle): number {
    return this.fonts[style.font].widthOfTextAtSize(text, style.size);
  }

  /** Szóhatáron tördel; a túl hosszú szót karakterenként vágja. Nem törő szóköznél nem tör. */
  wrap(text: string, style: TextStyle, maxWidth: number): string[] {
    const words = this.clean(text, style.font).split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";
    const pushWord = (word: string) => {
      const candidate = current ? `${current} ${word}` : word;
      if (this.width(candidate, style) <= maxWidth) { current = candidate; return; }
      if (current) { lines.push(current); current = ""; }
      if (this.width(word, style) <= maxWidth) { current = word; return; }
      let chunk = "";
      for (const ch of word) {
        if (chunk && this.width(chunk + ch, style) > maxWidth) { lines.push(chunk); chunk = ""; }
        chunk += ch;
      }
      current = chunk;
    };
    words.forEach(pushWord);
    if (current) lines.push(current);
    return lines;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    // Oldalfejléc: ügyfél · időszak (· Mintaadat) — jobbra zárva, mint a docx-ben.
    const style: TextStyle = { font: "regular", size: SIZE.small, color: COLOR_MUTED };
    this.wrap(this.pageHeader, style, CONTENT_WIDTH).forEach((line, i) => {
      this.drawAt(line, MARGIN_X + CONTENT_WIDTH - this.width(line, style), PAGE_HEIGHT - 32 - i * SIZE.small * LINE_GAP, style);
    });
  }

  /** Új oldal, ha a következő `height` pont már nem fér ki. */
  ensure(height: number) {
    if (this.y - height < MARGIN_BOTTOM) this.newPage();
  }

  space(pt: number) {
    this.y -= pt;
  }

  private drawAt(text: string, x: number, y: number, style: TextStyle) {
    if (!text) return;
    const font = this.fonts[style.font];
    this.page.drawText(text, { x, y, size: style.size, font, color: style.color ?? COLOR_TEXT });
    this.lines.push({
      page: this.pages.length, text, x, y, width: this.width(text, style), size: style.size, bold: style.font === "bold",
    });
  }

  /** Tördelt bekezdés a szedéstükörben (opcionális behúzással). */
  paragraph(text: string, style: TextStyle, indent = 0) {
    const lineHeight = style.size * LINE_GAP;
    for (const line of this.wrap(text, style, CONTENT_WIDTH - indent)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.drawAt(line, MARGIN_X + indent, this.y + (lineHeight - style.size), style);
    }
  }

  bullet(text: string) {
    const style: TextStyle = { font: "regular", size: SIZE.body };
    const indent = 14;
    const lines = this.wrap(text, style, CONTENT_WIDTH - indent);
    const lineHeight = style.size * LINE_GAP;
    lines.forEach((line, i) => {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      const baseline = this.y + (lineHeight - style.size);
      if (i === 0) this.drawAt("•", MARGIN_X + 3, baseline, style);
      this.drawAt(line, MARGIN_X + indent, baseline, style);
    });
  }

  /** Kétoszlopos mutató–érték táblázat; az érték jobbra zárt. A fejléc oldaltörésnél ismétlődik. */
  table(rows: [string, string][]) {
    const pad = 4;
    const colWidth = CONTENT_WIDTH / 2 - pad * 2;
    const lineHeight = SIZE.body * LINE_GAP;
    const drawRow = (cells: [string, string], bold: boolean) => {
      const style: TextStyle = { font: bold ? "bold" : "regular", size: SIZE.body };
      const left = this.wrap(cells[0], style, colWidth);
      const right = this.wrap(cells[1], style, colWidth);
      const height = Math.max(left.length, right.length, 1) * lineHeight + pad * 2;
      const top = this.y;
      left.forEach((l, i) => this.drawAt(l, MARGIN_X + pad, top - pad - (i + 1) * lineHeight + (lineHeight - style.size), style));
      right.forEach((r, i) => this.drawAt(r, MARGIN_X + CONTENT_WIDTH - pad - this.width(r, style), top - pad - (i + 1) * lineHeight + (lineHeight - style.size), style));
      this.y -= height;
      this.page.drawLine({
        start: { x: MARGIN_X, y: this.y }, end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y },
        thickness: bold ? 0.9 : 0.5, color: bold ? COLOR_MUTED : COLOR_RULE,
      });
      return height;
    };
    const rowHeight = (cells: [string, string]) => {
      const style: TextStyle = { font: "regular", size: SIZE.body };
      return Math.max(this.wrap(cells[0], style, colWidth).length, this.wrap(cells[1], style, colWidth).length, 1) * lineHeight + pad * 2;
    };
    const headerHeight = lineHeight + pad * 2;
    this.ensure(headerHeight + (rows[0] ? rowHeight(rows[0]) : 0));
    drawRow(TABLE_HEADER, true);
    for (const row of rows) {
      const h = rowHeight(row);
      if (this.y - h < MARGIN_BOTTOM) { this.newPage(); drawRow(TABLE_HEADER, true); }
      drawRow(row, false);
    }
  }

  /** Mintaadat-doboz: kitöltött háttér, borostyán szöveg, mint a docx-ben. */
  demoNotice(title: string, text: string) {
    const pad = 10;
    const titleStyle: TextStyle = { font: "bold", size: SIZE.demoTitle, color: COLOR_DEMO_TEXT };
    const textStyle: TextStyle = { font: "regular", size: SIZE.body, color: COLOR_DEMO_TEXT };
    const titleLines = this.wrap(title, titleStyle, CONTENT_WIDTH - pad * 2);
    const textLines = this.wrap(text, textStyle, CONTENT_WIDTH - pad * 2);
    const tH = titleStyle.size * LINE_GAP;
    const bH = textStyle.size * LINE_GAP;
    const height = pad * 2 + titleLines.length * tH + 4 + textLines.length * bH;
    this.ensure(height);
    this.page.drawRectangle({
      x: MARGIN_X, y: this.y - height, width: CONTENT_WIDTH, height,
      color: COLOR_DEMO_FILL, borderColor: COLOR_DEMO_TEXT, borderWidth: 1,
    });
    let y = this.y - pad;
    for (const l of titleLines) { y -= tH; this.drawAt(l, MARGIN_X + pad, y + (tH - titleStyle.size), titleStyle); }
    y -= 4;
    for (const l of textLines) { y -= bH; this.drawAt(l, MARGIN_X + pad, y + (bH - textStyle.size), textStyle); }
    this.y -= height;
  }

  /** Oldalszám minden oldal alján („1 / 3”). */
  footers() {
    const style: TextStyle = { font: "regular", size: SIZE.small, color: COLOR_MUTED };
    this.pages.forEach((page, i) => {
      this.page = page;
      const text = `${i + 1} / ${this.pages.length}`;
      const x = MARGIN_X + (CONTENT_WIDTH - this.width(text, style)) / 2;
      this.page.drawText(text, { x, y: 30, size: style.size, font: this.fonts.regular, color: style.color });
      this.lines.push({ page: i + 1, text, x, y: 30, width: this.width(text, style), size: style.size, bold: false });
    });
  }
}

function drawBlock(w: PdfWriter, b: ReportBlock) {
  switch (b.kind) {
    case "table": w.table(b.rows); return;
    case "interpretation": w.space(6); w.paragraph(b.text, { font: "regular", size: SIZE.body }); return;
    case "subheading": w.space(4); w.paragraph(b.text, { font: "bold", size: SIZE.subheading }); return;
    case "bullet": w.bullet(b.text); return;
    case "note": w.paragraph(b.text, { font: "regular", size: SIZE.body, color: COLOR_MUTED }); return;
    case "paragraph": w.space(3); w.paragraph(b.text, { font: "regular", size: SIZE.body }); return;
  }
}

/**
 * A PDF elkészítése a kirajzolt sorok listájával együtt (a tesztek ezen
 * ellenőrzik a tartalmat, mert a subsetelt betűnél a nyers bájtokban nincs
 * kereshető szöveg).
 */
export async function buildReportPdfWithLayout(input: ReportContentInput): Promise<{ buffer: Buffer; layout: ReportPdfLayout }> {
  const content = buildReportContent(input);
  const glyphs = loadReportFonts();

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Record<FontKey, PDFFont> = {
    regular: await doc.embedFont(glyphs.regular.bytes, { subset: true }),
    bold: await doc.embedFont(glyphs.bold.bytes, { subset: true }),
  };
  doc.setTitle(content.documentTitle);
  doc.setAuthor("Growth Engine");
  doc.setCreator("Growth Engine");
  doc.setProducer("Growth Engine");
  doc.setLanguage("hu-HU");

  const w = new PdfWriter(doc, fonts, glyphs, content.pageHeader);
  w.paragraph(content.title, { font: "bold", size: SIZE.title });
  w.space(4);
  w.paragraph(content.clientName, { font: "bold", size: SIZE.client });
  w.paragraph(content.periodLine, { font: "regular", size: SIZE.body });

  if (content.demoNotice) {
    w.space(12);
    w.demoNotice(content.demoNotice.title, content.demoNotice.text);
  }

  for (const section of content.sections) {
    w.space(18);
    // A cím ne maradjon árván a lap alján: kell alá legalább pár sor hely.
    w.ensure(SIZE.section * LINE_GAP + 3 * SIZE.body * LINE_GAP);
    w.paragraph(section.title, { font: "bold", size: SIZE.section });
    w.space(4);
    for (const block of section.blocks) drawBlock(w, block);
  }
  w.footers();

  const bytes = await doc.save();
  return {
    buffer: Buffer.from(bytes),
    layout: { lines: w.lines, pageCount: doc.getPageCount(), contentWidth: CONTENT_WIDTH, marginLeft: MARGIN_X },
  };
}

export async function buildReportPdf(input: ReportContentInput): Promise<Buffer> {
  return (await buildReportPdfWithLayout(input)).buffer;
}
