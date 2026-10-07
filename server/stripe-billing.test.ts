/**
 * Stripe előfizetés-logika — hálózat és API-kulcs nélkül, hamis Stripe klienssel.
 * Lefedi: HUF összeg (×100), éves = megújuló előfizetés, csomagváltás duplikáció
 * nélkül, webhook-állapotgép (updated / deleted / payment_failed).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toStripeAmount, getPriceAmountInCents, planLookupKey, parsePlanLookupKey, PLAN_DETAILS, PLAN_IDS,
} from "./stripe/products";
import {
  ensurePlanPrice, startPlanPurchase, resolveSubscriptionAccess, applyStripeEvent, resetPriceCache,
  type BillingStore, type BillingUser, type PurchaseUser,
} from "./stripe/billing";

const missing = () => Object.assign(new Error("No such product"), { code: "resource_missing", statusCode: 404 });

function fakeStripe(opts: { product?: "exists" | "missing"; prices?: any[]; sub?: any; pendingUpdate?: boolean } = {}) {
  return {
    products: {
      retrieve: vi.fn(async (id: string) => {
        if (opts.product === "missing") throw missing();
        return { id, active: true };
      }),
      update: vi.fn(async () => ({})),
      create: vi.fn(async (p: any) => p),
    },
    prices: {
      list: vi.fn(async () => ({ data: opts.prices ?? [] })),
      create: vi.fn(async (p: any) => ({ id: "price_new", ...p })),
    },
    subscriptions: {
      retrieve: vi.fn(async () => {
        if (!opts.sub) throw missing();
        return opts.sub;
      }),
      update: vi.fn(async () => ({ ...opts.sub, pending_update: opts.pendingUpdate ? { expires_at: 1 } : null })),
    },
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s" })) } },
  };
}

const priceFor = (planId: "starter" | "pro" | "agency", billing: "monthly" | "yearly", id = "price_existing") => ({
  id,
  lookup_key: planLookupKey(planId, billing),
  unit_amount: getPriceAmountInCents(planId, billing),
  currency: "huf",
  recurring: { interval: billing === "yearly" ? "year" : "month" },
  product: `ge_plan_${planId}`,
});

const user = (over: Partial<PurchaseUser> = {}): PurchaseUser => ({
  id: "u1", email: "ugyfel@example.hu", name: "Ügyfél", stripeCustomerId: null, stripeSubscriptionId: null, ...over,
});

beforeEach(() => resetPriceCache());

describe("HUF összeg", () => {
  it("a Stripe a HUF-ot kéttizedesként várja → fillér (×100)", () => {
    expect(toStripeAmount(9900)).toBe(990000);
    expect(getPriceAmountInCents("starter", "monthly")).toBe(990000);
    expect(getPriceAmountInCents("agency", "yearly")).toBe(49900000);
  });

  it("minden csomagár a Stripe 175 Ft-os minimuma felett van", () => {
    for (const id of PLAN_IDS) {
      expect(getPriceAmountInCents(id, "monthly")).toBeGreaterThanOrEqual(17500);
      expect(getPriceAmountInCents(id, "yearly")).toBe(toStripeAmount(PLAN_DETAILS[id].yearlyPriceHuf));
    }
  });

  it("lookup_key oda-vissza", () => {
    expect(parsePlanLookupKey(planLookupKey("pro", "yearly"))).toEqual({ planId: "pro", billing: "yearly" });
    expect(parsePlanLookupKey("valami_mas")).toBeNull();
    expect(parsePlanLookupKey(null)).toBeNull();
  });
});

describe("ensurePlanPrice", () => {
  it("hiányzó termék + ár → létrehozza (fillér összeg, éves intervallum, lookup_key), utána cache-ből", async () => {
    const s = fakeStripe({ product: "missing" });
    const id = await ensurePlanPrice(s as any, "pro", "yearly");
    expect(id).toBe("price_new");
    expect(s.products.create).toHaveBeenCalledWith(expect.objectContaining({ id: "ge_plan_pro" }));
    expect(s.prices.create).toHaveBeenCalledWith(expect.objectContaining({
      currency: "huf", product: "ge_plan_pro", unit_amount: 24900000,
      recurring: { interval: "year" }, lookup_key: "ge_pro_yearly", transfer_lookup_key: true,
    }));
    await ensurePlanPrice(s as any, "pro", "yearly");
    expect(s.prices.list).toHaveBeenCalledTimes(1);
  });

  it("létező, egyező ár → azt használja, nem hoz létre újat", async () => {
    const s = fakeStripe({ prices: [priceFor("starter", "monthly")] });
    expect(await ensurePlanPrice(s as any, "starter", "monthly")).toBe("price_existing");
    expect(s.prices.create).not.toHaveBeenCalled();
    expect(s.products.create).not.toHaveBeenCalled();
  });

  it("régi (rossz összegű) ár a lookup_key-en → új ár, a kulcs átkerül", async () => {
    const stale = { ...priceFor("starter", "monthly"), unit_amount: 9900 };
    const s = fakeStripe({ prices: [stale] });
    expect(await ensurePlanPrice(s as any, "starter", "monthly")).toBe("price_new");
    expect(s.prices.create).toHaveBeenCalledWith(expect.objectContaining({ unit_amount: 990000, transfer_lookup_key: true }));
  });
});

describe("startPlanPurchase", () => {
  it("nincs előfizetés → Checkout subscription módban (az éves is!), katalógus-árral", async () => {
    const s = fakeStripe({ prices: [priceFor("pro", "yearly")] });
    const r = await startPlanPurchase(s as any, user(), { planId: "pro", billing: "yearly" }, "https://app.test");
    expect(r).toEqual({ kind: "checkout", url: "https://checkout.stripe.test/s" });
    const params = s.checkout.sessions.create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toEqual([{ price: "price_existing", quantity: 1 }]);
    expect(params.customer_email).toBe("ugyfel@example.hu");
    expect(params.customer).toBeUndefined();
    expect(params.subscription_data.metadata).toEqual({ user_id: "u1", plan_id: "pro", billing: "yearly" });
    expect(params.success_url).toBe("https://app.test/beallitasok?tab=billing&checkout=success");
  });

  it("meglévő Stripe customer → azt használja (nem jön létre új ügyfél)", async () => {
    const s = fakeStripe({ prices: [priceFor("starter", "monthly")] });
    await startPlanPurchase(s as any, user({ stripeCustomerId: "cus_1" }), { planId: "starter", billing: "monthly" }, "https://app.test");
    const params = s.checkout.sessions.create.mock.calls[0][0];
    expect(params.customer).toBe("cus_1");
    expect(params.customer_email).toBeUndefined();
  });

  const activeSub = (priceId: string, extra: any = {}) => ({
    id: "sub_1", status: "active", cancel_at_period_end: false,
    items: { data: [{ id: "si_1", price: { id: priceId } }] }, ...extra,
  });

  it("aktív előfizetés + másik csomag → a MEGLÉVŐT módosítja arányos számlával, nem nyit új checkoutot", async () => {
    const s = fakeStripe({ prices: [priceFor("agency", "monthly", "price_agency")], sub: activeSub("price_pro") });
    const r = await startPlanPurchase(s as any, user({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" }), { planId: "agency", billing: "monthly" }, "https://app.test");
    expect(r).toEqual({ kind: "changed", planId: "agency", billing: "monthly" });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
    expect(s.subscriptions.update).toHaveBeenCalledWith("sub_1", expect.objectContaining({
      items: [{ id: "si_1", price: "price_agency" }],
      proration_behavior: "always_invoice",
      payment_behavior: "pending_if_incomplete",
    }));
  });

  it("lemondott (időszak végéig futó) előfizetésnél váltáskor visszavonja a lemondást", async () => {
    const s = fakeStripe({ prices: [priceFor("agency", "monthly", "price_agency")], sub: activeSub("price_pro", { cancel_at_period_end: true }) });
    await startPlanPurchase(s as any, user({ stripeSubscriptionId: "sub_1" }), { planId: "agency", billing: "monthly" }, "https://app.test");
    expect(s.subscriptions.update.mock.calls[0][1].cancel_at_period_end).toBe(false);
  });

  it("sikertelen különbözet-terhelés (pending_update) → payment_failed, a csomag nem változik", async () => {
    const s = fakeStripe({ prices: [priceFor("agency", "monthly", "price_agency")], sub: activeSub("price_pro"), pendingUpdate: true });
    const r = await startPlanPurchase(s as any, user({ stripeSubscriptionId: "sub_1" }), { planId: "agency", billing: "monthly" }, "https://app.test");
    expect(r).toEqual({ kind: "payment_failed" });
  });

  it("ugyanaz a csomag → BAD_REQUEST, semmi nem hívódik", async () => {
    const s = fakeStripe({ prices: [priceFor("pro", "monthly", "price_pro")], sub: activeSub("price_pro") });
    await expect(startPlanPurchase(s as any, user({ stripeSubscriptionId: "sub_1" }), { planId: "pro", billing: "monthly" }, "https://app.test"))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(s.subscriptions.update).not.toHaveBeenCalled();
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("késedelmes (past_due) előfizetés → előbb rendezni kell, nincs új checkout", async () => {
    const s = fakeStripe({ prices: [priceFor("agency", "monthly")], sub: activeSub("price_pro", { status: "past_due" }) });
    await expect(startPlanPurchase(s as any, user({ stripeSubscriptionId: "sub_1" }), { planId: "agency", billing: "monthly" }, "https://app.test"))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(s.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("megszűnt (canceled) vagy nem létező előfizetés → új checkout", async () => {
    const s1 = fakeStripe({ prices: [priceFor("pro", "monthly")], sub: activeSub("price_old", { status: "canceled" }) });
    expect((await startPlanPurchase(s1 as any, user({ stripeSubscriptionId: "sub_1" }), { planId: "pro", billing: "monthly" }, "https://app.test")).kind).toBe("checkout");
    const s2 = fakeStripe({ prices: [priceFor("pro", "monthly")] });
    expect((await startPlanPurchase(s2 as any, user({ stripeSubscriptionId: "sub_gone" }), { planId: "pro", billing: "monthly" }, "https://app.test")).kind).toBe("checkout");
  });
});

describe("resolveSubscriptionAccess", () => {
  const sub = (status: string, price: any = priceFor("pro", "yearly"), metadata: any = {}) => ({ status, metadata, items: { data: [{ price }] } });

  it("aktív / késedelmes → fizetős csomag a számlázott árból", () => {
    expect(resolveSubscriptionAccess(sub("active"))).toEqual({ kind: "paid", planId: "pro", billing: "yearly" });
    expect(resolveSubscriptionAccess(sub("past_due"))).toEqual({ kind: "paid", planId: "pro", billing: "yearly" });
  });

  it("megszűnt / fizetetlen → ingyenes; incomplete → változatlan", () => {
    expect(resolveSubscriptionAccess(sub("canceled"))).toEqual({ kind: "free" });
    expect(resolveSubscriptionAccess(sub("unpaid"))).toEqual({ kind: "free" });
    expect(resolveSubscriptionAccess(sub("incomplete"))).toEqual({ kind: "unchanged" });
  });

  it("régi ár lookup_key nélkül → az ár, majd az előfizetés metadata-ja dönt", () => {
    const legacy = { lookup_key: null, metadata: { plan_id: "agency" }, recurring: { interval: "month" } };
    expect(resolveSubscriptionAccess(sub("active", legacy))).toEqual({ kind: "paid", planId: "agency", billing: "monthly" });
    const bare = { lookup_key: null, metadata: {}, recurring: { interval: "month" } };
    expect(resolveSubscriptionAccess(sub("active", bare, { plan_id: "starter", billing: "yearly" }))).toEqual({ kind: "paid", planId: "starter", billing: "yearly" });
    expect(resolveSubscriptionAccess(sub("active", bare))).toEqual({ kind: "unchanged" });
  });
});

describe("applyStripeEvent (webhook)", () => {
  function fakeStore(u: BillingUser | null) {
    return {
      findUserById: vi.fn(async (id: string) => (u && u.id === id ? u : null)),
      findUserByCustomerId: vi.fn(async (c: string) => (u && u.stripeCustomerId === c ? u : null)),
      updateUser: vi.fn(async () => {}),
      notifyUser: vi.fn(async () => {}),
    } satisfies BillingStore;
  }
  const ev = (type: string, object: any) => ({ id: "evt_1", type, data: { object } }) as any;

  it("checkout.session.completed (fizetve) → csomag + azonosítók mentése", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: null, stripeSubscriptionId: null });
    await applyStripeEvent(ev("checkout.session.completed", {
      metadata: { user_id: "u1", plan_id: "pro", billing: "yearly" }, payment_status: "paid", customer: "cus_1", subscription: "sub_1",
    }), store);
    expect(store.updateUser).toHaveBeenCalledWith("u1", {
      subscriptionPlan: "pro", subscriptionBilling: "yearly", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
    });
  });

  it("checkout.session.completed (még fizetetlen) → csak az azonosítók, csomag nem", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: null, stripeSubscriptionId: null });
    await applyStripeEvent(ev("checkout.session.completed", {
      metadata: { user_id: "u1", plan_id: "pro", billing: "monthly" }, payment_status: "unpaid", customer: "cus_1", subscription: "sub_1",
    }), store);
    expect(store.updateUser).toHaveBeenCalledWith("u1", { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
  });

  it("customer.subscription.updated → a csomag a Stripe-ban számlázott árat követi (pl. portálos váltás)", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    await applyStripeEvent(ev("customer.subscription.updated", {
      id: "sub_1", status: "active", customer: "cus_1", metadata: {}, items: { data: [{ price: priceFor("agency", "monthly") }] },
    }), store);
    expect(store.updateUser).toHaveBeenCalledWith("u1", expect.objectContaining({ subscriptionPlan: "agency", subscriptionBilling: "monthly" }));
  });

  it("customer.subscription.updated egy RÉGI (duplikált) előfizetésről → figyelmen kívül", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new" });
    await applyStripeEvent(ev("customer.subscription.updated", {
      id: "sub_old", status: "canceled", customer: "cus_1", metadata: {}, items: { data: [{ price: priceFor("pro", "monthly") }] },
    }), store);
    expect(store.updateUser).not.toHaveBeenCalled();
  });

  it("customer.subscription.deleted → csak az AKTUÁLIS előfizetés törlése vált ingyenesre", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new" });
    await applyStripeEvent(ev("customer.subscription.deleted", { id: "sub_old", customer: "cus_1", metadata: {} }), store);
    expect(store.updateUser).not.toHaveBeenCalled();

    await applyStripeEvent(ev("customer.subscription.deleted", { id: "sub_new", customer: "cus_1", metadata: {} }), store);
    expect(store.updateUser).toHaveBeenCalledWith("u1", { subscriptionPlan: "free", stripeSubscriptionId: null });
  });

  it("invoice.payment_failed → értesítés a felhasználónak, forintban", async () => {
    const store = fakeStore({ id: "u1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
    await applyStripeEvent(ev("invoice.payment_failed", { id: "in_1", customer: "cus_1", amount_due: 2490000, billing_reason: "subscription_cycle" }), store);
    expect(store.notifyUser).toHaveBeenCalledWith("u1", "Sikertelen előfizetési díj", expect.stringMatching(/24\s900 Ft/));

    await applyStripeEvent(ev("invoice.payment_failed", { id: "in_2", customer: "cus_1", amount_due: 500000, billing_reason: "subscription_update" }), store);
    expect(store.notifyUser).toHaveBeenLastCalledWith("u1", "A csomagváltás fizetése nem sikerült", expect.stringContaining("nem változott"));
  });
});
