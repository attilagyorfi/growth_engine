/**
 * Az időzítő-ablak figyelmeztetése (Tartalomstúdió → Poszt időzítése): melyik
 * üzenetet mutassuk a poszt platformja, a kapcsolat és a kapcsoló alapján.
 */

/**
 * A FB/IG/TikTok-kapcsoló alá tartozó platformok — a szerveres
 * `META_TIKTOK_PLATFORMS` (server/featureFlags.ts) kliensoldali tükre.
 * A kettőt együtt kell változtatni.
 */
export const META_TIKTOK_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;

export function isMetaTiktokPlatform(platform: string): boolean {
  return (META_TIKTOK_PLATFORMS as readonly string[]).includes(platform);
}

export type ScheduleWarning =
  /** Van aktív kapcsolat, az időpontban kimegy. */
  | { kind: "ok" }
  /** Instagram-poszt kép nélkül. */
  | { kind: "needsImage" }
  /** A kapcsolat az ütemezett időpont előtt lejár → újracsatlakozás a Beállításokban. */
  | { kind: "expired"; expiresAt: Date }
  /** Nincs kapcsolat → csatlakozás a Beállításokban. */
  | { kind: "notConnected" }
  /** FB/IG/TikTok, kikapcsolt csatlakozás: nincs (érvényes) kapcsolat → Social Hub. */
  | { kind: "socialHub" };

export function getScheduleWarning(input: {
  platform: string;
  /** A profil aktív kapcsolata ezen a platformon (ha van). */
  connection: { tokenExpiresAt?: Date | string | null } | null | undefined;
  hasImage: boolean;
  /** Az ütemezett időpont (null, ha még nincs dátum). */
  scheduledAt: Date | null;
  /** `social.isPlatformConfigured.metaTiktokEnabled` — betöltés alatt false. */
  metaTiktokEnabled: boolean;
}): ScheduleWarning {
  const { platform, connection, hasImage, scheduledAt, metaTiktokEnabled } = input;
  const needsImage = platform === "instagram" && !hasImage;
  // A kapcsolat az ütemezett időpontig lejár? (LinkedIn: 60 nap, frissítés nélkül)
  const expiresAt = connection?.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : null;
  const expiredByThen = !!(
    connection && expiresAt && scheduledAt &&
    !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= scheduledAt.getTime()
  );

  if (connection && !needsImage && !expiredByThen) return { kind: "ok" };
  if (needsImage) return { kind: "needsImage" };
  // Kikapcsolt FB/IG/TikTok-csatlakozásnál új kapcsolat sem jöhet létre, ezért a
  // Beállítások helyett a Social Hubra mutatunk.
  if (!metaTiktokEnabled && isMetaTiktokPlatform(platform)) return { kind: "socialHub" };
  if (expiredByThen) return { kind: "expired", expiresAt: expiresAt! };
  return { kind: "notConnected" };
}
