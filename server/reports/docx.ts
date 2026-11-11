/**
 * G2A Growth Engine – havi riport Word-exportja (G1, TELJESÍTMÉNY MINTA szerkezet)
 *
 * `buildReportDocx(input)` tiszta függvény: nincs DB, hálózat vagy LLM. A tárolt
 * riport-pillanatképből (summaryData + aiSummary) dolgozik, így a Word-fájl
 * ugyanazt mutatja, mint a /riportok előnézete. Szerkezet:
 *   - fejléc: ügyfélnév + időszak (oldalfejlécben is), mintaadatnál jól látható jelölés
 *   - Összesítés: a riport KPI-jai
 *   - csatornánként számozott szakasz (a byPlatform sorrendjében): számok + sablonos értelmezés
 *   - utolsó szakasz: Vezetői értékelés (a tárolt AI-összefoglaló, markdown-jelölés nélkül)
 *
 * Minden szám a bemenetből jön, vagy abból egyszerű aránnyal képzett
 * (költség/konverzió csak konverzió > 0 esetén; részarány csak ha van összes konverzió).
 */
import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export type ReportDocxKpi = { key: string; label: string; value: number; unit?: string };
export type ReportDocxPlatform = { platform: string; spend: number; conversions: number };

export type ReportDocxInput = {
  clientName: string;
  /** YYYY-MM-DD */
  periodFrom: string;
  /** YYYY-MM-DD */
  periodTo: string;
  summaryData: { kpis: ReportDocxKpi[]; byPlatform: ReportDocxPlatform[] };
  aiSummary: string | null;
  demo: boolean;
};

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DEMO_NOTICE_TITLE = "Mintaadat – nem valós mérés";
export const DEMO_NOTICE_TEXT =
  "A riport számai szemléltető mintaadatból készültek, nem valós hirdetési vagy analitikai mérésből. Ne add ki valós teljesítményjelentésként.";
export const EXECUTIVE_SUMMARY_TITLE = "Vezetői értékelés";
export const NO_SUMMARY_TEXT = "Ehhez a riporthoz nem készült vezetői összefoglaló.";

/** Olvasható csatornanevek; ismeretlen kulcsnál maga a kulcs jelenik meg. */
const PLATFORM_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  ga4: "GA4 (analitika)",
  search_console: "Search Console",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

/** Egész szám hu-HU formában (ezres tagolás nem törő szóközzel). */
export function formatHuNumber(n: number): string {
  return Math.round(n).toLocaleString("hu-HU");
}

export function formatHuf(n: number): string {
  return `${formatHuNumber(n)} Ft`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("hu-HU", { maximumFractionDigits: 1 })}%`;
}

/** 2026-10-01 → 2026. 10. 01. */
export function formatHuDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}. ${m[2]}. ${m[3]}.` : iso;
}

function formatKpiValue(k: ReportDocxKpi): string {
  return k.unit === "HUF" ? formatHuf(k.value) : formatHuNumber(k.value);
}

/** Ékezetmentes, biztonságos szelet: csak [a-z0-9-]. */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** pl. riport-kovacs-es-tarsa-2026-10-01-2026-10-31.docx */
export function reportDocxFileName(clientName: string, periodFrom: string, periodTo: string): string {
  const client = slugify(clientName).slice(0, 60).replace(/-+$/, "") || "ugyfel";
  const parts = ["riport", client, slugify(periodFrom), slugify(periodTo)].filter(Boolean);
  return `${parts.join("-")}.docx`;
}

/**
 * Determinisztikus, sablonos értelmezés egy csatorna számaiból (nincs LLM).
 * A részarány az összes csatorna konverziójához viszonyít.
 */
export function channelInterpretation(p: ReportDocxPlatform, totalConversions: number): string {
  const label = platformLabel(p.platform);
  const spend = Math.round(p.spend);
  const conv = Math.round(p.conversions);
  let text: string;
  if (spend > 0 && conv > 0) {
    text = `A(z) ${label} csatornán ${formatHuf(spend)} költésből ${formatHuNumber(conv)} konverzió lett, egy konverzió átlagosan ${formatHuf(spend / conv)}-ba került.`;
  } else if (spend > 0) {
    text = `A(z) ${label} csatornán ${formatHuf(spend)} költés mellett ebben az időszakban nem volt mért konverzió.`;
  } else if (conv > 0) {
    text = `A(z) ${label} csatornán nem volt költés, a mért konverziók száma ${formatHuNumber(conv)}.`;
  } else {
    text = `A(z) ${label} csatornán ebben az időszakban nem volt mért költés és konverzió.`;
  }
  if (conv > 0 && totalConversions > 0) {
    text += ` Ez az összes konverzió ${formatPercent(conv / totalConversions)}-a.`;
  }
  return text;
}

