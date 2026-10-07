/**
 * G2A Growth Engine – Stripe előfizetés-logika (checkout, csomagváltás, webhook-állapot)
 *
 * Minden függvény a Stripe klienst paraméterként kapja, így hálózat nélkül,
 * hamis klienssel tesztelhető (server/stripe-billing.test.ts).
 *
 * Alapelvek:
 *  - Havi ÉS éves csomag is valódi, megújuló előfizetés (interval month/year).
 *  - Egy felhasználónak egyszerre EGY előfizetése van: ha már fizet, a csomagváltás
 *    a meglévő előfizetést módosítja (arányos számlázással), nem nyit újat.
 *  - A csomagot a Stripe-ban ténylegesen számlázott ár (Price lookup_key /
 *    metadata) határozza meg, nem a kliens.
 */
import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import {
  PLAN_DETAILS, STRIPE_CURRENCY, getPriceAmountInCents, stripeInterval, planProductId,
  planLookupKey, parsePlanLookupKey, isPlanId,
  type PlanId, type BillingInterval,
} from "./products";

type StripeClient = Pick<Stripe, "products" | "prices" | "subscriptions" | "checkout">;

function isMissing(err: any): boolean {
  return err?.code === "resource_missing" || err?.statusCode === 404;
}

// ─── Katalógus (Product + Price) ─────────────────────────────────────────────

/** Folyamaton belüli cache: lookup_key → price ID (deploy után újraépül). */
const priceCache = new Map<string, string>();
export function resetPriceCache() {
  priceCache.clear();
}

async function ensurePlanProduct(stripe: StripeClient, planId: PlanId): Promise<string> {
  const id = planProductId(planId);
  try {
    const product = await stripe.products.retrieve(id);
    if (!product.active) await stripe.products.update(id, { active: true });
    return id;
  } catch (err: any) {
    if (!isMissing(err)) throw err;
  }
  const plan = PLAN_DETAILS[planId];
  try {
    await stripe.products.create({ id, name: plan.name, description: plan.description, metadata: { plan_id: planId } });
  } catch (err: any) {
    // Párhuzamos első vásárlásnál a másik kérés már létrehozhatta.
    if (err?.code !== "resource_already_exists") throw err;
  }
  return id;
}

function productIdOf(product: string | { id: string } | null | undefined): string | undefined {
  return typeof product === "string" ? product : product?.id;
}

/**
 * Visszaadja a csomag+ciklus Stripe Price ID-ját; ha még nincs (vagy az ára
 * eltér a PLAN_DETAILS-től), létrehozza és ráteszi a lookup_key-t.
 */
export async function ensurePlanPrice(stripe: StripeClient, planId: PlanId, billing: BillingInterval): Promise<string> {
  const key = planLookupKey(planId, billing);
  const cached = priceCache.get(key);
  if (cached) return cached;

  const product = await ensurePlanProduct(stripe, planId);
  const unitAmount = getPriceAmountInCents(planId, billing);
  const interval = stripeInterval(billing);

  const existing = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const match = existing.data.find((p) =>
    p.unit_amount === unitAmount
    && p.currency === STRIPE_CURRENCY
    && p.recurring?.interval === interval
    && productIdOf(p.product as any) === product,
  );

  let priceId = match?.id;
  if (!priceId) {
    const created = await stripe.prices.create({
      currency: STRIPE_CURRENCY,
      product,
      unit_amount: unitAmount,
      recurring: { interval },
      lookup_key: key,
      transfer_lookup_key: true,
      nickname: `${PLAN_DETAILS[planId].name} (${billing === "yearly" ? "éves" : "havi"})`,
      metadata: { plan_id: planId, billing },
    });
    priceId = created.id;
  }
  priceCache.set(key, priceId);
  return priceId;
}

// ─── Előfizetés → csomag ─────────────────────────────────────────────────────

type PriceLike = {
  lookup_key?: string | null;
  metadata?: Record<string, string> | null;
  recurring?: { interval?: string } | null;
};

/** A számlázott árból kiolvassa a csomagot (lookup_key, ennek hiányában metadata). */
export function planFromPrice(price: PriceLike | null | undefined): { planId: PlanId; billing: BillingInterval } | null {
  if (!price) return null;
  const byKey = parsePlanLookupKey(price.lookup_key);
  if (byKey) return byKey;
  const planId = price.metadata?.plan_id;
  if (isPlanId(planId)) {
    return { planId, billing: price.recurring?.interval === "year" ? "yearly" : "monthly" };
  }
  return null;
}

