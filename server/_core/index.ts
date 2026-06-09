import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLinkedInOAuthRoutes } from "../linkedinOAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleStripeWebhook } from "../stripe/webhook";

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
    });
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // LinkedIn OAuth routes
  registerLinkedInOAuthRoutes(app);
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
  });
}

startServer().catch(console.error);
