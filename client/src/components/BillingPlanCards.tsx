/**
 * BillingPlanCards – Előfizetési csomagok összehasonlítása + Stripe checkout
 * Havi/éves kapcsolóval, valódi Stripe checkout session nyitással
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Rocket, Building2, Crown, CheckCircle2, CreditCard, ExternalLink, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PLAN_FEATURES, type SubscriptionPlan } from "@/hooks/useSubscription";

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  free: <Sparkles size={16} />,
  starter: <Rocket size={16} />,
  pro: <Building2 size={16} />,
  agency: <Crown size={16} />,
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  free: "var(--qa-accent)",
  starter: "var(--qa-accent)",
  pro: "var(--qa-warning)",
  agency: "var(--qa-success)",
};

const ANNUAL_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 99000,
  pro: 249000,
  agency: 499000,
};

const ANNUAL_MONTHLY_EQUIV: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 8250,
  pro: 20750,
  agency: 41583,
};

const FEATURE_LISTS: Record<SubscriptionPlan, string[]> = {
  free:    ["1 AI stratégia/hó", "5 AI poszt/hó", "1 SEO audit/hó"],
  starter: ["5 AI stratégia/hó", "50 AI poszt/hó", "3 SEO audit/hó", "5 AI kép/hó", "Kampány builder"],
  pro:     ["20 AI stratégia/hó", "300 AI poszt/hó", "10 SEO audit/hó", "30 AI kép/hó", "5 HeyGen videó/hó", "Kampány builder"],
  agency:  ["60 AI stratégia/hó", "1 000 AI poszt/hó", "30 SEO audit/hó", "100 AI kép/hó", "15 HeyGen videó/hó", "White-label"],
};

interface Props {
  currentPlan: SubscriptionPlan;
}

export default function BillingPlanCards({ currentPlan }: Props) {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const createCheckout = trpc.stripe.createCheckout.useMutation();
  const getPortalUrl = trpc.stripe.getPortalUrl.useMutation();

  const handleUpgrade = async (planId: "starter" | "pro" | "agency") => {
    setLoadingPlan(planId);
    try {
      const result = await createCheckout.mutateAsync({
        planId,
        billing: isYearly ? "yearly" : "monthly",
      });
      if (result.url) {
        toast.success("Átirányítás a fizetési oldalra...");
        window.open(result.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Hiba a fizetési oldal megnyitásakor");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPlan("portal");
    try {
      const result = await getPortalUrl.mutateAsync();
      if (result.url) {
        toast.success("Átirányítás a Stripe portálra...");
        window.open(result.url, "_blank");
      }
    } catch {
      toast.info("Nincs aktív Stripe előfizetés. Válassz csomagot alább.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ background: "oklch(0.17 0.022 255)", borderColor: "var(--qa-border)" }}>
      {/* Header + toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Csomagok</h3>
        <div className="flex items-center gap-3">
          {/* Manage subscription button (only if has Stripe sub) */}
          {currentPlan !== "free" && (
            <button
              onClick={handleManageSubscription}
              disabled={loadingPlan === "portal"}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "oklch(1 0 0 / 6%)", color: "oklch(0.7 0.015 240)" }}
            >
              {loadingPlan === "portal" ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
              Előfizetés kezelése
            </button>
          )}
          {/* Yearly/Monthly toggle */}
          <div className="inline-flex items-center gap-0.5 p-1 rounded-xl" style={{ background: "oklch(1 0 0 / 5%)", border: "1px solid var(--qa-border)" }}>
            <button
              onClick={() => setIsYearly(false)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={!isYearly ? { background: "var(--qa-accent)", color: "white" } : { color: "var(--qa-fg4)" }}
            >
              Havi
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              style={isYearly ? { background: "var(--qa-accent)", color: "white" } : { color: "var(--qa-fg4)" }}
            >
              Éves
              <span className="text-xs px-1 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.65 0.18 165 / 25%)", color: "var(--qa-success)" }}>-17%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {(["free", "starter", "pro", "agency"] as SubscriptionPlan[]).map(planId => {
          const plan = PLAN_FEATURES[planId];
          const isActive = currentPlan === planId;
          const color = PLAN_COLORS[planId];
          const isLoading = loadingPlan === planId;

          const displayPrice = isYearly && planId !== "free"
            ? ANNUAL_MONTHLY_EQUIV[planId]
            : plan.monthlyPrice;
          const priceLabel = isYearly && planId !== "free"
            ? `${ANNUAL_PRICES[planId].toLocaleString("hu-HU")} Ft/év`
            : null;

          return (
            <div
              key={planId}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{
                background: isActive ? `${color}10` : "var(--qa-surface2)",
                borderColor: isActive ? `${color}40` : "var(--qa-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color }}>{PLAN_ICONS[planId]}</span>
                <span className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>{plan.planLabel}</span>
                {isActive && (
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${color}20`, color }}>Aktív</span>
                )}
              </div>

              {/* Price with animation */}
              <motion.div key={isYearly ? "yearly" : "monthly"} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <p className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
                  {displayPrice === 0 ? "Ingyenes" : `${displayPrice.toLocaleString("hu-HU")} Ft`}
                  {displayPrice > 0 && <span className="text-xs font-normal" style={{ color: "var(--qa-fg3)" }}>/hó</span>}
                </p>
                {priceLabel && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--qa-success)" }}>{priceLabel} – 2 hónap ingyen</p>
                )}
              </motion.div>

              {/* Feature list */}
              <ul className="space-y-1.5 flex-1">
                {FEATURE_LISTS[planId].map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.7 0.015 240)" }}>
                    <CheckCircle2 size={11} style={{ color, flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {!isActive && planId !== "free" && (
                <button
                  onClick={() => handleUpgrade(planId as "starter" | "pro" | "agency")}
                  disabled={isLoading}
                  className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ background: `${color}20`, color }}
                >
                  {isLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>
                      <CreditCard size={12} />
                      {currentPlan === "free" ? "Választás" : "Frissítés"}
                      <ExternalLink size={10} />
                    </>
                  )}
                </button>
              )}
              {isActive && planId === "free" && (
                <span className="text-xs text-center" style={{ color: "var(--qa-fg4)" }}>Jelenlegi csomag</span>
              )}
              {!isActive && planId === "free" && (
                <span className="text-xs text-center" style={{ color: "var(--qa-fg4)" }}>Ingyenes szintre visszalépés</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stripe info */}
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "oklch(1 0 0 / 3%)", border: "1px solid oklch(1 0 0 / 6%)" }}>
        <CreditCard size={13} style={{ color: "var(--qa-fg3)", flexShrink: 0 }} />
        <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
          Biztonságos fizetés Stripe-on keresztül. Teszteléshez használd a <span className="font-mono" style={{ color: "var(--qa-fg3)" }}>4242 4242 4242 4242</span> kártyaszámot.
        </p>
      </div>
    </div>
  );
}
