/**
 * G2A Growth Engine – Stripe Webhook Handler
 * Route: POST /api/stripe/webhook
 * Registered BEFORE express.json() with express.raw()
 */

import type { Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { appUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function handleStripeWebhook(req: Request, res: Response) {
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id as "starter" | "pro" | "agency" | undefined;
        const billing = session.metadata?.billing as "monthly" | "yearly" | undefined;
        const customerId = typeof session.customer === "string" ? session.customer : (session.customer as Stripe.Customer)?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription as Stripe.Subscription)?.id;

        if (userId && planId) {
          await database.update(appUsers)
            .set({
              subscriptionPlan: planId,
              subscriptionBilling: billing ?? "monthly",
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
            })
            .where(eq(appUsers.id, userId));
          console.log(`[Stripe Webhook] Updated user ${userId} → plan: ${planId} (${billing})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : (subscription.customer as Stripe.Customer).id;

        await database.update(appUsers)
          .set({ subscriptionPlan: "free", stripeSubscriptionId: null })
          .where(eq(appUsers.stripeCustomerId, customerId));
        console.log(`[Stripe Webhook] Subscription cancelled for customer ${customerId} → downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as Stripe.Customer)?.id;
        if (customerId) {
          console.warn(`[Stripe Webhook] Payment failed for customer ${customerId}`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.json({ received: true });
}
