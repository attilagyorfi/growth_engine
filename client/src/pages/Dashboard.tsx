/*
 * G2A Growth Engine – Dashboard v5.0 („Napi fókusz" — UI-mockup variáció A)
 *
 * A design_handoff_growth_engine_ui asztali Irányítópultja, a laikus KKV-tulajra
 * hangolva: köszöntő + setup-progress + „Mi a dolgom ma?" elöl, mellette a
 * hónap számai, alatta a folyamat-térkép és a következő 7 nap.
 *
 * FONTOS — adat-őszinteség: ez az oldal KIZÁRÓLAG valós tRPC-adatból dolgozik
 * (tartalom, kampányok, stratégia, feliratkozók, AI kredit). A sparkline-ok
 * valós createdAt időbélyegekből származnak. NINCS koholt reach/konverzió szám;
 * ahol nincs adat, ott őszinte üres/lapos állapot van. A delta-chipek helyett
 * valós kontextus-alcímek állnak (nincs kitalált havi növekedés).
 */

import { useLocation } from "wouter";
import {
  ChevronRight, Calendar, CheckCircle2, ArrowRight, Eye, ThumbsUp,
  Brain, Image, Video, Target, FileText, Clock, Send,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useData } from "@/contexts/DataContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion } from "framer-motion";
import DailyTasksBlock from "@/components/DailyTasksBlock";
import OnboardingChecklist from "@/components/OnboardingChecklist";

