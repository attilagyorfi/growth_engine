/**
 * Social kapcsolat „egészsége” a tárolt lejárat alapján (ugyanaz a 7 napos
 * küszöb, mint a szerver lejárati értesítéseinél — server/connectionExpiry.ts).
 */
export const EXPIRY_WARN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ConnectionHealth = {
  state: "ok" | "expiring" | "expired" | "unknown";
  expiresAt: Date | null;
  daysLeft: number | null;
};

export function connectionHealth(tokenExpiresAt: string | null | undefined, now: Date = new Date()): ConnectionHealth {
  if (!tokenExpiresAt) return { state: "unknown", expiresAt: null, daysLeft: null };
  const expiresAt = new Date(tokenExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return { state: "unknown", expiresAt: null, daysLeft: null };
  const msLeft = expiresAt.getTime() - now.getTime();
  if (msLeft <= 0) return { state: "expired", expiresAt, daysLeft: 0 };
  const daysLeft = Math.max(1, Math.ceil(msLeft / DAY_MS));
  return { state: msLeft <= EXPIRY_WARN_DAYS * DAY_MS ? "expiring" : "ok", expiresAt, daysLeft };
}

/** Lejárt vagy hamarosan lejár → a csempére kattintás újracsatlakoztat. */
export function needsReconnect(tokenExpiresAt: string | null | undefined, now: Date = new Date()): boolean {
  const { state } = connectionHealth(tokenExpiresAt, now);
  return state === "expired" || state === "expiring";
}

export function formatHuDate(d: Date): string {
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" });
}
