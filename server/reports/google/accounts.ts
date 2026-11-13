/**
 * G2A Growth Engine – a csatlakozás után választható GA4-property-k,
 * Search Console-tulajdonok és Google Ads-ügyfélfiókok listája
 * (GA4 Admin API accountSummaries, GSC sites.list, Google Ads listAccessibleCustomers).
 */
import type { DataConnection } from "../../../drizzle/schema";
import { listGoogleAdsCustomers, type GoogleAdsConfig } from "./ads";
import { googleRequest, withGoogleAuth, type GoogleDeps } from "./client";

export const GA4_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
export const GSC_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
const MAX_PAGES = 10;

export type GoogleAccountOption = { id: string; name: string };

/** accountSummaries-válasz(ok) → „properties/<id>” opciók. */
export function mapAccountSummaries(pages: any[]): GoogleAccountOption[] {
  const out: GoogleAccountOption[] = [];
  for (const page of pages) {
    for (const account of page?.accountSummaries ?? []) {
      for (const p of account?.propertySummaries ?? []) {
        if (typeof p?.property !== "string" || !/^properties\/\d+$/.test(p.property)) continue;
        const name = [account?.displayName, p?.displayName].filter(Boolean).join(" / ") || p.property;
        out.push({ id: p.property, name: name.slice(0, 255) });
      }
    }
  }
  return out;
}

/** sites.list-válasz → tulajdon-opciók (az ellenőrizetlen tulajdonok kimaradnak). */
export function mapSites(json: any): GoogleAccountOption[] {
  return (json?.siteEntry ?? [])
    .filter((s: any) => typeof s?.siteUrl === "string" && s.permissionLevel !== "siteUnverifiedUser")
    .map((s: any) => ({ id: s.siteUrl, name: String(s.siteUrl).slice(0, 255) }));
}

export async function listGoogleAccounts(
  conn: DataConnection,
  deps: GoogleDeps,
  adsConfig?: GoogleAdsConfig | null,
): Promise<GoogleAccountOption[]> {
  if (conn.platform === "google_ads") {
    // Ügyfélfiókok kötőjel nélküli id-val, névként a formázott id (123-456-7890).
    return listGoogleAdsCustomers(conn, deps, adsConfig); // undefined → env-beli beállítás
  }
  return withGoogleAuth(conn, deps, async (accessToken) => {
    if (conn.platform === "search_console") {
      return mapSites(await googleRequest("Search Console sites.list", GSC_SITES_URL, { method: "GET", accessToken }, deps));
    }
    const pages: any[] = [];
    let pageToken = "";
    for (let i = 0; i < MAX_PAGES; i++) {
      const url = `${GA4_ADMIN_API}/accountSummaries?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const page = await googleRequest("GA4 accountSummaries", url, { method: "GET", accessToken }, deps);
      pages.push(page);
      pageToken = typeof page?.nextPageToken === "string" ? page.nextPageToken : "";
      if (!pageToken) break;
    }
    return mapAccountSummaries(pages);
  });
}
