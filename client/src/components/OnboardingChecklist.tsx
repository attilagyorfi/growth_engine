/**
 * G2A Growth Engine — Onboarding checklist widget (Dashboard-kártya)
 *
 * Az audit-agent talált: "Onboarding checklist widget a Dashboardon — 3 lépés
 * a teljes profilhoz progress-kártya. Retention-driver."
 *
 * 5 lépés a "teljes G2A profilhoz":
 *   1. Brand asset feltöltve (brandAssets.getByProfile > 0)
 *   2. Legalább 1 social csatlakoztatva (social.listConnections isActive > 0)
 *   3. Company Intelligence generálva (intelligence.get returns not-null)
 *   4. Első stratégia (strategyVersions.list > 0)
 *   5. Első AI-poszt (content.list > 0)
 *
 * Progress bar + %-os teljesítettség. Ha 100% → csak egy "Kész! 🎉" badge
 * (nem foglal helyet). Ha a user "dismisses" → localStorage-ba menti, nem
 * jelenik meg többet a Dashboardon.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronRight, Sparkles, X,
  Image as ImageIcon, Link2, Brain, BarChart3, FileText,
} from "lucide-react";

interface OnboardingChecklistProps {
  profileId: string;
}

// A localStorage kulcs — profile-onkénti dismiss (ha 3 projekt van, mindegyik
// önállóan is elrejthető). Az emberi-olvasható kulcs debug-hoz jó.
const dismissKey = (profileId: string) => `g2a_onboarding_dismissed_${profileId}`;

type Step = {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export default function OnboardingChecklist({ profileId }: OnboardingChecklistProps) {
  // Dismissed state — az init-nél olvassuk a localStorage-t
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(dismissKey(profileId)) === "true";
  });

  // 5 különböző query — mind a step-státuszhoz. Rövid staleTime hogy a
  // Dashboard-frissülés valós idejű legyen (pl. LinkedIn csatlakoztatás
  // után 30 mp-en belül tick megjelenik).
  const brandAssets = trpc.onboarding.getBrandAssets.useQuery(
    { profileId }, { enabled: !!profileId, staleTime: 30_000 }
  );
  const socialConns = trpc.social.listConnections.useQuery(
    { profileId }, { enabled: !!profileId, staleTime: 30_000 }
  );
  const intelligence = trpc.intelligence.get.useQuery(
    { profileId }, { enabled: !!profileId, staleTime: 60_000 }
  );
  const strategies = trpc.strategyVersions.list.useQuery(
    { profileId }, { enabled: !!profileId, staleTime: 60_000 }
  );
  const contentItems = trpc.content.list.useQuery(
    { profileId }, { enabled: !!profileId, staleTime: 30_000 }
  );

  const isLoading =
    brandAssets.isLoading || socialConns.isLoading || intelligence.isLoading ||
    strategies.isLoading || contentItems.isLoading;

  const steps: Step[] = useMemo(() => [
    {
      id: "brand-asset",
      icon: <ImageIcon size={14} />,
      label: "Brand asset feltöltve",
      description: "Logó, brand guide vagy vizuális irány a Brand Center-ben",
      href: "/beallitasok?tab=brand",
      done: (brandAssets.data?.length ?? 0) > 0,
    },
    {
      id: "social",
      icon: <Link2 size={14} />,
      label: "Közösségi média csatlakoztatva",
      description: "LinkedIn, Facebook, Instagram vagy TikTok fiók",
      href: "/beallitasok?tab=integrations",
      done: (socialConns.data ?? []).some((c: any) => c.isActive),
    },
    {
      id: "intelligence",
      icon: <Brain size={14} />,
      label: "Cégintelligencia generálva",
      description: "AI-elemzés a márkádról, versenytársakról, célközönségről",
      href: "/intelligencia",
      done: !!intelligence.data,
    },
    {
      id: "strategy",
      icon: <BarChart3 size={14} />,
      label: "Első stratégia elkészítve",
      description: "Havi vagy negyedéves tartalmi terv az AI-tól",
      href: "/strategia",
      done: (strategies.data?.length ?? 0) > 0,
    },
    {
      id: "content",
      icon: <FileText size={14} />,
      label: "Első AI-poszt legyártva",
      description: "Content Studio → első poszt generálása",
      href: "/tartalom-studio",
      done: (contentItems.data?.length ?? 0) > 0,
    },
  ], [brandAssets.data, socialConns.data, intelligence.data, strategies.data, contentItems.data]);

  const doneCount = steps.filter(s => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const isComplete = doneCount === steps.length;

  const handleDismiss = () => {
    localStorage.setItem(dismissKey(profileId), "true");
    setDismissed(true);
  };

  // Egyáltalán ne mutassuk ha:
  //   - a user már dismissed
  //   - a loading még nem futott le (kerüljük a "0 kész" flash-t)
  //   - VAGY komplett és korábban is a `hide-on-complete` visszaesethez
  //     (jelenleg minden 100%-osnál egyszerűen elrejtjük 5 mp-es sikerpillanat után)
  if (dismissed || isLoading) return null;

  return (
    <AnimatePresence>
      {!isComplete ? (
        <motion.section
          key="checklist"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-2xl border p-5 mb-6"
          style={{
            background: "var(--qa-surface)",
            borderColor: "var(--qa-border)",
          }}
        >
          {/* Header + progress + dismiss */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "var(--qa-accent)" }}
              >
                <Sparkles size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className="text-sm font-bold mb-0.5"
                  style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}
                >
                  Első lépések ({doneCount}/{steps.length})
                </h3>
                <p className="text-xs" style={{ color: "var(--qa-fg3)" }}>
                  Töltsd fel a profilodat — a G2A így tudja igazán jól segíteni a marketingedet.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "var(--qa-fg4)", background: "transparent" }}
              aria-label="Elrejtés"
              title="Elrejtés — később nem jelenik meg"
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--qa-surface2)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--qa-accent)" }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Steps — a kész step-ek felül, a hátralévők alul */}
          <div className="space-y-1.5">
            {steps
              .slice()
              .sort((a, b) => Number(b.done) - Number(a.done))
              .map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
          </div>
        </motion.section>
      ) : (
        // 100% state — kicsi congrats banner (nem dismissable, csak elmarad
        // egy oldalújratöltés után mert a dismissed flag akkor is elmenthető
        // manuálisan). Vagy: az X gomb már itt is aktív.
        <motion.section
          key="complete"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4 mb-6 flex items-center justify-between"
          style={{
            background: "oklch(0.72 0.19 145 / 8%)",
            borderColor: "oklch(0.72 0.19 145 / 30%)",
          }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} style={{ color: "var(--qa-success)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--qa-fg)" }}>
                🎉 A profilod teljes!
              </p>
              <p className="text-xs" style={{ color: "var(--qa-fg3)" }}>
                Minden alap kész — most már fókuszálhatsz a marketingedre.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
            style={{ color: "var(--qa-fg3)", background: "transparent" }}
          >
            Rendben
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <Link href={step.href}>
      <a
        className="group flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:opacity-90"
        style={{
          background: step.done ? "transparent" : "var(--qa-surface2)",
          opacity: step.done ? 0.55 : 1,
        }}
      >
        {step.done ? (
          <CheckCircle2 size={18} style={{ color: "var(--qa-success)", flexShrink: 0 }} />
        ) : (
          <Circle size={18} style={{ color: "var(--qa-fg4)", flexShrink: 0 }} />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold flex items-center gap-1.5"
            style={{
              color: step.done ? "var(--qa-fg3)" : "var(--qa-fg)",
              textDecoration: step.done ? "line-through" : "none",
            }}
          >
            {step.icon}
            {step.label}
          </p>
          {!step.done && (
            <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg4)" }}>
              {step.description}
            </p>
          )}
        </div>
        {!step.done && (
          <ChevronRight
            size={14}
            className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--qa-fg4)" }}
          />
        )}
      </a>
    </Link>
  );
}
