/**
 * Google-adatforrás (GA4, Search Console) csatlakozás – kliensoldali segédek.
 * A szerver callbackje csak állapotjelzővel tér vissza: /riportok?google=…&platform=…
 */
export type GoogleSourcePlatform = "ga4" | "search_console";

export const GOOGLE_SOURCE_LABEL: Record<GoogleSourcePlatform, string> = {
  ga4: "GA4",
  search_console: "Search Console",
};

export const GOOGLE_NOT_CONFIGURED_TEXT = "A Google-csatlakozás még nincs beállítva.";

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
  const label = platform === "ga4" || platform === "search_console" ? GOOGLE_SOURCE_LABEL[platform] : "Google";
  switch (status) {
    case "connected":
      return { kind: "success", text: `${label} csatlakoztatva. Válaszd ki, melyik tulajdon adatait húzzuk be.` };
    case "denied":
      return { kind: "error", text: "Nem adtál hozzáférést, így a csatlakozás elmaradt." };
    case "unavailable":
      return { kind: "error", text: GOOGLE_NOT_CONFIGURED_TEXT };
    default:
      return { kind: "error", text: "Nem sikerült a Google-csatlakozás. Próbáld újra." };
  }
}

/** A kapcsolat állapotszövege. */
export function connectionStatusText(conn: { connected: boolean; needsSelection: boolean }): string {
  if (conn.needsSelection) return "Kiválasztásra vár";
  return conn.connected ? "Csatlakoztatva" : "Nincs csatlakoztatva";
}
