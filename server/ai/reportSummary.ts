/**
 * G2A Growth Engine – AI report summary
 *
 * A `reports.generate` mutation hívja meg. Magyar vezetői összefoglalót ír a riport
 * adataiból, a profil brand voice-ában (G1: AI-narratíva valós adatból):
 *   - bemenet: összesített KPI-k (előző időszakkal), csatornánkénti összevetés,
 *     a közösségi szakasz (summaryData.social) és a kontextus-jelek
 *     (server/ai/reportSignals.ts: hirdetési költés, posztszám, hiányos adat);
 *   - a nagy változásokat az előfeldolgozó jelöli meg, okkal; a modell csak
 *     ezekből magyarázhat, ok híján kimondja, hogy az ok nem ismert;
 *   - számellenőrzés (server/ai/numberCheck.ts): a szöveg minden száma a
 *     bemenetből jöjjön. Eltérésnél egy újrapróbálás szigorító megjegyzéssel,
 *     utána a tartalékszöveg; LLM-hibánál a technikai tartalékszöveg;
 *   - mintaadatnál (isDemoData) a szöveg elején rövid jelzés (az ellenőrzés után).
 * A tárolt szöveget a Word/PDF „Vezetői értékelés” szakasza változatlanul használja.
 */
import { invokeLLM, type Message } from "../_core/llm";
import type { ClientProfile } from "../../drizzle/schema";
import { isDemoData, isSocialMetricPlatform } from "../reports/connectors";
import { platformLabel, socialMetricLabel, type SocialPlatformSummary } from "../reports/content";
import { CHANGE_CAUSE_TEXT, SIGNIFICANT_CHANGE_PCT, metricLabel, percentChange, type ReportSignals } from "./reportSignals";
import { extractNumbers, findUnverifiedNumbers } from "./numberCheck";

export type ReportSummaryData = {
  kpis: Array<{ key: string; label: string; value: number; prevValue?: number; unit?: string }>;
  series?: Array<{ metricKey: string; points: Array<{ date: string; value: number }> }>;
  byPlatform?: Array<{ platform: string; spend?: number; conversions?: number; prevSpend?: number; prevConversions?: number }>;
  social?: SocialPlatformSummary[] | null;
  /** Előfeldolgozott jelek (időszakok, csatorna-összevetés, kontextus, megjelölt változások). */
  signals?: ReportSignals | null;
};

export const SUMMARY_UNAVAILABLE_TEXT =
  "Az AI-összefoglaló ehhez a riporthoz nem érhető el. Kérlek nézd át a KPI-t és a chartokat a manuális elemzéshez.";
export const SUMMARY_TECHNICAL_ERROR_TEXT =
  "Az AI-összefoglaló ehhez a riporthoz nem érhető el (technikai hiba). A riport többi része (KPI, chart, PDF) érintetlen.";
/** Mintaadatnál a szöveg elé kerül (rövid; a dokumentum saját jelölését nem ismétli szó szerint). */
export const DEMO_SUMMARY_NOTICE = "Mintaadatokból készült riport – a számok nem valós eredmények.";

const fmtNum = (n: number) => n.toLocaleString("hu-HU", { maximumFractionDigits: 2 });
const fmtPct = (p: number) => `${p > 0 ? "+" : ""}${p.toLocaleString("hu-HU", { maximumFractionDigits: 1 })}%`;

/**
 * A prompt és az engedett számok halmaza. Minden szám, ami a prompt adat-részébe
 * kerül, a `num`/`pct` segédeken megy át, így az ellenőrzés pontosan azt fogadja
 * el, amit a modell megkapott.
 */
