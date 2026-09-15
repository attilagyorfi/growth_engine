/**
 * G2A Growth Engine – kliens-oldali hibafigyelés (Sentry).
 *
 * CSAK production build-ben aktív (dev/local nem küld). A DSN nem titok
 * (a kliens-bundle-ben úgyis látszik), ezért alapértelmezettként itt van,
 * de a VITE_SENTRY_DSN env-vel felülírható. PII (személyes adat) kikapcsolva.
 */
import * as Sentry from "@sentry/react";

const DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  "https://6049bf1f50d4108b76eaf45f369a4e3d@o4511276493766656.ingest.de.sentry.io/4511276503269456";

export function initSentry() {
  if (!import.meta.env.PROD || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: "production",
    integrations: [Sentry.browserTracingIntegration()],
    // Teljesítmény-minták 10%-a (költség/zaj kordában tartása).
    tracesSampleRate: 0.1,
    // Ne küldjön személyes adatot (IP, cookie, stb.).
    sendDefaultPii: false,
  });
}
