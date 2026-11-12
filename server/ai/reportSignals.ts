/**
 * G2A Growth Engine – riport-jelek előfeldolgozója (G1, AI-narratíva valós adatból)
 *
 * Tiszta, determinisztikus függvények: nincs DB-, hálózat- vagy LLM-hívás. A
 * `reports.generate` ebből számolja ki az AI-narratíva strukturált bemenetét:
 *   - az előző, azonos hosszúságú időszakot (`previousPeriod`),
 *   - csatornánként az aktuális és az előző időszak összesített mutatóit,
 *   - a kontextus-jeleket (hirdetési költés, posztszám, hiányos adat / szinkronhiba),
 *   - a küszöb feletti visszaeséseket és növekedéseket, mindegyikhez egy
 *     lehetséges okkal a fenti jelekből (ok híján „unknown”).
 * A modell CSAK ezekből az okokból magyarázhat (lásd server/ai/reportSummary.ts).
 */
import { buildSocialSummary, platformLabel, socialMetricLabel } from "../reports/content";
import { isSocialMetricPlatform } from "../reports/connectors";

// ─── Küszöbök ────────────────────────────────────────────────────────────────

/** Ennyi százalékos (vagy nagyobb) változás számít „nagynak” (mindkét irányban). */
export const SIGNIFICANT_CHANGE_PCT = 20;

/**
 * Minimális abszolút bázis (az előző időszak értéke) mutatónként: ez alatt a
 * százalékos változás félrevezető (pl. 2 → 4 konverzió = +100%), ezért nem jelölünk.
 */
export const MIN_ABSOLUTE_BASE: Readonly<Record<string, number>> = {
  spend: 10_000,
  impressions: 1_000,
  clicks: 50,
  conversions: 5,
  sessions: 100,
  reach: 500,
  engagement: 50,
  followers: 100,
};

/** Ismeretlen mutatónál alkalmazott minimális bázis. */
export const DEFAULT_MIN_ABSOLUTE_BASE = 20;

/** Ha egy csatorna napjainak kevesebb mint ennyi része fedett adattal, az adat hiányosnak számít. */
export const MIN_DAY_COVERAGE = 0.8;

/** Fizetett (hirdetési) csatornák: ezek költése jelzi, hogy futott-e kampány. */
export const PAID_PLATFORMS: readonly string[] = ["google_ads", "meta_ads"];

/**
 * Összevetett, napokon át összeadható mutatók. Az arány- és átlagmutatók
 * (ctr, position, engagementRate) összege értelmetlen, ezért kimaradnak.
 */
const COMPARED_METRICS: Readonly<Record<string, string>> = {
  spend: "Költés",
  impressions: "Megjelenés",
  clicks: "Kattintás",
  conversions: "Konverzió",
  sessions: "Munkamenet",
};
const COMPARED_SOCIAL_METRICS = ["followers", "reach", "impressions", "engagement"];

// ─── Időszak ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function parseIsoDay(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Érvénytelen dátum: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export type Period = { from: string; to: string; days: number };

/** A [from, to] időszak napjainak száma (mindkét vég beleszámít). */
export function periodDays(from: string, to: string): number {
  return Math.round((parseIsoDay(to) - parseIsoDay(from)) / DAY_MS) + 1;
}

/** Az előző, azonos napszámú időszak: to = from − 1 nap, from = to − (napszám − 1). */
export function previousPeriod(from: string, to: string): Period {
  const days = periodDays(from, to);
  const prevTo = parseIsoDay(from) - DAY_MS;
  return { from: toIsoDay(prevTo - (days - 1) * DAY_MS), to: toIsoDay(prevTo), days };
}

// ─── Csatornánkénti összesítés ───────────────────────────────────────────────

export type MetricRow = {
  platform: string;
  date: Date | string;
  metricKey: string;
  value: number;
  dimension?: Record<string, string> | null;
};

/** Egy csatorna egy időszakra: összesített mutatók + hány napra volt adat. */
export type ChannelPeriodStats = { metrics: Record<string, number>; daysWithData: number };

export type ChannelComparison = {
  platform: string;
  label: string;
  current: ChannelPeriodStats | null;
  /** Összevetés nélkül (compareToPrevious=false) mindig null. */
  previous: ChannelPeriodStats | null;
};

const dayOf = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Platformonként összesít. Fizetett/forgalmi csatorna: összeg; közösségi csatorna:
 * a riport „Közösségi média” szakaszával azonos logika (buildSocialSummary), így a
 * követőszám az időszak végi érték, nem napi összeg.
 */
