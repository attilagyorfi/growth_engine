/**
 * Márkaadatok → Social Hub-márkaprofil (PUT /clients/{id}/brand-profile) — tiszta függvények.
 *
 * A Social Hub a required_phrases, a forbidden_phrases és a required_disclaimer alapján
 * MEGÁLLÍTJA a posztokat, ezért ezekbe kizárólag a külön mezőkben (BrandRules) kifejezetten
 * megadott érték kerül. A brandVoice.keywords és .avoid csak javaslat: csak a voice szövegébe
 * mehet, a listákba soha. A hosszkorlátok UTF-16 egységben értendők.
 */
import { createHash } from "node:crypto";
import type { ClientProfile } from "../../drizzle/schema";
import { truncate } from "./drafts";

/** A szerződés korlátai (Social Hub: brandSyncLimits). */
export const BRAND_LIMITS = {
  voice: 2000, phrases: 100, phrase: 200, disclaimer: 1000, pillars: 20, pillarName: 120, pillarDescription: 1000,
} as const;

/** A kifejezetten kötelezőként, illetve tiltottként megadott szövegek. */
export type BrandRules = { requiredPhrases: string[]; forbiddenPhrases: string[]; requiredDisclaimer: string | null };
export const EMPTY_BRAND_RULES: BrandRules = { requiredPhrases: [], forbiddenPhrases: [], requiredDisclaimer: null };

export type BrandProfileBody = {
  voice: string | null;
  required_phrases: string[];
  forbidden_phrases: string[];
  required_disclaimer: string | null;
  pillars: { name: string; description: string | null }[];
};

export type BrandProfileMapping = { body: BrandProfileBody; hash: string; empty: boolean; warnings: string[] };

/** Szöveggé alakít, egységes sortöréssel, vezérlőkarakterek (pl. NUL) nélkül. */
const clean = (value: unknown): string => (typeof value === "string" ? value : "")
  .replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
/** Így hasonlít a Social Hub is. */
const fold = (value: string) => value.toLocaleLowerCase();
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function uniqueBy<T>(items: T[], key: (item: T) => string): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const item of items) {
    const k = fold(key(item));
    if (seen.has(k)) dropped.push(item);
    else { seen.add(k); kept.push(item); }
  }
  return { kept, dropped };
}

// ─── Az új mezők mentése ─────────────────────────────────────────────────────

/** A felhasználónak kiírható mentési hiba. */
export class BrandRulesError extends Error {}

const short = (value: string) => (value.length > 40 ? `${truncate(value, 40).trim()}…` : value);

function normalizePhrases(label: string, input: string[]): string[] {
  const cleaned = input.map(clean).filter(Boolean);
  for (const phrase of cleaned) {
    if (phrase.includes("\n")) throw new BrandRulesError(`${label}: egy kifejezés csak egy sor lehet.`);
    if (phrase.length > BRAND_LIMITS.phrase) {
      throw new BrandRulesError(`${label}: ez túl hosszú (legfeljebb ${BRAND_LIMITS.phrase} karakter): „${short(phrase)}”.`);
    }
  }
  const { kept } = uniqueBy(cleaned, (p) => p);
  if (kept.length > BRAND_LIMITS.phrases) throw new BrandRulesError(`${label}: legfeljebb ${BRAND_LIMITS.phrases} lehet, most ${kept.length} van.`);
  return kept;
}

/** Tisztítás és ellenőrzés mentés előtt. A korlátot túllépő adat hiba, soha nem vágjuk. */
export function normalizeBrandRules(input: BrandRules): BrandRules {
  const requiredPhrases = normalizePhrases("Kötelező kifejezések", input.requiredPhrases);
  const forbiddenPhrases = normalizePhrases("Tiltott kifejezések", input.forbiddenPhrases);
  const requiredDisclaimer = clean(input.requiredDisclaimer) || null;
  if (requiredDisclaimer && requiredDisclaimer.length > BRAND_LIMITS.disclaimer) {
    throw new BrandRulesError(`A kötelező záradék túl hosszú: legfeljebb ${BRAND_LIMITS.disclaimer} karakter, most ${requiredDisclaimer.length}.`);
  }
  for (const forbidden of forbiddenPhrases) {
    const inPhrase = requiredPhrases.find((p) => fold(p).includes(fold(forbidden)));
    if (inPhrase !== undefined) {
      throw new BrandRulesError(`A tiltott „${short(forbidden)}” benne van ebben a kötelező kifejezésben: „${short(inPhrase)}”. Így minden poszt megállna.`);
    }
    if (requiredDisclaimer && fold(requiredDisclaimer).includes(fold(forbidden))) {
      throw new BrandRulesError(`A tiltott „${short(forbidden)}” benne van a kötelező záradékban. Így minden poszt megállna.`);
    }
  }
  return { requiredPhrases, forbiddenPhrases, requiredDisclaimer };
}

