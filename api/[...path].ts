/**
 * G2A Growth Engine – Vercel serverless catch-all function
 *
 * Wraps the meglévő Express app into one Vercel function so all /api/* routes
 * (tRPC, OAuth callbacks, Stripe webhook, LinkedIn OAuth, storage proxy) work
 * without per-route refactoring.
 *
 * A fájl neve `[[...path]].ts` — ez Vercel catch-all routing pattern:
 * minden /api/* URL erre a function-re kerül, ÉS a req.url megőrzi az
 * eredeti path-et (pl. /api/trpc/appAuth.register). Így az Express
 * middleware tovább tud routolni saját maga belül.
 *
 * Az Express app singleton-ként init-elődik (cold start), majd a meleg
 * invocation-ök újrahasznosítják.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// NOTE: a Vercel Node.js ESM runtime strict directory-import védelmet alkalmaz.
// Explicit .js extension az imports-ban → egyértelmű fájl-resolution
// (no ERR_UNSUPPORTED_DIR_IMPORT). TS bundler mode compile-time .ts-re mappeli.
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { registerLinkedInOAuthRoutes } from "../server/linkedinOAuth.js";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { handleStripeWebhook } from "../server/stripe/webhook.js";

let appInstance: express.Express | null = null;

function getApp(): express.Express {
  if (appInstance) return appInstance;
  const app = express();

  // Stripe webhook MUST be registered before express.json() so the raw body
  // is preserved for signature verification.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

  // Standard body parsers with generous limits for file uploads.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Manus OAuth callback (under /api/oauth/callback) — graceful skip ha
  // OAUTH_SERVER_URL nincs beállítva (Manus-leválasztás után).
  registerOAuthRoutes(app);

  // LinkedIn OAuth callback (under /api/oauth/linkedin/callback).
  registerLinkedInOAuthRoutes(app);

  // tRPC API endpoint at /api/trpc/*.
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  appInstance = app;
  return app;
}

// Vercel serverless function entry point. The Express app is callable with
// the standard (req, res) signature. Az any cast szükséges, mert a
// @types/express Application type-jában nincs callable signature explicit
// definiálva (TS2349: "Express not callable") — bár runtime-on működik.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  const app = getApp() as any;
  return app(req, res);
}

// Allow large request bodies (file uploads). Default Vercel limit is 1MB.
export const config = {
  api: {
    bodyParser: false, // we use Express body parsers above
  },
  maxDuration: 60, // seconds (Hobby tier supports up to 60s)
};