export type SubscriptionAccess =
  | { kind: "paid"; planId: PlanId; billing: BillingInterval }
  | { kind: "free" }
  | { kind: "unchanged" };

type SubscriptionLike = {
  status: string;
  metadata?: Record<string, string> | null;
  items?: { data?: Array<{ price?: PriceLike | null }> } | null;
};

/** Fizetős hozzáférés: aktív, próbaidős, ill. késedelmes (Stripe még újrapróbálja a terhelést). */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);
/** Véget ért / fizetés nélküli állapotok → ingyenes szint. */
const ENDED_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired", "paused"]);

export function resolveSubscriptionAccess(sub: SubscriptionLike): SubscriptionAccess {
  if (ENDED_STATUSES.has(sub.status)) return { kind: "free" };
  if (!PAID_STATUSES.has(sub.status)) return { kind: "unchanged" }; // pl. incomplete: az első fizetés még folyamatban
  const fromPrice = planFromPrice(sub.items?.data?.[0]?.price);
  if (fromPrice) return { kind: "paid", ...fromPrice };
  const md = sub.metadata ?? {};
  if (isPlanId(md.plan_id)) {
    return { kind: "paid", planId: md.plan_id, billing: md.billing === "yearly" ? "yearly" : "monthly" };
  }
  return { kind: "unchanged" };
}

// ─── Vásárlás / csomagváltás ─────────────────────────────────────────────────

export type PurchaseUser = {
  id: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type PurchaseResult =
  | { kind: "checkout"; url: string }
  | { kind: "changed"; planId: PlanId; billing: BillingInterval }
  | { kind: "payment_failed" };

async function retrieveSubscriptionOrNull(stripe: StripeClient, id: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id);
  } catch (err: any) {
    if (isMissing(err)) return null;
    throw err;
  }
}

/**
 * - Nincs élő előfizetés → Stripe Checkout (új előfizetés), URL-t ad vissza.
 * - Van aktív előfizetés → a meglévőt módosítja az új árra, azonnali arányos
 *   számlával. `pending_if_incomplete`: ha a különbözet terhelése nem sikerül,
 *   a csomag NEM változik (Stripe pending update).
 * - Rendezetlen (past_due/unpaid/incomplete) előfizetés → hiba, előbb fizessen.
 */
export async function startPlanPurchase(
  stripe: StripeClient,
  user: PurchaseUser,
  input: { planId: PlanId; billing: BillingInterval },
  appOrigin: string,
): Promise<PurchaseResult> {
  const priceId = await ensurePlanPrice(stripe, input.planId, input.billing);
  const metadata = { user_id: user.id, plan_id: input.planId, billing: input.billing };

  if (user.stripeSubscriptionId) {
    const sub = await retrieveSubscriptionOrNull(stripe, user.stripeSubscriptionId);
    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      const item = sub.items.data[0];
      if (!item) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Az előfizetésnek nincs tétele a Stripe-ban." });
      }
      if (item.price.id === priceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Már ez a csomagod." });
      }
      const updated = await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "always_invoice",
        payment_behavior: "pending_if_incomplete",
        ...(sub.cancel_at_period_end ? { cancel_at_period_end: false } : {}),
        metadata,
      });
      if (updated.pending_update) return { kind: "payment_failed" };
      return { kind: "changed", planId: input.planId, billing: input.billing };
    }
    if (sub && sub.status !== "canceled" && sub.status !== "incomplete_expired") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Van egy rendezetlen számlád. Az „Előfizetés kezelése” gombbal frissítsd a fizetési módot, utána válthatsz csomagot.",
      });
    }
    // Lejárt / törölt előfizetés → új checkout lent.
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    metadata: { ...metadata, customer_email: user.email, customer_name: user.name ?? "" },
    subscription_data: { metadata },
    success_url: `${appOrigin}/beallitasok?tab=billing&checkout=success`,
    cancel_url: `${appOrigin}/beallitasok?tab=billing&checkout=cancelled`,
  });
  if (!session.url) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A Stripe nem adott vissza fizetési oldalt." });
  }
  return { kind: "checkout", url: session.url };
}

// ─── Webhook-események ───────────────────────────────────────────────────────

export type BillingUser = {
  id: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type BillingPatch = Partial<{
  subscriptionPlan: "free" | PlanId;
  subscriptionBilling: BillingInterval;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
}>;

/** A webhook adatbázis-műveletei — tesztben hamisítható. */
export type BillingStore = {
  findUserById(id: string): Promise<BillingUser | null>;
  findUserByCustomerId(customerId: string): Promise<BillingUser | null>;
  updateUser(id: string, patch: BillingPatch): Promise<void>;
  notifyUser(userId: string, title: string, body: string): Promise<void>;
};

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id ?? null;
}

