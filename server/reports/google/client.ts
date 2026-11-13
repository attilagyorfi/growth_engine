/**
 * G2A Growth Engine – Google REST-hívások közös rétege (G1)
 *
 *   - `googleRequest`: JSON-hívás korlátozott újrapróbálással. Csak 429,
 *     RESOURCE_EXHAUSTED és 5xx (meg hálózati hiba) esetén próbál újra, legfeljebb
 *     `maxRetries`-szor (alapból 3), exponenciális backoff-fal, injektált sleep-pel.
 *     401 → GoogleUnauthorizedError (a hívó frissít), más 4xx → azonnal GoogleApiError.
 *   - `withGoogleAuth`: érvényes access tokent ad (lejárt vagy 60 mp-en belül lejáró
 *     tokennél előbb frissít, és az új titkosított tokent + lejáratot visszaírja), 401-re
 *     egyszer frissít és újrapróbál; ha utána is 401 / invalid_grant → GoogleAuthRevokedError.
 *
 * Minden külső függőség (fetch, sleep, óra, konfiguráció, DB-visszaírás) injektálható,
 * így a tesztek kizárólag mockolt HTTP-válaszokkal futnak.
 */
import type { DataConnection } from "../../../drizzle/schema";
import { decryptToken, encryptToken } from "../../_core/tokenCrypto";
import {
  GoogleApiError,
  GoogleAuthRevokedError,
  getGoogleOAuthConfig,
  refreshGoogleAccessToken,
  type FetchLike,
  type GoogleOAuthConfig,
} from "./oauth";

export const GOOGLE_MAX_RETRIES = 3;
export const GOOGLE_RETRY_BASE_MS = 1000;
/** Ennyivel a lejárat előtt már frissítünk. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;

/** 401 a Google API-tól — a hívó (withGoogleAuth) frissít és újrapróbál. */
export class GoogleUnauthorizedError extends Error {
  constructor(label: string) {
    super(`${label}: HTTP 401`);
    this.name = "GoogleUnauthorizedError";
  }
}

export type GoogleHttpDeps = {
  fetch: FetchLike;
  sleep(ms: number): Promise<void>;
  maxRetries?: number;
};

export type GoogleDeps = GoogleHttpDeps & {
  now(): Date;
  config(): GoogleOAuthConfig | null;
  /** Az új (már titkosított) access token és lejárat visszaírása a kapcsolat sorába. */
  saveAccessToken(connectionId: string, encryptedAccessToken: string, tokenExpiry: Date): Promise<void>;
};

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isRetryable(status: number, json: any): boolean {
  return status === 429 || status >= 500 || json?.error?.status === "RESOURCE_EXHAUSTED";
}

export async function googleRequest<T = any>(
  label: string,
  url: string,
  init: { method: "GET" | "POST"; accessToken: string; body?: unknown },
  deps: GoogleHttpDeps,
): Promise<T> {
  const maxRetries = deps.maxRetries ?? GOOGLE_MAX_RETRIES;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await deps.fetch(url, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${init.accessToken}`,
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch {
      if (attempt < maxRetries) {
        await deps.sleep(GOOGLE_RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      throw new GoogleApiError(label, 0, "hálózati hiba");
    }
    if (res.ok) return (await readJson(res)) as T;
    const json = await readJson(res);
    if (res.status === 401) throw new GoogleUnauthorizedError(label);
    if (isRetryable(res.status, json)) {
      if (attempt < maxRetries) {
        await deps.sleep(GOOGLE_RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
      throw new GoogleApiError(label, res.status, `${maxRetries} újrapróbálás után is kvóta-/szerverhiba`);
    }
    throw new GoogleApiError(label, res.status);
  }
}

async function refreshAndSave(conn: DataConnection, config: GoogleOAuthConfig, deps: GoogleDeps): Promise<string> {
  const refreshToken = decryptToken(conn.refreshToken);
  if (!refreshToken) throw new GoogleAuthRevokedError();
  const tokens = await refreshGoogleAccessToken(config, refreshToken, deps.fetch, deps.now());
  await deps.saveAccessToken(conn.id, encryptToken(tokens.accessToken), tokens.expiresAt);
  return tokens.accessToken;
}

/** Érvényes access tokennel futtatja `fn`-t (frissítés, 401 → egyszeri újrapróbálás). */
export async function withGoogleAuth<T>(
  conn: DataConnection,
  deps: GoogleDeps,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  const config = deps.config();
  if (!config) throw new GoogleApiError("Google", 503, "a Google-csatlakozás nincs beállítva");

  const expiry = conn.tokenExpiry ? new Date(conn.tokenExpiry).getTime() : 0;
  const stored = decryptToken(conn.accessToken);
  let token = stored && expiry - TOKEN_REFRESH_SKEW_MS > deps.now().getTime()
    ? stored
    : await refreshAndSave(conn, config, deps);
  try {
    return await fn(token);
  } catch (err) {
    if (!(err instanceof GoogleUnauthorizedError)) throw err;
  }
  token = await refreshAndSave(conn, config, deps);
  try {
    return await fn(token);
  } catch (err) {
    if (err instanceof GoogleUnauthorizedError) throw new GoogleAuthRevokedError();
    throw err;
  }
}

/** Éles függőségek: globális fetch, setTimeout, a DB-visszaírás lusta importtal. */
export function defaultGoogleDeps(): GoogleDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    config: getGoogleOAuthConfig,
    saveAccessToken: async (id, accessToken, tokenExpiry) => {
      const db = await import("../../db");
      await db.updateDataConnectionAccessToken(id, accessToken, tokenExpiry);
    },
  };
}
