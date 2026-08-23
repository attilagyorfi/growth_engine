/**
 * G2A Growth Engine – közös „üzleti kontextus" builder az AI-generáláshoz.
 *
 * A tartalom eddig azért volt túl általános, mert a generáló promptok szinte
 * semmi cég-specifikus adatot nem kaptak (csak hangnem+stílus). Ez a helper a
 * client_profiles + company_intelligence VALÓS adataiból épít egy tömör, magyar
 * kontextus-blokkot: megkülönböztető erősségek, ajánlatok+USP, célközönség
 * fájdalompontjai, „mindig/soha" írási szabályok, példamondatok — pontosan az,
 * amitől a szöveg a céghez szabott lesz, nem sablonos.
 *
 * DB nélküli környezetben (teszt) csendben üres stringet ad vissza.
 */

/** „Ne légy sablonos" minőségi elvárás — a generáló system-promptokhoz. */
export const ANTI_GENERIC_HU =
  `MINŐSÉGI ELVÁRÁS: légy KONKRÉT és a fenti céghez szabott. Kerüld a sablonos ` +
  `marketing-közhelyeket (pl. „minőségi szolgáltatás", „ügyfélközpontú megközelítés", ` +
  `„versenyképes árak", „innovatív megoldások", „több éves tapasztalat"). Építs a cég ` +
  `valós megkülönböztető erősségeire, konkrét ajánlataira és a célközönség tényleges ` +
  `fájdalompontjaira. A szöveg NE legyen ráhúzható bármelyik másik cégre — ha kivennéd ` +
  `belőle a cég nevét és bármelyik versenytársra igaz maradna, írd újra konkrétabbra.`;

function trunc(s: unknown, n: number): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
}

/**
 * Gazdag, magyar üzleti kontextus-blokk a profil + company intelligence alapján.
 * Üres string, ha nincs adat (vagy nincs DB) — a hívó ilyenkor kontextus nélkül fut.
 */
export async function buildBusinessContext(profileId: string): Promise<string> {
  if (!profileId) return "";
  let p: any = null;
  let intel: any = null;
  try {
    const { getProfileById, getCompanyIntelligence } = await import("../db");
    [p, intel] = await Promise.all([
      getProfileById(profileId).catch(() => null),
      getCompanyIntelligence(profileId).catch(() => null),
    ]);
  } catch {
    return "";
  }

  const lines: string[] = [];

  if (p) {
    if (p.name) lines.push(`Cég: ${trunc(p.name, 120)}`);
    if (p.industry) lines.push(`Iparág: ${trunc(p.industry, 120)}`);
    if (p.description) lines.push(`Leírás: ${trunc(p.description, 500)}`);
    const bv = p.brandVoice ?? {};
    if (bv.tone || bv.style) lines.push(`Márka hangnem: ${trunc(bv.tone, 80)}${bv.style ? `, stílus: ${trunc(bv.style, 80)}` : ""}`);
    if (Array.isArray(bv.keywords) && bv.keywords.length) lines.push(`Preferált kulcsszavak (építs rájuk): ${bv.keywords.slice(0, 10).join(", ")}`);
    if (bv.avoid) lines.push(`KERÜLENDŐ szavak/kifejezések: ${trunc(bv.avoid, 200)}`);
    if (Array.isArray(p.contentPillars) && p.contentPillars.length) {
      lines.push(`Tartalmi pillérek: ${p.contentPillars.map((x: any) => x?.name).filter(Boolean).slice(0, 6).join(", ")}`);
    }
  }

  if (intel) {
    if (intel.companySummary) lines.push(`Cég-összefoglaló: ${trunc(intel.companySummary, 500)}`);
    const dna = intel.brandDna;
    if (dna?.differentiators?.length) lines.push(`Megkülönböztető erősségek (EZEKRE építs, ne általánosságokra): ${dna.differentiators.slice(0, 5).join("; ")}`);
    if (dna?.brandPromise) lines.push(`Márkaígéret: ${trunc(dna.brandPromise, 200)}`);
    if (dna?.personality?.length) lines.push(`Márka-személyiség: ${dna.personality.slice(0, 5).join(", ")}`);
    if (Array.isArray(intel.offerMap) && intel.offerMap.length) {
      lines.push(`Ajánlatok: ${intel.offerMap.slice(0, 4).map((o: any) => `${o?.name ?? ""}${o?.usp ? ` (USP: ${trunc(o.usp, 120)})` : ""}`).filter(Boolean).join("; ")}`);
    }
    if (Array.isArray(intel.audienceMap) && intel.audienceMap.length) {
      const a = intel.audienceMap[0];
      if (a?.segment) lines.push(`Fő célközönség: ${trunc(a.segment, 120)}${a.painPoints?.length ? ` — fájdalompontok: ${a.painPoints.slice(0, 3).join(", ")}` : ""}`);
    }
    const rules = intel.aiWritingRules;
    if (rules?.doList?.length) lines.push(`Írás — MINDIG: ${rules.doList.slice(0, 5).join("; ")}`);
    if (rules?.dontList?.length) lines.push(`Írás — SOHA: ${rules.dontList.slice(0, 5).join("; ")}`);
    if (rules?.examplePhrases?.length) lines.push(`Példák a cég valódi hangjára: „${rules.examplePhrases.slice(0, 3).join("” / „")}”`);
  }

  if (!lines.length) return "";
  return `A CÉG VALÓS ADATAI (ezekre építs, NE általánosságokra):\n- ${lines.join("\n- ")}`;
}