async function findSubscriptionOwner(store: BillingStore, sub: Stripe.Subscription): Promise<BillingUser | null> {
  const byMeta = sub.metadata?.user_id ? await store.findUserById(sub.metadata.user_id) : null;
  if (byMeta) return byMeta;
  const customerId = idOf(sub.customer as any);
  return customerId ? store.findUserByCustomerId(customerId) : null;
}

function formatHuf(stripeAmount: number | null | undefined): string {
  return `${Math.round((stripeAmount ?? 0) / 100).toLocaleString("hu-HU")} Ft`;
}

export async function applyStripeEvent(event: Stripe.Event, store: BillingStore): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id ?? session.client_reference_id;
      const planId = session.metadata?.plan_id;
      if (!userId || !isPlanId(planId)) return;
      const billing: BillingInterval = session.metadata?.billing === "yearly" ? "yearly" : "monthly";
      const customerId = idOf(session.customer as any);
      const subscriptionId = idOf(session.subscription as any);

      const user = await store.findUserById(userId);
      if (!user) return;
      if (user.stripeSubscriptionId && subscriptionId && user.stripeSubscriptionId !== subscriptionId) {
        // A javítás előtti duplikált előfizetés nyoma: a régit kézzel kell lemondani/visszatéríteni.
        console.warn(`[Stripe] User ${userId} új előfizetést kapott (${subscriptionId}), a korábbi (${user.stripeSubscriptionId}) még élhet a Stripe-ban.`);
      }
      // Késleltetett fizetési módnál (pl. átutalás) a session "unpaid" — ilyenkor csak az
      // azonosítókat mentjük; a csomagot a customer.subscription.updated (→ active) adja meg.
      const paid = session.payment_status !== "unpaid";
      await store.updateUser(userId, {
        ...(paid ? { subscriptionPlan: planId, subscriptionBilling: billing } : {}),
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
      });
      console.log(`[Stripe] User ${userId} → ${paid ? `${planId} (${billing})` : "fizetésre vár"}`);
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await findSubscriptionOwner(store, sub);
      if (!user) return;
      // Egy régi (duplikált) előfizetés eseménye nem írhatja felül az aktuálist.
      if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id) return;

      const access = resolveSubscriptionAccess(sub);
      if (access.kind === "paid") {
        const customerId = idOf(sub.customer as any);
        await store.updateUser(user.id, {
          subscriptionPlan: access.planId,
          subscriptionBilling: access.billing,
          stripeSubscriptionId: sub.id,
          ...(customerId ? { stripeCustomerId: customerId } : {}),
        });
      } else if (access.kind === "free" && user.stripeSubscriptionId === sub.id) {
        await store.updateUser(user.id, { subscriptionPlan: "free", stripeSubscriptionId: null });
      }
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await findSubscriptionOwner(store, sub);
      // Csak a felhasználó AKTUÁLIS előfizetésének megszűnése vonja vissza a csomagot.
      if (!user || user.stripeSubscriptionId !== sub.id) return;
      await store.updateUser(user.id, { subscriptionPlan: "free", stripeSubscriptionId: null });
      console.log(`[Stripe] Subscription ${sub.id} megszűnt → user ${user.id} ingyenes szintre került`);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = idOf(invoice.customer as any);
      if (!customerId) return;
      console.warn(`[Stripe] Sikertelen fizetés: customer ${customerId}, invoice ${invoice.id}`);
      const user = await store.findUserByCustomerId(customerId);
      if (!user) return;
      const amount = formatHuf(invoice.amount_due);
      if (invoice.billing_reason === "subscription_update") {
        await store.notifyUser(user.id, "A csomagváltás fizetése nem sikerült",
          `A(z) ${amount} összegű különbözetet nem sikerült terhelni, ezért a csomagod nem változott. Frissítsd a fizetési módot az „Előfizetés kezelése” alatt, és próbáld újra.`);
      } else {
        await store.notifyUser(user.id, "Sikertelen előfizetési díj",
          `A(z) ${amount} összegű számlát nem sikerült terhelni. A Stripe néhány napig újrapróbálja; hogy ne szűnjön meg a csomagod, frissítsd a fizetési módot az „Előfizetés kezelése” alatt.`);
      }
      return;
    }

    default:
      return;
  }
}
