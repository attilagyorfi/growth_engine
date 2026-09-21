/**
 * #15/#16 nézetek — demo-szintézis + aggregáció sanity-teszt (nincs DB/I/O).
 */
import { describe, it, expect } from "vitest";
import { fetchMetrics } from "./reports/connectors";
import { buildChannelPerformance, buildConversion } from "./routers/reports";

async function demoRows(from: string, to: string) {
  const platforms = ["google_ads", "meta_ads", "ga4", "search_console"] as const;
  const rows: any[] = [];
  for (const p of platforms) {
    const r = await fetchMetrics({ id: `demo-${p}`, platform: p } as any, from, to);
    rows.push(...r);
  }
  return rows;
}

describe("#15/#16 nézetek", () => {
  it("a demo-generátor ad metrikákat mind a 4 platformra", async () => {
    const rows = await demoRows("2026-09-01", "2026-09-07");
    expect(rows.length).toBeGreaterThan(0);
    const platforms = new Set(rows.map((r) => r.platform));
    expect(platforms.size).toBe(4);
  });

  it("#15 buildChannelPerformance értelmes csatorna-sorokat + legjobbat ad", async () => {
    const cp = buildChannelPerformance(await demoRows("2026-09-01", "2026-09-07"));
    expect(cp.channels.length).toBeGreaterThan(0);
    expect(cp.totals.conversions).toBeGreaterThan(0);
    expect(cp.totals.spend).toBeGreaterThan(0);
    // best a fizetett csatornák közül való (vagy null, ha nincs értelmezhető CPA)
    expect(["google_ads", "meta_ads", null]).toContain(cp.best);
    // a paid csatornáknál van CPC/költség-per-konverzió
    const paid = cp.channels.filter((c) => c.paid);
    expect(paid.every((c) => c.spend > 0)).toBe(true);
  });

  it("#16 buildConversion tölcsért, rátákat, trendet és csatorna-bontást ad", async () => {
    const conv = buildConversion(await demoRows("2026-09-01", "2026-09-07"));
    expect(conv.funnel.impressions).toBeGreaterThan(0);
    expect(conv.funnel.clicks).toBeGreaterThan(0);
    expect(conv.funnel.conversions).toBeGreaterThan(0);
    // a tölcsér szűkül: megjelenés >= kattintás >= konverzió
    expect(conv.funnel.impressions).toBeGreaterThanOrEqual(conv.funnel.clicks);
    expect(conv.funnel.clicks).toBeGreaterThanOrEqual(conv.funnel.conversions);
    expect(conv.conversionRate).not.toBeNull();
    expect(conv.trend.length).toBe(7); // 7 nap
    expect(conv.byChannel.length).toBeGreaterThan(0);
    // a share-ek összege ~1
    const shareSum = conv.byChannel.reduce((a, c) => a + c.share, 0);
    expect(shareSum).toBeGreaterThan(0.99);
    expect(shareSum).toBeLessThan(1.01);
  });
});
