/**
 * G2A Growth Engine – Google Ads élő adapter (Google Ads API REST, G1)
 *
 * A GA4 / Search Console OAuth-folyamatát használja (server/reports/google): ugyanaz az
 * aláírt state, nonce-süti, titkosított tokentárolás, frissítés és pending:-kiválasztás,
 * csak a scope más (adwords). Ami itt Ads-specifikus:
 *   - developer-token fejléc (GOOGLE_ADS_DEVELOPER_TOKEN), opcionálisan login-customer-id
 *     (GOOGLE_ADS_LOGIN_CUSTOMER_ID, kezelői/MCC fiók) — kötőjelek nélkül, szigorúan
 *     validálva; érvénytelen értéknél a fejléc nem megy ki;
 *   - fiókválasztás: customers:listAccessibleCustomers → „customers/<10 számjegy>”;
 *   - metrikák: customers/{id}/googleAds:searchStream GAQL-lel, napi bontásban
 *     (spend = cost_micros / 1 000 000 a fiók pénznemében, impressions, clicks, conversions);
 *   - hiba esetén csak a Google Ads hibakódja (pl. AUTHORIZATION_ERROR/USER_PERMISSION_DENIED),
 *     ennek híján a HTTP-státusz kerül a hibába — a hibaüzenet szövege és token soha.
 * 429 / RESOURCE_EXHAUSTED → a közös googleRequest korlátozott újrapróbálása (max. 3).
 *
 * Fail-closed: developer token vagy Google OAuth-env nélkül `getGoogleAdsConfig()` null →
 * nincs csatlakozás, nincs Google Ads-hívás.
 */
import type { DataConnection } from "../../../drizzle/schema";
import { ENV } from "../../_core/env";
import { googleRequest, withGoogleAuth, type GoogleDeps } from "./client";
import { GoogleApiError, isGoogleOAuthConfigured } from "./oauth";

/** A Google Ads API verziója — csak itt kell átírni verzióváltáskor. */
export const GOOGLE_ADS_API_VERSION = "v26";
export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// ─── Ügyfélazonosító ────────────────────────────────────────────────────────

const CUSTOMER_ID_RE = /^(?:customers\/)?(\d{3})-?(\d{3})-?(\d{4})$/;

/** „customers/1234567890”, „123-456-7890” vagy „1234567890” → „1234567890” (más → null). */
export function normalizeCustomerId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = CUSTOMER_ID_RE.exec(raw.trim());
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** Csak a tárolt, kötőjel nélküli alak érvényes URL-be / fejlécbe illesztéshez. */
export function isStoredCustomerId(id: unknown): id is string {
  return typeof id === "string" && /^\d{10}$/.test(id);
}

/** „1234567890” → „123-456-7890” (a Google Ads felületén megszokott alak). */
export function formatCustomerId(id: string): string {
  return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
}

// ─── Konfiguráció ───────────────────────────────────────────────────────────

export type GoogleAdsConfig = { developerToken: string; loginCustomerId: string | null };

/** A Google Ads-beállítás, vagy null, ha nincs developer token (fail-closed). */
export function getGoogleAdsConfig(): GoogleAdsConfig | null {
  const developerToken = ENV.googleAdsDeveloperToken;
  if (!developerToken) return null;
  return { developerToken, loginCustomerId: normalizeCustomerId(ENV.googleAdsLoginCustomerId) };
}

/** A kliensnek csak ez a boolean megy ki: Google OAuth-env ÉS developer token is kell. */
export function isGoogleAdsConfigured(): boolean {
  return isGoogleOAuthConfigured() && getGoogleAdsConfig() !== null;
}

function adsHeaders(config: GoogleAdsConfig, withLogin: boolean): Record<string, string> {
  const headers: Record<string, string> = { "developer-token": config.developerToken };
  if (withLogin && isStoredCustomerId(config.loginCustomerId)) headers["login-customer-id"] = config.loginCustomerId;
  return headers;
}

// ─── Hibák ──────────────────────────────────────────────────────────────────

const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

