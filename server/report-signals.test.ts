/**
 * G1 AI-narratíva — a riport-jelek előfeldolgozója (tiszta függvények, nincs DB/LLM).
 * Küszöbök, kis bázis, prevValue=0, okhozzárendelés és az előző időszak számítása.
 */
import { describe, it, expect } from "vitest";
import {
  analyzeReportPeriod,
  detectSignificantChanges,
  isSignificantChange,
  percentChange,
  periodDays,
  previousPeriod,
  DEFAULT_MIN_ABSOLUTE_BASE,
  MIN_ABSOLUTE_BASE,
  SIGNIFICANT_CHANGE_PCT,
  type ChannelComparison,
  type MetricRow,
  type ReportContextSignals,
} from "./ai/reportSignals";

/** Napi sorok egy platform egy mutatójára: az időszak összértéke egyenletesen elosztva. */
function rows(platform: string, metricKey: string, total: number, from: string, days: number): MetricRow[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => ({
    platform,
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    metricKey,
    value: total / days,
  }));
}

const CUR = { from: "2026-10-01", to: "2026-10-31" };
const PREV_FROM = "2026-08-31";

const context = (over: Partial<ReportContextSignals> = {}): ReportContextSignals => ({
  adSpend: { current: 100_000, previous: 100_000 },
  noCampaign: false,
  posts: { current: null, previous: null },
  missingData: [],
  ...over,
});

const channel = (platform: string, prev: Record<string, number>, cur: Record<string, number>): ChannelComparison => ({
  platform,
  label: platform,
  current: { metrics: cur, daysWithData: 31 },
  previous: { metrics: prev, daysWithData: 31 },
});

describe("previousPeriod / periodDays", () => {
  it("31 napos hónap → az előtte álló 31 nap (to = from − 1 nap), hónapváltással", () => {
    expect(periodDays("2026-10-01", "2026-10-31")).toBe(31);
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({ from: "2026-08-31", to: "2026-09-30", days: 31 });
  });

  it("30 napos hónap → az előtte álló 30 nap", () => {
    expect(previousPeriod("2026-11-01", "2026-11-30")).toEqual({ from: "2026-10-02", to: "2026-10-31", days: 30 });
  });

  it("február és szökőév, évváltás, egynapos időszak", () => {
    expect(previousPeriod("2026-03-01", "2026-03-31")).toEqual({ from: "2026-01-29", to: "2026-02-28", days: 31 });
    expect(previousPeriod("2028-03-01", "2028-03-31")).toEqual({ from: "2028-01-30", to: "2028-02-29", days: 31 });
    expect(previousPeriod("2027-01-01", "2027-01-31")).toEqual({ from: "2026-12-01", to: "2026-12-31", days: 31 });
    expect(previousPeriod("2026-10-15", "2026-10-15")).toEqual({ from: "2026-10-14", to: "2026-10-14", days: 1 });
  });
});

describe("küszöbök", () => {
  it("elnevezett, exportált küszöbök", () => {
    expect(SIGNIFICANT_CHANGE_PCT).toBe(20);
    expect(MIN_ABSOLUTE_BASE.conversions).toBeGreaterThan(0);
    expect(DEFAULT_MIN_ABSOLUTE_BASE).toBeGreaterThan(0);
  });

  it("a küszöb alatti változás nincs jelölve", () => {
    expect(isSignificantChange("clicks", 1000, 850)).toBe(false); // −15%
    expect(detectSignificantChanges([channel("google_ads", { clicks: 1000 }, { clicks: 1190 })], context())).toEqual([]);
  });

  it("a küszöb feletti visszaesés és növekedés jelölve, irány és százalék szerint", () => {
    const changes = detectSignificantChanges(
      [channel("google_ads", { clicks: 1000, impressions: 10_000, spend: 50_000 }, { clicks: 600, impressions: 13_000, spend: 50_000 })],
      context(),
    );
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.metricKey === "clicks")).toMatchObject({
      direction: "down", previous: 1000, current: 600, changePct: -40, diff: -400, label: "Kattintás",
    });
    expect(changes.find((c) => c.metricKey === "impressions")).toMatchObject({ direction: "up", changePct: 30 });
  });

  it("pontosan a küszöbnél jelöl", () => {
    expect(isSignificantChange("clicks", 1000, 800)).toBe(true);
  });

  it("kis abszolút bázisnál nincs jelölés (2 → 4 konverzió nem +100%-os hír)", () => {
    expect(isSignificantChange("conversions", 2, 4)).toBe(false);
    expect(isSignificantChange("conversions", 4, 0)).toBe(false);
    expect(isSignificantChange("ismeretlen_mutato", DEFAULT_MIN_ABSOLUTE_BASE - 1, 0)).toBe(false);
  });

  it("prevValue = 0: nincs nullával osztás, nincs százalék és nincs jelölés", () => {
    expect(percentChange(0, 500)).toBeNull();
    expect(isSignificantChange("clicks", 0, 500)).toBe(false);
    const changes = detectSignificantChanges([channel("google_ads", { clicks: 0 }, { clicks: 500 })], context());
    expect(changes).toEqual([]);
  });
});

