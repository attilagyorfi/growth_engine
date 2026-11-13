/**
 * G2A Growth Engine – Google OAuth route-ok (GA4, Search Console, Google Ads)
 *
 * Flow:
 *   1. GET /api/oauth/google/start?profileId=…&platform=ga4|search_console|google_ads
 *      (bejelentkezett, a profilra jogosult felhasználó) → Google authorize URL
 *      (offline access, prompt=consent, a platform scope-jai — `scopesFor` —, aláírt state).
 *   2. GET /api/oauth/google/callback?code&state
 *      a) state: HMAC-aláírás, ≤10 perces lejárat, és a nonce egyezik az indításkor
 *         beállított httpOnly sütiével (állapotmentes, így Vercel serverlessen is
 *         működik); a süti a callbackben mindig törlődik → egyszer használható;
 *      b) a session-süti felhasználója = a state userId-ja, és jogosult a profilra;
 *      c) code → token csere, majd „kiválasztásra vár” kapcsolatsor (titkosított tokenek);
 *      d) visszairányítás: /riportok?google=connected|denied|error|unavailable&platform=…
 *         — token, code vagy Google-hibarészlet soha nem kerül az URL-be vagy a naplóba.
 * Fail-closed: hiányzó Google-env esetén sem az indítás, sem a callback nem hív Google-t;
 * a google_ads ezen felül developer token (GOOGLE_ADS_DEVELOPER_TOKEN) nélkül sem indul.
 */
import type { Express, Request, Response } from "express";
import { getPublicAppOrigin } from "../../_core/env";
import { assertProfileOwnership } from "../../_core/ownership";
import { describeError } from "../syncProfile";
import { isGoogleAdsConfigured } from "./ads";
import { saveGoogleTokens, type DataConnectionStore } from "./connections";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  getGoogleOAuthConfig,
  GOOGLE_NONCE_COOKIE,
  GOOGLE_NONCE_COOKIE_PATH,
  GOOGLE_STATE_TTL_MS,
  googleNonceMatches,
  issueGoogleNonce,
  readCookie,
  isGooglePlatform,
  signGoogleState,
  verifyGoogleState,
  type FetchLike,
  type GoogleOAuthConfig,
  type GooglePlatform,
} from "./oauth";

export type SessionUser = { id: string; role: string; profileId: string | null };

export type GoogleOAuthRouteDeps = {
  config(): GoogleOAuthConfig | null;
  getSessionUser(req: Request): Promise<SessionUser | null>;
  assertOwnership(user: SessionUser, profileId: string): Promise<void>;
  fetch: FetchLike;
  store: DataConnectionStore;
  now(): number;
  appOrigin(): string;
  /** Google Ads: OAuth-env ÉS developer token is be van-e állítva (hiányában false → fail-closed). */
  adsConfigured?(): boolean;
};

type Status = "connected" | "denied" | "error" | "unavailable";

function back(res: Response, deps: GoogleOAuthRouteDeps, status: Status, platform?: string) {
  const params = new URLSearchParams({ google: status });
  if (platform && isGooglePlatform(platform)) params.set("platform", platform);
  res.redirect(`${deps.appOrigin()}/riportok?${params.toString()}`);
}