function toUpperSnake(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * A Google Ads hibaválaszából csak a hibakód: GoogleAdsFailure errorCode
 * ({ authorizationError: "USER_PERMISSION_DENIED" } → „AUTHORIZATION_ERROR/USER_PERMISSION_DENIED”),
 * ennek híján a gRPC-státusz (pl. PERMISSION_DENIED), végül „HTTP <státusz>”.
 */
export function googleAdsErrorCode(json: any, status: number): string {
  const error = Array.isArray(json) ? json[0]?.error : json?.error;
  for (const detail of Array.isArray(error?.details) ? error.details : []) {
    for (const e of Array.isArray(detail?.errors) ? detail.errors : []) {
      const entry = e?.errorCode && typeof e.errorCode === "object" ? Object.entries(e.errorCode)[0] : undefined;
      if (!entry) continue;
      const category = toUpperSnake(String(entry[0]));
      if (!CODE_RE.test(category)) continue;
      return typeof entry[1] === "string" && CODE_RE.test(entry[1]) ? `${category}/${entry[1]}` : category;
    }
  }
  if (typeof error?.status === "string" && CODE_RE.test(error.status)) return error.status;
  return `HTTP ${status}`;
}

/** Titokmentes Google Ads-hiba: az üzenet csak a hibakódot viszi (napló, lastSyncError). */
export class GoogleAdsApiError extends GoogleApiError {
  readonly code: string;
  constructor(status: number, code: string) {
    super("Google Ads", status);
    this.name = "GoogleAdsApiError";
    this.code = code;
    this.message = `Google Ads-hiba: ${code}`;
  }
}

const toAdsError = (status: number, json: any) => new GoogleAdsApiError(status, googleAdsErrorCode(json, status));

function requireConfig(config: GoogleAdsConfig | null): GoogleAdsConfig {
  if (!config) throw new GoogleApiError("Google Ads", 503, "a Google Ads-csatlakozás nincs beállítva");
  return config;
}

// ─── Fiókválasztás ──────────────────────────────────────────────────────────

export type GoogleAdsAccountOption = { id: string; name: string };

/** listAccessibleCustomers-válasz → kötőjel nélküli id + formázott név (duplikátum és hibás alak kimarad). */
export function mapAccessibleCustomers(json: any): GoogleAdsAccountOption[] {
  const seen = new Set<string>();
  const out: GoogleAdsAccountOption[] = [];
  for (const raw of Array.isArray(json?.resourceNames) ? json.resourceNames : []) {
    const id = normalizeCustomerId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: formatCustomerId(id) });
  }
  return out;
}

export async function listGoogleAdsCustomers(
  conn: DataConnection,
  deps: GoogleDeps,
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
): Promise<GoogleAdsAccountOption[]> {
  const ads = requireConfig(config);
  return withGoogleAuth(conn, deps, async (accessToken) => {
    // A listAccessibleCustomers nem használja a login-customer-id-t, ezért nem is küldjük.
    const json = await googleRequest("Google Ads listAccessibleCustomers", `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
      method: "GET", accessToken, headers: adsHeaders(ads, false), toError: toAdsError,
    }, deps);
    return mapAccessibleCustomers(json);
  });
}

// ─── Metrikák (searchStream) ────────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDay(day: string): string {
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new GoogleApiError("Google Ads", 400, "érvénytelen dátum");
  }
  return day;
}

/** A napi GAQL-lekérdezés; a dátumok YYYY-MM-DD-re validálva kerülnek bele. */
export function buildGoogleAdsQuery(from: string, to: string): string {
  return [
    "SELECT segments.date, customer.currency_code, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions",
    "FROM customer",
    `WHERE segments.date BETWEEN '${assertDay(from)}' AND '${assertDay(to)}'`,
    "ORDER BY segments.date",
  ].join(" ");
}

type Row = { platform: DataConnection["platform"]; date: Date; metricKey: string; value: number; currency: string | null; dimension: null };

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * searchStream-válasz (batch-ek tömbje, az int64 mezők stringként) → napi sorok
 * a mockkal azonos kulcsokkal: spend (pénznemmel), impressions, clicks, conversions.
 * Ugyanarra a napra jövő több sor összeadódik; adat nélküli napra nincs sor.
 */
export function mapSearchStream(json: any): Row[] {
  const batches = Array.isArray(json) ? json : json ? [json] : [];
  const byDay = new Map<string, { costMicros: number; impressions: number; clicks: number; conversions: number }>();
  let currency: string | null = null;
  for (const batch of batches) {
    for (const r of Array.isArray(batch?.results) ? batch.results : []) {
      const day = r?.segments?.date;
      if (typeof day !== "string" || !DAY_RE.test(day)) continue;
      const code = r?.customer?.currencyCode;
      if (!currency && typeof code === "string" && /^[A-Z]{3}$/.test(code)) currency = code;
      const acc = byDay.get(day) ?? { costMicros: 0, impressions: 0, clicks: 0, conversions: 0 };
      acc.costMicros += num(r?.metrics?.costMicros);
      acc.impressions += num(r?.metrics?.impressions);
      acc.clicks += num(r?.metrics?.clicks);
      acc.conversions += num(r?.metrics?.conversions);
      byDay.set(day, acc);
    }
  }
  const out: Row[] = [];
  for (const day of Array.from(byDay.keys()).sort()) {
    const m = byDay.get(day)!;
    const date = new Date(day);
    const row = (metricKey: string, value: number, cur: string | null = null): Row =>
      ({ platform: "google_ads", date, metricKey, value, currency: cur, dimension: null });
    out.push(
      row("spend", m.costMicros / 1_000_000, currency),
      row("impressions", m.impressions),
      row("clicks", m.clicks),
      row("conversions", m.conversions),
    );
  }
  return out;
}

export async function fetchGoogleAdsMetrics(
  conn: DataConnection,
  from: string,
  to: string,
  deps: GoogleDeps,
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
): Promise<Row[]> {
  const ads = requireConfig(config);
  const customerId = conn.externalAccountId;
  if (!isStoredCustomerId(customerId)) throw new GoogleApiError("Google Ads", 400, "érvénytelen ügyfélazonosító");
  const query = buildGoogleAdsQuery(from, to);
  const url = `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`;
  return withGoogleAuth(conn, deps, async (accessToken) => {
    const json = await googleRequest("Google Ads searchStream", url, {
      method: "POST", accessToken, body: { query }, headers: adsHeaders(ads, true), toError: toAdsError,
    }, deps);
    return mapSearchStream(json);
  });
}