// ─── Valós idősor-származtatás (createdAt-ból) ────────────────────────────────
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(raw: unknown): number | null {
  if (!raw) return null;
  const t = new Date(raw as string).getTime();
  return Number.isNaN(t) ? null : t;
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram",
  twitter: "X", tiktok: "TikTok", blog: "Blog",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { leads } = useData();
  const { activeProfile } = useProfile();
  const { isSuperAdmin, user } = useAppAuth();
  const { activeProject } = useActiveProject();

  const { data: contentItems = [] } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const { data: activeStrategy } = trpc.strategyVersions.getActive.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const { data: aiUsage } = trpc.aiUsage.status.useQuery(undefined, { enabled: true });

  const utils = trpc.useUtils();
  const updateContentMutation = trpc.content.update.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });

  // ─── Származtatott valós adatok ───────────────────────────────────────────
  // FIX: a séma-státusz "review" (nem "pending_approval") — eddig a jóváhagyási
  // sor mindig üres volt. A submitForReview status: "review"-t állít.
  const pendingContent = contentItems.filter((c: any) => c.status === "review");
  const totalApproval = pendingContent.length;

  const now = new Date();
  const in7Days = new Date(now.getTime() + WEEK_MS);
  const upcomingScheduled = contentItems.filter((c: any) => {
    if (!c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    return d >= now && d <= in7Days;
  }).slice(0, 5);

  const activeCampaigns = (campaigns as any[]).filter(c => c.status === "active" || c.status === "draft").length;
  const draftCampaigns = (campaigns as any[]).filter(c => c.status === "draft").length;
  const activeContent = contentItems.filter((c: any) => c.status === "scheduled" || c.status === "published" || c.status === "approved").length;

  // Folyamat-térkép (#3) — valós content-státuszok + stratégia
  const publishedCount = contentItems.filter((c: any) => c.status === "published").length;
  const writtenCount = contentItems.filter((c: any) => ["draft", "approved", "scheduled"].includes(c.status)).length;
  const strategyCount = activeStrategy ? 1 : 0;

  const pipeline = [
    { key: "strat", label: "Stratégia", value: strategyCount, sub: "az alap", tint: "success" as const, icon: Target, href: "/strategia" },
    { key: "written", label: "Megírt tartalom", value: writtenCount, sub: "készen áll", tint: "neutral" as const, icon: FileText, href: "/tartalom-studio" },
    { key: "review", label: "Rád vár", value: totalApproval, sub: "jóváhagyás", tint: "warning" as const, icon: Clock, href: "/tartalom-studio" },
    { key: "published", label: "Kiment", value: publishedCount, sub: "közzétéve", tint: "accent" as const, icon: Send, href: "/tartalom-studio" },
  ];
  const tintStyle: Record<string, { bg: string; fg: string }> = {
    success: { bg: "var(--qa-success-soft)", fg: "var(--qa-success)" },
    warning: { bg: "var(--qa-warning-soft)", fg: "var(--qa-warning)" },
    accent:  { bg: "var(--qa-accent-soft)", fg: "var(--qa-accent-purple)" },
    neutral: { bg: "var(--qa-surface2)", fg: "var(--qa-fg2)" },
  };

  // Feliratkozók e hónapban (valós createdAt alapján)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const leadsThisMonth = (leads as any[]).filter(l => {
    const t = toTime(l?.createdAt);
    return t != null && t >= monthStart;
  }).length;

  // „A hónap számokban" — valós KPI-k + laikus magyarázó mondat (#7).
  const kpis = [
    {
      key: "subs", label: "Hírlevél feliratkozók", value: (leads as any[]).length,
      sub: leadsThisMonth > 0 ? `+${leadsThisMonth} ebben a hónapban` : "összesen",
      explain: "Ennyien iratkoztak fel a hírleveledre — nekik közvetlenül tudsz üzenni.",
    },
    {
      key: "content", label: "Elkészült tartalmak", value: contentItems.length,
      sub: `${activeContent} aktív`,
      explain: "Az AI-jal eddig megírt posztok és szövegek összesen.",
    },
    {
      key: "campaigns", label: "Kampányok", value: activeCampaigns,
      sub: `${draftCampaigns} vázlat`,
      explain: "Futó és tervezett kampányaid — ezek fogják egy cél köré a posztokat.",
    },
    {
      key: "credits", label: "AI kreditek",
      value: aiUsage ? (aiUsage.limit === -1 ? "∞" : `${aiUsage.used}/${aiUsage.limit}`) : "–",
      sub: aiUsage?.plan ? `${aiUsage.plan} csomag` : "csomag",
      explain: "Ennyi AI-generálást használtál fel a havi keretedből.",
    },
  ];

  const handleApproveContent = async (id: string) => {
    await updateContentMutation.mutateAsync({ id, status: "approved" });
    toast.success("Tartalom jóváhagyva");
  };

  // ─── Köszöntő ──────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 10 ? "Jó reggelt" : hour < 18 ? "Jó napot" : "Jó estét";
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || "";
  const dateEyebrow = now.toLocaleDateString("hu-HU", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  // Egymondatos, valós állapotra épülő eligazítás (a régi „heti insight" helyett).
  const orientation = totalApproval > 0
    ? `${totalApproval} tartalom vár a jóváhagyásodra — érdemes ezzel kezdeni a napot.`
    : upcomingScheduled.length === 0
      ? "Nincs ütemezett poszt a héten — nézd meg, mit javasol az AI a mai teendőknél."
      : `${upcomingScheduled.length} poszt megy ki a következő 7 napban — minden a kezed alatt van.`;

  const contextLine = isSuperAdmin && activeProject
    ? `Aktív ügyfél: ${activeProject.name}`
    : activeProfile.name
      ? `Aktív ügyfél: ${activeProfile.name}`
      : null;

  return (
    <DashboardLayout title="Irányítópult" background="iranyitopult">
      <>
        {/* ─── Köszöntő ──────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-5"
        >
          <div className="qa-eyebrow qa-eyebrow-accent mb-1.5" style={{ textTransform: "capitalize" }}>{dateEyebrow}</div>
          <h1 className="font-bold" style={{ fontFamily: "var(--font-heading)", fontSize: 26, letterSpacing: "-0.03em", color: "var(--qa-fg)", lineHeight: 1.1 }}>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--qa-fg3)" }}>
            {orientation}{contextLine ? ` · ${contextLine}` : ""}
          </p>
        </motion.header>

        {/* ─── Setup-progress (valós, 5 lépés) — 100%/dismiss esetén elrejti magát ─ */}
        {activeProfile.id && <OnboardingChecklist profileId={activeProfile.id} />}

        {/* ─── Napi fókusz rács: 1.55fr / 1fr ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-4">

          {/* BAL: Mi a dolgom ma? + folyamat-térkép */}
          <div className="space-y-4 min-w-0">
            {/* Mi a dolgom ma? — valós, naponta cache-elt AI teendők */}
            {activeProfile.id && <DailyTasksBlock profileId={activeProfile.id} />}

            {/* Folyamat-térkép (#3) */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="qa-eyebrow">Hol tart a tartalmad</span>
                <button onClick={() => navigate("/tartalom-studio")} className="text-xs flex items-center gap-1" style={{ color: "var(--qa-accent)" }}>
                  Tartalom Studio <ArrowRight size={11} />
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {pipeline.map((cell) => {
                  const st = tintStyle[cell.tint];
                  return (
                    <button
                      key={cell.key}
                      onClick={() => navigate(cell.href)}
                      className="rounded-xl p-3 text-left transition-transform hover:-translate-y-0.5"
                      style={{ background: st.bg }}
                    >
                      <cell.icon size={15} style={{ color: st.fg }} />
                      <p className="qa-metric mt-2" style={{ fontSize: 24, lineHeight: 1, color: st.fg }}>{cell.value}</p>
                      <p className="text-xs font-semibold mt-1" style={{ color: "var(--qa-fg2)" }}>{cell.label}</p>
                      <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>{cell.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* JOBB: A hónap számokban + Következő 7 nap */}
          <div className="space-y-4 min-w-0">
            {/* A hónap számokban — KPI lista magyarázó mondattal (#7) */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <span className="qa-eyebrow">A hónap számokban</span>
              <div className="mt-2">
                {kpis.map((k) => (
                  <div key={k.key} className="py-3 border-b last:border-0" style={{ borderColor: "var(--qa-divider)" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="qa-metric" style={{ fontSize: 22, lineHeight: 1 }}>{k.value}</span>
                        <span className="text-sm truncate" style={{ color: "var(--qa-fg2)" }}>{k.label}</span>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: "var(--qa-fg4)" }}>{k.sub}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)", lineHeight: 1.5 }}>{k.explain}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Következő 7 nap */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <div className="flex items-center justify-between">
                <span className="qa-eyebrow">Következő 7 nap</span>
                {upcomingScheduled.length > 0 && (
                  <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{upcomingScheduled.length} poszt</span>
                )}
              </div>
              <div className="mt-3">
                {upcomingScheduled.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar size={22} className="mx-auto mb-2" style={{ color: "var(--qa-fg4)" }} />
                    <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>Nincs ütemezett poszt</p>
                    <button onClick={() => navigate("/tartalom-studio")} className="mt-2 text-xs" style={{ color: "var(--qa-accent)" }}>
                      Tartalom ütemezése →
                    </button>
                  </div>
                ) : upcomingScheduled.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--qa-divider)" }}>
                    <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--qa-fg3)", minWidth: 42 }}>
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ color: "var(--qa-fg2)" }}>{c.title}</p>
                      <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>{PLATFORM_LABELS[String(c.platform).toLowerCase()] ?? c.platform}</p>
                    </div>
                    <span className="qa-status qa-status-scheduled flex-shrink-0">Ütemezett</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Jóváhagyásra vár (teljes szélesség) ─────────────────────────── */}
        <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--qa-surface)", borderColor: totalApproval > 0 ? "rgba(245,158,11,.35)" : "var(--qa-border)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="qa-eyebrow">Jóváhagyásra vár</span>
            <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{totalApproval} elem</span>
          </div>
          {totalApproval === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: "var(--qa-success)" }} />
              <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>Nincs jóváhagyásra váró elem — minden rendben.</p>
            </div>
          ) : (
            <div>
              {pendingContent.slice(0, 4).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--qa-divider)" }}>
                  <span className="qa-status qa-status-scheduled flex-shrink-0" style={{ minWidth: 0 }}>
                    {PLATFORM_LABELS[String(c.platform).toLowerCase()] ?? c.platform}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate" style={{ color: "var(--qa-fg2)" }}>{c.title}</p>
                    <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "nincs időpont"}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/tartalom-studio")}
                    className="qa-btn-secondary flex-shrink-0"
                    style={{ padding: "6px 12px", fontSize: 13, minHeight: 0 }}
                  >
                    <Eye size={13} /> Átnézés
                  </button>
                  <button
                    onClick={() => handleApproveContent(c.id)}
                    className="qa-btn-primary flex-shrink-0"
                    style={{ padding: "6px 12px", fontSize: 13, minHeight: 0 }}
                  >
                    <ThumbsUp size={13} /> Jóváhagyás
                  </button>
                </div>
              ))}
              {totalApproval > 4 && (
                <button onClick={() => navigate("/tartalom-studio")} className="mt-3 text-xs flex items-center gap-1" style={{ color: "var(--qa-accent)" }}>
                  +{totalApproval - 4} további <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* AI Kredit widget — csak nem-super_admin */}
        <AiCreditsWidget navigate={navigate} isSuperAdmin={isSuperAdmin} />
      </>
    </DashboardLayout>
  );
}

