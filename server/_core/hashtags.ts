/**
 * Hashtagek egységes alakja: `#` és szóköz nélkül, ismétlés nélkül — a felület
 * teszi elé a `#`-et. Modellenként eltér, hogy az AI `#`-tel adja-e vissza
 * (a Claude igen, a gpt-4o többnyire nem), ezért a generálás után normalizálunk;
 * enélkül a felületen `##Hashtag` jelent meg.
 */
export function normalizeHashtags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = String(tag ?? "").trim().replace(/^#+/, "").replace(/\s+/g, "");
    if (!clean) continue;
    const key = clean.toLocaleLowerCase("hu-HU");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/** Egy AI-válasz objektum `hashtags` mezőjét normalizálja (ha van). */
export function withNormalizedHashtags<T>(obj: T): T {
  if (obj && typeof obj === "object" && "hashtags" in (obj as Record<string, unknown>)) {
    return { ...obj, hashtags: normalizeHashtags((obj as Record<string, unknown>).hashtags) };
  }
  return obj;
}
