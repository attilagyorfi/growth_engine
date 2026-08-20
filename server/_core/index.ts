import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLinkedInOAuthRoutes } from "../linkedinOAuth";
import { registerFacebookOAuthRoutes } from "../facebookOAuth";
import { registerTikTokOAuthRoutes } from "../tiktokOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe/webhook";
import { logLlmStartup } from "./llm";
import { ENV } from "./env";
import { seedDemoAccount } from "./demoAccount";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Trust proxy (Railway/Render) ────────────────────────────────────────
  // SECURITY FIX (audit MEDIUM): a platform egy reverse-proxy mögé teszi a
  // containert. Enélkül a `req.ip` a proxy IP-je, és a rate-limiter a kliens
  // által HAMISÍTHATÓ X-Forwarded-For első elemét használta → IP-limiter bypass
  // (spam-regisztráció, reset-email flood). 1 hop = a platform egyetlen proxyja.
  app.set("trust proxy", 1);

  // ─── Biztonsági fejlécek (helmet-mentesen, dep nélkül) ────────────────────
  // SECURITY FIX (audit HIGH): eddig SEMMILYEN security header nem volt.
  // - X-Frame-Options + CSP frame-ancestors: clickjacking ellen (a dashboard
  //   nem ágyazható iframe-be),
  // - nosniff: MIME-sniffing ellen,
  // - Referrer-Policy: reset-token / URL szivárgás csökkentése,
  // - HSTS (prod): SSL-strip ellen.
  // Szándékosan NINCS szigorú script-src CSP, hogy a Vite SPA ne törjön —
  // az a következő, dedikált lépés (finomhangolt CSP).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    if (ENV.isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  // ─── Stripe webhook MUST be registered before express.json() ─────────────
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // ─── Health check ─ Railway/Render használja a deploy ellenőrzéséhez ─────
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "g2a-growth-engine",
      env: process.env.NODE_ENV || "development",
      time: new Date().toISOString(),
      // Diagnosztika: melyik LLM provider aktív és van-e hozzá kulcs.
      // (Csak boolean + provider név — kulcs vagy más titok SOHA nem kerülhet ide.)
      llmProvider: ENV.llmProvider,
      llmKeyConfigured:
        ENV.llmProvider === "openai"
          ? !!ENV.openaiApiKey
          : ENV.llmProvider === "anthropic"
            ? !!ENV.anthropicApiKey
            : !!ENV.forgeApiKey,
    });
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Social OAuth routes — minden hardened auth-gate + HMAC state +
  // ownership check + APP_URL-derived redirect-tel (lásd a security audit
  // #2 fix-et). Mind a 3 modul defensive: env nélkül 500-at ad, NEM crash.
  registerLinkedInOAuthRoutes(app);
  registerFacebookOAuthRoutes(app);
  registerTikTokOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // Production (Railway, Render, stb.): a platform által megadott PORT-on
  // MUSZÁJ hallgatni — ha másikat választunk, a platform routing nem
  // találja meg a servert. Csak dev-ben keresünk alternatív portot.
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Explicit 0.0.0.0 bind: Railway/Render/Fly minden interface-en hallgat-éval
  // tudja a containert routolni (a default `localhost`-only bind nem elég).
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port} (${process.env.NODE_ENV || "development"})`);
    // Diagnosztika: melyik LLM provider aktív (openai vs. a halott manus proxy)?
    logLlmStartup();
    // Demo/teszt fiók seed — csak ha ENABLE_DEMO_ACCOUNT=true. Non-blocking,
    // non-fatal: a szerver akkor is fut, ha a seed elhasal (pl. nincs DB).
    seedDemoAccount().catch(err => console.error("[demo] seed failed:", err));
  });
}

startServer().catch(console.error);
