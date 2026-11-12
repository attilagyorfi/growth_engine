/**
 * G2A Growth Engine – napi riport-adatszinkron háttérfeladatként (G1)
 *
 * Szándékosan külön modul a server/scheduler.ts-től (annak posztoló része a G2-ben törlődik).
 * Naponta egyszer, a hajnali ablakban (Europe/Budapest, 03:00–05:59), minden aktív
 * profilra lefut ugyanaz, mint a kézi `reports.sync`-nél (közös mag:
 * server/reports/syncProfile.ts), az előző három nap gördülő ablakára (tegnap−2 … tegnap),
 * hogy a késve érkező adatok is bekerüljenek.
 *
 *   - Párhuzamos futás ellen: MySQL GET_LOCK('report_daily_sync', 0) egy dedikált
 *     poolkapcsolaton; foglalt zárnál, NULL-nál vagy hibánál a futás kimarad (fail-closed).
 *   - Idempotens írás: platformonkénti csere [from, to]-ban (replaceReportMetrics,
 *     replaceSocialReportMetrics), így az ismételt futás nem duplikál.
 *   - Profilonként legfeljebb MAX_SYNC_ATTEMPTS próbálkozás exponenciális visszalépéssel
 *     (a teljes profil-szinkron ismételhető, mert az írás idempotens). Egy profil hibája
 *     nem állítja meg a többit.
 *   - Tartós hibánál a profilhoz kötött aktív felhasználók rövid értesítést kapnak.
 *
 * Spam elleni döntés: a „ma már lefutott” kapu csak memóriában él (újraindulás után
 * ugyanazon a napon újra futhat — ez ártalmatlan az idempotens írás miatt). Az
 * értesítés deduplikációja viszont DB-alapú: ha a felhasználónak már van OLVASATLAN,
 * azonos profilú, típusú (system) és című értesítése, nem kap újat. Így egy tartós
 * hibáról egyszer szólunk; ha elolvasta, és a hiba másnap is fennáll, újra.
 *
 * Napló: csak profilId, platform, hibaosztály és rövid (URL-mentes) üzenet — token,
 * kulcs, stack vagy teljes err-objektum nem.
 */
import { describeError, type SyncProfileResult } from "./reports/syncProfile";

export const REPORT_SYNC_TIME_ZONE = "Europe/Budapest";
/** A hajnali futási ablak budapesti órában: [kezdet, vég). */
export const REPORT_SYNC_WINDOW_START_HOUR = 3;
export const REPORT_SYNC_WINDOW_END_HOUR = 6;
/** Gördülő ablak: tegnap−(N−1) … tegnap. */
export const REPORT_SYNC_LOOKBACK_DAYS = 3;
export const REPORT_SYNC_CHECK_INTERVAL_MS = 10 * 60 * 1000;
export const REPORT_SYNC_LOCK_NAME = "report_daily_sync";
export const MAX_SYNC_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 30_000;

export const SYNC_FAILURE_TITLE = "Nem sikerült frissíteni a riportadatokat";
export const SYNC_FAILURE_ACTION_URL = "/riportok";

// ─── Ütemezési döntés (tiszta függvények) ──────────────────────────────────

/** Env-kapcsoló: ha meg van adva, csak a "true" kapcsol be; különben productionben aktív. */
export function isReportSyncEnabled(raw: string | undefined, isProduction: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  return value ? value === "true" : isProduction;
}

