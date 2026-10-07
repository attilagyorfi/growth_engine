/**
 * G2A Growth Engine – Stripe Product & Price Definitions
 * Centralised plan → price mapping for checkout sessions
 */

export type BillingInterval = "monthly" | "yearly";
export type PlanId = "starter" | "pro" | "agency";

export const PLAN_IDS: readonly PlanId[] = ["starter", "pro", "agency"];
export const STRIPE_CURRENCY = "huf";

/**
 * A csomagárak forintban (ez jelenik meg a felületen is). A Stripe-ba küldött
 * összeget a `toStripeAmount` számolja.
 *
 * A Stripe-katalógus (Product + Price) a `billing.ts`-ben jön létre első
 * használatkor, determinisztikus azonosítókkal (lásd `planProductId` és
 * `planLookupKey`). Kézi előkészítés a Stripe Dashboardon nem kell.
 */
export const PLAN_DETAILS: Record<PlanId, {
  name: string;
  description: string;
  monthlyPriceHuf: number;
  yearlyPriceHuf: number;
}> = {
  starter: {
    name: "G2A Growth Engine – Starter",
    description: "1 vállalkozás profil, 5 AI stratégia/hó, 50 AI poszt/hó, 3 SEO audit/hó",
    monthlyPriceHuf: 9900,
    yearlyPriceHuf: 99000,
  },
  pro: {
    name: "G2A Growth Engine – Pro",
    description: "3 vállalkozás profil, 300 AI szöveges/hó, 30 AI kép/hó, 5 HeyGen videó/hó",
    monthlyPriceHuf: 24900,
    yearlyPriceHuf: 249000,
  },
  agency: {
    name: "G2A Growth Engine – Agency",
    description: "Korlátlan projekt, 1000 AI szöveges/hó, 100 AI kép/hó, 15 HeyGen videó/hó",
    monthlyPriceHuf: 49900,
    yearlyPriceHuf: 499000,
  },
};

/**
 * Forint → Stripe `unit_amount`.
 *
 * A Stripe a HUF-ot terhelésnél KÉTTIZEDES pénznemként kezeli (csak a kifizetés
 * zero-decimal), tehát az összeget fillérben kell megadni: 9 900 Ft → 990000.
 * Forrás: https://docs.stripe.com/currencies (Special cases → Hungarian Forint).
 * Korábban a forintérték ment át változatlanul, így 9 900 Ft helyett 99,00 Ft lett
 * volna a terhelés (ami a 175 Ft-os Stripe-minimum alatt van).
 */
export function toStripeAmount(huf: number): number {
  return Math.round(huf * 100);
}

export function getPlanPriceHuf(planId: PlanId, billing: BillingInterval): number {
  const plan = PLAN_DETAILS[planId];
  return billing === "yearly" ? plan.yearlyPriceHuf : plan.monthlyPriceHuf;
}

export function getPriceAmountInCents(planId: PlanId, billing: BillingInterval): number {
  return toStripeAmount(getPlanPriceHuf(planId, billing));
}

export function stripeInterval(billing: BillingInterval): "month" | "year" {
  return billing === "yearly" ? "year" : "month";
}

/** Determinisztikus Stripe Product ID csomagonként (pl. `ge_plan_pro`). */
export function planProductId(planId: PlanId): string {
  return `ge_plan_${planId}`;
}

/** Stripe Price `lookup_key` csomag+ciklus szerint (pl. `ge_pro_yearly`). */
export function planLookupKey(planId: PlanId, billing: BillingInterval): string {
  return `ge_${planId}_${billing}`;
}

export function parsePlanLookupKey(key: string | null | undefined): { planId: PlanId; billing: BillingInterval } | null {
  const m = /^ge_(starter|pro|agency)_(monthly|yearly)$/.exec(key ?? "");
  return m ? { planId: m[1] as PlanId, billing: m[2] as BillingInterval } : null;
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === "string" && (PLAN_IDS as readonly string[]).includes(v);
}

export function getPlanDisplayName(planId: PlanId): string {
  return PLAN_DETAILS[planId].name;
}
