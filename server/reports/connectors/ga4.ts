/**
 * G2A Growth Engine – GA4 élő adapter (Data API v1beta, properties/{id}:runReport)
 *
 * Napi bontás (dimension: date, YYYYMMDD) → a mock generátorral azonos kulcsok:
 *   sessions → sessions, totalUsers → users, keyEvents (fallback: conversions) → conversions,
 *   engagementRate → engagementRate (tört szám, 0–1; NEM alakítjuk százalékká).
 * A dátum UTC napi Date, ugyanúgy képezve, mint a mockban (`new Date("YYYY-MM-DD")`).
 * Adat nélküli napra nem gyártunk nullás sort.
 */
import type { DataConnection } from "../../../drizzle/schema";
import { googleRequest, withGoogleAuth, type GoogleDeps } from "../google/client";
import { GoogleApiError } from "../google/oauth";

export const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

type Row = { platform: DataConnection["platform"]; date: Date; metricKey: string; value: number; currency: null; dimension: null };

const GA4_METRIC_KEYS: Record<string, string> = {
  sessions: "sessions",
  totalUsers: "users",
  keyEvents: "conversions",
  conversions: "conversions",
  engagementRate: "engagementRate",
};
const KEY_ORDER = ["sessions", "users", "conversions", "engagementRate"];

/** "20261101" → "2026-11-01" (érvénytelen → null). */
export function ga4DateToDay(raw: string | undefined): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** Rögzített runReport-válasz → normalizált napi sorok. */
export function mapGa4Report(json: any): Row[] {
  const headers: string[] = (json?.metricHeaders ?? []).map((h: any) => String(h?.name ?? ""));
  const dateIdx = Math.max(0, (json?.dimensionHeaders ?? []).findIndex((h: any) => h?.name === "date"));
  const out: Row[] = [];
  for (const r of json?.rows ?? []) {
    const day = ga4DateToDay(r?.dimensionValues?.[dateIdx]?.value);
    if (!day) continue;
    const byKey = new Map<string, number>();
    headers.forEach((name, i) => {
      const key = GA4_METRIC_KEYS[name];
      const value = Number(r?.metricValues?.[i]?.value);
      if (key && Number.isFinite(value) && !byKey.has(key)) byKey.set(key, value);
    });
    for (const key of KEY_ORDER) {
      if (!byKey.has(key)) continue;
      out.push({ platform: "ga4", date: new Date(day), metricKey: key, value: byKey.get(key)!, currency: null, dimension: null });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function runReportBody(from: string, to: string, conversionMetric: "keyEvents" | "conversions") {
  return {
    dateRanges: [{ startDate: from, endDate: to }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: conversionMetric }, { name: "engagementRate" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 10000,
  };
}

export async function fetchGa4Metrics(conn: DataConnection, from: string, to: string, deps: GoogleDeps): Promise<Row[]> {
  const property = conn.externalAccountId;
  if (!/^properties\/\d+$/.test(property)) throw new GoogleApiError("GA4", 400, "érvénytelen property-azonosító");
  const url = `${GA4_DATA_API}/${property}:runReport`;
  return withGoogleAuth(conn, deps, async (accessToken) => {
    let json: any;
    try {
      json = await googleRequest("GA4 runReport", url, { method: "POST", accessToken, body: runReportBody(from, to, "keyEvents") }, deps);
    } catch (err) {
      // Régebbi property-n a keyEvents még nem elérhető (400) → a conversions metrikára váltunk.
      if (!(err instanceof GoogleApiError) || err.status !== 400) throw err;
      json = null;
    }
    const hasKeyEvents = (json?.metricHeaders ?? []).some((h: any) => h?.name === "keyEvents");
    if (!json || !hasKeyEvents) {
      json = await googleRequest("GA4 runReport", url, { method: "POST", accessToken, body: runReportBody(from, to, "conversions") }, deps);
    }
    return mapGa4Report(json);
  });
}
