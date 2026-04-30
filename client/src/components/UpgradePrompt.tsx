/**
 * UpgradePrompt – Feature gating UI komponens
 * Megjelenik, ha a felhasználónak nincs hozzáférése egy funkcióhoz.
 * Szinkronban van a useSubscription.ts PLAN_FEATURES struktúrával.
 */
import { Lock, Sparkles, TrendingUp, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface UpgradePromptProps {
  feature: string;
  requiredPlan: "starter" | "pro" | "agency";
  description?: string;
  compact?: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

const PLAN_PRICES: Record<string, string> = {
  starter: "9 900 Ft/hó",
  pro: "24 900 Ft/hó",
  agency: "49 900 Ft/hó",
};

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  starter: {
    bg: "oklch(0.6 0.2 255 / 10%)",
    text: "oklch(0.75 0.2 255)",
    border: "oklch(0.6 0.2 255 / 30%)",
  },
  pro: {
    bg: "oklch(0.75 0.18 75 / 10%)",
    text: "var(--qa-warning)",
    border: "oklch(0.75 0.18 75 / 30%)",
  },
  agency: {
    bg: "oklch(0.65 0.18 165 / 10%)",
    text: "var(--qa-success)",
    border: "oklch(0.65 0.18 165 / 30%)",
  },
};

// Per-plan highlight features (szinkron: useSubscription.ts PLAN_FEATURES)
const PLAN_HIGHLIGHTS: Record<string, Array<{ icon: React.ElementType; label: string }>> = {
  starter: [
    { icon: Sparkles, label: "5 AI stratégia/hó" },
    { icon: Zap, label: "50 AI poszt/hó" },
    { icon: TrendingUp, label: "Analitika export" },
  ],
  pro: [
    { icon: Zap, label: "300 AI szöveges/hó" },
    { icon: Sparkles, label: "30 AI kép + 5 videó/hó" },
    { icon: TrendingUp, label: "Kampány builder" },
  ],
  agency: [
    { icon: Crown, label: "1 000 AI szöveges/hó" },
    { icon: Sparkles, label: "100 AI kép + 15 videó/hó" },
    { icon: TrendingUp, label: "White-label + korlátlan projekt" },
  ],
};

export default function UpgradePrompt({
  feature,
  requiredPlan,
  description,
  compact = false,
}: UpgradePromptProps) {
  const [, navigate] = useLocation();
  const colors = PLAN_COLORS[requiredPlan] ?? PLAN_COLORS.pro;
  const planLabel = PLAN_LABELS[requiredPlan] ?? "Pro";
  const planPrice = PLAN_PRICES[requiredPlan] ?? "";
  const highlights = PLAN_HIGHLIGHTS[requiredPlan] ?? [];

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border"
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        <Lock size={13} style={{ color: colors.text }} />
        <span className="text-xs font-medium" style={{ color: colors.text }}>
          {planLabel} csomag szükséges
        </span>
        <button
          onClick={() => navigate("/beallitasok?tab=billing")}
          className="ml-auto text-xs font-semibold underline"
          style={{ color: colors.text }}
        >
          Bővítés
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}
      >
        <Lock size={24} style={{ color: colors.text }} />
      </div>
      <h3
        className="text-lg font-bold mb-1"
        style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}
      >
        {feature} – {planLabel} csomag szükséges
      </h3>
      <p className="text-xs mb-4" style={{ color: "var(--qa-fg3)" }}>
        {planPrice}
      </p>
      {description && (
        <p className="text-sm mb-4 max-w-md" style={{ color: "var(--qa-fg3)" }}>
          {description}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {highlights.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: colors.text }}>
            <Icon size={13} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Button
        onClick={() => navigate("/beallitasok?tab=billing")}
        className="font-semibold"
        style={{ background: colors.text, color: "oklch(0.1 0.02 255)" }}
      >
        Csomag bővítése
      </Button>
    </div>
  );
}
