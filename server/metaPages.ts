/**
 * G2A Growth Engine – Meta (Facebook/Instagram) oldalak kezelése a csatlakozáskor
 *
 * Ha a felhasználó több Facebook-oldalt kezel (ügynökség!), a Meta mindet visszaadja.
 * Eddig MINDEN oldal aktív kapcsolatként mentődött (kulccsal együtt) az épp kiválasztott
 * ügyfélhez. Most:
 *   - 1 oldal  → közvetlenül mentjük,
 *   - több     → a kulcsok CSAK memóriában várnak (15 percig), a felhasználó kiválasztja,
 *                melyik oldal tartozik ehhez az ügyfélhez, és csak az mentődik.
 * A függő választás a felhasználóhoz kötött, véletlen azonosítóval (nem kitalálható);
 * újraindításkor elvész — akkor a csatlakozást újra kell indítani.
 */
import crypto from "crypto";
import { nanoid } from "nanoid";
import { META_GRAPH_BASE } from "./_core/meta";
import { encryptToken } from "./_core/tokenCrypto";
import { DEACTIVATED_CONNECTION } from "./_core/socialConnectionState";

export type MetaPage = { id: string; name: string; accessToken: string; instagramId?: string };

type Pending = { profileId: string; userId: string; pages: MetaPage[]; expiresAt: number };

export const PENDING_TTL_MS = 15 * 60 * 1000;
const pending = new Map<string, Pending>();

function prune(now: number) {
  for (const [id, p] of Array.from(pending.entries())) if (p.expiresAt <= now) pending.delete(id);
}

/** Több oldal esetén: elteszi a választáshoz; a visszaadott azonosító megy az URL-be. */
export function savePendingPages(p: Omit<Pending, "expiresAt">, now = Date.now()): string {
  prune(now);
  const id = crypto.randomBytes(18).toString("base64url");
  pending.set(id, { ...p, expiresAt: now + PENDING_TTL_MS });
  return id;
}

/** A függő választás (csak a saját felhasználójának, lejáratig). */
export function peekPendingPages(id: string, userId: string, now = Date.now()): Pending | null {
  const p = pending.get(id);
  if (!p || p.userId !== userId) return null;
  if (p.expiresAt <= now) { pending.delete(id); return null; }
  return p;
}

/** Ugyanaz, de egyben törli is (egyszer használható). */
export function takePendingPages(id: string, userId: string, now = Date.now()): Pending | null {
  const p = peekPendingPages(id, userId, now);
  if (p) pending.delete(id);
  return p;
}

export function resetPendingPages() {
  pending.clear();
}

type Db = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;
type FetchLike = (url: string) => Promise<Response>;

/**
 * Egy oldal (és ha van, a hozzá kötött Instagram üzleti fiók) mentése az ügyfélhez.
 * A profil korábbi Facebook/Instagram kapcsolatai kikapcsolnak, a kulcsuk törlődik.
 * A long-lived user tokenből kért Page-token nem jár le → tokenExpiresAt: null.
 */
export async function saveMetaPageConnection(
  db: Db,
  profileId: string,
  page: MetaPage,
  deps: { fetch?: FetchLike } = {},
): Promise<{ pageName: string; instagramUsername: string | null }> {
  const { socialConnections } = await import("../drizzle/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const f: FetchLike = deps.fetch ?? fetch;

  await db.update(socialConnections)
    .set({ ...DEACTIVATED_CONNECTION })
    .where(and(eq(socialConnections.profileId, profileId), inArray(socialConnections.platform, ["facebook", "instagram"])));

  await db.insert(socialConnections).values({
    id: nanoid(),
    profileId,
    platform: "facebook",
    accessToken: encryptToken(page.accessToken),
    refreshToken: null,
    tokenExpiresAt: null, // Page-token: nem jár le
    platformUserId: page.id,
    platformUsername: page.name,
    isActive: true,
  });

  let instagramUsername: string | null = null;
  if (page.instagramId) {
    try {
      const igRes = await f(`${META_GRAPH_BASE}/${page.instagramId}?` + new URLSearchParams({ access_token: page.accessToken, fields: "username" }));
      if (igRes.ok) instagramUsername = (await igRes.json() as { username?: string }).username ?? null;
    } catch { /* a felhasználónév nem kötelező */ }
    await db.insert(socialConnections).values({
      id: nanoid(),
      profileId,
      platform: "instagram",
      accessToken: encryptToken(page.accessToken), // IG-hez is a Page-token kell
      refreshToken: null,
      tokenExpiresAt: null,
      platformUserId: page.instagramId,
      platformUsername: instagramUsername || `@${page.name}`,
      isActive: true,
    });
  }
  return { pageName: page.name, instagramUsername };
}
