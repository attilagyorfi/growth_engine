/**
 * G2A Growth Engine – Stripe Webhook Handler
 * Route: POST /api/stripe/webhook
 * Registered BEFORE express.json() with express.raw()
 *
 * Itt csak az aláírás-ellenőrzés és az adatbázis-kötés van; az események
 * feldolgozása a `billing.ts` `applyStripeEvent` függvényében (tesztelt).
 */

import type { Request, Response } from "express";
import Stripe from "stripe";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { appUsers, appNotifications } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { applyStripeEvent, type BillingStore, type BillingUser } from "./billing";

// LAZY INIT: a Stripe kliens csak akkor példányosul, amikor a webhook
// tényleg meghívódik — így a server elindul akkor is, ha a STRIPE_SECRET_KEY
// env var nincs beállítva (graceful degradation).
let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function createBillingStore(database: Db): BillingStore {
  const pick = (rows: Array<{ id: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null }>): BillingUser | null =>
    rows[0] ? { id: rows[0].id, stripeCustomerId: rows[0].stripeCustomerId, stripeSubscriptionId: rows[0].stripeSubscriptionId } : null;
  const cols = { id: appUsers.id, stripeCustomerId: appUsers.stripeCustomerId, stripeSubscriptionId: appUsers.stripeSubscriptionId };

  return {
    async findUserById(id) {
      return pick(await database.select(cols).from(appUsers).where(eq(appUsers.id, id)).limit(1));
    },
    async findUserByCustomerId(customerId) {
      return pick(await database.select(cols).from(appUsers).where(eq(appUsers.stripeCustomerId, customerId)).limit(1));
    },
    async updateUser(id, patch) {
      if (Object.keys(patch).length === 0) return;
      await database.update(appUsers).set(patch).where(eq(appUsers.id, id));
    },
    async notifyUser(userId, title, body) {
      await database.insert(appNotifications).values({
        id: nanoid(),
        appUserId: userId,
        type: "system",
        title,
        body,
        actionUrl: "/beallitasok?tab=billing",
      });
    },
  };
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.warn("[Stripe Webhook] STRIPE_SECRET_KEY vagy STRIPE_WEBHOOK_SECRET nincs beállítva.");
    return res.status(503).json({ error: "Stripe nincs konfigurálva" });
  }
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ─── Test event passthrough ───────────────────────────────────────────────
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Event: ${event.type} (${event.id})`);

  const database = await getDb();
  if (!database) {
    console.error("[Stripe Webhook] Database not available");
    return res.status(500).json({ error: "Database unavailable" });
  }

  try {
    await applyStripeEvent(event, createBillingStore(database));
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.json({ received: true });
}
