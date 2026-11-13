/**
 * G2A Growth Engine – Google OAuth 2.0 (GA4 + Search Console, G1)
 *
 * Nyers fetch, új függőség nélkül. Csak olvasó scope-ok:
 *   - https://www.googleapis.com/auth/analytics.readonly   (GA4 Data + Admin API)
 *   - https://www.googleapis.com/auth/webmasters.readonly  (Search Console API)
 *
 * Fail-closed: a GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REDIRECT_URL bármelyike vagy a
 * JWT_SECRET (state-aláírás + token-titkosítás) hiányában `getGoogleOAuthConfig()`
 * null → nincs OAuth-indítás, nincs callback-feldolgozás, nincs Google-hívás.
 *
 * Titkok: a client secret, a code és a tokenek soha nem kerülnek naplóba, hibaüzenetbe,
 * URL-be (a token-végpontot POST-törzzsel hívjuk) vagy tRPC-válaszba. A hibák csak
 * HTTP-státuszt és egy rövid, saját szöveget visznek, a Google-válasz törzsét nem.
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { ENV } from "../../_core/env";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;

/** A Google-lel csatlakoztatható adatkapcsolat-platformok. */
export const GOOGLE_PLATFORMS = ["ga4", "search_console"] as const;
export type GooglePlatform = (typeof GOOGLE_PLATFORMS)[number];
export function isGooglePlatform(p: string): p is GooglePlatform {
  return (GOOGLE_PLATFORMS as readonly string[]).includes(p);
}

/** A kiválasztásra váró kapcsolat externalAccountId-ja: `pending:<connId>` (az oszlop notNull). */
export const PENDING_ACCOUNT_PREFIX = "pending:";
export function isPendingAccountId(externalAccountId: string | null | undefined): boolean {
  return !!externalAccountId && externalAccountId.startsWith(PENDING_ACCOUNT_PREFIX);
}

// ─── Hibák ──────────────────────────────────────────────────────────────────

/** A hozzáférés visszavonva / lejárt (invalid_grant, vagy frissítés utáni 401) → újracsatlakozás kell. */
export class GoogleAuthRevokedError extends Error {
  constructor(message = "A Google-hozzáférés megszűnt, csatlakoztasd újra.") {
    super(message);
    this.name = "GoogleAuthRevokedError";
  }
}

/** Titokmentes Google API-hiba: csak a hívás neve és a HTTP-státusz. */
export class GoogleApiError extends Error {
  readonly status: number;
  constructor(label: string, status: number, detail?: string) {
    super(`${label}: HTTP ${status}${detail ? ` (${detail})` : ""}`);
    this.name = "GoogleApiError";
    this.status = status;
  }
}

// ─── Konfiguráció ───────────────────────────────────────────────────────────

export type GoogleOAuthConfig = { clientId: string; clientSecret: string; redirectUrl: string };

/** A Google OAuth-beállítás, vagy null, ha bármi hiányzik (fail-closed). */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = ENV.googleOAuthClientId;
  const clientSecret = ENV.googleOAuthClientSecret;
  const redirectUrl = ENV.googleOAuthRedirectUrl;
  if (!clientId || !clientSecret || !redirectUrl || !ENV.cookieSecret) return null;
  return { clientId, clientSecret, redirectUrl };
}

/** A kliensnek csak ez a boolean megy ki (env-érték soha). */
export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}

// ─── State: HMAC-aláírt, 10 perces, egyszer használható ────────────────────

export const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleStatePayload = {
  userId: string;
  profileId: string;
  platform: GooglePlatform;
  nonce: string;
  /** Lejárat (epoch ms). */
  exp: number;
};

function stateKey(secret: string): Buffer {
  // Külön kulcs a JWT_SECRET-ből, hogy a state-aláírás ne legyen session-tokenként újrahasznosítható.
  return createHash("sha256").update(`g2a-google-oauth-state-v1:${secret}`).digest();
}

