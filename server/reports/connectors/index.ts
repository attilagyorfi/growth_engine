/**
 * G2A Growth Engine – Reports connector layer
 *
 * `fetchMetrics(conn, from, to)` — a `reports.sync` mutation ezt hívja meg
 * platformonként. A visszatérés normalizált {platform, date, metricKey,
 * value, currency, dimension} sorok, amiket a `report_metrics` táblába
 * insertelünk.
 *
 * JELENLEG: mock adatot generál minden platformhoz. A valós adapterek
 * (GA4, Google Ads, Search Console, Meta Ads) külön PR-ekben jönnek,
 * miután a Google Cloud OAuth verification + Meta Ads Insights review
 * lezárul (2-6 hét platformonként).
 *
 * A mock generátor determinisztikus (nap + platform + metricKey → seed):
 * ugyanaz a from/to ugyanazokat a számokat adja vissza, így a UI-fejlesztés
 * predikálható értékekkel megy, és a `getMetricsByProfile` output-ja
 * tesztelhető.
 */
import type { DataConnection } from "../../../drizzle/schema";

export type NormalizedMetricRow = {
  platform: "google_ads" | "ga4" | "search_console" | "meta_ads";
  date: Date;
  metricKey: string;
  value: number;
  currency?: string | null;
  dimension?: Record<string, string> | null;
};

// Egyszerű determinisztikus pseudorandom (LCG) — teszt-friendly.
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function daysBetween(from: string, to: string): string[] {
  const start = new Date(from);
  const end = new Date(to);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Platform-specifikus metrika-listák — a UI ezek alapján épül.
const METRIC_CONFIG: Record<string, Array<{ key: string; base: number; variance: number; currency?: string }>> = {
  google_ads: [
    { key: "spend", base: 15000, variance: 0.3, currency: "HUF" },
    { key: "impressions", base: 8000, variance: 0.4 },
    { key: "clicks", base: 250, variance: 0.35 },
    { key: "conversions", base: 5, variance: 0.6 },
  ],
  meta_ads: [
    { key: "spend", base: 12000, variance: 0.4, currency: "HUF" },
    { key: "impressions", base: 15000, variance: 0.45 },
    { key: "clicks", base: 320, variance: 0.4 },
    { key: "conversions", base: 4, variance: 0.7 },
  ],
  ga4: [
    { key: "sessions", base: 450, variance: 0.3 },
    { key: "users", base: 380, variance: 0.3 },
    { key: "conversions", base: 8, variance: 0.5 },
    { key: "engagementRate", base: 0.62, variance: 0.15 },
  ],
  search_console: [
    { key: "impressions", base: 2200, variance: 0.35 },
    { key: "clicks", base: 85, variance: 0.4 },
    { key: "ctr", base: 0.038, variance: 0.2 },
    { key: "position", base: 12.5, variance: 0.15 },
  ],
};

/**
 * Egy `DataConnection`-höz és időszakhoz visszaadja a normalizált metrikák
 * listáját. MOCK — determinisztikus (a connectionId + date + metricKey
 * hash-e adja a seed-et).
 *
 * A hívó `insertReportMetrics(profileId, rows)`-szal írja be — a
 * `profileId`-t az `id, profileId, createdAt` mezőket a helper egészíti ki.
 */
// ─── Adapter-forrás: éles-ready kapcsoló ─────────────────────────────────────
// A valós adapterek (GA4, Google Ads, Search Console, Meta Ads) ide kerülnek be,
// MIUTÁN a Google Cloud OAuth verification + Meta Ads Insights review lezárul.
// Amíg ez a lista üres, MINDEN platform mock adatot ad → a UI DEMO-t jelöl.
// Élesítéskor egy platformhoz: (1) vedd fel ide, (2) implementáld a valós
// lekérést a fetchMetrics eleji ágban. Így a váltás egyetlen, jól látható pont.
export const LIVE_METRIC_PLATFORMS = new Set<DataConnection["platform"]>([
  // "google_ads", "ga4", "search_console", "meta_ads",
]);

export type MetricsSource = "mock" | "live" | "mixed";

/** A metrikák jelenlegi forrása a UI/label számára (üres élő-lista → "mock"). */
export function getMetricsSource(): MetricsSource {
  const all: DataConnection["platform"][] = ["google_ads", "ga4", "search_console", "meta_ads"];
  const liveCount = all.filter((p) => LIVE_METRIC_PLATFORMS.has(p)).length;
  if (liveCount === 0) return "mock";
  if (liveCount === all.length) return "live";
  return "mixed";
}

/** Igaz, amíg BÁRMELY platform mock adatot ad — a UI ilyenkor DEMO-t jelöl. */
export function isDemoData(): boolean {
  return getMetricsSource() !== "live";
}

export async function fetchMetrics(
  conn: DataConnection,
  from: string,
  to: string,
): Promise<Array<Omit<NormalizedMetricRow, "platform"> & { platform: DataConnection["platform"] }>> {
  // Éles seam: ha ez a platform már élő, ide jön a valós API-hívás. Amíg a
  // valós adapter nincs implementálva, hangosan jelezzük (nem csúszik át némán).
  if (LIVE_METRIC_PLATFORMS.has(conn.platform)) {
    throw new Error(`[metrics] Live adapter for '${conn.platform}' is enabled but not implemented yet`);
  }
  const config = METRIC_CONFIG[conn.platform] ?? [];
  const days = daysBetween(from, to);
  const rows: Array<Omit<NormalizedMetricRow, "platform"> & { platform: DataConnection["platform"] }> = [];

  for (const day of days) {
    for (const metric of config) {
      const seed = stringHash(`${conn.id}:${day}:${metric.key}`);
      const rand = seededRandom(seed);
      // Base * (1 + variance * (rand - 0.5) * 2) — ~ ±variance % szórás
      const noise = 1 + metric.variance * (rand() - 0.5) * 2;
      const value = metric.base * noise;
      // Rate/percentage-metrikákat 4 tizedesig, integereket egészre kerekítjük.
      const rounded = metric.key === "engagementRate" || metric.key === "ctr" || metric.key === "position"
        ? Math.round(value * 10000) / 10000
        : Math.round(value);
      rows.push({
        platform: conn.platform,
        date: new Date(day),
        metricKey: metric.key,
        value: rounded,
        currency: metric.currency ?? null,
        dimension: null,
      });
    }
  }
  return rows;
}