export function buildReportSummaryPrompt(profile: ClientProfile, summaryData: ReportSummaryData): {
  messages: Message[];
  allowedNumbers: number[];
} {
  const allowed = new Set<number>();
  const num = (n: number) => { allowed.add(n); return fmtNum(n); };
  const pct = (p: number) => { allowed.add(p); return fmtPct(p); };
  const signals = summaryData.signals ?? null;
  const compare = !!signals?.previousPeriod;

  const brandVoice = profile.brandVoice
    ? `Márkahang: ${JSON.stringify(profile.brandVoice)}`
    : "Márkahang: professzionális, tömör, magyar B2B kontextusra szabott.";

  const lines: string[] = [];
  lines.push(`Ügyfél: ${profile.name}${profile.industry ? ` (${profile.industry})` : ""}`);
  for (const n of extractNumbers(`${profile.name} ${profile.industry ?? ""}`)) allowed.add(n.value);

  if (signals) {
    const dateParts = (iso: string) => iso.split("-").map(Number).forEach((p) => allowed.add(p));
    dateParts(signals.period.from);
    dateParts(signals.period.to);
    lines.push(`Időszak: ${signals.period.from} – ${signals.period.to} (${num(signals.period.days)} nap)`);
    if (signals.previousPeriod) {
      const p = signals.previousPeriod;
      dateParts(p.from);
      dateParts(p.to);
      lines.push(`Előző, azonos hosszú időszak: ${p.from} – ${p.to} (${num(p.days)} nap)`);
    }
  }

  lines.push("", "Összesített mutatók (hirdetési és forgalmi csatornák):");
  for (const k of summaryData.kpis) {
    const unit = k.unit ? ` ${k.unit}` : "";
    let delta = "";
    if (k.prevValue != null) {
      const change = percentChange(k.prevValue, k.value);
      delta = ` (előző időszak: ${num(k.prevValue)}${unit}${change != null ? `, változás: ${pct(change)}` : ""})`;
    }
    lines.push(`- ${k.label}: ${num(k.value)}${unit}${delta}`);
  }

  const metricsText = (platform: string, metrics: Record<string, number>) =>
    Object.entries(metrics).map(([key, v]) => `${metricLabel(platform, key)} ${num(v)}`).join(", ") || "nincs adat";

  lines.push("", "Csatornák:");
  const channelLines: string[] = [];
  if (signals) {
    for (const ch of signals.channels.filter((c) => !isSocialMetricPlatform(c.platform))) {
      const cur = ch.current?.metrics ?? {};
      let line = `- ${ch.label}: ${ch.current ? metricsText(ch.platform, cur) : "ebben az időszakban nincs adat"}`;
      if ((cur.spend ?? 0) > 0 && (cur.conversions ?? 0) > 0) {
        line += `; költség/konverzió: ${num(Math.round(cur.spend / cur.conversions))} HUF`;
      }
      if (ch.previous) line += `\n  előző időszak: ${metricsText(ch.platform, ch.previous.metrics)}`;
      channelLines.push(line);
    }
  } else {
    for (const p of summaryData.byPlatform ?? []) {
      channelLines.push(`- ${platformLabel(p.platform)}: költés ${num(p.spend ?? 0)}, konverzió ${num(p.conversions ?? 0)}`);
    }
  }
  lines.push(...(channelLines.length ? channelLines : ["(nincs csatornaadat)"]));

  lines.push("", "Közösségi média (Social Hub):");
  const social = (summaryData.social ?? []).filter((p) => p.metrics.length > 0);
  if (social.length) {
    for (const p of social) {
      let line = `- ${platformLabel(p.platform)}: ${p.metrics.map((m) => `${socialMetricLabel(m.key)} ${num(m.value)}`).join(", ")}`;
      const prev = signals?.channels.find((c) => c.platform === p.platform)?.previous;
      if (prev) line += `\n  előző időszak: ${metricsText(p.platform, prev.metrics)}`;
      lines.push(line);
    }
  } else {
    lines.push("(ehhez az időszakhoz nincs közösségi adat)");
  }

  if (signals) {
    const ctx = signals.context;
    lines.push("", "Kontextus-jelek:");
    if (ctx.noCampaign) {
      lines.push(`- Hirdetési költés ebben az időszakban: ${num(0)} HUF, vagyis nem futott fizetett kampány.`);
    } else {
      lines.push(`- Hirdetési költés ebben az időszakban: ${num(ctx.adSpend.current)} HUF.`);
    }
    if (ctx.adSpend.previous != null) lines.push(`- Hirdetési költés az előző időszakban: ${num(ctx.adSpend.previous)} HUF.`);
    // Posztszámot csak akkor írunk, ha van mit mondani: a GE nem publikál, ezért „0 poszt”
    // állítás csak az előző időszaki posztokkal összevetve kerülhet be.
    const { current: pc, previous: pp } = ctx.posts;
    if (pc != null && (compare ? pp != null && pp > 0 : pc > 0)) {
      lines.push(`- Ütemezett/publikált posztok a Growth Engine-ben: ${num(pc)}${compare && pp != null ? ` (előző időszak: ${num(pp)})` : ""}.`);
    }
    for (const m of ctx.missingData) {
      const when = m.period === "current" ? "ebben az időszakban" : "az előző időszakban";
      const label = platformLabel(m.platform);
      if (m.kind === "no_rows") lines.push(`- Hiányzó adat: ${label} – ${when} nincs mért adat.`);
      else if (m.kind === "partial") lines.push(`- Hiányos adat: ${label} – ${when} ${num(m.days)} napból csak ${num(m.daysWithData)} napra van adat.`);
      else lines.push(`- Szinkronhiba: ${label} – a legutóbbi adatfrissítés hibával zárult, az adat hiányos lehet.`);
    }
    if (!ctx.missingData.length) lines.push("- Nincs ismert adathiány.");

    if (compare) {
      lines.push("", `Megjelölt nagy változások (az előző időszakhoz képest legalább ±${num(SIGNIFICANT_CHANGE_PCT)}%):`);
      if (!signals.changes.length) lines.push("- Nincs a küszöböt meghaladó változás.");
      for (const c of signals.changes) {
        lines.push(
          `- ${platformLabel(c.platform)} · ${c.label}: ${num(c.previous)} → ${num(c.current)} (${pct(c.changePct)}, eltérés: ${num(c.diff)}; ${c.direction === "down" ? "visszaesés" : "növekedés"}). Lehetséges ok: ${CHANGE_CAUSE_TEXT[c.cause]}.`,
        );
      }
    }
  }

  const rules = [
    "Szabályok:",
    "- Csak a fenti adatokban szereplő számokat használd (kerekíteni szabad). Ne számolj új számot (arányt, átlagot, különbséget), és ne becsülj.",
    compare
      ? "- A változásokat CSAK a „Megjelölt nagy változások” listában megadott lehetséges okkal magyarázd. Ha az ok „ismeretlen”, írd ki egyértelműen, hogy az ok nem ismert – ne találgass, ne találj ki más okot."
      : "- Ebben a riportban nincs összevetés az előző időszakkal: változásról, növekedésről vagy visszaesésről ne írj.",
    "- Olyat ne állíts, ami nincs a fenti adatok és jelek között.",
    "- Tegezve, közérthetően, az ügyfélnek írj; szakzsargon, marketing-frázisok és „látjuk, hogy” típusú töltelék nélkül.",
  ];

  const messages: Message[] = [
    {
      role: "system",
      content: `Te egy senior digitális marketing tanácsadó vagy, aki magyar ügyfeleknek riportokat készít. ${brandVoice} A választ MAGYARUL írd, tömören, 3-4 rövid bekezdésben. Ne használj marketing-frázisokat ("game-changer", "leverage", stb.); konkrét számokra hivatkozz, de csak a megkapott számokra.`,
    },
    {
      role: "user",
      content: `${lines.join("\n")}

Írj rövid vezetői összefoglalót:
- mi ment jól ebben az időszakban (konkrét számokkal),
- mi az az 1-2 pont, ami figyelmet igényel (a megjelölt nagy változásokat és az okukat ide írd),
- milyen konkrét, praktikus lépést ajánlasz a következő időszakra.

${rules.join("\n")}`,
    },
  ];
  return { messages, allowedNumbers: Array.from(allowed) };
}

