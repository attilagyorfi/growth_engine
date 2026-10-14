/**
 * G2A Growth Engine – social kapcsolatok lejárati figyelmeztetése
 *
 * A LinkedIn (Share on LinkedIn / OpenID) hozzáférés 60 napig él, frissítő token
 * nélkül — utána újra kell csatlakozni. Eddig ez csak akkor derült ki, amikor egy
 * ütemezett poszt elbukott. Most az időzítő óránként ellenőrzi az aktív
 * kapcsolatokat, és értesít:
 *   - 7 napon belüli lejáratnál: „Hamarosan lejár …”,
 *   - lejárt kapcsolatnál: „Lejárt …”.
 * Mindkettő kapcsolatonként és lejárati dátumonként EGYSZER megy ki (a cím
 * tartalmazza a dátumot, ez a duplikáció-szűrés kulcsa).
 */
import { PLATFORM_LABEL } from "./publishing";

export const EXPIRY_WARN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpiringConnection = {
  id: string;
  profileId: string;
  platform: string;
  platformUsername: string | null;
  tokenExpiresAt: string | null;
};

export type ExpiryNotice = { title: string; body: string };

function huDate(d: Date): string {
  return d.toLocaleDateString("hu-HU", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" });
}

/** A kapcsolathoz tartozó figyelmeztetés (vagy null, ha még nem aktuális / nincs lejárat). */
export function expiryNotice(conn: ExpiringConnection, now: Date): ExpiryNotice | null {
  if (!conn.tokenExpiresAt) return null;
  const expiresAt = new Date(conn.tokenExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;

  const label = PLATFORM_LABEL[conn.platform] ?? conn.platform;
  const who = conn.platformUsername ? ` (${conn.platformUsername})` : "";
  const date = huDate(expiresAt);
  const msLeft = expiresAt.getTime() - now.getTime();

  if (msLeft <= 0) {
    return {
      title: `Lejárt a ${label}-kapcsolat (${date})`,
      body: `A(z) ${label}-fiókod${who} kapcsolata lejárt, ezért az ütemezett posztok nem mennek ki. Csatlakoztasd újra a Beállítások → Integrációk alatt — egy kattintás a ${label} csempére.`,
    };
  }
  if (msLeft <= EXPIRY_WARN_DAYS * DAY_MS) {
    const days = Math.max(1, Math.ceil(msLeft / DAY_MS));
    return {
      title: `Hamarosan lejár a ${label}-kapcsolat (${date})`,
      body: `A(z) ${label}-fiókod${who} kapcsolata ${days} nap múlva (${date}) lejár. Csatlakoztasd újra előtte a Beállítások → Integrációk alatt, hogy az ütemezett posztok ne akadjanak el.`,
    };
  }
  return null;
}

export type ExpiryDeps = {
  now(): Date;
  listActiveConnections(): Promise<ExpiringConnection[]>;
  /** Volt-e már ilyen című értesítés ehhez a profilhoz (duplikáció-szűrés). */
  hasNotification(profileId: string, title: string): Promise<boolean>;
  notify(profileId: string, title: string, body: string): Promise<void>;
};

export async function runExpiryCheck(deps: ExpiryDeps): Promise<{ notified: number }> {
  const now = deps.now();
  let notified = 0;
  for (const conn of await deps.listActiveConnections()) {
    const notice = expiryNotice(conn, now);
    if (!notice) continue;
    if (await deps.hasNotification(conn.profileId, notice.title)) continue;
    await deps.notify(conn.profileId, notice.title, notice.body);
    notified++;
  }
  return { notified };
}
