/**
 * G2A Growth Engine – Facebook + Instagram OAuth (Meta Graph API)
 *
 * EGY OAuth flow két platformhoz: a Meta egy App-pal lefedi a Facebook
 * Page-eket ÉS az Instagram Business accountokat. A user a Facebook-on
 * jelentkezik be, ott kiválasztja melyik Page-ekhez ad engedélyt, és ha
 * a Page-hez tartozik IG Business account, AZT IS megkapjuk.
 *
 * Flow:
 *   1. /api/oauth/facebook/start?profileId=xxx  (bejelentkezett user only)
 *   2. Redirect → https://www.facebook.com/v18.0/dialog/oauth?...
 *   3. User Facebook-on engedélyez → callback ?code&state
 *   4. /api/oauth/facebook/callback:
 *      a) code → user access token (short-lived)
 *      b) short → long-lived user token (60 nap)
 *      c) GET /me/accounts → Pages lista + page access tokenek
 *      d) MINDEN Page-re egy `social_connections` rekord (platform=facebook)
 *      e) MINDEN Page-re GET /{pageId}?fields=instagram_business_account →
 *         ha van IG account, plusz egy `social_connections` (platform=instagram)
 *   5. Redirect: /beallitasok?facebook=connected&pages=N&instagram=M
 *
 * App Review szükséges scopes (production):
 *   - pages_show_list (alap)
 *   - pages_read_engagement (poszt analytics)
 *   - pages_manage_posts (poszt publikálás)
 *   - instagram_basic (IG account összerendelés)
 *   - instagram_content_publish (IG poszt publikálás)
 *   - business_management (Business Manager hozzáférés — opcionális)
 *
 * Development mode-ban (review előtt) csak a developer + manuálisan
 * hozzáadott tester accountok tudnak bejelentkezni. Lásd:
 * docs/social-oauth-setup.md
 *
 * Audit-szigorú: ugyanazok a security feltételek mint a LinkedIn-en
 * (auth-gate, HMAC state, ownership check, no open-redirect).
 */

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";
import { verifyAppToken } from "./routers/appAuth";
import { assertProfileOwnership } from "./_core/ownership";
import { getAppUserById } from "./authDb";

const META_GRAPH_VERSION = "v18.0";
const FB_AUTH_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const FB_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
const FB_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

const FB_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

function getAppOrigin(): string {
  return ENV.appUrl || "http://localhost:5173";
}

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