function strictRetryMessages(messages: Message[], unverified: string[]): Message[] {
  const problem = unverified.length
    ? `Az előző válaszodban olyan számok szerepeltek, amelyek nincsenek a megadott adatok között: ${unverified.join(", ")}.`
    : "Az előző válaszod üres volt.";
  const note = `\n\nFIGYELEM: ${problem} Írd újra az összefoglalót úgy, hogy KIZÁRÓLAG a fenti adatokban szereplő számokat használd (legfeljebb kerekítve), és ne írj semmilyen más számot – sorszámot, darabszámot vagy becslést se.`;
  return messages.map((m, i) =>
    i === messages.length - 1 && typeof m.content === "string" ? { ...m, content: m.content + note } : m);
}

function responseText(resp: Awaited<ReturnType<typeof invokeLLM>>): string {
  const raw = resp.choices?.[0]?.message?.content;
  return typeof raw === "string" ? raw.trim() : "";
}

export async function generateReportSummary(params: {
  profile: ClientProfile;
  summaryData: ReportSummaryData;
  appUserId: string;
}): Promise<string> {
  const { profile, summaryData } = params;
  const { messages, allowedNumbers } = buildReportSummaryPrompt(profile, summaryData);
  const check = (text: string) => {
    const unverified = findUnverifiedNumbers(text, allowedNumbers);
    return { ok: text.length > 0 && unverified.length === 0, unverified };
  };

  let text: string;
  try {
    const first = responseText(await invokeLLM({ messages }));
    const firstCheck = check(first);
    if (firstCheck.ok) {
      text = first;
    } else {
      console.warn("[reportSummary] Ellenőrizetlen vagy üres válasz, újrapróbálás:", firstCheck.unverified);
      const second = responseText(await invokeLLM({ messages: strictRetryMessages(messages, firstCheck.unverified) }));
      const secondCheck = check(second);
      if (secondCheck.ok) {
        text = second;
      } else {
        console.warn("[reportSummary] Az újrapróbálás sem ellenőrizhető, tartalékszöveg:", secondCheck.unverified);
        text = SUMMARY_UNAVAILABLE_TEXT;
      }
    }
  } catch (err) {
    console.error("[reportSummary] LLM invocation failed:", err);
    text = SUMMARY_TECHNICAL_ERROR_TEXT;
  }

  // A jelzés az ellenőrzés UTÁN kerül a szöveg elé (determinisztikus, nem a modell írja).
  return isDemoData() ? `${DEMO_SUMMARY_NOTICE}\n\n${text}` : text;
}
