/**
 * Google-adatforrás (GA4, Search Console, Google Ads) csatlakozás – kliensoldali segédek.
 * A szerver callbackje csak állapotjelzővel tér vissza: /riportok?google=…&platform=…
 */
export type GoogleSourcePlatform = "ga4" | "search_console" | "google_ads";

export const GOOGLE_SOURCE_PLATFORMS: GoogleSourcePlatform[] = ["ga4", "search_console", "google_ads"];

export const GOOGLE_SOURCE_LABEL: Record<GoogleSourcePlatform, string> = {
  ga4: "GA4",
  search_console: "Search Console",
  google_ads: "Google Ads",
};

export function isGoogleSourcePlatform(p: string | null | undefined): p is GoogleSourcePlatform {
  return !!p && (GOOGLE_SOURCE_PLATFORMS as string[]).includes(p);
}

export const GOOGLE_NOT_CONFIGURED_TEXT = "A Google-csatlakozás még nincs beállítva.";
export const GOOGLE_ADS_NOT_CONFIGURED_TEXT = "A Google Ads-csatlakozás még nincs beállítva.";

/** Mit kell kiválasztani a csatlakozás után (a Google Ads-nél fiókot, máshol tulajdont). */
export function googleSelectionNoun(platform: string | null | undefined): string {
  return platform === "google_ads" ? "fiók" : "tulajdon";
}

/** Indítható-e a csatlakozás az adott platformra (a Google Ads developer tokent is kér). */
export function googleConnectEnabled(
  platform: GoogleSourcePlatform,
  status: { googleConfigured?: boolean; googleAdsConfigured?: boolean } | undefined,
): boolean {
  if (status?.googleConfigured !== true) return false;
  return platform !== "google_ads" || status.googleAdsConfigured === true;
}

/** A csatlakozás indító URL-je (a szerver irányít tovább a Google-höz). */
export function googleConnectUrl(profileId: string, platform: GoogleSourcePlatform): string {
  return `/api/oauth/google/start?${new URLSearchParams({ profileId, platform }).toString()}`;
}

/** A visszatérés állapotjelzőjéből rövid üzenet (vagy null, ha nincs ilyen paraméter). */
export function googleReturnNotice(search: string): { kind: "success" | "error"; text: string } | null {
  const params = new URLSearchParams(search);
  const status = params.get("google");
  if (!status) return null;
  const platform = params.get("platform");
  const label = isGoogleSourcePlatform(platform) ? GOOGLE_SOURCE_LABEL[platform] : "Google";
  switch (status) {
    case "connected":
      return { kind: "success", text: `${label} csatlakoztatva. Válaszd ki, melyik ${googleSelectionNoun(platform)} adatait húzzuk be.` };
    case "denied":
      return { kind: "error", text: "Nem adtál hozzáférést, így a csatlakozás elmaradt." };
    case "unavailable":
      return { kind: "error", text: platform === "google_ads" ? GOOGLE_ADS_NOT_CONFIGURED_TEXT : GOOGLE_NOT_CONFIGURED_TEXT };
    default:
      return { kind: "error", text: "Nem sikerült a Google-csatlakozás. Próbáld újra." };
  }
}

/** A kapcsolat állapotszövege. */
export function connectionStatusText(conn: { connected: boolean; needsSelection: boolean }): string {
  if (conn.needsSelection) return "Kiválasztásra vár";
  return conn.connected ? "Csatlakoztatva" : "Nincs csatlakoztatva";
}
