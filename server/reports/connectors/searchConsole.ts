/**
 * G2A Growth Engine – Search Console élő adapter (searchAnalytics.query)
 *
 * dimensions: [date] → napi sorok a mock generátorral azonos kulcsokkal:
 * impressions, clicks, ctr (tört szám, 0–1), position. Adat nélküli napra nincs sor.
 */
import type { DataConnection } from "../../../drizzle/schema";
import { googleRequest, withGoogleAuth, type GoogleDeps } from "../google/client";
import { GoogleApiError } from "../google/oauth";

export const GSC_API = "https://www.googleapis.com/webmasters/v3";

type Row = { platform: DataConnection["platform"]; date: Date; metricKey: string; value: number; currency: null; dimension: null };

const KEYS = ["impressions", "clicks", "ctr", "position"] as const;

/** A Search Console tulajdon-azonosító: URL-előtag vagy sc-domain:. */
export function isValidGscSiteUrl(site: string): boolean {
  return /^https?:\/\/\S+$/.test(site) || /^sc-domain:[^\s/]+$/.test(site);
}

/** Rögzített searchAnalytics.query-válasz → normalizált napi sorok. */
export function mapSearchAnalytics(json: any): Row[] {
  const out: Row[] = [];
  for (const r of json?.rows ?? []) {
    const day = r?.keys?.[0];
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    for (const key of KEYS) {
      const value = Number(r?.[key]);
      if (!Number.isFinite(value)) continue;
      out.push({ platform: "search_console", date: new Date(day), metricKey: key, value, currency: null, dimension: null });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function fetchSearchConsoleMetrics(conn: DataConnection, from: string, to: string, deps: GoogleDeps): Promise<Row[]> {
  const site = conn.externalAccountId;
  if (!isValidGscSiteUrl(site)) throw new GoogleApiError("Search Console", 400, "érvénytelen tulajdon-azonosító");
  const url = `${GSC_API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  return withGoogleAuth(conn, deps, async (accessToken) => {
    const json = await googleRequest(
      "Search Console query",
      url,
      { method: "POST", accessToken, body: { startDate: from, endDate: to, dimensions: ["date"], rowLimit: 25000 } },
      deps,
    );
    return mapSearchAnalytics(json);
  });
}
