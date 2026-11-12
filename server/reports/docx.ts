/**
 * G2A Growth Engine – havi riport Word-exportja (G1, TELJESÍTMÉNY MINTA szerkezet)
 *
 * `buildReportDocx(input)` tiszta függvény: nincs DB, hálózat vagy LLM. A szerkezetet
 * és minden szöveget a közös tartalmi modell (content.ts → buildReportContent) adja,
 * amiből a PDF-export (pdf.ts) is készül; itt csak a Word-formázás történik:
 *   - fejléc: ügyfélnév + időszak (oldalfejlécben is), mintaadatnál jól látható jelölés
 *   - Összesítés, csatornánként számozott szakaszok, végül a Vezetői értékelés
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

import {
  buildReportContent,
  reportFileName,
  TABLE_HEADER,
  type ReportBlock,
  type ReportContentInput,
  type ReportKpi,
  type ReportPlatform,
} from "./content";

// A korábbi publikus API megmarad (a hívók és a tesztek innen importálnak).
export {
  DEMO_NOTICE_TEXT,
  DEMO_NOTICE_TITLE,
  EXECUTIVE_SUMMARY_TITLE,
  NO_SUMMARY_TEXT,
  channelInterpretation,
  formatHuDate,
  formatHuNumber,
  formatHuf,
  platformLabel,
  summaryToBlocks,
} from "./content";

export type ReportDocxKpi = ReportKpi;
export type ReportDocxPlatform = ReportPlatform;
export type ReportDocxInput = ReportContentInput;

export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** pl. riport-kovacs-es-tarsa-2026-10-01-2026-10-31.docx */
export function reportDocxFileName(clientName: string, periodFrom: string, periodTo: string): string {
  return reportFileName(clientName, periodFrom, periodTo, "docx");
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
      new TableRow({ tableHeader: true, children: [cell(TABLE_HEADER[0], true), cell(TABLE_HEADER[1], true, AlignmentType.RIGHT)] }),
      ...rows.map(([label, value]) => new TableRow({ children: [cell(label), cell(value, false, AlignmentType.RIGHT)] })),
    ],
  });
}

function blockToDocx(b: ReportBlock): Paragraph | Table {
  switch (b.kind) {
    case "table": return numbersTable(b.rows);
    case "interpretation": return new Paragraph({ spacing: { before: 120 }, children: [new TextRun(b.text)] });
    case "subheading": return new Paragraph({ children: [new TextRun({ text: b.text, bold: true })] });
    case "bullet": return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b.text)] });
    case "note": return new Paragraph({ children: [new TextRun({ text: b.text, italics: true })] });
    case "paragraph": return new Paragraph({ children: [new TextRun(b.text)] });
  }
}

export async function buildReportDocx(input: ReportDocxInput): Promise<Buffer> {
  const content = buildReportContent(input);

  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(content.title)] }),
    new Paragraph({ children: [new TextRun({ text: content.clientName, bold: true, size: 28 })] }),
    new Paragraph({ children: [new TextRun({ text: content.periodLine })] }),
  ];

  if (content.demoNotice) {
    const shading = { type: ShadingType.CLEAR, color: "auto", fill: "FFF4CE" };
    children.push(
      new Paragraph({
        shading,
        spacing: { before: 200 },
        children: [new TextRun({ text: content.demoNotice.title, bold: true, color: "B45309", size: 26 })],
      }),
      new Paragraph({ shading, spacing: { after: 200 }, children: [new TextRun({ text: content.demoNotice.text, color: "B45309" })] }),
    );
  }

  for (const section of content.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.title)] }));
    children.push(...section.blocks.map(blockToDocx));
  }

  const doc = new Document({
    creator: "Growth Engine",
    title: content.documentTitle,
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: content.pageHeader, size: 18, color: "666666" })],
          })],
        }),
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
