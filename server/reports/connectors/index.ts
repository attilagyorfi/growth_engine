/**
 * G2A Growth Engine – Reports connector layer
 *
 * `fetchMetrics(conn, from, to)` — a `reports.sync` mutation ezt hívja meg
 * platformonként. A visszatérés normalizált {platform, date, metricKey,
 * value, currency, dimension} sorok, amiket a `report_metrics` táblába
 * insertelünk.
 *
 * Élő adapter: GA4 (./ga4.ts), Search Console (./searchConsole.ts) és Google Ads
 * (../google/ads.ts), a LIVE_METRIC_PLATFORMS env-vel platformonként bekapcsolva.
 * A többi platform (és env nélkül mind) mock adatot ad; a Meta Ads külön körben jön.
 *
 * A mock generátor determinisztikus (nap + platform + metricKey → seed):
 * ugyanaz a from/to ugyanazokat a számokat adja vissza, így a UI-fejlesztés
 * predikálható értékekkel megy, és a `getMetricsByProfile` output-ja
 * tesztelhető.
 */
import type { DataConnection } from "../../../drizzle/schema";

/** Közösségi platformok: ezek sorai a Social Hubból jönnek (server/socialHub), nem data_connections-ből. */
export const SOCIAL_METRIC_PLATFORMS = ["facebook", "instagram", "linkedin"] as const;
export type SocialMetricPlatform = (typeof SOCIAL_METRIC_PLATFORMS)[number];

/** A report_metrics.platform összes értéke (a drizzle/schema.ts enumjával egyezik). */
export const METRIC_PLATFORMS = ["google_ads", "ga4", "search_console", "meta_ads", ...SOCIAL_METRIC_PLATFORMS] as const;
export type MetricPlatform = (typeof METRIC_PLATFORMS)[number];

export function isSocialMetricPlatform(platform: string): platform is SocialMetricPlatform {
  return (SOCIAL_METRIC_PLATFORMS as readonly string[]).includes(platform);
}