// ─── Leképezés ───────────────────────────────────────────────────────────────

function buildVoice(brandVoice: unknown, warnings: string[]): string | null {
  const v = (brandVoice ?? {}) as Record<string, unknown>;
  const keywords = list(v.keywords).map(clean).filter(Boolean).join(", ");
  const lines = [["Hangnem", clean(v.tone)], ["Stílus", clean(v.style)], ["Kerülendő", clean(v.avoid)], ["Javasolt kulcsszavak", keywords]]
    .flatMap(([label, value]) => (value ? [`${label}: ${value}`] : []));
  const full = lines.join("\n");
  const voice = truncate(full, BRAND_LIMITS.voice).trim();
  if (voice !== full) warnings.push(`A hangnem leírása túl hosszú, csak az első ${BRAND_LIMITS.voice} karakter megy át.`);
  return voice || null;
}

function buildPillars(contentPillars: unknown, warnings: string[]): BrandProfileBody["pillars"] {
  const active = list(contentPillars).filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && (p as any).active === true);
  const mapped = active.flatMap((p) => {
    const fullName = clean(p.name);
    const name = truncate(fullName, BRAND_LIMITS.pillarName).trim();
    if (!name) {
      warnings.push("Egy név nélküli pillér kimarad.");
      return [];
    }
    if (name !== fullName) warnings.push(`A „${short(name)}” pillér neve túl hosszú, rövidítve megy át.`);
    const fullDescription = clean(p.description);
    const description = truncate(fullDescription, BRAND_LIMITS.pillarDescription).trim();
    if (description !== fullDescription) warnings.push(`A „${short(name)}” pillér leírása túl hosszú, rövidítve megy át.`);
    return [{ name, description: description || null }];
  });
  // Az egyediség a vágás UTÁNI névre vonatkozik.
  const { kept, dropped } = uniqueBy(mapped, (p) => p.name);
  for (const p of dropped) warnings.push(`Két aktív pillér neve azonos („${short(p.name)}”), csak az első megy át.`);
  for (const p of kept.slice(BRAND_LIMITS.pillars)) warnings.push(`Legfeljebb ${BRAND_LIMITS.pillars} pillér mehet át, ez kimarad: „${short(p.name)}”.`);
  return kept.slice(0, BRAND_LIMITS.pillars);
}

/** A mentett érték már ellenőrzött; ez a kézzel átírt sor ellen véd. Soha nem vág, csak kihagy. */
function safePhrases(label: string, stored: unknown, warnings: string[]): string[] {
  const all = list(stored).map(clean).filter(Boolean);
  const valid = uniqueBy(all.filter((p) => p.length <= BRAND_LIMITS.phrase && !p.includes("\n")), (p) => p).kept;
  const kept = valid.slice(0, BRAND_LIMITS.phrases);
  if (kept.length < uniqueBy(all, (p) => p).kept.length) warnings.push(`${label}: ami nem fér bele, kimarad. Nézd át a listát.`);
  return kept;
}

export function buildBrandProfile(
  profile: Partial<Pick<ClientProfile, "brandVoice" | "contentPillars">>,
  rules: BrandRules,
): BrandProfileMapping {
  const warnings: string[] = [];
  const disclaimer = clean(rules.requiredDisclaimer) || null;
  const disclaimerFits = disclaimer === null || disclaimer.length <= BRAND_LIMITS.disclaimer;
  const body: BrandProfileBody = {
    voice: buildVoice(profile.brandVoice, warnings),
    required_phrases: safePhrases("Kötelező kifejezések", rules.requiredPhrases, warnings),
    forbidden_phrases: safePhrases("Tiltott kifejezések", rules.forbiddenPhrases, warnings),
    required_disclaimer: disclaimerFits ? disclaimer : null,
    pillars: buildPillars(profile.contentPillars, warnings),
  };
  if (!disclaimerFits) warnings.push("A kötelező záradék túl hosszú, ezért kimarad.");
  const empty = body.voice === null && body.required_disclaimer === null
    && !body.required_phrases.length && !body.forbidden_phrases.length && !body.pillars.length;
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return { body, hash, empty, warnings };
}
