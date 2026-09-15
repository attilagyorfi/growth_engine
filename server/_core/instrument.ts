/**
 * G2A Growth Engine – Sentry szerver-oldali init.
 *
 * FONTOS: ez legyen az ELSŐ import az index.ts-ben, hogy a Node/Express
 * auto-instrumentáció a többi modul betöltése ELŐTT beálljon.
 *
 * CSAK production-ban aktív (dev/local nem küld). A DSN nem titok, ezért
 * alapértelmezettként itt van, de a SENTRY_DSN env-vel felülírható.
 * PII (személyes adat) kikapcsolva.
 */
import * as Sentry from "@sentry/node";

const DSN =
  process.env.SENTRY_DSN ||
  "https://6049bf1f50d4108b76eaf45f369a4e3d@o4511276493766656.ingest.de.sentry.io/4511276503269456";

if (process.env.NODE_ENV === "production" && DSN) {
  Sentry.init({
    dsn: DSN,
    environment: "production",
    // Teljesítmény-minták 10%-a (költség/zaj kordában tartása).
    tracesSampleRate: 0.1,
    // Ne küldjön személyes adatot (IP, fejlécek, request body).
    sendDefaultPii: false,
  });
  console.log("[Sentry] szerver-oldali hibafigyelés aktív (production).");
}
