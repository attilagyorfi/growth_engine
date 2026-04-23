/**
 * G2A Growth Engine – LinkedIn OAuth 2.0 Flow
 * 
 * Setup required:
 * 1. Create a LinkedIn App at https://www.linkedin.com/developers/apps
 * 2. Add OAuth 2.0 redirect URL: https://your-domain.com/api/oauth/linkedin/callback
 * 3. Request scopes: openid, profile, email, w_member_social
 * 4. Set env vars: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 * 
 * Flow:
 * 1. Frontend redirects to /api/oauth/linkedin/start?profileId=xxx&origin=xxx
 * 2. Server redirects to LinkedIn authorization URL
 * 3. LinkedIn redirects back to /api/oauth/linkedin/callback?code=xxx&state=xxx
 * 4. Server exchanges code for access token, saves to social_connections table
 * 5. Server redirects to frontend /beallitasok?linkedin=connected
 */

import type { Express, Request, Response } from "express";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_ME_URL = "https://api.linkedin.com/v2/userinfo";

function getLinkedInConfig() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  };
}

export function registerLinkedInOAuthRoutes(app: Express) {
  /**
   * Step 1: Initiate LinkedIn OAuth
   * Frontend calls: /api/oauth/linkedin/start?profileId=xxx&origin=https://app.domain.com
   */
  app.get("/api/oauth/linkedin/start", (req: Request, res: Response) => {
    const { profileId, origin } = req.query as { profileId?: string; origin?: string };

    if (!profileId || !origin) {
      res.status(400).json({ error: "Missing profileId or origin" });
      return;
    }

    const { clientId } = getLinkedInConfig();
    if (!clientId) {
      res.status(500).json({ error: "LinkedIn OAuth not configured. Set LINKEDIN_CLIENT_ID env var." });
      return;
    }

    // Encode state to pass profileId and origin through the OAuth flow
    const state = Buffer.from(JSON.stringify({ profileId, origin })).toString("base64url");
    const redirectUri = `${origin}/api/oauth/linkedin/callback`;

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
   * LinkedIn redirects here after user authorizes
   */
  app.get("/api/oauth/linkedin/callback", async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (error) {
      console.error("[LinkedIn OAuth] Error:", error, error_description);
      res.redirect(`/beallitasok?linkedin=error&reason=${encodeURIComponent(error_description ?? error)}`);
      return;
    }

    if (!code || !state) {
      res.redirect("/beallitasok?linkedin=error&reason=missing_params");
      return;
    }

    let profileId: string;
    let origin: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
      profileId = decoded.profileId;
      origin = decoded.origin;
    } catch {
      res.redirect("/beallitasok?linkedin=error&reason=invalid_state");
      return;
    }

    const { clientId, clientSecret } = getLinkedInConfig();
    if (!clientId || !clientSecret) {
      res.redirect(`${origin}/beallitasok?linkedin=error&reason=not_configured`);
      return;
    }

    const redirectUri = `${origin}/api/oauth/linkedin/callback`;

    try {
      // Exchange authorization code for access token
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
        res.redirect(`${origin}/beallitasok?linkedin=error&reason=token_exchange_failed`);
        return;
      }

      const tokenData = await tokenRes.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };

      // Get LinkedIn user info
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

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 5184000) * 1000);

      // Save to database
      const { getDb } = await import("./db");
      const { socialConnections } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) {
        res.redirect(`${origin}/beallitasok?linkedin=error&reason=db_unavailable`);
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
      res.redirect(`${origin}/beallitasok?linkedin=connected&username=${encodeURIComponent(platformUsername)}`);
    } catch (err) {
      console.error("[LinkedIn OAuth] Unexpected error:", err);
      res.redirect(`${origin}/beallitasok?linkedin=error&reason=unexpected`);
    }
  });
}