/** A budapesti naptári nap (YYYY-MM-DD) és óra (0–23) az adott pillanatban — DST-biztosan. */
export function budapestClock(now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_SYNC_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Naptári napok eltolása YYYY-MM-DD formában (UTC-dél, így DST nem zavar be). */
export function shiftDay(day: string, deltaDays: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/** A gördülő ablak a budapesti „ma” alapján: tegnap−2 … tegnap. */
export function rollingWindow(now: Date): { from: string; to: string } {
  const { day } = budapestClock(now);
  return { from: shiftDay(day, -REPORT_SYNC_LOOKBACK_DAYS), to: shiftDay(day, -1) };
}

/** Fusson-e most: a hajnali ablakban vagyunk, és ezen a budapesti napon még nem futott. */
export function shouldRunDailySync(now: Date, lastRunDay: string | null): { run: boolean; day: string } {
  const { day, hour } = budapestClock(now);
  const inWindow = hour >= REPORT_SYNC_WINDOW_START_HOUR && hour < REPORT_SYNC_WINDOW_END_HOUR;
  return { run: inWindow && day !== lastRunDay, day };
}

// ─── Zár ────────────────────────────────────────────────────────────────────

export type LockConnection = {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  release(): void;
};
export type LockPool = { getConnection(): Promise<LockConnection> };

export type LockOutcome<T> =
  | { acquired: true; value: T }
  | { acquired: false; reason: "busy" | "error" };

/**
 * GET_LOCK(name, 0) és RELEASE_LOCK ugyanazon a, poolból kivett dedikált kapcsolaton.
 * A felszabadítás és a kapcsolat visszaadása finally-ben történik (hibánál is).
 * Fail-closed: foglalt zár (0), NULL vagy hiba esetén `fn` nem fut.
 */
export async function withMysqlLock<T>(pool: LockPool, name: string, fn: () => Promise<T>): Promise<LockOutcome<T>> {
  let conn: LockConnection;
  try {
    conn = await pool.getConnection();
  } catch (err) {
    const info = describeError(err);
    console.error(`[ReportSync] Nincs adatbázis-kapcsolat a zárhoz: ${info.name}: ${info.message}`);
    return { acquired: false, reason: "error" };
  }
  try {
    let got: unknown;
    try {
      const [rows] = (await conn.query("SELECT GET_LOCK(?, 0) AS got", [name])) as [Array<{ got: unknown }>];
      got = rows?.[0]?.got;
    } catch (err) {
      const info = describeError(err);
      console.error(`[ReportSync] GET_LOCK hiba, a futás kimarad: ${info.name}: ${info.message}`);
      return { acquired: false, reason: "error" };
    }
    if (got === null || got === undefined) {
      console.error("[ReportSync] GET_LOCK NULL-t adott, a futás kimarad.");
      return { acquired: false, reason: "error" };
    }
    if (Number(got) !== 1) {
      console.log("[ReportSync] A zár foglalt (egy másik példány fut), a futás kimarad.");
      return { acquired: false, reason: "busy" };
    }
    try {
      return { acquired: true, value: await fn() };
    } finally {
      try {
        await conn.query("SELECT RELEASE_LOCK(?)", [name]);
      } catch (err) {
        const info = describeError(err);
        console.error(`[ReportSync] RELEASE_LOCK hiba: ${info.name}: ${info.message}`);
      }
    }
  } finally {
    conn.release();
  }
}

// ─── A napi futás ───────────────────────────────────────────────────────────

export type ReportSyncDeps = {
  now(): Date;
  withLock<T>(fn: () => Promise<T>): Promise<LockOutcome<T>>;
  listActiveProfileIds(): Promise<string[]>;
  syncProfile(profileId: string, from: string, to: string): Promise<SyncProfileResult>;
  listRecipients(profileId: string): Promise<string[]>;
  hasUnreadNotification(appUserId: string, profileId: string, title: string): Promise<boolean>;
  notify(n: { appUserId: string; profileId: string; title: string; body: string; actionUrl: string }): Promise<void>;
  sleep(ms: number): Promise<void>;
  maxAttempts?: number;
  baseDelayMs?: number;
};

export type SyncFailure = { platform: string; name: string; message: string };

export type DailySyncResult =
  | { status: "skipped"; reason: "busy" | "error" }
  | { status: "done"; from: string; to: string; synced: number; failed: number; retried: number; notified: number };

/**
 * Az ütemező hibának veszi a kapcsolat-lekérés/-írás hibáit és a közösségi ág
 * `failed` státuszát; a `skipped` (not_configured, no_external_ref, no_match,
 * not_requested) NEM hiba.
 */
export function collectSyncFailures(result: SyncProfileResult): SyncFailure[] {
  const failures: SyncFailure[] = result.errors.map((e) => ({ platform: e.platform, name: e.name, message: e.message }));
  if (result.social.status === "failed") {
    failures.push({ platform: "social", name: "SocialHubError", message: result.social.message });
  }
  return failures;
}

const FAILURE_LABEL: Record<string, string> = {
  google_ads: "Google Ads", ga4: "Google Analytics", search_console: "Search Console",
  meta_ads: "Meta hirdetések", social: "közösségi média",
};

export function buildFailureBody(failures: SyncFailure[]): string {
  const labels = Array.from(new Set(failures.map((f) => FAILURE_LABEL[f.platform]).filter(Boolean)));
  const which = labels.length ? ` (${labels.join(", ")})` : "";
  return `A napi adatfrissítés${which} többszöri próbálkozás után sem sikerült. Holnap újra próbáljuk; a Riportok oldalon kézzel is frissítheted.`;
}

async function syncWithRetry(deps: ReportSyncDeps, profileId: string, from: string, to: string) {
  const maxAttempts = Math.max(1, deps.maxAttempts ?? MAX_SYNC_ATTEMPTS);
  const baseDelay = deps.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  let failures: SyncFailure[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      failures = collectSyncFailures(await deps.syncProfile(profileId, from, to));
    } catch (err) {
      failures = [{ platform: "*", ...describeError(err) }];
    }
    if (failures.length === 0) return { ok: true as const, attempts: attempt, failures };
    for (const f of failures) {
      console.error(`[ReportSync] profil=${profileId} platform=${f.platform} próbálkozás ${attempt}/${maxAttempts}: ${f.name}: ${f.message}`);
    }
    if (attempt < maxAttempts) await deps.sleep(baseDelay * 2 ** (attempt - 1));
  }
  return { ok: false as const, attempts: maxAttempts, failures };
}

async function notifyFailure(deps: ReportSyncDeps, profileId: string, failures: SyncFailure[]): Promise<number> {
  const recipients = await deps.listRecipients(profileId);
  if (recipients.length === 0) {
    console.warn(`[ReportSync] profil=${profileId}: tartós hiba, de nincs értesíthető aktív felhasználó.`);
    return 0;
  }
  let sent = 0;
  for (const appUserId of recipients) {
    if (await deps.hasUnreadNotification(appUserId, profileId, SYNC_FAILURE_TITLE)) continue;
    await deps.notify({ appUserId, profileId, title: SYNC_FAILURE_TITLE, body: buildFailureBody(failures), actionUrl: SYNC_FAILURE_ACTION_URL });
    sent++;
  }
  return sent;
}

export async function runDailyReportSync(deps: ReportSyncDeps): Promise<DailySyncResult> {
  const { from, to } = rollingWindow(deps.now());
  const outcome = await deps.withLock(async () => {
    const result = { status: "done" as const, from, to, synced: 0, failed: 0, retried: 0, notified: 0 };
    for (const profileId of await deps.listActiveProfileIds()) {
      try {
        const res = await syncWithRetry(deps, profileId, from, to);
        if (res.attempts > 1) result.retried++;
        if (res.ok) {
          result.synced++;
          continue;
        }
        result.failed++;
        result.notified += await notifyFailure(deps, profileId, res.failures);
      } catch (err) {
        // Pl. az értesítés írása hibázik — a többi profil menjen tovább.
        const info = describeError(err);
        console.error(`[ReportSync] profil=${profileId}: ${info.name}: ${info.message}`);
      }
    }
    return result;
  });
  return outcome.acquired ? outcome.value : { status: "skipped", reason: outcome.reason };
}

// ─── Adatbázis-kötés + indítás ────────────────────────────────────────────

async function createDbDeps(): Promise<ReportSyncDeps | null> {
  const db = await import("./db");
  const pool = await db.getDbPool();
  if (!pool) return null;
  const { syncProfileMetrics } = await import("./reports/syncProfile");
  const { nanoid } = await import("nanoid");
  return {
    now: () => new Date(),
    withLock: (fn) => withMysqlLock(pool as unknown as LockPool, REPORT_SYNC_LOCK_NAME, fn),
    listActiveProfileIds: () => db.listActiveProfileIds(),
    syncProfile: (profileId, from, to) => syncProfileMetrics(profileId, from, to),
    listRecipients: (profileId) => db.listActiveProfileUserIds(profileId),
    hasUnreadNotification: (appUserId, profileId, title) => db.hasUnreadNotification(appUserId, profileId, "system", title),
    notify: ({ appUserId, profileId, title, body, actionUrl }) =>
      db.createNotification({ id: nanoid(), appUserId, profileId, type: "system", title: title.slice(0, 255), body, actionUrl }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Napra kulcsolt kapu a tickek fölött (memóriában). A napot csak lefutott vagy
 * foglalt zár miatt kihagyott futás után jelöli késznek; DB-/zárhiba után a
 * következő tick (még az ablakon belül) újra próbálja.
 */
export function createDailyTicker(run: () => Promise<DailySyncResult | null>) {
  let lastRunDay: string | null = null;
  let running = false;
  return async function tick(now: Date): Promise<DailySyncResult | null> {
    const decision = shouldRunDailySync(now, lastRunDay);
    if (!decision.run || running) return null;
    running = true;
    try {
      const result = await run();
      if (result && (result.status === "done" || result.reason === "busy")) lastRunDay = decision.day;
      return result;
    } finally {
      running = false;
    }
  };
}

async function runOnce(): Promise<DailySyncResult | null> {
  try {
    const deps = await createDbDeps();
    if (!deps) {
      console.error("[ReportSync] Az adatbázis nem elérhető, a futás kimarad.");
      return null;
    }
    const result = await runDailyReportSync(deps);
    if (result.status === "done") {
      console.log(`[ReportSync] ${result.from} … ${result.to}: kész ${result.synced}, sikertelen ${result.failed}, újrapróbált ${result.retried}, értesítés ${result.notified}`);
    }
    return result;
  } catch (err) {
    const info = describeError(err);
    console.error(`[ReportSync] Hiba a futás közben: ${info.name}: ${info.message}`);
    return null;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Indítás a szerverrel együtt (productionben alapból be; REPORT_SYNC_SCHEDULER_ENABLED=false kikapcsolja). */
export function startReportSyncScheduler(opts: { enabled: boolean }) {
  if (!opts.enabled || timer) return;
  console.log("[ReportSync] Elindult — naponta egyszer, hajnalban (Europe/Budapest) frissíti a riportadatokat.");
  const tick = createDailyTicker(runOnce);
  setTimeout(() => { void tick(new Date()); }, 60_000).unref?.();
  timer = setInterval(() => { void tick(new Date()); }, REPORT_SYNC_CHECK_INTERVAL_MS);
  timer.unref?.();
}