export function registerFacebookOAuthRoutes(app: Express) {
  /**
   * Step 1: Initiate Facebook OAuth
   */
  app.get("/api/oauth/facebook/start", async (req: Request, res: Response) => {
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

    if (!ENV.facebookAppId) {
      res.status(500).json({ error: "Facebook OAuth not configured. Set FACEBOOK_APP_ID env var." });
      return;
    }

    const appOrigin = getAppOrigin();
    const redirectUri = `${appOrigin}/api/oauth/facebook/callback`;
    const state = signState({ profileId, userId: user.id });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.facebookAppId,
      redirect_uri: redirectUri,
      state,
      scope: FB_SCOPES,
      // auth_type=rerequest — ha a user korábban elutasított pár scope-ot,
      // most újra megkérdezi (különben csendben kihagyja és kódunk
      // azt hiszi minden OK).
      auth_type: "rerequest",
    });

    res.redirect(`${FB_AUTH_URL}?${params.toString()}`);
  });

  /**
   * Step 2: Facebook OAuth Callback
   */
  app.get("/api/oauth/facebook/callback", async (req: Request, res: Response) => {
    const appOrigin = getAppOrigin();
    const { code, state, error, error_description } = req.query as {
      code?: string; state?: string; error?: string; error_description?: string;
    };

    if (error) {
      console.error("[Facebook OAuth] Error:", error, error_description);
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=${encodeURIComponent(error_description ?? error)}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=missing_params`);
      return;
    }

    const verified = verifyState(state);
    if (!verified) {
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=invalid_state`);
      return;
    }
    const { profileId, userId } = verified;

    const user = await getAppUserById(userId);
    if (!user) {
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=user_gone`);
      return;
    }
    try {
      await assertProfileOwnership(user.id, user.role, profileId, user.profileId);
    } catch {
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=forbidden`);
      return;
    }

    if (!ENV.facebookAppId || !ENV.facebookAppSecret) {
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=not_configured`);
      return;
    }

    const redirectUri = `${appOrigin}/api/oauth/facebook/callback`;

    try {
      // a) code → short-lived user access token
      const shortTokenRes = await fetch(`${FB_TOKEN_URL}?` + new URLSearchParams({
        client_id: ENV.facebookAppId,
        client_secret: ENV.facebookAppSecret,
        redirect_uri: redirectUri,
        code,
      }));
      if (!shortTokenRes.ok) {
        const errText = await shortTokenRes.text();
        console.error("[Facebook OAuth] Token exchange failed:", errText);
        res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=token_exchange_failed`);
        return;
      }
      const shortToken = (await shortTokenRes.json() as { access_token: string }).access_token;

      // b) short → long-lived (60 nap) — javasolt minden Meta integrációhoz
      const longTokenRes = await fetch(`${FB_TOKEN_URL}?` + new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: ENV.facebookAppId,
        client_secret: ENV.facebookAppSecret,
        fb_exchange_token: shortToken,
      }));
      const longToken = longTokenRes.ok
        ? (await longTokenRes.json() as { access_token: string; expires_in?: number }).access_token
        : shortToken; // fallback: short-lived (1 ora)

      // c) GET /me/accounts → Pages lista + per-page access tokenek
      const pagesRes = await fetch(`${FB_GRAPH_BASE}/me/accounts?` + new URLSearchParams({
        access_token: longToken,
        fields: "id,name,access_token,instagram_business_account",
      }));
      if (!pagesRes.ok) {
        const errText = await pagesRes.text();
        console.error("[Facebook OAuth] /me/accounts failed:", errText);
        res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=pages_fetch_failed`);
        return;
      }
      const pages = (await pagesRes.json() as {
        data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
      }).data ?? [];

      if (pages.length === 0) {
        // Nincs Page-e a usernek → nem tudunk publikálni semmilyen Page-re
        res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=no_pages`);
        return;
      }

      const { getDb } = await import("./db");
      const { socialConnections } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) {
        res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=db_unavailable`);
        return;
      }

      // Deaktiváljuk a profile minden korábbi FB + IG kapcsolatát (új csatlakozás felülírja)
      await db.update(socialConnections)
        .set({ isActive: false })
        .where(and(
          eq(socialConnections.profileId, profileId),
          eq(socialConnections.platform, "facebook"),
        ));
      await db.update(socialConnections)
        .set({ isActive: false })
        .where(and(
          eq(socialConnections.profileId, profileId),
          eq(socialConnections.platform, "instagram"),
        ));

      // A Page tokenek "long-lived" jellegűek (nincs explicit expires_in,
      // a Meta dokumentum szerint kb. 60 nap a user-token után + auto-refresh).
      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);

      let fbConnected = 0;
      let igConnected = 0;

      for (const page of pages) {
        // FB Page rekord
        await db.insert(socialConnections).values({
          id: nanoid(),
          profileId,
          platform: "facebook",
          accessToken: page.access_token,
          refreshToken: null,
          tokenExpiresAt: tokenExpiresAt.toISOString(),
          platformUserId: page.id,
          platformUsername: page.name,
          isActive: true,
        });
        fbConnected++;

        // IG Business account (ha van) — a Page hozzá van rendelve
        if (page.instagram_business_account?.id) {
          // IG-hez használt token a Page-token (a Meta dokumentum szerint)
          // Lekérjük az IG username-t a Graph API-ból
          let igUsername = "";
          try {
            const igRes = await fetch(`${FB_GRAPH_BASE}/${page.instagram_business_account.id}?` + new URLSearchParams({
              access_token: page.access_token,
              fields: "username",
            }));
            if (igRes.ok) {
              igUsername = (await igRes.json() as { username?: string }).username ?? "";
            }
          } catch { /* non-fatal */ }

          await db.insert(socialConnections).values({
            id: nanoid(),
            profileId,
            platform: "instagram",
            accessToken: page.access_token,                  // Page-token IG-hoz is
            refreshToken: null,
            tokenExpiresAt: tokenExpiresAt.toISOString(),
            platformUserId: page.instagram_business_account.id,
            platformUsername: igUsername || `@${page.name}`,
            isActive: true,
          });
          igConnected++;
        }
      }

      console.log(`[Facebook OAuth] Profile ${profileId}: ${fbConnected} Page(s), ${igConnected} IG account(s)`);
      res.redirect(`${appOrigin}/beallitasok?facebook=connected&pages=${fbConnected}&instagram=${igConnected}`);
    } catch (err) {
      console.error("[Facebook OAuth] Unexpected error:", err);
      res.redirect(`${appOrigin}/beallitasok?facebook=error&reason=unexpected`);
    }
  });
}
