/**
 * G2A Growth Engine – közzététel (a „Közzétesz most” és az időzítő közös útja)
 *
 * - composePostText: a poszt szövege + a hozzá tartozó hashtagek (ami még nincs benne).
 * - publishWithConnection: token visszafejtés, lejárat-ellenőrzés, platform-routolás.
 * - classifyPublishError: érthető magyar hiba + „végleges-e” (újrapróbálás vagy feladás).
 */
import type { SocialConnection } from "../drizzle/schema";
import { decryptToken } from "./_core/tokenCrypto";

export const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", twitter: "X (Twitter)", tiktok: "TikTok",
};

/** Hiba, amelynél nincs értelme újrapróbálni (pl. lejárt kapcsolat, hiányzó kép). */
export class PublishError extends Error {
  constructor(message: string, readonly permanent: boolean) {
    super(message);
    this.name = "PublishError";
  }
}

/** A poszt szövege + azok a hashtagek, amelyek még nem szerepelnek benne (a tárolt alak # nélküli). */
export function composePostText(content: string, hashtags?: readonly string[] | null): string {
  const text = (content ?? "").trim();
  const lower = text.toLocaleLowerCase("hu-HU");
  const missing = (hashtags ?? [])
    .map((h) => String(h ?? "").trim().replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((h) => h && !lower.includes(`#${h.toLocaleLowerCase("hu-HU")}`));
  const unique = Array.from(new Set(missing));
  return unique.length ? `${text}\n\n${unique.map((h) => `#${h}`).join(" ")}` : text;
}

/**
 * A platform-hibaüzenetből érthető magyar szöveg + „végleges-e”.
 * Végleges: lejárt/visszavont hozzáférés, a platform elutasította a tartalmat.
 * Átmeneti: hálózati hiba, időtúllépés, 429, 5xx — ezeknél az időzítő újrapróbál.
 */
export function classifyPublishError(platform: string, err: unknown): { message: string; permanent: boolean } {
  const label = PLATFORM_LABEL[platform] ?? platform;
  if (err instanceof PublishError) return { message: err.message, permanent: err.permanent };
  const raw = err instanceof Error ? err.message : String(err);
  const short = raw.replace(/\s+/g, " ").slice(0, 300);

  if (/\b401\b|invalid[_ ]token|expired|OAuthException|"code"\s*:\s*190|REVOKED_ACCESS_TOKEN/i.test(raw)) {
    return { message: `A(z) ${label}-kapcsolat lejárt vagy visszavonták. Csatlakoztasd újra a Beállítások → Integrációk alatt.`, permanent: true };
  }
  if (/\b429\b|rate.?limit|too many requests/i.test(raw)) {
    return { message: `A(z) ${label} átmenetileg korlátozza a kéréseket. Később újrapróbáljuk.`, permanent: false };
  }
  if (/\b5\d\d\b|fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|aborted|timeout/i.test(raw)) {
    return { message: `A(z) ${label} most nem érhető el (${short}).`, permanent: false };
  }
  if (/\b(400|403|404|409|422)\b/.test(raw)) {
    return { message: `A(z) ${label} elutasította a posztot: ${short}`, permanent: true };
  }
  return { message: `Közzététel sikertelen (${label}): ${short}`, permanent: false };
}

type Publishers = {
  publishToLinkedIn: (token: string, authorId: string, text: string, imageUrl?: string) => Promise<{ postId: string }>;
  publishToFacebook: (token: string, pageId: string, text: string, imageUrl?: string) => Promise<{ postId: string }>;
  publishToInstagram: (token: string, igUserId: string, text: string, imageUrl: string) => Promise<{ postId: string }>;
};

/** Közzététel egy social kapcsolaton keresztül. Hibánál PublishError-t vagy a platform hibáját dobja. */
export async function publishWithConnection(
  conn: Pick<SocialConnection, "platform" | "accessToken" | "platformUserId" | "tokenExpiresAt" | "isActive">,
  text: string,
  imageUrl?: string | null,
  deps: { publishers?: Publishers; now?: Date } = {},
): Promise<{ postId: string }> {
  const label = PLATFORM_LABEL[conn.platform] ?? conn.platform;
  if (!conn.isActive) throw new PublishError(`A(z) ${label}-kapcsolat nem aktív. Csatlakoztasd újra.`, true);

  const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= (deps.now ?? new Date()).getTime()) {
    throw new PublishError(`A(z) ${label}-kapcsolat lejárt (${expiresAt.toLocaleDateString("hu-HU")}). Csatlakoztasd újra a Beállítások → Integrációk alatt.`, true);
  }

  const accessToken = decryptToken(conn.accessToken);
  if (!accessToken) throw new PublishError(`A(z) ${label} hozzáférési kulcsa hiányzik vagy sérült. Csatlakoztasd újra a fiókot.`, true);

  const p = deps.publishers ?? await import("./socialPublisher");
  const image = imageUrl || undefined;
  switch (conn.platform) {
    case "linkedin":
      if (!conn.platformUserId) throw new PublishError("A LinkedIn-fiók azonosítója hiányzik. Csatlakoztasd újra a fiókot.", true);
      return p.publishToLinkedIn(accessToken, conn.platformUserId, text, image);
    case "facebook":
      if (!conn.platformUserId) throw new PublishError("A Facebook-oldal azonosítója hiányzik. Csatlakoztasd újra a fiókot.", true);
      return p.publishToFacebook(accessToken, conn.platformUserId, text, image);
    case "instagram":
      if (!conn.platformUserId) throw new PublishError("Az Instagram üzleti fiók azonosítója hiányzik. Csatlakoztasd újra a Facebook-oldalon keresztül.", true);
      if (!image) throw new PublishError("Instagram-poszthoz kép kell (csak szöveges poszt ott nem lehetséges).", true);
      return p.publishToInstagram(accessToken, conn.platformUserId, text, image);
    default:
      throw new PublishError(`A(z) ${label} platformra jelenleg nem támogatott az automatikus közzététel.`, true);
  }
}
