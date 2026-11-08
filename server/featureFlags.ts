/**
 * G2A Growth Engine – szerveroldali funkciókapcsolók
 *
 * Egy helyen, kódban dokumentálva. Az alapérték mindig a biztonságos (kikapcsolt)
 * állapot: a működéshez semmilyen env-et nem kell beállítani.
 */

/** A kapcsoló alá tartozó platformok: ezekhez nem lehet új kapcsolatot létrehozni, amíg ki van kapcsolva. */
export const META_TIKTOK_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;

export const FEATURE_FLAGS = {
  /**
   * Facebook / Instagram / TikTok csatlakozás (OAuth + kézi token).
   *
   * MIÉRT KI: a G0 terv szerint (docs/termekcsalad/GROWTH_ENGINE_TERV.md) a Growth
   * Engine Meta- és TikTok-appja nem megy App Review-ra — a közzététel a Social Hub
   * dolga. A kód a G2 végéig megmarad, csak nem érhető el.
   *
   * MEDDIG: a G2 végéig; utána vagy végleg törlődik, vagy (review után) visszakapcsolható.
   * Visszakapcsolás: SOCIAL_META_TIKTOK_ENABLED=true env (alapból nincs beállítva → kikapcsolt).
   *
   * Ami NEM változik: a meglévő kapcsolatok, a lecsatlakoztatás és a publikálás
   * (publishNow / schedulePost / időzítő) érintetlen.
   */
  metaTiktokConnect: process.env.SOCIAL_META_TIKTOK_ENABLED === "true",
};

export function isMetaTiktokConnectEnabled(): boolean {
  return FEATURE_FLAGS.metaTiktokConnect;
}

/** Igaz, ha a platform a kapcsoló alá tartozik ÉS a kapcsoló ki van kapcsolva. */
export function isConnectBlocked(platform: string): boolean {
  return !isMetaTiktokConnectEnabled() && (META_TIKTOK_PLATFORMS as readonly string[]).includes(platform);
}

/** Rövid, tegező hibaüzenet a kikapcsolt csatlakozáshoz (tRPC-hibákban). */
export const META_TIKTOK_DISABLED_MESSAGE =
  "A Facebook-, Instagram- és TikTok-csatlakozás egyelőre nem elérhető. A posztokat a Social Hubból teheted közzé.";
