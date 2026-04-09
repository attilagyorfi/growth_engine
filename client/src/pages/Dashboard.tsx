/*
 * G2A Growth Engine – Dashboard v3.0
 * Operatív döntéstámogató felület
 * Blokkok: Needs Approval, This Week's Priorities, Scheduled Next 7 Days, Top Insight, At-risk Items
 */

import { useLocation } from "wouter";
import {
  CheckCircle2, Clock, AlertTriangle, Lightbulb, TrendingUp,
  Mail, FileText, BarChart3, Users, ChevronRight, Zap,
  Calendar, Eye, ThumbsUp, MessageSquare, ArrowRight, Activity,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useData } from "@/contexts/DataContext";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { outbound, leads, inbound, updateOutbound } = useData();
  const { activeProfile } = useProfile();

  // Content items from tRPC
  const { data: contentItems = [] } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const utils = trpc.useUtils();
  const updateContentMutation = trpc.content.update.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });

  // --- Needs Approval ---
  const pendingEmails = outbound.filter(e => e.status === "draft");
  const pendingContent = contentItems.filter((c: any) => c.status === "pending_approval");
  const totalApproval = pendingEmails.length + pendingContent.length;

  // --- This Week's Priorities ---
  const weekPriorities = [
    { id: "p1", label: "Heti outbound kampány indítása", type: "email", count: pendingEmails.length, href: "/sales-ops" },
    { id: "p2", label: "Tartalom jóváhagyás", type: "content", count: pendingContent.length, href: "/content-studio" },
    { id: "p3", label: "Stratégia heti fókusz frissítése", type: "strategy", count: 1, href: "/strategy" },
    { id: "p4", label: "Új leadek minősítése", type: "leads", count: leads.filter(l => l.status === "new" || l.status === "researched").length, href: "/sales-ops" },
  ].filter(p => p.count > 0);

  // --- Scheduled Next 7 Days ---
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingScheduled = contentItems.filter((c: any) => {
    if (c.status !== "scheduled" || !c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    return d >= now && d <= in7Days;
  }).slice(0, 5);

  // --- At-risk Items ---
  const atRiskLeads = leads.filter(l => l.status === "sent").slice(0, 3);
  const unansweredInbound = inbound.filter(e => e.category === "interested" && !e.read).slice(0, 3);

  // --- KPI Summary ---
  const kpis = [
    { label: "Aktív Leadek", value: leads.filter(l => l.status !== "closed_won" && l.status !== "closed_lost").length, icon: Users, color: "oklch(0.6 0.2 255)" },
    { label: "Kiküldött Emailek", value: outbound.filter(e => e.status === "sent").length, icon: Mail, color: "oklch(0.65 0.18 165)" },
    { label: "Jóváhagyásra Vár", value: totalApproval, icon: Clock, color: "oklch(0.75 0.18 75)" },
    { label: "Ütemezett Posztok", value: contentItems.filter((c: any) => c.status === "scheduled").length, icon: Calendar, color: "oklch(0.7 0.18 300)" },
  ];

  const handleApproveEmail = async (id: string) => {
    await updateOutbound(id, { status: "approved" });
    toast.success("Email jóváhagyva");
  };

  const handleApproveContent = async (id: string) => {
    await updateContentMutation.mutateAsync({ id, status: "approved" });
    toast.success("Tartalom jóváhagyva");
  };

  const card = (children: React.ReactNode, className?: string) => (
    <div className={`rounded-xl border p-4 ${className ?? ""}`} style={{ background: "oklch(0.17 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
      {children}
    </div>
  );

  const sectionTitle = (text: string) => (
    <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.5 0.015 240)" }}>{text}</h2>
  );

  return (
    <DashboardLayout>
      {/* Welcome bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
            Jó reggelt! 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
            Aktív ügyfél: <span className="font-semibold" style={{ color: "oklch(0.75 0.18 255)" }}>{activeProfile.name}</span>
            <span className="mx-2" style={{ color: "oklch(0.35 0.015 240)" }}>·</span>
            <span style={{ color: "oklch(0.45 0.015 240)" }}>{new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}</span>
          </p>
        </div>

      </div>

      {/* PRIMARY BLOCKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* 1. Needs Approval */}
        <div>
          {sectionTitle("Needs Approval")}
          {card(
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.75 0.18 75 / 15%)" }}>
                    <Clock size={16} style={{ color: "oklch(0.75 0.18 75)" }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{totalApproval}</p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>elem vár jóváhagyásra</p>
                  </div>
                </div>
              </div>
              {pendingEmails.slice(0, 2).map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-t" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail size={13} style={{ color: "oklch(0.6 0.2 255)", flexShrink: 0 }} />
                    <p className="text-xs truncate" style={{ color: "oklch(0.78 0.008 240)" }}>{e.subject}</p>
                  </div>
                  <button onClick={() => handleApproveEmail(e.id)} className="ml-2 flex-shrink-0 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>
                    <ThumbsUp size={11} />
                  </button>
                </div>
              ))}
              {pendingContent.slice(0, 2).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-t" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} style={{ color: "oklch(0.7 0.18 300)", flexShrink: 0 }} />
                    <p className="text-xs truncate" style={{ color: "oklch(0.78 0.008 240)" }}>{c.title}</p>
                  </div>
                  <button onClick={() => handleApproveContent(c.id)} className="ml-2 flex-shrink-0 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>
                    <ThumbsUp size={11} />
                  </button>
                </div>
              ))}
              {totalApproval > 4 && (
                <button onClick={() => navigate("/sales-ops")} className="mt-2 text-xs flex items-center gap-1" style={{ color: "oklch(0.6 0.2 255)" }}>
                  +{totalApproval - 4} további <ArrowRight size={11} />
                </button>
              )}
              {totalApproval === 0 && (
                <p className="text-xs text-center py-3" style={{ color: "oklch(0.5 0.015 240)" }}>
                  <CheckCircle2 size={16} className="mx-auto mb-1" style={{ color: "oklch(0.65 0.18 165)" }} />
                  Nincs jóváhagyásra váró elem
                </p>
              )}
            </div>
          )}
        </div>

        {/* 2. This Week's Priorities */}
        <div>
          {sectionTitle("This Week's Priorities")}
          {card(
            <div className="space-y-2">
              {weekPriorities.length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle2 size={20} className="mx-auto mb-2" style={{ color: "oklch(0.65 0.18 165)" }} />
                  <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Nincsenek aktív prioritások</p>
                </div>
              )}
              {weekPriorities.map(p => (
                <button key={p.id} onClick={() => navigate(p.href)} className="w-full flex items-center justify-between p-2.5 rounded-lg transition-colors text-left" style={{ background: "oklch(0.22 0.02 255)" }}
                  onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.25 0.02 255)")}
                  onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.22 0.02 255)")}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
                      {p.type === "email" && <Mail size={12} style={{ color: "oklch(0.6 0.2 255)" }} />}
                      {p.type === "content" && <FileText size={12} style={{ color: "oklch(0.7 0.18 300)" }} />}
                      {p.type === "strategy" && <BarChart3 size={12} style={{ color: "oklch(0.65 0.18 165)" }} />}
                      {p.type === "leads" && <Users size={12} style={{ color: "oklch(0.75 0.18 75)" }} />}
                    </div>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.85 0.008 240)" }}>{p.label}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}>{p.count}</span>
                    <ChevronRight size={12} style={{ color: "oklch(0.45 0.015 240)" }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Scheduled Next 7 Days */}
        <div>
          {sectionTitle("Scheduled Next 7 Days")}
          {card(
            <div>
              {upcomingScheduled.length === 0 ? (
                <div className="text-center py-4">
                  <Calendar size={24} className="mx-auto mb-2" style={{ color: "oklch(0.4 0.015 240)" }} />
                  <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Nincs ütemezett poszt a következő 7 napban</p>
                  <button onClick={() => navigate("/content-studio")} className="mt-2 text-xs" style={{ color: "oklch(0.6 0.2 255)" }}>
                    Tartalom ütemezése →
                  </button>
                </div>
              ) : upcomingScheduled.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.7 0.18 300 / 15%)" }}>
                    <Calendar size={13} style={{ color: "oklch(0.7 0.18 300)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 240)" }}>{c.title}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                      {c.platform} · {c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECOND ROW: Top Insight + At-risk + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* 4. Top Insight */}
        <div className="lg:col-span-2">
          {sectionTitle("Top Insight")}
          {card(
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255 / 20%), oklch(0.55 0.18 165 / 20%))" }}>
                <Lightbulb size={18} style={{ color: "oklch(0.75 0.18 75)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                  {activeProfile.name} – Heti AI Insight
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.62 0.015 240)" }}>
                  {contentItems.length > 0 || leads.length > 0
                    ? `${leads.length} aktív lead és ${contentItems.length} tartalom alapján: fókuszálj a legjobb teljesítményű csatornára és ütemezd a következő hét tartalmait előre.`
                    : "Töltsd ki az onboardingot és generálj stratégiát, hogy személyre szabott AI insight-okat kapj a vállalkozásodról."}
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => navigate("/strategy")} className="text-xs flex items-center gap-1" style={{ color: "oklch(0.6 0.2 255)" }}>
                    Stratégiában megnyitás <ArrowRight size={11} />
                  </button>
                  <span style={{ color: "oklch(0.35 0.015 240)" }}>·</span>
                  <button onClick={() => navigate("/clients")} className="text-xs flex items-center gap-1" style={{ color: "oklch(0.65 0.18 165)" }}>
                    Intelligence megtekintése <Eye size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. At-risk Items */}
        <div>
          {sectionTitle("At-risk Items")}
          {card(
            <div>
              {atRiskLeads.length === 0 && unansweredInbound.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <CheckCircle2 size={16} style={{ color: "oklch(0.65 0.18 165)" }} />
                  <p className="text-xs" style={{ color: "oklch(0.65 0.18 165)" }}>Nincsenek kockázatos elemek</p>
                </div>
              ) : (
                <>
                  {unansweredInbound.map(e => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
                      <AlertTriangle size={14} style={{ color: "oklch(0.75 0.18 75)", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 240)" }}>
                          Megválaszolatlan: {e.fromName}
                        </p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Érdeklődő – azonnali figyelmet igényel</p>
                      </div>
                      <button onClick={() => navigate("/sales-ops")} className="flex-shrink-0">
                        <ChevronRight size={13} style={{ color: "oklch(0.45 0.015 240)" }} />
                      </button>
                    </div>
                  ))}
                  {atRiskLeads.map(l => (
                    <div key={l.id} className="flex items-center gap-2.5 py-2 border-b last:border-0" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
                      <AlertTriangle size={14} style={{ color: "oklch(0.65 0.22 25)", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 240)" }}>{l.company}</p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Megkeresett – nincs visszajelzés</p>
                      </div>
                      <button onClick={() => navigate("/sales-ops")} className="flex-shrink-0">
                        <ChevronRight size={13} style={{ color: "oklch(0.45 0.015 240)" }} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="rounded-xl border p-4"
            style={{ background: "oklch(0.17 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <k.icon size={16} style={{ color: k.color }} />
              <TrendingUp size={12} style={{ color: "oklch(0.45 0.015 240)" }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>{k.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Activity Stream + Latest Replies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          {sectionTitle("Aktivitás")}
          {card(
            <div>
              {outbound.length === 0 && inbound.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "oklch(0.5 0.015 240)" }}>Nincs aktivitás</p>
              ) : [
                ...outbound.slice(0, 3).map(e => ({ id: `o-${e.id}`, type: "email", label: e.subject, sub: e.toName || e.to, time: e.createdAt ? new Date(e.createdAt).toLocaleDateString("hu-HU") : "–", href: "/sales-ops" })),
                ...inbound.slice(0, 2).map(e => ({ id: `i-${e.id}`, type: "inbound", label: e.subject, sub: e.fromName || e.from, time: e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("hu-HU") : "–", href: "/sales-ops" })),
              ].slice(0, 5).map(a => (
                <button key={a.id} onClick={() => navigate(a.href)} className="w-full flex items-center gap-3 py-2.5 border-b last:border-0 text-left" style={{ borderColor: "oklch(1 0 0 / 6%)" }}
                  onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                  onMouseLeave={(e: any) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.type === "email" ? "oklch(0.6 0.2 255 / 15%)" : "oklch(0.65 0.18 165 / 15%)" }}>
                    {a.type === "email" ? <Mail size={13} style={{ color: "oklch(0.6 0.2 255)" }} /> : <MessageSquare size={13} style={{ color: "oklch(0.65 0.18 165)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 240)" }}>{a.label}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{a.sub} · {a.time}</p>
                  </div>
                  <Activity size={12} style={{ color: "oklch(0.4 0.015 240)", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {sectionTitle("Legutóbbi Válaszok")}
          {card(
            <div>
              {inbound.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "oklch(0.5 0.015 240)" }}>Nincsenek beérkező válaszok</p>
              ) : inbound.slice(0, 5).map(e => (
                <button key={e.id} onClick={() => navigate("/sales-ops")} className="w-full flex items-center gap-3 py-2.5 border-b last:border-0 text-left" style={{ borderColor: "oklch(1 0 0 / 6%)" }}
                  onMouseEnter={(e2: any) => (e2.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                  onMouseLeave={(e2: any) => (e2.currentTarget.style.background = "transparent")}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.65 0.18 165 / 15%)" }}>
                    <MessageSquare size={13} style={{ color: "oklch(0.65 0.18 165)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 240)" }}>{e.fromName}</p>
                    <p className="text-xs truncate" style={{ color: "oklch(0.5 0.015 240)" }}>{e.subject}</p>
                  </div>
                  {!e.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.6 0.2 255)" }} />}
                </button>
              ))}
              <button onClick={() => navigate("/sales-ops")} className="mt-2 text-xs flex items-center gap-1 w-full justify-center" style={{ color: "oklch(0.6 0.2 255)" }}>
                Összes válasz <Eye size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