export function aggregateChannels(rows: MetricRow[]): Map<string, ChannelPeriodStats> {
  const out = new Map<string, ChannelPeriodStats>();
  const platforms = Array.from(new Set(rows.map((r) => r.platform)));
  for (const platform of platforms) {
    const own = rows.filter((r) => r.platform === platform && Number.isFinite(r.value));
    const daysWithData = new Set(own.map((r) => dayOf(r.date))).size;
    const metrics: Record<string, number> = {};
    if (isSocialMetricPlatform(platform)) {
      const social = buildSocialSummary(own)[0];
      for (const m of social?.metrics ?? []) {
        if (COMPARED_SOCIAL_METRICS.includes(m.key)) metrics[m.key] = m.value;
      }
    } else {
      for (const r of own) {
        if (!(r.metricKey in COMPARED_METRICS)) continue;
        metrics[r.metricKey] = (metrics[r.metricKey] ?? 0) + r.value;
      }
      for (const k of Object.keys(metrics)) metrics[k] = round2(metrics[k]);
    }
    out.set(platform, { metrics, daysWithData });
  }
  return out;
}

export function metricLabel(platform: string, key: string): string {
  return isSocialMetricPlatform(platform) ? socialMetricLabel(key) : COMPARED_METRICS[key] ?? key;
}

// ─── Kontextus-jelek ─────────────────────────────────────────────────────────

export type MissingDataSignal = {
  platform: string;
  period: "current" | "previous";
  /** no_rows: egyáltalán nincs sor; partial: az időszak egy részére nincs; sync_error: a legutóbbi szinkron hibás volt. */
  kind: "no_rows" | "partial" | "sync_error";
  daysWithData: number;
  days: number;
};

export type ReportContextSignals = {
  /** Fizetett csatornák összes költése (HUF). previous: null, ha nincs összevetés. */
  adSpend: { current: number; previous: number | null };
  /** Igaz, ha az időszakban 0 volt a hirdetési költés (nem futott fizetett kampány). */
  noCampaign: boolean;
  /** A profil időszakbeli ütemezett/publikált posztjai (null: nem ismert / nincs összevetés). */
  posts: { current: number | null; previous: number | null };
  missingData: MissingDataSignal[];
};

// ─── Megjelölt változások ────────────────────────────────────────────────────

export type ChangeCause = "no_campaign" | "fewer_posts" | "more_posts" | "missing_data" | "unknown";

export const CHANGE_CAUSE_TEXT: Readonly<Record<ChangeCause, string>> = {
  no_campaign: "nem futott fizetett kampány (az időszakban nem volt hirdetési költés)",
  fewer_posts: "kevesebb poszt készült, mint az előző időszakban",
  more_posts: "több poszt készült, mint az előző időszakban",
  missing_data: "hiányos adat: erre a csatornára az időszak egy részére (vagy egészére) nincs mérés",
  unknown: "ismeretlen",
};

export type FlaggedChange = {
  platform: string;
  metricKey: string;
  label: string;
  direction: "up" | "down";
  previous: number;
  current: number;
  /** Előjeles változás, 1 tizedesre kerekítve (pl. −35.2). */
  changePct: number;
  /** Előjeles abszolút különbség (current − previous). */
  diff: number;
  cause: ChangeCause;
};

export type ReportSignals = {
  period: Period;
  /** null, ha nincs összevetés (compareToPrevious=false). */
  previousPeriod: Period | null;
  channels: ChannelComparison[];
  context: ReportContextSignals;
  changes: FlaggedChange[];
};

export function minBaseFor(metricKey: string): number {
  return MIN_ABSOLUTE_BASE[metricKey] ?? DEFAULT_MIN_ABSOLUTE_BASE;
}

/**
 * Százalékos változás 1 tizedesre; null, ha az előző érték ≤ 0 (nincs nullával
 * osztás, „új aktivitásnál” nincs százalék).
 */
