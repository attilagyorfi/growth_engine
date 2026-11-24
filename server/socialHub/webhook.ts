/**
 * Social Hub webhook-fogadó (G2): POST /api/social-hub/webhook.
 *
 * A szerződés: socialhub ARCHITECTURE.md „Webhooks”. Az aláírás a nyers bájtokra szól
 * (HMAC-SHA256 a `<timestamp>.<törzs>` fölött), ezért a regisztráló az express.json ELŐTT fut,
 * mindkét belépőn (server/_core/index.ts, api/[...path].ts).
 *
 * Sorrend: titok (503) → időbélyeg és aláírás (401) → csak ezután JSON → fejléc és törzs
 * egyezése (400) → ismeretlen típus kihagyása (200) → feldolgozás egy tranzakcióban.
 * A 2xx csak a sikeres feldolgozás után megy ki; minden más választ a Social Hub újraküld.
 *
 * A válaszban és a naplóban nincs törzs, titok, aláírás vagy hibarészlet; a next(err) nem
 * hívódik, így a hibakezelőhöz (Sentry) sem jut el a kérés.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import { resolveWebhookSecret } from "./config";
import { SOCIAL_HUB_EVENT_STATUS, type SocialHubEventType } from "./postState";
import { processWebhookEvent, type SocialHubWebhookEvent } from "./webhookStore";

export const SOCIAL_HUB_WEBHOOK_PATH = "/api/social-hub/webhook";
export const MAX_WEBHOOK_BYTES = 64 * 1024;
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export type WebhookDeps = {
  loadSecret: () => Promise<string | null>;
  process: (event: SocialHubWebhookEvent) => Promise<unknown>;
  now: () => number;
};
const defaultDeps: WebhookDeps = { loadSecret: resolveWebhookSecret, process: processWebhookEvent, now: Date.now };

const envelopeSchema = z.object({ id: z.string().min(1).max(255), type: z.string().min(1).max(255) });
const shortId = z.string().min(1).max(64);
const eventSchema = z.object({
  id: shortId,
  created_at: z.string().datetime({ offset: true }),
  data: z.object({ post_id: shortId, client_id: shortId }),
});

const isKnownType = (type: string): type is SocialHubEventType => Object.hasOwn(SOCIAL_HUB_EVENT_STATUS, type);

/** Az aláírás a fejléc változatlan időbélyegére és a törzs bájtjaira szól. */
export function verifySignature(
  input: { body: Buffer; timestamp: string | undefined; signature: string | undefined; secret: string; nowMs: number },
): boolean {
  const { timestamp, signature } = input;
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(input.nowMs / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", input.secret).update(`${timestamp}.`).update(input.body).digest("hex")}`);
  const received = Buffer.from(signature);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function handle(req: Request, body: Buffer, deps: WebhookDeps): Promise<number> {
  const secret = await deps.loadSecret().catch(() => null);
  if (!secret) return 503;
  const signed = { body, timestamp: req.get("x-socialhub-timestamp"), signature: req.get("x-socialhub-signature"), secret, nowMs: deps.now() };
  if (!verifySignature(signed)) return 401;

  let json: unknown;
  try {
    json = JSON.parse(body.toString("utf8"));
  } catch {
    return 400;
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) return 400;
  const { id, type } = envelope.data;
  if (req.get("x-socialhub-event-id") !== id || req.get("x-socialhub-event") !== type) return 400;
  if (!isKnownType(type)) return 200;

  const event = eventSchema.safeParse(json);
  if (!event.success) return 400;
  const { created_at, data } = event.data;
  try {
    await deps.process({ id, type, createdAtMs: Date.parse(created_at), socialHubPostId: data.post_id, socialHubClientId: data.client_id });
  } catch {
    // A naplót (művelet, hibakód) a tároló burkolója írja; a visszagördült eseményt a Social Hub újraküldi.
    return 503;
  }
  return 200;
}

// Bármilyen Content-Type-ot nyersen olvasunk, hogy semmi ne juthasson tovább az express.json-ra.
const readRawBody = express.raw({ type: () => true, limit: MAX_WEBHOOK_BYTES, inflate: false });

function answer(res: Response, status: number): void {
  if (!res.headersSent) res.status(status).json({ ok: status < 300 });
}

export function registerSocialHubWebhook(app: Express, deps: WebhookDeps = defaultDeps): void {
  app.post(SOCIAL_HUB_WEBHOOK_PATH, (req, res) => {
    const fail = (err: unknown) => {
      const status = (err as { status?: unknown } | null)?.status;
      answer(res, typeof status === "number" && status >= 400 && status < 500 ? status : 500);
    };
    try {
      // A Vercel segédje a req.body-t maga értelmezné JSON-ként; a nyers bájtok kellenek.
      Object.defineProperty(req, "body", { value: undefined, writable: true, configurable: true, enumerable: true });
      readRawBody(req, res, (err?: unknown) => {
        if (err) return fail(err);
        handle(req, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), deps).then((status) => answer(res, status)).catch(fail);
      });
    } catch (err) {
      fail(err);
    }
  });
}
