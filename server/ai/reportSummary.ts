/**
 * G2A Growth Engine – AI report summary
 *
 * A `reports.generate` mutation hívja meg minden PDF-generálás előtt.
 * Magyar vezetői összefoglalót ír a legenerált metrikák alapján, G2A brand
 * voice-ban. Az `aiUsage`-ot is számolja (a `aiSeoPerMonth` mintáját
 * követi — új számláló `aiReportsPerMonth` a `useSubscription` bővítése
 * későbbi PR-ben).
 */
import { invokeLLM } from "../_core/llm";
import type { ClientProfile } from "../../drizzle/schema";

export type ReportSummaryData = {
  kpis: Array<{ key: string; label: string; value: number; prevValue?: number; unit?: string }>;
  series?: Array<{ metricKey: string; points: Array<{ date: string; value: number }> }>;
  byPlatform?: Array<{ platform: string; spend?: number; conversions?: number }>;
};

export async function generateReportSummary(params: {
  profile: ClientProfile;
  summaryData: ReportSummaryData;
  appUserId: string;
}): Promise<string> {
  const { profile, summaryData } = params;
  const brandVoice = profile.brandVoice
    ? `Márkahang: ${JSON.stringify(profile.brandVoice)}`
    : "Márkahang: professzionális, tömör, magyar B2B kontextusra szabott.";

  const kpiText = summaryData.kpis.map(k => {
    const delta = k.prevValue != null && k.prevValue !== 0
      ? ` (előző időszak: ${k.prevValue}, változás: ${(((k.value - k.prevValue) / k.prevValue) * 100).toFixed(1)}%)`
      : "";
    return `- ${k.label}: ${k.value}${k.unit ? " " + k.unit : ""}${delta}`;
  }).join("\n");

  const byPlatformText = (summaryData.byPlatform ?? []).map(p =>
    `- ${p.platform}: költés ${p.spend ?? 0}, konverzió ${p.conversions ?? 0}`
  ).join("\n");

  const messages = [
    {
      role: "system" as const,
      content: `Te egy senior digitális marketing tanácsadó vagy, aki magyar B2B ügyfeleknek riportokat készít. ${brandVoice} A választ MAGYARUL írd, 3-4 rövid bekezdésben. Ne használj marketing-frázisokat ("game-changer", "leverage", stb.); konkrét számokra hivatkozz.`,
    },
    {
      role: "user" as const,
      content: `Ügyfél: ${profile.name}${profile.industry ? ` (${profile.industry})` : ""}

KPI-k:
${kpiText}

Platform bontás:
${byPlatformText || "(nincs platform-bontás)"}

Írj egy 3-4 bekezdéses vezetői összefoglalót:
1. Mi ment jól ebben az időszakban (konkrét számokkal)?
2. Mi az a 1-2 pont, ami figyelmet igényel?
3. Milyen konkrét, praktikus lépést ajánlasz a következő időszakra?

Ne találj ki számokat — CSAK azokra hivatkozz, amiket megkaptál. Kerüld a "látjuk, hogy" típusú töltelék-mondatokat.`,
    },
  ];

  try {
    const resp = await invokeLLM({ messages });
    const raw = resp.choices?.[0]?.message?.content;
    return typeof raw === "string" && raw.trim().length > 0
      ? raw
      : "Az AI-összefoglaló ehhez a riporthoz nem érhető el. Kérlek nézd át a KPI-t és a chartokat a manuális elemzéshez.";
  } catch (err) {
    console.error("[reportSummary] LLM invocation failed:", err);
    return "Az AI-összefoglaló ehhez a riporthoz nem érhető el (technikai hiba). A riport többi része (KPI, chart, PDF) érintetlen.";
  }
}