export function percentChange(previous: number, current: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Jelölendő-e a változás: elég nagy bázis és legalább SIGNIFICANT_CHANGE_PCT százalék. */
export function isSignificantChange(metricKey: string, previous: number, current: number): boolean {
  const pct = percentChange(previous, current);
  if (pct == null || previous < minBaseFor(metricKey)) return false;
  return Math.abs(pct) >= SIGNIFICANT_CHANGE_PCT;
}

function causeFor(
  change: { platform: string; direction: "up" | "down" },
  channel: ChannelComparison,
  context: ReportContextSignals,
): ChangeCause {
  const { platform, direction } = change;
  const period = direction === "down" ? "current" : "previous";
  if (context.missingData.some((m) => m.platform === platform && m.period === period)) return "missing_data";

  if (direction === "down") {
    if (PAID_PLATFORMS.includes(platform)) {
      if ((channel.current?.metrics.spend ?? 0) === 0) return "no_campaign";
    } else if (!isSocialMetricPlatform(platform)) {
      // Forgalmi csatorna (GA4, Search Console): akkor magyarázza a kampány hiánya,
      // ha az előző időszakban volt hirdetési költés, most pedig nem.
      if (context.noCampaign && (context.adSpend.previous ?? 0) > 0) return "no_campaign";
    }
  }

  // Posztszám csak a közösségi csatornákat magyarázza, és csak ha mindkét időszakra
  // van posztadat, az előző időszakban pedig volt poszt (ha mindkettő 0, az nem ok:
  // a GE nem publikál, a 0 nem jelenti, hogy nem jelent meg semmi).
  const { current: pc, previous: pp } = context.posts;
  if (isSocialMetricPlatform(platform) && pc != null && pp != null && pp > 0) {
    if (direction === "down" && pc < pp) return "fewer_posts";
    if (direction === "up" && pc > pp) return "more_posts";
  }
  return "unknown";
}

/** Csatornánként és mutatónként a küszöb feletti változások, okkal. */
export function detectSignificantChanges(channels: ChannelComparison[], context: ReportContextSignals): FlaggedChange[] {
  const out: FlaggedChange[] = [];
  for (const ch of channels) {
    // Összevetés nélkül (previous === null) nincs mit jelölni.
    if (!ch.previous) continue;
    const cur = ch.current?.metrics ?? {};
    const prev = ch.previous.metrics;
    const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(cur)]));
    for (const key of keys) {
      const p = prev[key] ?? 0;
      const c = cur[key] ?? 0;
      if (!isSignificantChange(key, p, c)) continue;
      const direction = c < p ? "down" : "up";
      out.push({
        platform: ch.platform,
        metricKey: key,
        label: metricLabel(ch.platform, key),
        direction,
        previous: p,
        current: c,
        changePct: percentChange(p, c)!,
        diff: round2(c - p),
        cause: causeFor({ platform: ch.platform, direction }, ch, context),
      });
    }
  }
  return out;
}

// ─── Teljes elemzés ──────────────────────────────────────────────────────────

export type AnalyzeInput = {
  from: string;
  to: string;
  currentRows: MetricRow[];
  /** null: nincs összevetés (compareToPrevious=false). */
  previousRows: MetricRow[] | null;
  posts?: { current: number | null; previous: number | null };
  /** Platformok, amelyek kapcsolatának legutóbbi szinkronja hibával zárult. */
  syncErrorPlatforms?: string[];
};

/** A narratíva strukturált bemenete: időszakok, csatorna-összevetés, kontextus-jelek, megjelölt változások. */
export function analyzeReportPeriod(input: AnalyzeInput): ReportSignals {
  const period: Period = { from: input.from, to: input.to, days: periodDays(input.from, input.to) };
  const compare = input.previousRows != null;
  const prevPeriod = compare ? previousPeriod(input.from, input.to) : null;

  const cur = aggregateChannels(input.currentRows);
  const prev = compare ? aggregateChannels(input.previousRows!) : new Map<string, ChannelPeriodStats>();
  const platforms = Array.from(new Set([...Array.from(cur.keys()), ...Array.from(prev.keys())]));
  const channels: ChannelComparison[] = platforms.map((platform) => ({
    platform,
    label: platformLabel(platform),
    current: cur.get(platform) ?? null,
    previous: compare ? prev.get(platform) ?? { metrics: {}, daysWithData: 0 } : null,
  }));

  const missingData: MissingDataSignal[] = [];
  const coverage = (stats: ChannelPeriodStats | null, days: number) =>
    !stats || stats.daysWithData === 0 ? "no_rows" : stats.daysWithData < days * MIN_DAY_COVERAGE ? "partial" : null;
  for (const ch of channels) {
    const c = coverage(ch.current, period.days);
    if (c) missingData.push({ platform: ch.platform, period: "current", kind: c, daysWithData: ch.current?.daysWithData ?? 0, days: period.days });
    if (prevPeriod) {
      const p = coverage(ch.previous, prevPeriod.days);
      if (p) missingData.push({ platform: ch.platform, period: "previous", kind: p, daysWithData: ch.previous?.daysWithData ?? 0, days: prevPeriod.days });
    }
  }
  for (const platform of input.syncErrorPlatforms ?? []) {
    if (missingData.some((m) => m.platform === platform && m.period === "current")) continue;
    const stats = cur.get(platform);
    missingData.push({ platform, period: "current", kind: "sync_error", daysWithData: stats?.daysWithData ?? 0, days: period.days });
  }

  const paidSpend = (m: Map<string, ChannelPeriodStats>) =>
    round2(PAID_PLATFORMS.reduce((a, p) => a + (m.get(p)?.metrics.spend ?? 0), 0));
  const adSpend = { current: paidSpend(cur), previous: compare ? paidSpend(prev) : null };
  const context: ReportContextSignals = {
    adSpend,
    noCampaign: adSpend.current === 0,
    posts: {
      current: input.posts?.current ?? null,
      previous: compare ? input.posts?.previous ?? null : null,
    },
    missingData,
  };

  return {
    period,
    previousPeriod: prevPeriod,
    channels,
    context,
    changes: detectSignificantChanges(channels, context),
  };
}