export function signGoogleState(payload: GoogleStatePayload, secret = ENV.cookieSecret): string {
  if (!secret) throw new Error("A state aláírásához JWT_SECRET kell.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateKey(secret)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** Aláírás + lejárat ellenőrzése (a nonce egyszeri felhasználását a süti-összevetés végzi, lásd lent). */
export function verifyGoogleState(state: string | undefined, now = Date.now(), secret = ENV.cookieSecret): GoogleStatePayload | null {
  if (!state || !secret) return null;
  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = Buffer.from(state.slice(dot + 1), "base64url");
  const expected = createHmac("sha256", stateKey(secret)).update(body).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof obj.userId !== "string" || typeof obj.profileId !== "string" || typeof obj.nonce !== "string") return null;
    if (typeof obj.exp !== "number" || !isGooglePlatform(obj.platform)) return null;
    if (now > obj.exp) return null;
    return obj as GoogleStatePayload;
  } catch {
    return null;
  }
}

/**
 * Egyszer használható nonce, állapotmentesen: az indításkor kiadott nonce egy rövid
 * életű, httpOnly sütibe kerül (csak a /api/oauth/google útvonalra), és az aláírt
 * state is tartalmazza. A callback a kettőt összeveti, majd a sütit mindenképp törli.
 * Így bármelyik példány (Vercel serverless, Railway) ellenőrizni tudja, a state csak
 * abban a böngészőben használható fel, ahol a csatlakozás indult, és csak egyszer.
 */
export const GOOGLE_NONCE_COOKIE = "g2a_google_oauth_nonce";
export const GOOGLE_NONCE_COOKIE_PATH = "/api/oauth/google";

export function issueGoogleNonce(now = Date.now()): { nonce: string; exp: number } {
  return { nonce: randomBytes(16).toString("base64url"), exp: now + GOOGLE_STATE_TTL_MS };
}

/** Időzítés-biztos összevetés; üres vagy hiányzó érték soha nem egyezik. */
export function googleNonceMatches(cookieNonce: string | null | undefined, stateNonce: string | null | undefined): boolean {
  if (!cookieNonce || !stateNonce) return false;
  const a = Buffer.from(cookieNonce);
  const b = Buffer.from(stateNonce);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Egy süti értéke a Cookie fejlécből (cookie-parser nélkül). */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ─── Authorize URL ──────────────────────────────────────────────────────────

export function buildGoogleAuthorizeUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUrl,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── Token-végpont ──────────────────────────────────────────────────────────

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
};

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toTokenSet(json: any, now: Date): GoogleTokenSet {
  if (!json || typeof json.access_token !== "string" || !json.access_token) {
    throw new GoogleApiError("Google token-csere", 502, "hiányos válasz");
  }
  const expiresIn = Number(json.expires_in);
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : null,
    expiresAt: new Date(now.getTime() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(" ").filter(Boolean) : [...GOOGLE_SCOPES],
  };
}

/** code → token csere (POST-törzzsel: a code és a secret nem kerül URL-be). */
export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  fetchImpl: FetchLike,
  now = new Date(),
): Promise<GoogleTokenSet> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUrl,
      grant_type: "authorization_code",
    }).toString(),
  });
  const json = await readJson(res);
  if (!res.ok) throw new GoogleApiError("Google token-csere", res.status);
  return toTokenSet(json, now);
}

/** refresh_token → új access token. invalid_grant → GoogleAuthRevokedError. */
export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: FetchLike,
  now = new Date(),
): Promise<GoogleTokenSet> {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = await readJson(res);
  if (!res.ok) {
    if (json?.error === "invalid_grant") throw new GoogleAuthRevokedError();
    throw new GoogleApiError("Google token-frissítés", res.status);
  }
  return toTokenSet(json, now);
}

/** Google-oldali visszavonás bontáskor — best effort, hibája nem akadályozza a bontást. */
export async function revokeGoogleToken(token: string, fetchImpl: FetchLike): Promise<boolean> {
  try {
    const res = await fetchImpl(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
