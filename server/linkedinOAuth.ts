/**
 * G2A Growth Engine – LinkedIn OAuth 2.0 Flow (v2 — security hardened)
 *
 * Audit #2 (KRITIKUS) fixes:
 *   - A /start endpoint MOST authentikációt és profile-ownership check-et igényel.
 *     Korábban PUBLIC volt — bárki bekothetette a saját LinkedIn-jét egy másik
 *     ügyfél clientProfile-jához, és az ő nevükben posztolhatott.
 *   - A `state` MOST HMAC-aláírt (timing-safe verify). Korábban sima base64,
 *     bárki kovácsolhatott custom state-et.
 *   - A redirect `origin` MOST whitelist-elt (process.env.APP_URL +
 *     localhost dev). Korábban user-controlled volt → open redirect → phishing.
 *
 * Flow:
 * 1. Frontend (bejelentkezett user) → /api/oauth/linkedin/start?profileId=xxx
 *    (origin nincs query-ből; szerver-oldalon belőlünk dől el a saját APP_URL)
 * 2. Szerver: HMAC state-t generál {profileId, userId, ts, nonce} + redirect LinkedIn-re
 * 3. LinkedIn → /api/oauth/linkedin/callback?code=xxx&state=xxx
 * 4. Szerver: state HMAC verify (timing-safe), TTL check (<15 perc), ownership re-check,
 *    code→token cserél, social_connections-be ment
 * 5. Redirect a frontend-re: /beallitasok?linkedin=connected (APP_URL-en belül)
 *
 * Setup:
 * - LinkedIn App: https://www.linkedin.com/developers/apps (scopes:
 *   openid profile email w_member_social)
 * - Redirect URL a LinkedIn-en: {APP_URL}/api/oauth/linkedin/callback
 * - Env: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, APP_URL, JWT_SECRET
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { verifyAppToken } from "./routers/appAuth";
import { assertProfileOwnership } from "./_core/ownership";
import { getAppUserById } from "./authDb";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_ME_URL = "https://api.linkedin.com/v2/userinfo";
const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15 perc — elég hogy a user végigvigye

function getLinkedInConfig() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  };
}

// Az APP_URL alapján derivedet származtatunk a callback URL-hez. NEM
// fogadunk el query-param `origin`-t mert az open-redirect vektor lenne.
function getAppOrigin(): string {
  const fromEnv = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  return fromEnv || "http://localhost:5173";
}

// HMAC-aláírt state. Formátum: `${payloadB64url}.${signatureB64url}`.
// Tartalom: { profileId, userId, ts, nonce }. A JWT_SECRET-et használjuk
// HMAC-kulcsként (már fail-fast védve env.ts-ben hogy ≥32 char).
function signState(payload: { profileId: string; userId: string }): string {
  const stateObj = { ...payload, ts: Date.now(), nonce: crypto.randomBytes(8).toString("base64url") };
  const payloadB64 = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", ENV.cookieSecret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

function verifyState(state: string): { profileId: string; userId: string; ts: number } | null {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const payloadB64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expectedSig = crypto.createHmac("sha256", ENV.cookieSecret).update(payloadB64).digest("base64url");
  // Timing-safe compare — különben a kovácsolt state mérete elárulná hogy
  // melyik karakter helyes.
  const a = Buffer.from(sig, "base64url");
  const b = Buffer.from(expectedSig, "base64url");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (typeof obj.profileId !== "string" || typeof obj.userId !== "string" || typeof obj.ts !== "number") return null;
    if (Date.now() - obj.ts > STATE_MAX_AGE_MS) return null; // expired
    return obj;
  } catch {
    return null;
  }
}

// Cookie parser segéd (express nem mindig használ cookie-parser middleware-t).
function readAppToken(req: Request): string | null {
  const cookie = req.headers.cookie ?? "";
  const m = cookie.match(/(?:^|;\s*)app_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function registerLinkedInOAuthRoutes(app: Express) {
  /**
   * Step 1: Initiate LinkedIn OAuth (AUTH REQUIRED)
   */
  app.get("/api/oauth/linkedin/start", async (req: Request, res: Response) => {
    const { profileId } = req.query as { profileId?: string };
    if (!profileId) {
      res.status(400).json({ error: "Missing profileId" });
      return;
    }

    // ── 1. Auth gate: csak bejelentkezett user kezdeményezhet OAuth-ot
    const token = readAppToken(req);
    if (!token) {
      res.status(401).json({ error: "Unauthorized — log in first" });
      return;
    }
    const payload = await verifyAppToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    const user = await getAppUserById(payload.userId as string);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // ── 2. Ownership check: csak a saját (vagy super_admin által kezelt)
    //     profile-hoz csatolhat LinkedIn-t. Korábban EZ HIÁNYZOTT —
    //     bárki bekothetett bármelyik profile-hoz.
    try {
      await assertProfileOwnership(user.id, user.role, profileId, user.profileId);
    } catch (e: any) {
      res.status(403).json({ error: e?.message ?? "Forbidden" });
      return;
    }

    const { clientId } = getLinkedInConfig();
    if (!clientId) {
      res.status(500).json({ error: "LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID env var." });
      return;
    }

    const appOrigin = getAppOrigin();
    const redirectUri = `${appOrigin}/api/oauth/linkedin/callback`;
    const state = signState({ profileId, userId: user.id });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile email w_member_social",
    });

    res.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
  });

  /**
   * Step 2: LinkedIn OAuth Callback
   */
  app.get("/api/oauth/linkedin/callback", async (req: Request, res: Response) => {
    const appOrigin = getAppOrigin();
    const { code, state, error, error_description } = req.query as {
      code?: string; state?: string; error?: string; error_description?: string;
    };

    if (error) {
      console.error("[LinkedIn OAuth] Error:", error, error_description);
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=${encodeURIComponent(error_description ?? error)}`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=missing_params`);
      return;
    }

    // ── 1. HMAC state verify — kovácsolt state-et elutasít, lejárt state-et is
    const verified = verifyState(state);
    if (!verified) {
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=invalid_state`);
      return;
    }
    const { profileId, userId } = verified;

    // ── 2. Re-check ownership (a state óta változhatott a jogosultság)
    const user = await getAppUserById(userId);
    if (!user) {
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=user_gone`);
      return;
    }
    try {
      await assertProfileOwnership(user.id, user.role, profileId, user.profileId);
    } catch {
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=forbidden`);
      return;
    }

    const { clientId, clientSecret } = getLinkedInConfig();
    if (!clientId || !clientSecret) {
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=not_configured`);
      return;
    }

    const redirectUri = `${appOrigin}/api/oauth/linkedin/callback`;

    try {
      const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[LinkedIn OAuth] Token exchange failed:", errText);
        res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=token_exchange_failed`);
        return;
      }

      const tokenData = await tokenRes.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };

      const meRes = await fetch(LINKEDIN_ME_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      let platformUserId = "";
      let platformUsername = "";
      if (meRes.ok) {
        const meData = await meRes.json() as { sub?: string; name?: string; email?: string };
        platformUserId = meData.sub ?? "";
        platformUsername = meData.name ?? meData.email ?? "";
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 5184000) * 1000);

      const { getDb } = await import("./db");
      const { socialConnections } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) {
        res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=db_unavailable`);
        return;
      }

      // Upsert: deactivate existing LinkedIn connections for this profile, then insert new
      await db.update(socialConnections)
        .set({ isActive: false })
        .where(and(
          eq(socialConnections.profileId, profileId),
          eq(socialConnections.platform, "linkedin"),
        ));

      await db.insert(socialConnections).values({
        profileId,
        platform: "linkedin",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt: expiresAt.toISOString(),
        platformUserId,
        platformUsername,
        isActive: true,
      });

      console.log(`[LinkedIn OAuth] Connected for profile ${profileId}: ${platformUsername}`);
      res.redirect(`${appOrigin}/beallitasok?linkedin=connected&username=${encodeURIComponent(platformUsername)}`);
    } catch (err) {
      console.error("[LinkedIn OAuth] Unexpected error:", err);
      res.redirect(`${appOrigin}/beallitasok?linkedin=error&reason=unexpected`);
    }
  });
}
