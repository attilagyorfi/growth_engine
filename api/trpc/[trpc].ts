/**
 * G2A Growth Engine – tRPC catch-all serverless function
 *
 * Ez a fájl CSAK a /api/trpc/* URL-eket kezeli. Specifikusabb mint a
 * globális api/[...path].ts, ezért Vercel routing precedence szerint
 * mindig győz tRPC kérésekért. Külön funkcióként deployolódik a Vercel
 * @vercel/node builder-rel.
 *
 * Miért külön ez a fájl és nem a globális catch-all?
 * - api/health.ts (zero-deps endpoint) MŰKÖDIK → bizonyítja, hogy a
 *   Vercel api/ felfedezés és function deploy működik
 * - api/[...path].ts (Express-alapú globális catch-all) 404-et adott →
 *   vagy nem deployolódott (még TS hiba?), vagy a global catch-all
 *   pattern nem match-elt a /api/trpc/* URL-ekre valamiért
 * - Egy scoped tRPC-only handler stabilabb: kisebb import surface,
 *   nincs OAuth/Stripe import chain ami compile-issue-t okozhat
 *
 * Hívási szignatúra: app.handle(req, res) ahelyett hogy app(req, res).
 * Az Express Application interface mindkettőt támogatja, de a handle()
 * explicit függvényhívás, ami Vercel runtime-on jobban viselkedik —
 * a TS2349 hiba ("Express not callable") egyik gyökeroka az implicit
 * hívási signatúra. A handle() explicit method, nincs callable-issue.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

let appInstance: express.Express | null = null;

function getApp(): express.Express {
  if (appInstance) return appInstance;
  const app = express();

  // Standard body parsers — a tRPC superjson payload elérhet 1MB-nyit
  // (pl. nagy strategy data), ezért generous limit.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // tRPC middleware csak a /api/trpc path-en — nem konfliktál más route-tal.
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  appInstance = app;
  return app;
}

// Vercel serverless function entry point.
// (app as any)(req, res) - az Express Application callable runtime-on,
// de a @types/express type-jában nincs callable signature explicit definiálva
// (ezt a TS2349 build hiba miatt tanultuk meg). Az any cast átmenetileg
// megkerüli a type problémát anélkül hogy a runtime semantikát változtatná.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any): void {
  const app = getApp() as any;
  app(req, res);
}

// Vercel function config — letiltja a Vercel default body parser-t,
// hogy az Express saját parserei kezelhessék a request body-t.
export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};
