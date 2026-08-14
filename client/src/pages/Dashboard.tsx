/*
 * G2A Growth Engine – Dashboard v4.0 (G2A arculat PILOT — teal + Geist)
 *
 * A design_handoff asztali Irányítópult újraépítése az új arculatban.
 * SCOPE: a teljes oldal a `.ge-arculat` konténerben renderel — a token-réteg
 * (index.css) itt teal-re és Geist-re vált mindent, a többi oldal érintetlen.
 *
 * FONTOS — adat-őszinteség: a designban látható "+34% elérés", "0,9% foglalási
 * konverzió" stb. DEMO számok; a repóban NINCS analitika/reach idősor-API.
 * Ez az oldal KIZÁRÓLAG valós tRPC-adatból dolgozik (leads, tartalom,
 * kampányok, AI kredit); a sparkline-ok valós createdAt időbélyegekből
 * származnak. Ahol nincs valós adat, ott őszinte üres/lapos állapot van.
 */

import { useLocation } from "wouter";
import {
  ChevronRight, Calendar, CheckCircle2,
  ArrowRight, Eye, ThumbsUp, Brain, Image, Video,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Sparkline from "@/components/charts/Sparkline";
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

/** Heti darabszám-vödrök az utolsó N hétre (régi → új). Sparkline-hoz. */
function weeklyCounts(items: any[], weeks = 12): number[] {
  const buckets = new Array(weeks).fill(0);
  const now = Date.now();
  for (const it of items) {
    const t = toTime(it?.createdAt);
    if (t == null) continue;
    const ago = Math.floor((now - t) / WEEK_MS);
    if (ago >= 0 && ago < weeks) buckets[weeks - 1 - ago]++;
  }
  return buckets;
}

/** Napi darabszám az utolsó N napra (régi → új). Hero area-charthoz. */
function dailyCounts(items: any[], days = 30): number[] {
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  for (const it of items) {
    const t = toTime(it?.createdAt);
    if (t == null) continue;
    const ago = Math.floor((now - t) / DAY_MS);
    if (ago >= 0 && ago < days) buckets[days - 1 - ago]++;
  }
  return buckets;
}

function countSince(items: any[], sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  return items.filter((it) => {
    const t = toTime(it?.createdAt);
    return t != null && t >= cutoff;
  }).length;
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram",
  twitter: "X", tiktok: "TikTok", blog: "Blog",
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { leads } = useData();
  const { activeProfile } = useProfile();
  const { isSuperAdmin } = useAppAuth();
  const { activeProject } = useActiveProject();

  const { data: contentItems = [] } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const { data: aiUsage } = trpc.aiUsage.status.useQuery(undefined, { enabled: true });

  const utils = trpc.useUtils();
  const updateContentMutation = trpc.content.update.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });

  // ─── Származtatott valós adatok ───────────────────────────────────────────
  const pendingContent = contentItems.filter((c: any) => c.status === "pending_approval");
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
  const contentLast7 = countSince(contentItems, 7 * DAY_MS);

  // Feliratkozók e hónapban (valós createdAt alapján)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const leadsThisMonth = (leads as any[]).filter(l => {
    const t = toTime(l?.createdAt);
    return t != null && t >= monthStart;
  }).length;

  // Napi teendők (valós, származtatott prioritások)
  const priorities = [
    { id: "approve", label: "Tartalom jóváhagyása", count: totalApproval, href: "/tartalom-studio", done: totalApproval === 0 },
    { id: "schedule", label: "Következő hét ütemezése", count: upcomingScheduled.length, href: "/tartalom-studio", done: upcomingScheduled.length > 0 },
    { id: "strategy", label: "Heti fókusz frissítése", count: 1, href: "/strategia", done: false },
  ];
  const prioritiesDone = priorities.filter(p => p.done).length;

  // KPI kártyák — mind valós adat + valós sparkline
  const kpis = [
    {
      key: "subs", eyebrow: "Hírlevél feliratkozók", value: (leads as any[]).length,
      sub: leadsThisMonth > 0 ? `+${leadsThisMonth} / hó` : "összesen",
      series: weeklyCounts(leads as any[]), color: "var(--qa-success)",
    },
    {
      key: "content", eyebrow: "AI tartalmak", value: contentItems.length,
      sub: `${activeContent} aktív`,
      series: weeklyCounts(contentItems as any[]), color: "var(--qa-accent)",
    },
    {
      key: "campaigns", eyebrow: "Aktív kampányok", value: activeCampaigns,
      sub: `${draftCampaigns} vázlat`,
      series: weeklyCounts(campaigns as any[]), color: "var(--qa-fg3)",
    },
    {
      key: "credits", eyebrow: "AI kreditek",
      value: aiUsage ? (aiUsage.limit === -1 ? "∞" : `${aiUsage.used}/${aiUsage.limit}`) : "–",
      sub: aiUsage?.plan ? String(aiUsage.plan) : "csomag",
      series: [0, 0], color: "var(--qa-accent-purple)",
    },
  ];

  const contentDaily = dailyCounts(contentItems as any[], 30);

  const handleApproveContent = async (id: string) => {
    await updateContentMutation.mutateAsync({ id, status: "approved" });
    toast.success("Tartalom jóváhagyva");
  };

  const subtitle = isSuperAdmin && activeProject
    ? `Aktív projekt: ${activeProject.name} · ${now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}`
    : activeProfile.name
      ? `Aktív ügyfél: ${activeProfile.name} · ${now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}`
      : now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });

  return (
    <DashboardLayout title="Irányítópult" subtitle={subtitle}>
      <div className="ge-arculat">

        {/* Onboarding retention widget (feltételes) */}
        {activeProfile.id && <OnboardingChecklist profileId={activeProfile.id} />}

        {/* ─── KPI sor: 4 kártya sparkline-nal ─────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="rounded-2xl border p-4 flex flex-col"
              style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
            >
              <span className="qa-eyebrow mb-2">{k.eyebrow}</span>
              <div className="flex items-baseline gap-2">
                <span className="qa-metric" style={{ fontSize: 30, lineHeight: 1 }}>{k.value}</span>
                <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>{k.sub}</span>
              </div>
              <div className="mt-3">
                <Sparkline data={k.series} color={k.color} height={30} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── Fő rács: hero + jóváhagyás | jobb oszlop ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* BAL: hero insight + jóváhagyásra vár */}
          <div className="lg:col-span-2 space-y-4">

            {/* Hero AI insight */}
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--qa-surface)", border: "1px solid rgba(20,184,166,.28)" }}
            >
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0">
                  <div className="flex items-baseline gap-0.5">
                    <span className="qa-metric" style={{ fontSize: 56, color: "var(--qa-accent)" }}>{contentLast7}</span>
                  </div>
                  <div className="qa-eyebrow mt-1">Új tartalom</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>7 nap</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="qa-eyebrow qa-eyebrow-accent mb-1.5">Heti AI insight</div>
                  <p className="text-[15px] leading-relaxed" style={{ color: "var(--qa-fg)" }}>
                    {contentItems.length > 0 || (leads as any[]).length > 0
                      ? `${(leads as any[]).length} feliratkozó és ${contentItems.length} tartalom alapján: ütemezd előre a következő hét posztjait, és fókuszálj a legjobban teljesítő csatornára.`
                      : "Töltsd ki az onboardingot és generálj stratégiát, hogy személyre szabott AI insight-okat kapj a vállalkozásodról."}
                  </p>
                </div>
              </div>

              {/* Valós tartalom-volumen 30 nap (nem koholt reach) */}
              <div className="mt-4">
                <Sparkline data={contentDaily} color="var(--qa-accent)" fill height={72} strokeWidth={2} />
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--qa-accent)" }} />
                  <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>Tartalom · 30 nap</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => navigate("/strategia")} className="qa-btn-primary">
                  Stratégiában megnyitás
                </button>
                <button onClick={() => navigate("/analitika")} className="qa-btn-secondary">
                  Analitika
                </button>
              </div>
            </div>

            {/* Jóváhagyásra vár */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="qa-eyebrow">Jóváhagyásra vár</span>
                <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{totalApproval} elem</span>
              </div>
              {totalApproval === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: "var(--qa-success)" }} />
                  <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>Nincs jóváhagyásra váró elem</p>
                </div>
              ) : (
                <div>
                  {pendingContent.slice(0, 4).map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--qa-surface2)" }}>
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
          </div>

          {/* JOBB: napi teendők + következő 7 nap */}
          <div className="space-y-4">

            {/* Napi teendők */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="qa-eyebrow">Napi teendők</span>
                <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{prioritiesDone}/{priorities.length} kész</span>
              </div>
              <div>
                {priorities.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(p.href)}
                    className="w-full flex items-center gap-3 py-2.5 border-b last:border-0 text-left"
                    style={{ borderColor: "var(--qa-surface2)" }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={p.done
                        ? { background: "var(--qa-accent)" }
                        : { border: "1.5px solid var(--qa-border-hi)" }}
                    >
                      {p.done && <CheckCircle2 size={13} style={{ color: "var(--qa-accent-on)" }} />}
                    </span>
                    <span
                      className="flex-1 text-sm"
                      style={{ color: p.done ? "var(--qa-fg4)" : "var(--qa-fg2)", textDecoration: p.done ? "line-through" : "none" }}
                    >
                      {p.label}
                    </span>
                    {!p.done && p.count > 0 && (
                      <span className="qa-status qa-status-pending flex-shrink-0">{p.count}</span>
                    )}
                    <ChevronRight size={14} style={{ color: "var(--qa-fg4)" }} className="flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Következő 7 nap */}
            <div className="rounded-2xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
              <span className="qa-eyebrow">Következő 7 nap</span>
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
                  <div key={c.id} className="flex items-center gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--qa-surface2)" }}>
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

        {/* AI napi teendők blokk (Mi a dolgom ma?) — teal-re hangolva */}
        {activeProfile.id && <DailyTasksBlock profileId={activeProfile.id} />}

        {/* AI Kredit widget — csak nem-super_admin */}
        <AiCreditsWidget navigate={navigate} isSuperAdmin={isSuperAdmin} />
      </div>
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
