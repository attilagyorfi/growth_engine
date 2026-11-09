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

  /**
   * HeyGen AI-videógyártás (avatar/hang lista + új videó indítása).
   *
   * MIÉRT KI: a G0 terv szerint (docs/termekcsalad/GROWTH_ENGINE_TERV.md) a videógyártás
   * befagyasztva: nem a fő érték, karbantartást visz, és minden videó fizetős HeyGen-hívás.
   *
   * MEDDIG: ha egy fizető ügyfél kéri, a G3 után; addig a kód marad, csak nem érhető el.
   * Visszakapcsolás: HEYGEN_VIDEO_ENABLED=true env (alapból nincs beállítva → kikapcsolt).
   *
   * Ami NEM változik: a már elkészült videók listája, az állapotlekérdezés (csak a DB-ből,
   * HeyGen-hívás nélkül) és a kvótakijelzés működik; adat nem törlődik.
   */
  heygenVideo: process.env.HEYGEN_VIDEO_ENABLED === "true",

  /**
   * Hírlevélküldés (super_admin kampányküldő, Resend).
   *
   * MIÉRT KI: a G0 terv szerint (docs/termekcsalad/GROWTH_ENGINE_TERV.md) a hírlevél
   * befagyasztva: nem a fő érték, karbantartást visz.
   *
   * MEDDIG: amíg a saját G2A-hírlevél el nem indul; addig a kód marad, csak nem érhető el.
   * Visszakapcsolás: NEWSLETTER_ENABLED=true env (alapból nincs beállítva → kikapcsolt).
   *
   * Ami NEM változik: a regisztrációs hírlevél-hozzájárulás gyűjtése és a feliratkozók
   * listája működik; feliratkozási adat nem törlődik.
   */
  newsletter: process.env.NEWSLETTER_ENABLED === "true",
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

export function isHeygenVideoEnabled(): boolean {
  return FEATURE_FLAGS.heygenVideo;
}

export function isNewsletterEnabled(): boolean {
  return FEATURE_FLAGS.newsletter;
}

/** Rövid, tegező hibaüzenet a kikapcsolt videókészítéshez (tRPC-hibákban). */
export const HEYGEN_VIDEO_DISABLED_MESSAGE = "A videókészítés egyelőre nem elérhető.";

/** Rövid, tegező hibaüzenet a kikapcsolt hírlevélküldéshez (tRPC-hibákban). */
export const NEWSLETTER_DISABLED_MESSAGE = "A hírlevélküldés egyelőre szünetel.";
