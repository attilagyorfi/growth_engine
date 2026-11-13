/**
 * G2A Growth Engine – Reports router (2026-06)
 *
 * A mellékelt integrációs skeleton alapján, a repó konvencióihoz igazítva:
 *   - appUserProcedure + assertProfileOwnership tenancy-hoz
 *   - db-helperek a server/db.ts-ből
 *   - mock connector a server/reports/connectors-ból
 *   - AI narratíva a server/ai/reportSummary.ts-ből
 *   - Word- és PDF-export a server/reports/docx.ts / pdf.ts-ből (közös tartalom: content.ts)
 *
 * Az eljárások: connections.list/upsert/disconnect, sync, generate, list,
 * get, exportDocx, exportPdf, schedule. A `buildSummary` tiszta függvény — unit-tesztelhető.
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
  getMetricsByProfile,
  countProfilePostsInPeriod,
  createReport,
  updateReport,
  listReports,
  getReportById,
  upsertReportSchedule,
  setDataConnectionBrand,
  dataConnectionStore,
  markDataConnectionDisconnected,
} from "../db";
import { isGoogleOAuthConfigured, isGooglePlatform, GoogleAuthRevokedError } from "../reports/google/oauth";
import { defaultGoogleDeps } from "../reports/google/client";
import { listGoogleAccounts } from "../reports/google/accounts";
import { GoogleSelectionError, loadGoogleConnection, selectGoogleAccount, toSafeConnection } from "../reports/google/connections";
import { assertBrandInProfile } from "./brands";
import { generateReportSummary } from "../ai/reportSummary";
import { analyzeReportPeriod, previousPeriod } from "../ai/reportSignals";
import { buildReportPdf, reportPdfFileName, PDF_MIME_TYPE } from "../reports/pdf";
import { mockMetrics, getMetricsSource, isDemoData, isSocialMetricPlatform, METRIC_PLATFORMS } from "../reports/connectors";
import { describeError, REVOKED_SYNC_ERROR, syncProfileMetrics } from "../reports/syncProfile";
import { buildReportDocx, reportDocxFileName, DOCX_MIME_TYPE } from "../reports/docx";
import { buildSocialSection, buildSocialSummary, type ReportContentInput } from "../reports/content";

// data_connections platformjai (OAuth-kapcsolatok). A közösségi csatorna NEM kapcsolat-sor:
// a Social Hubból jön, a sync külön ágán (server/socialHub).
const platformEnum = z.enum(["google_ads", "ga4", "search_console", "meta_ads"]);
// report_metrics platformjai: a kapcsolat-platformok + facebook/instagram/linkedin.
const metricPlatformEnum = z.enum(METRIC_PLATFORMS);

/** A Google-kiválasztás hibái tRPC-hibaként (a többi hiba változatlanul tovább). */
function toTrpcError(err: unknown): never {
  if (err instanceof GoogleSelectionError) throw new TRPCError({ code: err.code, message: err.message });
  throw err;
}