export type NormalizedMetricRow = {
  platform: MetricPlatform;
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
 * listáját (`fetchMetrics`): élő platformnál a valós adapterből, különben a
 * determinisztikus mockból (`mockMetrics`: a connectionId + date + metricKey
 * hash-e adja a seed-et).
 *
 * A hívó (server/reports/syncProfile.ts) platformonként a `replaceReportMetrics`-szel
 * írja be (törlés [from,to]-ban, majd beszúrás) — az `id, profileId, createdAt`
 * mezőket a helper egészíti ki.
 */
// ─── Adapter-forrás: env-kapcsoló (LIVE_METRIC_PLATFORMS) ─────────────────────
// Élő adapter: ga4, search_console, google_ads (Google OAuth, server/reports/google).
// Platformonként a LIVE_METRIC_PLATFORMS env kapcsolja be (pl. "ga4,search_console,google_ads");
// alapból üres → MINDEN platform mock adatot ad, a UI DEMO-t jelöl. Döntés: a még
// adapter nélküli meta_ads env-ben megadva is figyelmen kívül marad (figyelmeztetéssel),
// tehát mock + DEMO-jelölés marad, és az éjszakai szinkron sem húzza — így nem
// keletkezhet csendben hamis „élő” adat.
const CONNECTION_PLATFORMS = ["google_ads", "ga4", "search_console", "meta_ads"] as const;
type ConnectionPlatform = DataConnection["platform"];
type ConnectionRows = Array<Omit<NormalizedMetricRow, "platform"> & { platform: ConnectionPlatform }>;
export type LiveAdapter = (conn: DataConnection, from: string, to: string) => Promise<ConnectionRows>;

/** A platformok, amelyekhez van valós adapter (csak ezek kapcsolhatók élőre). */
export const LIVE_ADAPTER_PLATFORMS: ReadonlySet<ConnectionPlatform> = new Set<ConnectionPlatform>(["ga4", "search_console", "google_ads"]);

/**
 * LIVE_METRIC_PLATFORMS env → élő platformok halmaza. Vesszővel elválasztott,
 * kis-/nagybetű és szóköz közömbös; ismeretlen érték és adapter nélküli platform
 * kimarad (az `onIgnored` kapja meg, pl. figyelmeztető naplóhoz).
 */
export function parseLivePlatforms(raw: string | undefined | null, onIgnored?: (value: string) => void): Set<ConnectionPlatform> {
  const out = new Set<ConnectionPlatform>();
  for (const part of (raw ?? "").split(",")) {
    const value = part.trim().toLowerCase();
    if (!value) continue;
    if ((CONNECTION_PLATFORMS as readonly string[]).includes(value) && LIVE_ADAPTER_PLATFORMS.has(value as ConnectionPlatform)) {
      out.add(value as ConnectionPlatform);
    } else {
      onIgnored?.(value.slice(0, 40));
    }
  }
  return out;
}

export const LIVE_METRIC_PLATFORMS: ReadonlySet<ConnectionPlatform> = parseLivePlatforms(
  process.env.LIVE_METRIC_PLATFORMS,
  (value) => console.warn(`[metrics] LIVE_METRIC_PLATFORMS: '${value}' kimarad (ismeretlen vagy még nincs élő adapter) — mintaadat marad.`),
);

export type MetricsSource = "mock" | "live" | "mixed";

/** A metrikák jelenlegi forrása a UI/label számára (üres élő-lista → "mock"). */
export function getMetricsSource(live: ReadonlySet<string> = LIVE_METRIC_PLATFORMS): MetricsSource {
  const liveCount = CONNECTION_PLATFORMS.filter((p) => live.has(p)).length;
  if (liveCount === 0) return "mock";
  if (liveCount === CONNECTION_PLATFORMS.length) return "live";
  return "mixed";
}

/** Igaz, amíg BÁRMELY platform mock adatot ad — a UI ilyenkor DEMO-t jelöl. */
export function isDemoData(live: ReadonlySet<string> = LIVE_METRIC_PLATFORMS): boolean {
  return getMetricsSource(live) !== "live";
}

async function defaultLiveAdapter(platform: ConnectionPlatform): Promise<LiveAdapter | null> {
  const { defaultGoogleDeps } = await import("../google/client");
  if (platform === "ga4") {
    const { fetchGa4Metrics } = await import("./ga4");
    return (conn, from, to) => fetchGa4Metrics(conn, from, to, defaultGoogleDeps());
  }
  if (platform === "search_console") {
    const { fetchSearchConsoleMetrics } = await import("./searchConsole");
    return (conn, from, to) => fetchSearchConsoleMetrics(conn, from, to, defaultGoogleDeps());
  }
  if (platform === "google_ads") {
    const { fetchGoogleAdsMetrics } = await import("../google/ads");
    return (conn, from, to) => fetchGoogleAdsMetrics(conn, from, to, defaultGoogleDeps());
  }
  return null;
}

export type FetchMetricsOptions = {
  /** Az élő platformok (alapból a LIVE_METRIC_PLATFORMS). */
  live?: ReadonlySet<string>;
  /** Teszthez: platformonkénti adapter-felülírás. */
  adapters?: Partial<Record<ConnectionPlatform, LiveAdapter>>;
};

export async function fetchMetrics(
  conn: DataConnection,
  from: string,
  to: string,
  options: FetchMetricsOptions = {},
): Promise<ConnectionRows> {
  const live = options.live ?? LIVE_METRIC_PLATFORMS;
  if (live.has(conn.platform)) {
    const adapter = options.adapters?.[conn.platform] ?? (await defaultLiveAdapter(conn.platform));
    // Adapter nélküli élő platform: hangos hiba, nem csúszik át némán mintaadatra.
    if (!adapter) throw new Error(`[metrics] Live adapter for '${conn.platform}' is enabled but not implemented yet`);
    return adapter(conn, from, to);
  }
  return mockMetrics(conn, from, to);
}

/** A determinisztikus mintaadat (a DEMO-nézetek és a nem élő platformok forrása). */
export function mockMetrics(conn: Pick<DataConnection, "id" | "platform">, from: string, to: string): ConnectionRows {
  const config = METRIC_CONFIG[conn.platform] ?? [];
  const days = daysBetween(from, to);
  const rows: ConnectionRows = [];

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