describe("okhozzárendelés", () => {
  it("0 hirdetési költésnél a fizetett csatorna visszaesésének oka no_campaign", () => {
    const [c] = detectSignificantChanges(
      [channel("google_ads", { clicks: 1000 }, { clicks: 0, spend: 0 })],
      context({ adSpend: { current: 0, previous: 80_000 }, noCampaign: true }),
    );
    expect(c).toMatchObject({ metricKey: "clicks", direction: "down", cause: "no_campaign" });
  });

  it("a forgalmi csatorna visszaesésének oka no_campaign, ha az előző időszakban volt költés, most nincs", () => {
    const [c] = detectSignificantChanges(
      [channel("ga4", { sessions: 2000 }, { sessions: 1200 })],
      context({ adSpend: { current: 0, previous: 80_000 }, noCampaign: true }),
    );
    expect(c.cause).toBe("no_campaign");
  });

  it("kevesebb posztnál (mindkét időszakban van posztadat) a közösségi visszaesés oka fewer_posts", () => {
    const [c] = detectSignificantChanges(
      [channel("facebook", { reach: 10_000 }, { reach: 6000 })],
      context({ posts: { current: 4, previous: 10 } }),
    );
    expect(c.cause).toBe("fewer_posts");
  });

  it("ha az előző időszakban volt poszt, most pedig 0, az ok fewer_posts", () => {
    const [c] = detectSignificantChanges(
      [channel("facebook", { reach: 10_000 }, { reach: 6000 })],
      context({ posts: { current: 0, previous: 5 } }),
    );
    expect(c.cause).toBe("fewer_posts");
  });

  it("ha egyik időszakban sincs posztadat, az ok nem fewer_posts", () => {
    for (const posts of [{ current: 0, previous: 0 }, { current: null, previous: null }, { current: 4, previous: null }]) {
      const [c] = detectSignificantChanges([channel("facebook", { reach: 10_000 }, { reach: 6000 })], context({ posts }));
      expect(c.cause).toBe("unknown");
    }
  });

  it("több posztnál a közösségi növekedés oka more_posts", () => {
    const [c] = detectSignificantChanges(
      [channel("instagram", { engagement: 400 }, { engagement: 700 })],
      context({ posts: { current: 12, previous: 6 } }),
    );
    expect(c).toMatchObject({ direction: "up", cause: "more_posts" });
  });

  it("hiányzó csatorna- vagy időszakadatnál missing_data", () => {
    const missing = context({
      missingData: [{ platform: "meta_ads", period: "current", kind: "partial", daysWithData: 10, days: 31 }],
    });
    const [c] = detectSignificantChanges([channel("meta_ads", { clicks: 900, spend: 40_000 }, { clicks: 300, spend: 15_000 })], missing);
    expect(c.cause).toBe("missing_data");
  });

  it("jel híján az ok ismeretlen", () => {
    const [c] = detectSignificantChanges([channel("google_ads", { clicks: 1000, spend: 50_000 }, { clicks: 500, spend: 50_000 })], context());
    expect(c.cause).toBe("unknown");
  });
});