export const reportsRouter = router({
  // ─── Kapcsolatok (Ads/Analytics OAuth) ───────────────────────────────────
  connections: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        // Explicit mezőlista: token (access/refresh) soha nem megy ki a kliensre.
        return (await listDataConnections(input.profileId)).map(toSafeConnection);
      }),

    // Kézi kapcsolat-rögzítés a még OAuth nélküli platformokhoz (google_ads, meta_ads).
    // A GA4 / Search Console tokenje KIZÁRÓLAG a Google OAuth-callbackből jöhet
    // (server/reports/google/routes.ts) — itt klienstől érkező tokent nem fogadunk el.
    upsert: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: platformEnum,
        externalAccountId: z.string(),
        externalAccountName: z.string().optional(),
        accessToken: z.string().optional(),
        refreshToken: z.string().optional(),
        tokenExpiry: z.date().optional(),
        scopes: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        if (isGooglePlatform(input.platform)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ezt a forrást a „Csatlakozás Google-lel” gombbal add hozzá." });
        }
        // Az upsertDataConnection a tokeneket titkosítva írja.
        const row = await upsertDataConnection({ ...input, connected: true });
        return row ? toSafeConnection(row) : null;
      }),

    // ─── Google (GA4 + Search Console) ─────────────────────────────────────
    // A csatlakozás a /api/oauth/google/start route-on indul; itt csak az állapot,
    // a választható property/site lista és a kiválasztás mentése van.
    google: router({
      /** Csak boolean: be van-e állítva a Google OAuth (env-érték soha nem megy ki). */
      status: appUserProcedure.query(() => ({ googleConfigured: isGoogleOAuthConfigured() })),

      accounts: appUserProcedure
        .input(z.object({ profileId: z.string(), connectionId: z.string() }))
        .query(async ({ input, ctx }) => {
          await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
          const conn = await loadGoogleConnection(dataConnectionStore, input.profileId, input.connectionId).catch(toTrpcError);
          try {
            return { accounts: await listGoogleAccounts(conn, defaultGoogleDeps()) };
          } catch (err) {
            if (err instanceof GoogleAuthRevokedError) {
              await markDataConnectionDisconnected(conn.id, REVOKED_SYNC_ERROR);
              throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A Google-hozzáférés megszűnt. Csatlakozz újra." });
            }
            const info = describeError(err);
            console.error(`[reports.google.accounts] kapcsolat=${conn.id}: ${info.name}: ${info.message}`);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Most nem sikerült lekérni a listát. Próbáld újra később." });
          }
        }),

      select: appUserProcedure
        .input(z.object({
          profileId: z.string(),
          connectionId: z.string(),
          externalAccountId: z.string().min(1).max(255),
          externalAccountName: z.string().max(255).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
          return selectGoogleAccount(dataConnectionStore, input).catch(toTrpcError);
        }),
    }),

    disconnect: appUserProcedure
      .input(z.object({ profileId: z.string(), connectionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return deleteDataConnection(input.profileId, input.connectionId);
      }),

    // Márka hozzárendelése (null = nincs márka). A kapcsolat eddigi metrikasorai
    // ugyanabban a tranzakcióban átcímkéződnek vagy törlődnek (nincs dupla számolás).
    setBrand: appUserProcedure
      .input(z.object({ profileId: z.string(), connectionId: z.string(), brandId: z.string().nullable() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        if (input.brandId) await assertBrandInProfile(input.profileId, input.brandId);
        const result = await setDataConnectionBrand(input.profileId, input.connectionId, input.brandId);
        if (!result.ok) throw new TRPCError({ code: "NOT_FOUND", message: "A kapcsolat nem található." });
        return { ok: true as const, brandId: input.brandId };
      }),
  }),

  // ─── Adat-szinkron: metrikák behúzása és normalizált tárolása ─────────────
  sync: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      from: z.string(), // YYYY-MM-DD
      to: z.string(),
      platforms: z.array(metricPlatformEnum).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      // Közös mag a napi háttér-szinkronnal (server/reportSyncScheduler.ts). A belső
      // hibalistát itt elnyeljük: a kézi szinkron válasza változatlan marad.
      const { platforms, inserted, social } = await syncProfileMetrics(input.profileId, input.from, input.to, input.platforms);
      return { platforms, inserted, social };
    }),

  // ─── Riport legenerálása (összesítés → AI-narratíva) ─────────────────────
  // A letölthető fájl (Word/PDF) igény szerint, az exportDocx/exportPdf-fel készül
  // a tárolt pillanatképből; a pdfUrl ezért null marad (nincs hamis URL).
  generate: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      from: z.string(),
      to: z.string(),
      templateKey: z.enum(["default", "paid", "seo"]).default("default"),
      compareToPrevious: z.boolean().default(true),
      // Márkára szűkített riport; hiányában / null-nál összesített (a márkák előtti viselkedés).
      brandId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const brand = input.brandId ? await assertBrandInProfile(input.profileId, input.brandId) : null;

      const profile = await getProfileById(input.profileId);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "A profil nem található" });

      const report = await createReport({
        profileId: input.profileId,
        title: reportTitle(profile.name, brand?.name ?? null, input.from, input.to),
        ...(brand ? { brandId: brand.id } : {}),
        periodFrom: new Date(input.from),
        periodTo: new Date(input.to),
        templateKey: input.templateKey,
        status: "rendering",
        createdBy: ctx.appUser.id,
      });

      try {
        // 1) Aktuális és (compareToPrevious esetén) az előző, azonos napszámú
        //    időszak metrikái + a kontextus-jelek forrásai (posztszám, szinkronhiba).
        const prev = input.compareToPrevious ? previousPeriod(input.from, input.to) : null;
        // Márkánál csak a márka sorai és kapcsolatai; összesítettnél minden (változatlan hívás).
        const metrics = (from: string, to: string) =>
          brand ? getMetricsByProfile(input.profileId, from, to, brand.id) : getMetricsByProfile(input.profileId, from, to);
        const [current, previous, postsCurrent, postsPrevious, allConnections] = await Promise.all([
          metrics(input.from, input.to),
          prev ? metrics(prev.from, prev.to) : Promise.resolve(null),
          countProfilePostsInPeriod(input.profileId, input.from, input.to),
          prev ? countProfilePostsInPeriod(input.profileId, prev.from, prev.to) : Promise.resolve(null),
          listDataConnections(input.profileId),
        ]);
        const connections = brand ? allConnections.filter((c) => c.brandId === brand.id) : allConnections;
        const signals = analyzeReportPeriod({
          from: input.from,
          to: input.to,
          currentRows: current,
          previousRows: previous,
          posts: { current: postsCurrent, previous: postsPrevious },
          syncErrorPlatforms: connections.filter((c) => c.connected && c.lastSyncError).map((c) => c.platform),
        });
        const summaryData = {
          ...buildSummary(current, previous),
          signals,
          // A márka neve a pillanatképben is megmarad (export, narratíva), akkor is, ha a márkát később törlik.
          ...(brand ? { brand: { id: brand.id, name: brand.name } } : {}),
        };

        // 2) AI vezetői összefoglaló magyar G2A brand-voice-ban (előfeldolgozott jelekkel, számellenőrzéssel)
        const aiSummary = await generateReportSummary({
          profile,
          summaryData,
          appUserId: ctx.appUser.id,
        });

        return updateReport(report.id, {
          status: "rendered",
          summaryData,
          aiSummary,
        });
      } catch (err) {
        await updateReport(report.id, { status: "failed" });
        console.error("[reports.generate] failed:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Riport generálás sikertelen" });
      }
    }),

  // brandId: hiányzik = minden riport; null = csak az összesítettek; string = az adott márkáé.
  list: appUserProcedure
    .input(z.object({ profileId: z.string(), brandId: z.string().nullable().optional() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      if (input.brandId === undefined) return listReports(input.profileId);
      if (input.brandId) await assertBrandInProfile(input.profileId, input.brandId);
      return listReports(input.profileId, input.brandId);
    }),

  get: appUserProcedure
    .input(z.object({ profileId: z.string(), reportId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const report = await getReportById(input.profileId, input.reportId);
      if (!report) return report;
      // A webes előnézet ugyanazt a közösségi szakaszt kapja, mint a Word és a PDF.
      const summaryData = report.summaryData as ReportContentInput["summaryData"] | null;
      return { ...report, socialSection: buildSocialSection(summaryData?.social) };
    }),

  // ─── Word- és PDF-export (G1, TELJESÍTMÉNY MINTA szerkezet) ─────────────
  // A tárolt riport-pillanatképből (summaryData + aiSummary) készülnek, nincs
  // LLM-hívás és új számítás. A jogosultságot, a hibautakat és a bemenetet a
  // közös loadExportableReport() adja, így a két formátum nem térhet el.
  exportDocx: appUserProcedure
    .input(z.object({ profileId: z.string(), reportId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const content = await loadExportableReport(ctx.appUser, input);
      const buffer = await buildReportDocx(content);
      return {
        fileName: reportDocxFileName(content.clientName, content.periodFrom, content.periodTo),
        mimeType: DOCX_MIME_TYPE,
        base64: buffer.toString("base64"),
      };
    }),

  // Szerveroldali .pdf (pdf-lib, beágyazott DejaVu Sans) — a böngészős nyomtatás
  // mellett ez a letölthető, később e-mailben is küldhető fájl.
  exportPdf: appUserProcedure
    .input(z.object({ profileId: z.string(), reportId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const content = await loadExportableReport(ctx.appUser, input);
      let buffer: Buffer;
      try {
        buffer = await buildReportPdf(content);
      } catch (err) {
        console.error(`[reports.exportPdf] PDF-készítés sikertelen (riport: ${input.reportId}):`, err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Most nem sikerült elkészíteni a PDF-et. Próbáld újra később." });
      }
      return {
        fileName: reportPdfFileName(content.clientName, content.periodFrom, content.periodTo),
        mimeType: PDF_MIME_TYPE,
        base64: buffer.toString("base64"),
      };
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
  dimension?: Record<string, string> | null;
};

/**
 * `previousAll` (az előző, azonos hosszú időszak sorai) megadásakor a KPI-k
 * `prevValue`-t, a csatornák `prevSpend`/`prevConversions`-t is kapnak.
 */
export function buildSummary(all: Metric[], previousAll?: Metric[] | null) {
  // A közösségi (Social Hub) sorok külön szakaszba mennek; a fizetett/forgalmi
  // KPI-kat, idősorokat és a csatornabontást nem torzítják (pl. impressions).
  const social = buildSocialSummary(all.filter((r) => isSocialMetricPlatform(r.platform)));
  const current = all.filter((r) => !isSocialMetricPlatform(r.platform));
  const previous = previousAll ? previousAll.filter((r) => !isSocialMetricPlatform(r.platform)) : null;
  const sum = (key: string, rows: Metric[]) =>
    rows.filter((r) => r.metricKey === key).reduce((a, r) => a + r.value, 0);
  const kpi = (key: string, label: string, unit?: string) => ({
    key,
    label,
    value: Math.round(sum(key, current)),
    ...(previous ? { prevValue: Math.round(sum(key, previous)) } : {}),
    ...(unit ? { unit } : {}),
  });

  const kpis = [
    kpi("spend", "Költés", "HUF"),
    kpi("impressions", "Megjelenés"),
    kpi("clicks", "Kattintás"),
    kpi("conversions", "Konverzió"),
    kpi("sessions", "Munkamenet (GA4)"),
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
    ...(previous
      ? {
        prevSpend: Math.round(sum("spend", previous.filter((r) => r.platform === p))),
        prevConversions: Math.round(sum("conversions", previous.filter((r) => r.platform === p))),
      }
      : {}),
  }));

  return { kpis, series, byPlatform, social };
}

// ─── #15/#16 nézetek adat-rétege ─────────────────────────────────────────────

/** A UI-ban megjelenő csatornák (fix sorrend + magyar/olvasható címke). */
const VIEW_CHANNELS: { platform: string; label: string; paid: boolean }[] = [
  { platform: "google_ads", label: "Google Ads", paid: true },
  { platform: "meta_ads", label: "Meta Ads", paid: true },
  { platform: "ga4", label: "GA4 (analitika)", paid: false },
  { platform: "search_console", label: "Search Console", paid: false },
];

/** A riport címe; márkánál a márka neve is benne van, összesítettnél a márkák előtti cím. */
export function reportTitle(profileName: string, brandName: string | null, from: string, to: string): string {
  return brandName
    ? `${profileName} – ${brandName} – riport ${from} → ${to}`
    : `${profileName} – riport ${from} → ${to}`;
}

/** Az exportok ügyfélneve: márkás riportnál „Ügyfél – Márka”, egyébként a profil neve. */
export function reportClientName(profileName: string, brandName: string | null | undefined): string {
  return brandName ? `${profileName} – ${brandName}` : profileName;
}

/** A tárolt időszakhatár (Date vagy string) → YYYY-MM-DD. */
function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

export const REPORT_NOT_READY_MESSAGE =
  "Ez a riport még nem készült el, ezért nem tölthető le. Várd meg, amíg elkészül, vagy generáld újra.";

/**
 * Közös előkészítés a Word- és PDF-exporthoz: jogosultság (assertProfileOwnership),
 * a riport betöltése a profil alatt (NOT_FOUND), csak elkészült riport
 * (rendered/delivered + summaryData, egyébként BAD_REQUEST), ügyfélnév, dátumok és
 * a mintaadat-jelölés (az isDemoData() dönti el — a riportsor nem tárolja, ugyanúgy,
 * mint a dataSource-nál).
 */
export async function loadExportableReport(
  appUser: { id: string; role: string; profileId: string | null },
  input: { profileId: string; reportId: string },
): Promise<ReportContentInput> {
  await assertProfileOwnership(appUser.id, appUser.role, input.profileId, appUser.profileId);
  const report = await getReportById(input.profileId, input.reportId);
  if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "A riport nem található" });

  const summaryData = report.summaryData as ReportContentInput["summaryData"] | null;
  if ((report.status !== "rendered" && report.status !== "delivered") || !summaryData) {
    throw new TRPCError({ code: "BAD_REQUEST", message: REPORT_NOT_READY_MESSAGE });
  }

  const profile = await getProfileById(input.profileId);
  const brandName = (summaryData as { brand?: { name?: string } | null }).brand?.name ?? null;
  return {
    clientName: profile?.name ? reportClientName(profile.name, brandName) : report.title,
    periodFrom: toIsoDate(report.periodFrom),
    periodTo: toIsoDate(report.periodTo),
    summaryData: { kpis: summaryData.kpis ?? [], byPlatform: summaryData.byPlatform ?? [], social: summaryData.social ?? [] },
    aiSummary: report.aiSummary ?? null,
    demo: isDemoData(),
  };
}

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
    // A közösségi sorok nem fizetett/forgalmi csatornák: az összesítőket nem torzíthatják.
    const real = (await getMetricsByProfile(profileId, from, to)).filter((r) => !isSocialMetricPlatform(r.platform));
    return { rows: real as unknown as Metric[], demo: false };
  }
  const rows: Metric[] = [];
  for (const c of VIEW_CHANNELS) {
    const conn = { id: `demo-${profileId}-${c.platform}`, platform: c.platform } as any;
    // Mindig a mintaadat: a DEMO-nézet álkapcsolatára élő adapter nem futhat.
    const r = mockMetrics(conn, from, to);
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