function AiCreditsWidget({ navigate, isSuperAdmin }: { navigate: (path: string) => void; isSuperAdmin: boolean }) {
  const { data: aiUsage, isLoading } = trpc.aiUsage.status.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  if (isSuperAdmin || isLoading || !aiUsage || aiUsage.unlimited) return null;

  const pct = Math.min(100, Math.round((aiUsage.used / aiUsage.limit) * 100));
  const isWarning = aiUsage.warning;
  const isExhausted = aiUsage.remaining === 0;
  const barColor = isExhausted ? "var(--qa-danger)" : isWarning ? "var(--qa-warning)" : "var(--qa-accent)";

  const planLabels: Record<string, string> = {
    free: "Ingyenes", starter: "Starter", pro: "Pro", agency: "Agency",
  };

  const nowD = new Date();
  const resetDate = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 1);
  const daysLeft = Math.ceil((resetDate.getTime() - nowD.getTime()) / DAY_MS);

  const featureRows = aiUsage.featureLimits ? [
    { label: "Szöveges generálás", icon: Brain, used: (aiUsage.breakdown?.post ?? 0) + (aiUsage.breakdown?.strategy ?? 0) + (aiUsage.breakdown?.contentPlan ?? 0), limit: ((aiUsage.featureLimits as any).post ?? 0) + ((aiUsage.featureLimits as any).strategy ?? 0) + ((aiUsage.featureLimits as any).contentPlan ?? 0), color: "var(--qa-accent)" },
    { label: "Képgenerálás", icon: Image, used: aiUsage.breakdown?.image ?? 0, limit: (aiUsage.featureLimits as any).image ?? 0, color: "var(--qa-accent-purple)" },
    { label: "AI videók (HeyGen)", icon: Video, used: aiUsage.breakdown?.video ?? 0, limit: (aiUsage.featureLimits as any).video ?? 0, color: "var(--qa-success)" },
  ] : [];

  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: isExhausted ? "rgba(239,68,68,.4)" : isWarning ? "rgba(245,158,11,.4)" : "var(--qa-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="qa-eyebrow">AI kredit</span>
          <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>
            {planLabels[aiUsage.plan] ?? aiUsage.plan} csomag · reset {daysLeft} nap múlva
          </p>
        </div>
        <p className="qa-metric" style={{ fontSize: 22, color: isExhausted ? "var(--qa-danger)" : "var(--qa-fg)" }}>
          {aiUsage.used}<span className="text-sm font-normal" style={{ color: "var(--qa-fg4)" }}>/{aiUsage.limit}</span>
        </p>
      </div>

      <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ background: "var(--qa-surface3)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>

      {featureRows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {featureRows.map(row => (
            <div key={row.label} className="rounded-lg p-2.5 text-center" style={{ background: "var(--qa-surface2)" }}>
              <row.icon size={15} className="mx-auto mb-1" style={{ color: row.color }} />
              <p className="text-sm font-bold tabular-nums" style={{ color: "var(--qa-fg2)" }}>{row.used}/{row.limit}</p>
              <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--qa-fg4)" }}>{row.label}</p>
            </div>
          ))}
        </div>
      )}

      {(isExhausted || isWarning) && (
        <button
          onClick={() => navigate("/beallitasok?tab=billing")}
          className="w-full py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: isExhausted ? "rgba(239,68,68,.14)" : "rgba(245,158,11,.14)",
            color: isExhausted ? "var(--qa-danger)" : "var(--qa-warning)",
            border: `1px solid ${isExhausted ? "rgba(239,68,68,.25)" : "rgba(245,158,11,.25)"}`,
          }}
        >
          {isExhausted ? "Csomag frissítése — több AI kredit" : "Hamarosan elfogy a kredited — frissítsd a csomagot"}
        </button>
      )}
    </div>
  );
}
