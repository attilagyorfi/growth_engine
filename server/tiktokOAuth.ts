/**
 * G2A Growth Engine – TikTok OAuth (TikTok for Developers)
 *
 * Flow:
 *   1. /api/oauth/tiktok/start?profileId=xxx  (bejelentkezett user only)
 *   2. Redirect → https://www.tiktok.com/v2/auth/authorize/
 *   3. User TikTok-on engedélyez → callback ?code&state
 *   4. /api/oauth/tiktok/callback:
 *      a) code → access token (POST /v2/oauth/token/)
 *      b) GET /v2/user/info/ → display_name + open_id
 *      c) social_connections rekord (platform=tiktok)
 *   5. Redirect: /beallitasok?tiktok=connected
 *
 * Scopes (App Review szükséges production-ban):
 *   - user.info.basic — display_name + open_id (azonnal jóváhagyott)
 *   - video.publish — videó publikálás (review szükséges)
 *   - video.upload — videó feltöltés (review szükséges)
 *
 * Development mode: csak a TikTok Developer Portal-on hozzáadott
 * "test accounts" tudnak bejelentkezni a review előtt.
 *
 * Setup: docs/social-oauth-setup.md
 * API ref: https://developers.tiktok.com/doc/login-kit-web
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";
import { verifyAppToken } from "./routers/appAuth";
import { assertProfileOwnership } from "./_core/ownership";
import { getAppUserById } from "./authDb";

const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

// "user.info.basic" mindig megy review nélkül. A "video.publish" + "video.upload"
// review-igényes — ha még nem kapod meg, a TikTok ignorálja és a kapott token
// csak userinfo-ra jó. A connection mentés akkor is sikerül; a poszt-publikálás
// később, review után megy.
const TIKTOK_SCOPES = "user.info.basic,video.publish,video.upload";

function getAppOrigin(): string {
  return ENV.appUrl || "http://localhost:5173";
}

function signState(payload: { profileId: string; userId: string; csrf: string }): string {
  const stateObj = { ...payload, ts: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", ENV.cookieSecret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyState(state: string): { profileId: string; userId: string; csrf: string; ts: number } | null {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expectedSig = crypto.createHmac("sha256", ENV.cookieSecret).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expectedSig, "base64url");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (typeof obj.profileId !== "string" || typeof obj.userId !== "string" || typeof obj.ts !== "number") return null;
    if (Date.now() - obj.ts > STATE_MAX_AGE_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

function readAppToken(req: Request): string | null {
  const cookie = req.headers.cookie ?? "";
  const m = cookie.match(/(?:^|;\s*)app_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function registerTikTokOAuthRoutes(app: Express) {
  /**
   * Step 1: Initiate TikTok OAuth
   */
  app.get("/api/oauth/tiktok/start", async (req: Request, res: Response) => {
    const { profileId } = req.query as { profileId?: string };
    if (!profileId) { res.status(400).json({ error: "Missing profileId" }); return; }

    const token = readAppToken(req);
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
    const payload = await verifyAppToken(token);
    if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }
    const user = await getAppUserById(payload.userId as string);
    if (!user) { res.status(401).json({ error: "User not found" }); return; }

    try {
      await assertProfileOwnership(user.id, user.role, profileId, user.profileId);
    } catch (e: any) {
      res.status(403).json({ error: e?.message ?? "Forbidden" });
      return;
    }

    if (!ENV.tiktokClientKey) {
      res.status(500).json({ error: "TikTok OAuth not configured. Set TIKTOK_CLIENT_KEY env var." });
      return;
    }

    const appOrigin = getAppOrigin();
    const redirectUri = `${appOrigin}/api/oauth/tiktok/callback`;
    // CSRF token a TikTok dokumentum kifejezett követelménye (külön a state-től)
    const csrf = crypto.randomBytes(16).toString("base64url");
    const state = signState({ profileId, userId: user.id, csrf });

    const params = new URLSearchParams({
      client_key: ENV.tiktokClientKey,
      scope: TIKTOK_SCOPES,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });

    res.redirect(`${TIKTOK_AUTH_URL}?${params.toString()}`);
  });

  /**
   * Step 2: TikTok OAuth Callback
   */
  app.get("/api/oauth/tiktok/callback", async (req: Request, res: Response) => {
    const appOrigin = getAppOrigin();
    const { code, state, error, error_description } = req.query as {
      code?: string; state?: string; error?: string; error_description?: string;
    };

    if (error) {
      console.error("[TikTok OAuth] Error:", error, error_description);
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=${encodeURIComponent(error_description ?? error)}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=missing_params`);
      return;
    }

    const verified = verifyState(state);
    if (!verified) {
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=invalid_state`);
      return;
    }
    const { profileId, userId } = verified;

    const user = await getAppUserById(userId);
    if (!user) {
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=user_gone`);
      return;
    }
    try {
      await assertProfileOwnership(user.id, user.role, profileId, user.profileId);
    } catch {
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=forbidden`);
      return;
    }

    if (!ENV.tiktokClientKey || !ENV.tiktokClientSecret) {
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=not_configured`);
      return;
    }

    const redirectUri = `${appOrigin}/api/oauth/tiktok/callback`;

    try {
      // a) code → access token (form-encoded POST)
      const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: new URLSearchParams({
          client_key: ENV.tiktokClientKey,
          client_secret: ENV.tiktokClientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[TikTok OAuth] Token exchange failed:", errText);
        res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=token_exchange_failed`);
        return;
      }
      const tokenData = await tokenRes.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
        refresh_expires_in?: number;
        open_id?: string;
        scope?: string;
        token_type?: string;
        error?: string;
      };
      if (tokenData.error) {
        console.error("[TikTok OAuth] Token response error:", tokenData);
        res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=token_response_error`);
        return;
      }

      // b) GET /v2/user/info/ → display_name (UI-megjelenítéshez)
      let platformUsername = "";
      try {
        const userInfoRes = await fetch(`${TIKTOK_USERINFO_URL}?fields=open_id,display_name`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userInfoRes.ok) {
          const ui = await userInfoRes.json() as { data?: { user?: { display_name?: string; open_id?: string } } };
          platformUsername = ui.data?.user?.display_name ?? "";
        }
      } catch { /* non-fatal */ }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000);
      const platformUserId = tokenData.open_id ?? "";

      const { getDb } = await import("./db");
      const { socialConnections } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) {
        res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=db_unavailable`);
        return;
      }

      await db.update(socialConnections)
        .set({ isActive: false })
        .where(and(
          eq(socialConnections.profileId, profileId),
          eq(socialConnections.platform, "tiktok"),
        ));

      await db.insert(socialConnections).values({
        id: nanoid(),
        profileId,
        platform: "tiktok",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: expiresAt.toISOString(),
        platformUserId,
        platformUsername: platformUsername || platformUserId,
        isActive: true,
      });

      console.log(`[TikTok OAuth] Connected for profile ${profileId}: ${platformUsername || platformUserId}`);
      res.redirect(`${appOrigin}/beallitasok?tiktok=connected&username=${encodeURIComponent(platformUsername)}`);
    } catch (err) {
      console.error("[TikTok OAuth] Unexpected error:", err);
      res.redirect(`${appOrigin}/beallitasok?tiktok=error&reason=unexpected`);
    }
  });
}
