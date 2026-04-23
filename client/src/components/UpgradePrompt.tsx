/**
 * UpgradePrompt – Feature gating UI komponens
 * Megjelenik, ha a felhasználónak nincs hozzáférése egy funkcióhoz.
 */
import { Lock, Sparkles, TrendingUp, Zap } from "lucide-react";
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

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  starter: {
    bg: "oklch(0.6 0.2 255 / 10%)",
    text: "oklch(0.75 0.2 255)",
    border: "oklch(0.6 0.2 255 / 30%)",
  },
  pro: {
    bg: "oklch(0.75 0.18 75 / 10%)",
    text: "oklch(0.75 0.18 75)",
    border: "oklch(0.75 0.18 75 / 30%)",
  },
  agency: {
    bg: "oklch(0.65 0.18 165 / 10%)",
    text: "oklch(0.65 0.18 165)",
    border: "oklch(0.65 0.18 165 / 30%)",
  },
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
        className="text-lg font-bold mb-2"
        style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}
      >
        {feature} – {planLabel} csomag szükséges
      </h3>
      {description && (
        <p className="text-sm mb-4 max-w-md" style={{ color: "oklch(0.6 0.015 240)" }}>
          {description}
        </p>
      )}
      <div className="flex items-center gap-3 mb-6">
        {requiredPlan === "starter" && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.text }}>
            <Sparkles size={13} />
            <span>20 AI generálás/hó</span>
          </div>
        )}
        {(requiredPlan === "pro" || requiredPlan === "agency") && (
          <>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.text }}>
              <Zap size={13} />
              <span>Korlátlan AI</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: colors.text }}>
              <TrendingUp size={13} />
              <span>Teljes hozzáférés</span>
            </div>
          </>
        )}
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