type SummaryBlock = { kind: "heading" | "bullet" | "paragraph"; text: string };

/** Inline markdown-jelölés eltávolítása; a szöveg tartalma változatlan marad. */
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1$2")
    .replace(/(^|[^\w_])_(?!\s)([^_]+?)_(?!\w)/g, "$1$2")
    .trim();
}

/**
 * Az AI-összefoglaló (markdown) sima bekezdésekké alakítása: címsorból kiemelt
 * bekezdés, listaelemből felsorolás, a többi sorból egy-egy bekezdés.
 */
export function summaryToBlocks(markdown: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) blocks.push({ kind: "paragraph", text: stripInlineMarkdown(buffer.join(" ")) });
    buffer = [];
  };
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || /^([-*_])\1{2,}$/.test(line)) { flush(); continue; }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) { flush(); blocks.push({ kind: "heading", text: stripInlineMarkdown(heading[1]) }); continue; }
    const bullet = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) { flush(); blocks.push({ kind: "bullet", text: stripInlineMarkdown(bullet[1]) }); continue; }
    buffer.push(line.replace(/^>\s?/, ""));
  }
  flush();
  return blocks.filter((b) => b.text.length > 0);
}

// ─── docx-építőkockák ────────────────────────────────────────────────────────

function numbersTable(rows: [string, string][]): Table {
  const cell = (text: string, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [cell("Mutató", true), cell("Érték", true, AlignmentType.RIGHT)] }),
      ...rows.map(([label, value]) => new TableRow({ children: [cell(label), cell(value, false, AlignmentType.RIGHT)] })),
    ],
  });
}

function channelRows(p: ReportDocxPlatform): [string, string][] {
  const rows: [string, string][] = [
    ["Költés", formatHuf(p.spend)],
    ["Konverzió", formatHuNumber(p.conversions)],
  ];
  if (p.conversions > 0 && p.spend > 0) rows.push(["Költség / konverzió", formatHuf(p.spend / p.conversions)]);
  return rows;
}

export async function buildReportDocx(input: ReportDocxInput): Promise<Buffer> {
  const { clientName, periodFrom, periodTo, summaryData, aiSummary, demo } = input;
  const periodText = `${formatHuDate(periodFrom)} – ${formatHuDate(periodTo)}`;
  const kpis = summaryData.kpis ?? [];
  const byPlatform = summaryData.byPlatform ?? [];
  const totalConversions = byPlatform.reduce((a, p) => a + Math.max(0, Math.round(p.conversions)), 0);

  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Havi teljesítményriport")] }),
    new Paragraph({ children: [new TextRun({ text: clientName, bold: true, size: 28 })] }),
    new Paragraph({ children: [new TextRun({ text: `Időszak: ${periodText}` })] }),
  ];

  if (demo) {
    const shading = { type: ShadingType.CLEAR, color: "auto", fill: "FFF4CE" };
    children.push(
      new Paragraph({
        shading,
        spacing: { before: 200 },
        children: [new TextRun({ text: DEMO_NOTICE_TITLE.toUpperCase(), bold: true, color: "B45309", size: 26 })],
      }),
      new Paragraph({ shading, spacing: { after: 200 }, children: [new TextRun({ text: DEMO_NOTICE_TEXT, color: "B45309" })] }),
    );
  }

  if (kpis.length) {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Összesítés")] }),
      numbersTable(kpis.map((k) => [k.label, formatKpiValue(k)])),
    );
  }

  byPlatform.forEach((p, i) => {
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${i + 1}. ${platformLabel(p.platform)}`)] }),
      numbersTable(channelRows(p)),
      new Paragraph({ spacing: { before: 120 }, children: [new TextRun(channelInterpretation(p, totalConversions))] }),
    );
  });

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(EXECUTIVE_SUMMARY_TITLE)] }));
  const blocks = aiSummary && aiSummary.trim() ? summaryToBlocks(aiSummary) : [];
  if (blocks.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: NO_SUMMARY_TEXT, italics: true })] }));
  } else {
    for (const b of blocks) {
      if (b.kind === "heading") children.push(new Paragraph({ children: [new TextRun({ text: b.text, bold: true })] }));
      else if (b.kind === "bullet") children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b.text)] }));
      else children.push(new Paragraph({ children: [new TextRun(b.text)] }));
    }
  }

  const doc = new Document({
    creator: "Growth Engine",
    title: `${clientName} – havi riport (${periodText})`,
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `${clientName} · ${periodText}${demo ? ` · ${DEMO_NOTICE_TITLE}` : ""}`, size: 18, color: "666666" })],
          })],
        }),
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
