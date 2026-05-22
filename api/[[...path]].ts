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
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { registerLinkedInOAuthRoutes } from "../server/linkedinOAuth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { handleStripeWebhook } from "../server/stripe/webhook";

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

  // S3 storage signed URL proxy (under /api/storage/*).
  registerStorageProxy(app);

  // Manus OAuth callback (under /api/oauth/callback).
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
// the standard (req, res) signature, so we just delegate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  const app = getApp();
  return app(req, res);
}

// Allow large request bodies (file uploads). Default Vercel limit is 1MB.
export const config = {
  api: {
    bodyParser: false, // we use Express body parsers above
  },
  maxDuration: 60, // seconds (Hobby tier supports up to 60s)
};