describe("analyzeReportPeriod", () => {
  it("csatorna-összevetés, költés- és hiányjelek a nyers sorokból", () => {
    const signals = analyzeReportPeriod({
      ...CUR,
      currentRows: [
        ...rows("google_ads", "clicks", 600, CUR.from, 31),
        ...rows("google_ads", "spend", 0, CUR.from, 31),
        ...rows("ga4", "sessions", 3000, CUR.from, 10), // csak 10 napra van adat
      ],
      previousRows: [
        ...rows("google_ads", "clicks", 1000, PREV_FROM, 31),
        ...rows("google_ads", "spend", 90_000, PREV_FROM, 31),
        ...rows("ga4", "sessions", 3000, PREV_FROM, 31),
        ...rows("meta_ads", "clicks", 500, PREV_FROM, 31),
      ],
      posts: { current: 3, previous: 5 },
    });

    expect(signals.previousPeriod).toEqual({ from: "2026-08-31", to: "2026-09-30", days: 31 });
    expect(signals.context.adSpend).toEqual({ current: 0, previous: 90_000 });
    expect(signals.context.noCampaign).toBe(true);
    expect(signals.context.missingData).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "ga4", period: "current", kind: "partial", daysWithData: 10 }),
      expect.objectContaining({ platform: "meta_ads", period: "current", kind: "no_rows" }),
    ]));
    const gads = signals.channels.find((c) => c.platform === "google_ads")!;
    expect(gads.previous?.metrics.clicks).toBe(1000);
    expect(signals.changes.find((c) => c.platform === "google_ads" && c.metricKey === "clicks")?.cause).toBe("no_campaign");
    expect(signals.changes.find((c) => c.platform === "meta_ads")?.cause).toBe("missing_data");
  });

  it("összevetésnél az üres előző időszak previous/no_rows hiányjelet ad, a növekedés nincs jelölve", () => {
    const signals = analyzeReportPeriod({
      ...CUR,
      currentRows: rows("google_ads", "clicks", 500, CUR.from, 31),
      previousRows: [],
    });
    expect(signals.context.missingData).toEqual([expect.objectContaining({ platform: "google_ads", period: "previous", kind: "no_rows" })]);
    expect(signals.changes).toEqual([]);
  });

  it("szinkronhibás platform missing_data jelet kap", () => {
    const signals = analyzeReportPeriod({
      ...CUR,
      currentRows: rows("google_ads", "clicks", 500, CUR.from, 31),
      previousRows: rows("google_ads", "clicks", 1000, PREV_FROM, 31),
      syncErrorPlatforms: ["google_ads"],
    });
    expect(signals.context.missingData).toEqual([expect.objectContaining({ platform: "google_ads", kind: "sync_error" })]);
    expect(signals.changes[0].cause).toBe("missing_data");
  });

  it("összevetés nélkül (previousRows = null) nincs előző időszak és nincs jelölt változás", () => {
    const signals = analyzeReportPeriod({
      ...CUR,
      currentRows: rows("google_ads", "clicks", 500, CUR.from, 31),
      previousRows: null,
      posts: { current: 4, previous: 9 },
    });
    expect(signals.previousPeriod).toBeNull();
    expect(signals.channels[0].previous).toBeNull();
    expect(signals.changes).toEqual([]);
    expect(signals.context.adSpend.previous).toBeNull();
    expect(signals.context.posts.previous).toBeNull();
  });

  it("közösségi csatornán a követőszám időszak végi érték, nem napi összeg", () => {
    const followers = (from: string, value: number): MetricRow[] =>
      Array.from({ length: 31 }, (_, i) => ({
        platform: "facebook",
        date: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
        metricKey: "followers",
        value,
      }));
    const signals = analyzeReportPeriod({ ...CUR, currentRows: followers(CUR.from, 1200), previousRows: followers(PREV_FROM, 1000) });
    const fb = signals.channels.find((c) => c.platform === "facebook")!;
    expect(fb.current?.metrics.followers).toBe(1200);
    expect(signals.changes).toEqual([expect.objectContaining({ metricKey: "followers", changePct: 20, direction: "up" })]);
  });
});
