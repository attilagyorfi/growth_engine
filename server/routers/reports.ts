/**
 * G2A Growth Engine – Reports router (2026-06)
 *
 * A mellékelt integrációs skeleton alapján, a repó konvencióihoz igazítva:
 *   - appUserProcedure + assertProfileOwnership tenancy-hoz
 *   - db-helperek a server/db.ts-ből
 *   - mock connector a server/reports/connectors-ból
 *   - AI narratíva a server/ai/reportSummary.ts-ből
 *   - PDF stub a server/reports/pdf.ts-ből (Playwright TODO)
 *
 * Az eljárások: connections.list/upsert/disconnect, sync, generate, list,
 * get, schedule. A `buildSummary` tiszta függvény — unit-tesztelhető.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, appUserProcedure } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import {
  getProfileById,
  listDataConnections,
  upsertDataConnection,
  deleteDataConnection,
  insertReportMetrics,
  getMetricsByProfile,
  createReport,
  updateReport,
  listReports,
  getReportById,
  upsertReportSchedule,
} from "../db";
import { generateReportSummary } from "../ai/reportSummary";
import { renderReportPdf } from "../reports/pdf";
import { fetchMetrics, getMetricsSource, isDemoData } from "../reports/connectors";

const platformEnum = z.enum(["google_ads", "ga4", "search_console", "meta_ads"]);

export const reportsRouter = router({
  // ─── Kapcsolatok (Ads/Analytics OAuth) ───────────────────────────────────
  connections: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return listDataConnections(input.profileId);
      }),

    // Az OAuth callback után hívva (jelenleg mock, a valós OAuth flow-k
    // külön PR-ekben jönnek: googleAdsOAuth, gscOAuth, ga4OAuth, meta ads
    // scope kiterjesztése a meglévő facebookOAuth.ts-hez).
    upsert: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: platformEnum,
        externalAccountId: z.string(),
        externalAccountName: z.string().optional(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        tokenExpiry: z.date().optional(),
        scopes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return upsertDataConnection({ ...input, connected: true });
      }),

    disconnect: appUserProcedure
      .input(z.object({ profileId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return deleteDataConnection(input.profileId, input.connectionId);
      }),
  }),

  // ─── Adat-szinkron: metrikák behúzása és normalizált tárolása ─────────────
  sync: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      from: z.string(), // YYYY-MM-DD
      to: z.string(),
      platforms: z.array(platformEnum).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const conns = await listDataConnections(input.profileId);
      const targets = input.platforms
        ? conns.filter((c) => input.platforms!.includes(c.platform))
        : conns;

      let inserted = 0;
      for (const conn of targets) {
        try {
          const rows = await fetchMetrics(conn, input.from, input.to);
          const result = await insertReportMetrics(input.profileId, rows);
          inserted += result.inserted;
        } catch (err) {
          console.error(`[reports.sync] ${conn.platform} failed:`, err);
          // Nem dobjuk tovább — a többi platform szinkron menjen tovább
        }
      }
      return { platforms: targets.map((t) => t.platform), inserted };
    }),

  // ─── Riport legenerálása (összesítés → AI-narratíva → PDF) ────────────────
  generate: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      from: z.string(),
      to: z.string(),
      templateKey: z.enum(["default", "paid", "seo"]).default("default"),
      compareToPrevious: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);

      const profile = await getProfileById(input.profileId);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "A profil nem található" });

      const report = await createReport({
        profileId: input.profileId,
        title: `${profile.name} – riport ${input.from} → ${input.to}`,
        periodFrom: new Date(input.from),
        periodTo: new Date(input.to),
        templateKey: input.templateKey,
        status: "rendering",
        createdBy: ctx.appUser.id,
      });

      try {
        // 1) Aktuális időszak metrikái. (Előző időszak összehasonlítás TODO —
        //    a compareToPrevious input már figyelve, de a buildSummary most
        //    csak a current-et fogadja. Következő iteráció.)
        const current = await getMetricsByProfile(input.profileId, input.from, input.to);
        const summaryData = buildSummary(current);

        // 2) AI vezetői összefoglaló magyar G2A brand-voice-ban
        const aiSummary = await generateReportSummary({
          profile,
          summaryData,
          appUserId: ctx.appUser.id,
        });

        // 3) PDF renderelés (jelenleg stub — placeholder URL)
        const pdfUrl = await renderReportPdf({ reportId: report.id });

        return updateReport(report.id, {
          status: "rendered",
          summaryData,
          aiSummary,
          pdfUrl,
        });
      } catch (err) {
        await updateReport(report.id, { status: "failed" });
        console.error("[reports.generate] failed:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Riport generálás sikertelen" });
      }
    }),

  list: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return listReports(input.profileId);
    }),

  get: appUserProcedure
    .input(z.object({ profileId: z.string(), reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getReportById(input.profileId, input.reportId);
    }),

  /**
   * A mérési adat forrása (mock/live) — a UI EZ ALAPJÁN jelöl DEMO-t, nem
   * beégetett szöveggel. Amíg a valós adapterek (Google/Meta OAuth) nem élnek,
   * `demo: true`; élesítéskor a connector LIVE_METRIC_PLATFORMS bővítésével
   * `demo: false` lesz, és a DEMO-jelölés automatikusan eltűnik a felületről.
   */
  dataSource: appUserProcedure.query(() => ({
    source: getMetricsSource(),
    demo: isDemoData(),
  })),

  // ─── #15 Csatorna-teljesítmény ───────────────────────────────────────────
  // Csatornánkénti összevetés (költés/megjelenés/kattintás/CTR/CPC/konverzió/
  // költség-per-konverzió). DEMO módban a mock generátor adja; élesben a valós
  // report_metrics. A `demo` flag vezérli a felület DEMO-jelölését.
  channelPerformance: appUserProcedure
    .input(z.object({ profileId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const range = resolveRange(input.from, input.to);
      const { rows, demo } = await getViewMetrics(input.profileId, range.from, range.to);
      return { demo, source: getMetricsSource(), ...range, ...buildChannelPerformance(rows) };
    }),

  // ─── #16 Konverzió ───────────────────────────────────────────────────────
  // Tölcsér (megjelenés → kattintás → konverzió), konverziós ráta, költség/
  // konverzió, napi trend és csatornánkénti konverzió-hozzájárulás.
  conversion: appUserProcedure
    .input(z.object({ profileId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const range = resolveRange(input.from, input.to);
      const { rows, demo } = await getViewMetrics(input.profileId, range.from, range.to);
      return { demo, source: getMetricsSource(), ...range, ...buildConversion(rows) };
    }),

  // ─── Havi ütemezés ───────────────────────────────────────────────────────
  schedule: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      templateKey: z.enum(["default", "paid", "seo"]).default("default"),
      dayOfMonth: z.number().min(1).max(28).default(3),
      recipients: z.array(z.string().email()),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return upsertReportSchedule(input);
    }),
});

