/**
 * G2A Growth Engine – számellenőrzés az AI-narratívához (G1)
 *
 * Tiszta függvények: a generált szövegből kinyeri a számokat (magyar formátum:
 * szóköz/pont ezreselválasztó, tizedesvessző, %, „ezer/millió/milliárd”), és
 * megnézi, hogy mindegyik a bemenetből származik-e (kerekítési tűréssel). A
 * felsorolás sorszámai („1.”, „2)”) nem számítanak; más kis egész nem kap felmentést.
 */

export type ExtractedNumber = {
  /** A szövegben talált alak (pl. „150 000”, „12,5”, „1,2 millió”). */
  raw: string;
  /** Abszolút érték (az előjel nem számít: „−25%” és „25%-kal csökkent” ugyanaz). */
  value: number;
  /** Tizedesjegyek száma a szövegben (a kerekítési tűréshez). */
  decimals: number;
  /** Szorzó (ezer/millió/milliárd), egyébként 1. */
  multiplier: number;
  /** Szóközzel tagolt alak csoportjai — ha az egész nem igazolható, darabonként is próbáljuk („3 150” lehet „3” és „150”). */
  spaceGroups: number[] | null;
};

/** Relatív kerekítési tűrés (pl. 152 340 → „152 ezer” még elfogadott). */
export const RELATIVE_TOLERANCE = 0.005;

const MULTIPLIERS: Record<string, number> = { ezer: 1e3, millió: 1e6, milliárd: 1e9 };

// Számjegy közvetlenül betű után (pl. „GA4”) nem szám. Ezres tagolás: szóköz vagy
// pont, pontosan 3 jegyű csoportokkal; tizedes: vessző.
const LETTER = "A-Za-z\\u00C0-\\u024F";
const NUMBER_RE = new RegExp(
  `(?<![${LETTER}\\d,])(\\d{1,3}(?:[ .]\\d{3})+(?!\\d)|\\d+)(?:,(\\d+))?(?:\\s?(ezer|milliárd|millió)(?![${LETTER}]))?`,
  "g",
);

// Felsorolás- és címsor-sorszám a sor elején: „1. ”, „2) ”, „## 3. ”, „**4.** ”.
const ORDINAL_RE = /^(\s*(?:#{1,6}\s*)?(?:[-*+]\s+)?(?:\*\*)?)\d{1,2}[.)](\*\*)?(?=\s)/gm;

function normalize(text: string): string {
  // Nem törő és keskeny szóközök (pl. a hu-HU ezres tagolás) → sima szóköz; a sortörés marad.
  return text.replace(/[^\S\r\n]/g, " ");
}

export function stripListOrdinals(text: string): string {
  return text.replace(ORDINAL_RE, "$1$2");
}

export function extractNumbers(text: string): ExtractedNumber[] {
  const src = stripListOrdinals(normalize(text));
  const out: ExtractedNumber[] = [];
  for (const m of Array.from(src.matchAll(NUMBER_RE))) {
    const intPart = m[1];
    const frac = m[2] ?? "";
    const mult = m[3] ? MULTIPLIERS[m[3]] : 1;
    const digits = intPart.replace(/[ .]/g, "");
    out.push({
      raw: m[0].trim(),
      value: Number(`${digits}${frac ? "." + frac : ""}`),
      decimals: frac.length,
      multiplier: mult,
      spaceGroups: intPart.includes(" ") && !frac && mult === 1 ? intPart.split(" ").map(Number) : null,
    });
  }
  return out;
}

function matchesAny(shown: number, decimals: number, multiplier: number, allowed: number[]): boolean {
  const target = shown * multiplier;
  const roundingTol = 0.5 * Math.pow(10, -decimals) * multiplier;
  return allowed.some((a) => {
    const v = Math.abs(a);
    return Math.abs(target - v) <= Math.max(roundingTol, RELATIVE_TOLERANCE * v) + 1e-9;
  });
}

/** A szöveg azon számai (eredeti alakjukban), amelyek nem vezethetők vissza a bemenetre. */
export function findUnverifiedNumbers(text: string, allowed: Iterable<number>): string[] {
  const list = Array.from(allowed).filter((n) => Number.isFinite(n));
  return extractNumbers(text)
    .filter((n) => {
      if (matchesAny(n.value, n.decimals, n.multiplier, list)) return false;
      if (n.spaceGroups && n.spaceGroups.every((g) => matchesAny(g, 0, 1, list))) return false;
      return true;
    })
    .map((n) => n.raw);
}
