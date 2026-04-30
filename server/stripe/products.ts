/**
 * G2A Growth Engine – Stripe Product & Price Definitions
 * Centralised plan → price mapping for checkout sessions
 */

export type BillingInterval = "monthly" | "yearly";
export type PlanId = "starter" | "pro" | "agency";

/**
 * Stripe Price IDs are created dynamically on first checkout.
 * We store them in env vars after creation, or create inline products.
 * For now we use inline product data (no pre-created Stripe products needed).
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

export function getPriceAmountInCents(planId: PlanId, billing: BillingInterval): number {
  const plan = PLAN_DETAILS[planId];
  // Stripe uses smallest currency unit; HUF has no subunit (1 HUF = 1 unit)
  return billing === "yearly" ? plan.yearlyPriceHuf : plan.monthlyPriceHuf;
}

export function getPlanDisplayName(planId: PlanId): string {
  return PLAN_DETAILS[planId].name;
}