// ─── Tiszta összesítő függvény (unit-tesztelhető, nincs I/O) ─────────────────
type Metric = {
  platform: string;
  date: Date | string;
  metricKey: string;
  value: number;
  currency?: string | null;
};

export function buildSummary(current: Metric[]) {
  const sum = (key: string, rows: Metric[]) =>
    rows.filter((r) => r.metricKey === key).reduce((a, r) => a + r.value, 0);

  const kpis = [
    { key: "spend", label: "Költés", value: Math.round(sum("spend", current)), unit: "HUF" },
    { key: "impressions", label: "Megjelenés", value: Math.round(sum("impressions", current)) },
    { key: "clicks", label: "Kattintás", value: Math.round(sum("clicks", current)) },
    { key: "conversions", label: "Konverzió", value: Math.round(sum("conversions", current)) },
    { key: "sessions", label: "Munkamenet (GA4)", value: Math.round(sum("sessions", current)) },
  ];

  // Idősoros bontás — a UI napi vonaldiagramot rajzol ebből.
  const byDate = (key: string) => {
    const map = new Map<string, number>();
    for (const r of current) {
      if (r.metricKey !== key) continue;
      const dateStr = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      map.set(dateStr, (map.get(dateStr) ?? 0) + r.value);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
  };

  const series = [
    { metricKey: "spend", points: byDate("spend") },
    { metricKey: "clicks", points: byDate("clicks") },
    { metricKey: "conversions", points: byDate("conversions") },
  ];

  // Platform bontás — a UI bar/donut chartot rajzol ebből.
  const platforms = Array.from(new Set(current.map((r) => r.platform)));
  const byPlatform = platforms.map((p) => ({
    platform: p,
    spend: Math.round(sum("spend", current.filter((r) => r.platform === p))),
    conversions: Math.round(sum("conversions", current.filter((r) => r.platform === p))),
  }));

  return { kpis, series, byPlatform };
}

// ─── #15/#16 nézetek adat-rétege ─────────────────────────────────────────────

/** A UI-ban megjelenő csatornák (fix sorrend + magyar/olvasható címke). */
const VIEW_CHANNELS: { platform: string; label: string; paid: boolean }[] = [
  { platform: "google_ads", label: "Google Ads", paid: true },
  { platform: "meta_ads", label: "Meta Ads", paid: true },
  { platform: "ga4", label: "GA4 (analitika)", paid: false },
  { platform: "search_console", label: "Search Console", paid: false },
];

/** Alapértelmezett időszak: utolsó 30 nap (YYYY-MM-DD). */
function resolveRange(from?: string, to?: string): { from: string; to: string } {
  const toD = to ? new Date(to) : new Date();
  const fromD = from ? new Date(from) : new Date(toD.getTime() - 29 * 86_400_000);
  return { from: fromD.toISOString().slice(0, 10), to: toD.toISOString().slice(0, 10) };
}

/**
 * A #15/#16 nézetek metrikái. ÉLES módban (LIVE_METRIC_PLATFORMS feltöltve) a
 * valós, szinkronizált report_metrics. DEMO módban a determinisztikus mock
 * generátor mind a 4 platformra — így kapcsolat nélkül is látszik érdemi adat.
 * Amint az OAuth-verifikáció kész és a lista feltöltődik, demo=false lesz és a
 * felület DEMO-jelölése automatikusan eltűnik (egyetlen kapcsoló, nincs UI-módosítás).
 */
async function getViewMetrics(profileId: string, from: string, to: string): Promise<{ rows: Metric[]; demo: boolean }> {
  if (!isDemoData()) {
    const real = await getMetricsByProfile(profileId, from, to);
    return { rows: real as unknown as Metric[], demo: false };
  }
  const rows: Metric[] = [];
  for (const c of VIEW_CHANNELS) {
    const conn = { id: `demo-${profileId}-${c.platform}`, platform: c.platform } as any;
    const r = await fetchMetrics(conn, from, to);
    rows.push(...(r as unknown as Metric[]));
  }
  return { rows, demo: true };
}

const sumBy = (rows: Metric[], key: string, platform?: string) =>
  rows.filter((r) => r.metricKey === key && (!platform || r.platform === platform)).reduce((a, r) => a + r.value, 0);

/** #15 — csatornánkénti teljesítmény + „legjobb a pénzért" (legalacsonyabb költség/konverzió). */
export function buildChannelPerformance(rows: Metric[]) {
  const channels = VIEW_CHANNELS.map((c) => {
    const spend = sumBy(rows, "spend", c.platform);
    const impressions = sumBy(rows, "impressions", c.platform);
    const clicks = sumBy(rows, "clicks", c.platform);
    const conversions = sumBy(rows, "conversions", c.platform);
    return {
      platform: c.platform,
      label: c.label,
      paid: c.paid,
      spend: Math.round(spend),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      ctr: impressions > 0 ? clicks / impressions : null,
      cpc: clicks > 0 && spend > 0 ? spend / clicks : null,
      costPerConversion: conversions > 0 && spend > 0 ? spend / conversions : null,
    };
  }).filter((c) => c.spend || c.impressions || c.clicks || c.conversions);

  const totals = {
    spend: Math.round(sumBy(rows, "spend")),
    impressions: Math.round(sumBy(rows, "impressions")),
    clicks: Math.round(sumBy(rows, "clicks")),
    conversions: Math.round(sumBy(rows, "conversions")),
  };

  // „Legjobb csatorna a pénzért": a fizetett csatornák közül a legalacsonyabb
  // költség/konverzió (ha van értelmezhető adat).
  const paidWithCpa = channels.filter((c) => c.paid && c.costPerConversion != null);
  const best = paidWithCpa.length
    ? paidWithCpa.reduce((a, b) => (a.costPerConversion! <= b.costPerConversion! ? a : b)).platform
    : null;

  return { channels, totals, best };
}

/** #16 — konverziós tölcsér, ráták, napi trend és csatornánkénti hozzájárulás. */
export function buildConversion(rows: Metric[]) {
  const impressions = Math.round(sumBy(rows, "impressions"));
  const clicks = Math.round(sumBy(rows, "clicks"));
  const conversions = Math.round(sumBy(rows, "conversions"));
  const spend = sumBy(rows, "spend");

  // Napi konverzió-trend.
  const trendMap = new Map<string, number>();
  for (const r of rows) {
    if (r.metricKey !== "conversions") continue;
    const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
    trendMap.set(d, (trendMap.get(d) ?? 0) + r.value);
  }
  const trend = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, conversions: Math.round(value) }));

  // Csatornánkénti konverzió-hozzájárulás (csak ahol van konverzió).
  const byChannel = VIEW_CHANNELS
    .map((c) => ({ platform: c.platform, label: c.label, conversions: Math.round(sumBy(rows, "conversions", c.platform)) }))
    .filter((c) => c.conversions > 0)
    .map((c) => ({ ...c, share: conversions > 0 ? c.conversions / conversions : 0 }))
    .sort((a, b) => b.conversions - a.conversions);

  return {
    funnel: { impressions, clicks, conversions },
    clickThroughRate: impressions > 0 ? clicks / impressions : null,
    conversionRate: clicks > 0 ? conversions / clicks : null,
    costPerConversion: conversions > 0 && spend > 0 ? spend / conversions : null,
    spend: Math.round(spend),
    trend,
    byChannel,
  };
}
