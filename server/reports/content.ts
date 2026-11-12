/**
 * G2A Growth Engine – havi riport közös tartalmi modellje (G1, TELJESÍTMÉNY MINTA szerkezet)
 *
 * `buildReportContent(input)` tiszta függvény: nincs DB, hálózat vagy LLM. A tárolt
 * riport-pillanatképből (summaryData + aiSummary) felépíti a dokumentum szerkezetét,
 * amit a Word- (docx.ts) és a PDF-builder (pdf.ts) is ebből renderel — a szövegek,
 * szakaszcímek és értelmezések CSAK itt vannak definiálva. Szerkezet:
 *   - fejléc: ügyfélnév + időszak (oldalfejlécben is), mintaadatnál jól látható jelölés
 *   - Összesítés: a riport KPI-jai
 *   - csatornánként számozott szakasz (a byPlatform sorrendjében): számok + sablonos értelmezés
 *   - utolsó szakasz: Vezetői értékelés (a tárolt AI-összefoglaló, markdown-jelölés nélkül)
 *
 * Minden szám a bemenetből jön, vagy abból egyszerű aránnyal képzett
 * (költség/konverzió csak konverzió > 0 esetén; részarány csak ha van összes konverzió).
 */

export type ReportKpi = { key: string; label: string; value: number; unit?: string };
export type ReportPlatform = { platform: string; spend: number; conversions: number };

export type ReportContentInput = {
  clientName: string;
  /** YYYY-MM-DD */
  periodFrom: string;
  /** YYYY-MM-DD */
  periodTo: string;
  summaryData: { kpis: ReportKpi[]; byPlatform: ReportPlatform[] };
  aiSummary: string | null;
  demo: boolean;
};

export const REPORT_TITLE = "Havi teljesítményriport";
export const SUMMARY_SECTION_TITLE = "Összesítés";
export const DEMO_NOTICE_TITLE = "Mintaadat – nem valós mérés";
export const DEMO_NOTICE_TEXT =
  "A riport számai szemléltető mintaadatból készültek, nem valós hirdetési vagy analitikai mérésből. Ne add ki valós teljesítményjelentésként.";
export const EXECUTIVE_SUMMARY_TITLE = "Vezetői értékelés";
export const NO_SUMMARY_TEXT = "Ehhez a riporthoz nem készült vezetői összefoglaló.";
export const TABLE_HEADER: [string, string] = ["Mutató", "Érték"];

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

export function formatPeriod(periodFrom: string, periodTo: string): string {
  return `${formatHuDate(periodFrom)} – ${formatHuDate(periodTo)}`;
}

function formatKpiValue(k: ReportKpi): string {
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

/** pl. riport-kovacs-es-tarsa-2026-10-01-2026-10-31.<ext> */
export function reportFileName(clientName: string, periodFrom: string, periodTo: string, ext: "docx" | "pdf"): string {
  const client = slugify(clientName).slice(0, 60).replace(/-+$/, "") || "ugyfel";
  const parts = ["riport", client, slugify(periodFrom), slugify(periodTo)].filter(Boolean);
  return `${parts.join("-")}.${ext}`;
}

/**
 * Determinisztikus, sablonos értelmezés egy csatorna számaiból (nincs LLM).
 * A részarány az összes csatorna konverziójához viszonyít.
 */
export function channelInterpretation(p: ReportPlatform, totalConversions: number): string {
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

export type SummaryBlock = { kind: "heading" | "bullet" | "paragraph"; text: string };

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

function channelRows(p: ReportPlatform): [string, string][] {
  const rows: [string, string][] = [
    ["Költés", formatHuf(p.spend)],
    ["Konverzió", formatHuNumber(p.conversions)],
  ];
  if (p.conversions > 0 && p.spend > 0) rows.push(["Költség / konverzió", formatHuf(p.spend / p.conversions)]);
  return rows;
}

// ─── A dokumentum szerkezete (formátumfüggetlen) ─────────────────────────────

export type ReportBlock =
  /** Mutató–érték táblázat; a fejléc a TABLE_HEADER. */
  | { kind: "table"; rows: [string, string][] }
  /** Csatorna sablonos értelmezése (a táblázat után, kis térközzel). */
  | { kind: "interpretation"; text: string }
  /** Az összefoglalón belüli kiemelt sor (markdown-címsorból). */
  | { kind: "subheading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "paragraph"; text: string }
  /** Semleges, dőlt megjegyzés (pl. nincs összefoglaló). */
  | { kind: "note"; text: string };

export type ReportSection = { title: string; blocks: ReportBlock[] };

export type ReportContent = {
  /** Dokumentumcím (pl. „Havi teljesítményriport”). */
  title: string;
  clientName: string;
  /** „2026. 10. 01. – 2026. 10. 31.” */
  periodText: string;
  /** „Időszak: …” sor a cím alatt. */
  periodLine: string;
  /** Minden oldal fejlécében: ügyfél · időszak (· Mintaadat-jelölés). */
  pageHeader: string;
  /** Metaadat-cím (fájl tulajdonságai). */
  documentTitle: string;
  /** Mintaadatnál a jól látható jelölés, egyébként null. */
  demoNotice: { title: string; text: string } | null;
  /** Összesítés (ha van KPI), számozott csatornaszakaszok, végül a Vezetői értékelés. */
  sections: ReportSection[];
};

export function buildReportContent(input: ReportContentInput): ReportContent {
  const { clientName, periodFrom, periodTo, summaryData, aiSummary, demo } = input;
  const periodText = formatPeriod(periodFrom, periodTo);
  const kpis = summaryData.kpis ?? [];
  const byPlatform = summaryData.byPlatform ?? [];
  const totalConversions = byPlatform.reduce((a, p) => a + Math.max(0, Math.round(p.conversions)), 0);

  const sections: ReportSection[] = [];
  if (kpis.length) {
    sections.push({
      title: SUMMARY_SECTION_TITLE,
      blocks: [{ kind: "table", rows: kpis.map((k) => [k.label, formatKpiValue(k)]) }],
    });
  }

  byPlatform.forEach((p, i) => {
    sections.push({
      title: `${i + 1}. ${platformLabel(p.platform)}`,
      blocks: [
        { kind: "table", rows: channelRows(p) },
        { kind: "interpretation", text: channelInterpretation(p, totalConversions) },
      ],
    });
  });

  const summaryBlocks = aiSummary && aiSummary.trim() ? summaryToBlocks(aiSummary) : [];
  sections.push({
    title: EXECUTIVE_SUMMARY_TITLE,
    blocks: summaryBlocks.length === 0
      ? [{ kind: "note", text: NO_SUMMARY_TEXT }]
      : summaryBlocks.map((b): ReportBlock =>
        b.kind === "heading" ? { kind: "subheading", text: b.text } : { kind: b.kind, text: b.text }),
  });

  return {
    title: REPORT_TITLE,
    clientName,
    periodText,
    periodLine: `Időszak: ${periodText}`,
    pageHeader: `${clientName} · ${periodText}${demo ? ` · ${DEMO_NOTICE_TITLE}` : ""}`,
    documentTitle: `${clientName} – havi riport (${periodText})`,
    demoNotice: demo ? { title: DEMO_NOTICE_TITLE.toUpperCase(), text: DEMO_NOTICE_TEXT } : null,
    sections,
  };
}
