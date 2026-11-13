/**
 * G2A Growth Engine – Google-adatkapcsolatok állapotai (data_connections, séma-változás nélkül)
 *
 *   1. OAuth-callback → `saveGoogleTokens`: profilonként és platformonként EGY sor.
 *      Ha már van ilyen sor (pl. újracsatlakozás), azt frissíti (brandId megmarad),
 *      különben újat szúr be. A sor „kiválasztásra vár”: externalAccountId =
 *      `pending:<connId>` (az oszlop notNull), connected=false. A tokenek titkosítva.
 *   2. Property/site/fiók kiválasztás → `selectGoogleAccount`: ugyanazt a sort frissíti
 *      id alapján (externalAccountId = „properties/<id>”, a GSC site URL, vagy a Google Ads
 *      ügyfélazonosító kötőjelek nélkül, pl. „1234567890”), connected=true.
 *   3. A szinkron a pending és a connected=false sorokat kihagyja (syncProfile).
 */
import { nanoid } from "nanoid";
import type { DataConnection, InsertDataConnection } from "../../../drizzle/schema";
import { encryptToken } from "../../_core/tokenCrypto";
import { isValidGscSiteUrl } from "../connectors/searchConsole";
import { formatCustomerId, normalizeCustomerId } from "./ads";
import { PENDING_ACCOUNT_PREFIX, isGooglePlatform, isPendingAccountId, type GooglePlatform, type GoogleTokenSet } from "./oauth";

export type DataConnectionStore = {
  findByProfilePlatform(profileId: string, platform: DataConnection["platform"]): Promise<DataConnection[]>;
  getById(connectionId: string): Promise<DataConnection | null>;
  insert(values: InsertDataConnection): Promise<void>;
  update(connectionId: string, patch: Partial<InsertDataConnection>): Promise<void>;
};

export async function saveGoogleTokens(
  store: DataConnectionStore,
  input: { profileId: string; platform: GooglePlatform; tokens: GoogleTokenSet },
): Promise<{ connectionId: string }> {
  const existing = (await store.findByProfilePlatform(input.profileId, input.platform))[0];
  const id = existing?.id ?? nanoid();
  const patch = {
    externalAccountId: `${PENDING_ACCOUNT_PREFIX}${id}`,
    externalAccountName: null,
    accessToken: encryptToken(input.tokens.accessToken),
    // prompt=consent mellett mindig jön refresh token; ha mégsem, a régit megtartjuk.
    ...(input.tokens.refreshToken ? { refreshToken: encryptToken(input.tokens.refreshToken) } : {}),
    tokenExpiry: input.tokens.expiresAt,
    scopes: input.tokens.scopes,
    connected: false,
    lastSyncError: null,
  } satisfies Partial<InsertDataConnection>;
  if (existing) {
    await store.update(id, patch);
  } else {
    await store.insert({ id, profileId: input.profileId, platform: input.platform, refreshToken: null, ...patch });
  }
  return { connectionId: id };
}

export class GoogleSelectionError extends Error {
  constructor(readonly code: "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST", message: string) {
    super(message);
    this.name = "GoogleSelectionError";
  }
}

/** A kiválasztás formai ellenőrzése és tárolási alakja platformonként (érvénytelen → null). */
export function normalizeGoogleAccountId(platform: GooglePlatform, externalAccountId: string): string | null {
  if (isPendingAccountId(externalAccountId)) return null;
  if (platform === "google_ads") return normalizeCustomerId(externalAccountId);
  if (platform === "ga4") return /^properties\/\d+$/.test(externalAccountId) ? externalAccountId : null;
  return isValidGscSiteUrl(externalAccountId) ? externalAccountId : null;
}

export function isValidGoogleAccountId(platform: GooglePlatform, externalAccountId: string): boolean {
  return normalizeGoogleAccountId(platform, externalAccountId) !== null;
}

const SELECT_HINT: Record<GooglePlatform, string> = {
  ga4: "Válassz egy GA4-tulajdont.",
  search_console: "Válassz egy Search Console-tulajdont.",
  google_ads: "Válassz egy Google Ads-fiókot.",
};

/** A profil Google-kapcsolata (más profilé → FORBIDDEN, nem Google → BAD_REQUEST). */
export async function loadGoogleConnection(store: DataConnectionStore, profileId: string, connectionId: string): Promise<DataConnection> {
  const conn = await store.getById(connectionId);
  if (!conn) throw new GoogleSelectionError("NOT_FOUND", "A kapcsolat nem található.");
  if (conn.profileId !== profileId) throw new GoogleSelectionError("FORBIDDEN", "Nincs jogosultságod ehhez a kapcsolathoz.");
  if (!isGooglePlatform(conn.platform)) {
    throw new GoogleSelectionError("BAD_REQUEST", "Ez nem Google-kapcsolat.");
  }
  if (!conn.refreshToken && !conn.accessToken) {
    throw new GoogleSelectionError("BAD_REQUEST", "Előbb csatlakozz Google-lel.");
  }
  return conn;
}

export async function selectGoogleAccount(
  store: DataConnectionStore,
  input: { profileId: string; connectionId: string; externalAccountId: string; externalAccountName?: string | null },
): Promise<{ connectionId: string; externalAccountId: string }> {
  const conn = await loadGoogleConnection(store, input.profileId, input.connectionId);
  const platform = conn.platform as GooglePlatform;
  const externalAccountId = normalizeGoogleAccountId(platform, input.externalAccountId);
  if (!externalAccountId) throw new GoogleSelectionError("BAD_REQUEST", SELECT_HINT[platform]);
  const defaultName = platform === "google_ads" ? formatCustomerId(externalAccountId) : externalAccountId;
  await store.update(conn.id, {
    externalAccountId,
    externalAccountName: (input.externalAccountName ?? defaultName).slice(0, 255),
    connected: true,
    lastSyncError: null,
  });
  return { connectionId: conn.id, externalAccountId };
}

/** A kliensnek kimenő, titokmentes kapcsolat-nézet (explicit mezőlista). */
export function toSafeConnection(conn: DataConnection) {
  return {
    id: conn.id,
    platform: conn.platform,
    externalAccountId: conn.externalAccountId,
    externalAccountName: conn.externalAccountName,
    brandId: conn.brandId,
    connected: conn.connected,
    lastSyncedAt: conn.lastSyncedAt,
    lastSyncError: conn.lastSyncError,
    tokenExpiry: conn.tokenExpiry,
    scopes: conn.scopes,
    needsSelection: isPendingAccountId(conn.externalAccountId),
  };
}
