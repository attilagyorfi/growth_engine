/**
 * DailyTasksBlock – „Mi a dolgom ma?" AI-alapú napi teendők blokk
 * Kattintható feladatok: navigáció + auto-trigger (stratégia generálás, content studio, stb.)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, ArrowRight, CheckCircle2, Loader2, Zap,
  TrendingUp, FileText, Users, Megaphone, Brain, LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type ActionType = "strategy" | "content" | "sales" | "campaign" | "intelligence" | "other";
type CategoryType = "tartalom" | "lead" | "stratégia" | "kampány" | "egyéb";

interface Task {
  text: string;
  category: CategoryType;
  link: string;
  actionType: ActionType;
}

interface DailyTasksResult {
  tasks: Task[];
  motivationalMessage: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  tartalom:  { bg: "oklch(0.7 0.18 300 / 15%)", text: "oklch(0.7 0.18 300)" },
  lead:      { bg: "oklch(0.6 0.2 255 / 15%)",  text: "oklch(0.6 0.2 255)"  },
  stratégia: { bg: "oklch(0.75 0.18 75 / 15%)", text: "oklch(0.75 0.18 75)" },
  kampány:   { bg: "oklch(0.65 0.18 165 / 15%)",text: "oklch(0.65 0.18 165)"},
  egyéb:     { bg: "oklch(0.5 0.015 240 / 20%)",text: "oklch(0.65 0.015 240)"},
};

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  strategy:     TrendingUp,
  content:      FileText,
  sales:        Users,
  campaign:     Megaphone,
  intelligence: Brain,
  other:        LayoutDashboard,
};

const ACTION_LABELS: Record<ActionType, string> = {
  strategy:     "Stratégia megnyitása",
  content:      "Content Studio megnyitása",
  sales:        "Sales Ops megnyitása",
  campaign:     "Kampányok megnyitása",
  intelligence: "Intelligencia megnyitása",
  other:        "Irányítópult",
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface DailyTasksBlockProps {
  profileId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DailyTasksBlock({ profileId }: DailyTasksBlockProps) {
  const [, navigate] = useLocation();
  const [result, setResult] = useState<DailyTasksResult | null>(null);
  const [generated, setGenerated] = useState(false);
  const [clickedIdx, setClickedIdx] = useState<number | null>(null);

  const generateMutation = trpc.dailyTasks.generate.useMutation({
    onSuccess: (data: unknown) => {
      setResult(data as DailyTasksResult);
      setGenerated(true);
    },
    onError: (err) => {
      toast.error(err.message ?? "Hiba a napi teendők generálása során");
    },
  });

  const handleGenerate = () => {
    if (!profileId) return;
    generateMutation.mutate({ profileId });
  };

  const handleTaskClick = (task: Task, idx: number) => {
    if (!task.link) return;
    setClickedIdx(idx);

    // Show toast based on action type
    const actionLabel = ACTION_LABELS[task.actionType] ?? "Megnyitás";
    toast.info(`${actionLabel}...`, { duration: 1500 });

    // Navigate after brief delay for visual feedback
    setTimeout(() => {
      navigate(task.link);
      setClickedIdx(null);
    }, 300);
  };

  const isLoading = generateMutation.isPending;

  return (
    <div
      className="rounded-xl border mb-6 overflow-hidden"
      style={{ background: "oklch(0.17 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "oklch(1 0 0 / 8%)", background: "oklch(0.15 0.025 255 / 60%)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.6 0.2 255 / 20%)" }}
          >
            <Sparkles size={14} style={{ color: "oklch(0.75 0.2 255)" }} />
          </div>
          <div>
            <h2
              className="text-sm font-bold"
              style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}
            >
              Mi a dolgom ma?
            </h2>
            <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
              Kattints egy feladatra a közvetlen megnyitáshoz
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isLoading || !profileId}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.75 0.2 255)" }}
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {generated ? "Frissítés" : "Generálás"}
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg animate-pulse"
                  style={{ background: "oklch(1 0 0 / 5%)" }}
                />
              ))}
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Motivational message */}
              {result.motivationalMessage && (
                <p
                  className="text-xs mb-3 italic"
                  style={{ color: "oklch(0.65 0.15 255)" }}
                >
                  ✨ {result.motivationalMessage}
                </p>
              )}
              {/* Task cards */}
              <div className="space-y-2">
                {result.tasks.map((task, idx) => {
                  const colors = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS["egyéb"];
                  const ActionIcon = ACTION_ICONS[task.actionType] ?? LayoutDashboard;
                  const isClicked = clickedIdx === idx;

                  return (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      onClick={() => handleTaskClick(task, idx)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group cursor-pointer"
                      style={{
                        background: isClicked ? "oklch(0.6 0.2 255 / 12%)" : "oklch(1 0 0 / 3%)",
                        border: "1px solid transparent",
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.background = "oklch(1 0 0 / 6%)";
                        e.currentTarget.style.borderColor = "oklch(0.6 0.2 255 / 20%)";
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.currentTarget.style.background = "oklch(1 0 0 / 3%)";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      {/* Number badge */}
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {idx + 1}
                      </div>

                      {/* Task text */}
                      <p
                        className="flex-1 text-xs font-medium text-left"
                        style={{ color: "oklch(0.85 0.008 240)" }}
                      >
                        {task.text}
                      </p>

                      {/* Right side: category badge + action icon */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium hidden sm:inline"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {task.category}
                        </span>
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity"
                          style={{ background: colors.bg }}
                        >
                          <ActionIcon size={12} style={{ color: colors.text }} />
                        </div>
                        <ExternalLink
                          size={11}
                          className="opacity-30 group-hover:opacity-70 transition-opacity"
                          style={{ color: "oklch(0.65 0.015 240)" }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <p className="text-xs mt-3 text-center" style={{ color: "oklch(0.4 0.015 240)" }}>
                Kattints egy feladatra a megfelelő modul megnyitásához
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-6 text-center"
            >
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex flex-col items-center gap-2 px-6 py-4 rounded-xl border transition-all cursor-pointer w-full"
                style={{ background: "oklch(0.6 0.2 255 / 8%)", borderColor: "oklch(0.6 0.2 255 / 25%)", borderStyle: "dashed" }}
                onMouseEnter={(e: any) => { e.currentTarget.style.background = "oklch(0.6 0.2 255 / 15%)"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = "oklch(0.6 0.2 255 / 8%)"; }}
              >
                {isLoading
                  ? <Loader2 size={24} className="animate-spin" style={{ color: "oklch(0.6 0.2 255)" }} />
                  : <Zap size={24} style={{ color: "oklch(0.6 0.2 255)" }} />
                }
                <p className="text-sm font-semibold" style={{ color: "oklch(0.75 0.015 240)" }}>
                  {isLoading ? "AI elemzés folyamatban..." : "Napi teendők generálása"}
                </p>
                <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>
                  Az AI elemzi a vállalkozásod állapotát és személyre szabott javaslatokat ad
                </p>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