export function createGoogleOAuthHandlers(deps: GoogleOAuthRouteDeps) {
  const platformAvailable = (platform: GooglePlatform) => platform !== "google_ads" || deps.adsConfigured?.() === true;

  async function start(req: Request, res: Response) {
    const { profileId, platform } = req.query as { profileId?: string; platform?: string };
    const config = deps.config();
    if (!config) return back(res, deps, "unavailable", platform);
    if (!profileId || !platform || !isGooglePlatform(platform)) {
      res.status(400).json({ error: "Hiányzó vagy érvénytelen paraméter." });
      return;
    }
    if (!platformAvailable(platform)) return back(res, deps, "unavailable", platform);
    const user = await deps.getSessionUser(req);
    if (!user) { res.status(401).json({ error: "Jelentkezz be újra." }); return; }
    try {
      await deps.assertOwnership(user, profileId);
    } catch {
      res.status(403).json({ error: "Nincs jogosultságod ehhez a profilhoz." });
      return;
    }
    const { nonce, exp } = issueGoogleNonce(deps.now());
    const state = signGoogleState({ userId: user.id, profileId, platform, nonce, exp });
    res.cookie(GOOGLE_NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: deps.appOrigin().startsWith("https://"),
      // Lax: a Google-ról visszatérő felső szintű GET-navigáció elviszi a sütit.
      sameSite: "lax",
      path: GOOGLE_NONCE_COOKIE_PATH,
      maxAge: GOOGLE_STATE_TTL_MS,
    });
    res.redirect(buildGoogleAuthorizeUrl(config, state, platform));
  }

  async function callback(req: Request, res: Response) {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    const config = deps.config();
    if (!config) return back(res, deps, "unavailable");

    const cookieNonce = readCookie(req.headers.cookie, GOOGLE_NONCE_COOKIE);
    // A süti egyszer használható: minden callback-próbálkozás törli.
    res.clearCookie(GOOGLE_NONCE_COOKIE, { path: GOOGLE_NONCE_COOKIE_PATH });
    const payload = verifyGoogleState(state, deps.now());
    if (!payload || !googleNonceMatches(cookieNonce, payload.nonce)) {
      console.warn("[Google OAuth] érvénytelen, lejárt vagy már felhasznált state");
      return back(res, deps, "error");
    }
    if (error) return back(res, deps, "denied", payload.platform); // pl. access_denied — részlet nem kell
    if (!platformAvailable(payload.platform)) return back(res, deps, "unavailable", payload.platform);
    if (!code) return back(res, deps, "error", payload.platform);

    const user = await deps.getSessionUser(req);
    if (!user || user.id !== payload.userId) {
      console.warn("[Google OAuth] a state más felhasználóhoz tartozik, vagy nincs session");
      return back(res, deps, "error", payload.platform);
    }
    try {
      await deps.assertOwnership(user, payload.profileId);
    } catch {
      console.warn(`[Google OAuth] nincs jogosultság a profilhoz: ${payload.profileId}`);
      return back(res, deps, "error", payload.platform);
    }

    try {
      const tokens = await exchangeGoogleCode(config, code, deps.fetch, payload.platform, new Date(deps.now()));
      await saveGoogleTokens(deps.store, { profileId: payload.profileId, platform: payload.platform, tokens });
      return back(res, deps, "connected", payload.platform);
    } catch (err) {
      const info = describeError(err);
      console.error(`[Google OAuth] csatlakozás sikertelen profil=${payload.profileId}: ${info.name}: ${info.message}`);
      return back(res, deps, "error", payload.platform);
    }
  }

  // Külső védőháló: ha bármi dob (pl. session-ellenőrzés, DB), nincs kezeletlen
  // promise-hiba — visszairányítás állapotjelzővel, naplóban csak név + rövid üzenet.
  const guard = (name: string, fn: (req: Request, res: Response) => Promise<void>) =>
    async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (err) {
        const info = describeError(err);
        console.error(`[Google OAuth] ${name} váratlan hiba: ${info.name}: ${info.message}`);
        if (!res.headersSent) back(res, deps, "error");
      }
    };

  return { start: guard("start", start), callback: guard("callback", callback) };
}

function readAppToken(req: Request): string | null {
  const cookie = req.headers.cookie ?? "";
  const m = cookie.match(/(?:^|;\s*)app_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function defaultGoogleOAuthRouteDeps(): Promise<GoogleOAuthRouteDeps> {
  const { verifyAppToken } = await import("../../routers/appAuth");
  const { getAppUserById } = await import("../../authDb");
  const { dataConnectionStore } = await import("../../db");
  return {
    config: getGoogleOAuthConfig,
    getSessionUser: async (req) => {
      const token = readAppToken(req);
      if (!token) return null;
      const payload = await verifyAppToken(token);
      if (!payload) return null;
      const user = await getAppUserById(payload.userId as string);
      return user ? { id: user.id, role: user.role, profileId: user.profileId ?? null } : null;
    },
    assertOwnership: (user, profileId) => assertProfileOwnership(user.id, user.role, profileId, user.profileId),
    fetch: (url, init) => fetch(url, init),
    store: dataConnectionStore,
    now: () => Date.now(),
    appOrigin: getPublicAppOrigin,
    adsConfigured: isGoogleAdsConfigured,
  };
}

export function registerGoogleOAuthRoutes(app: Express, depsPromise: Promise<GoogleOAuthRouteDeps> = defaultGoogleOAuthRouteDeps()) {
  const handlers = depsPromise.then(createGoogleOAuthHandlers);
  app.get("/api/oauth/google/start", async (req, res) => (await handlers).start(req, res));
  app.get("/api/oauth/google/callback", async (req, res) => (await handlers).callback(req, res));
}
