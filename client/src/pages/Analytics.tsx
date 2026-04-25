/**
 * G2A Growth Engine – Analytics Page
 * Design: "Dark Ops Dashboard"
 * Features: real data from leads + content, empty states, recharts
 */

import DashboardLayout from "@/components/DashboardLayout";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useSubscription } from "@/hooks/useSubscription";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Mail, Users, Layers, BarChart2,
  Target, Zap, ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

// ─── Style tokens ──────────────────────────────────────────────────────────────
const cardBg = "oklch(0.18 0.022 255)";
const border = "1px solid oklch(1 0 0 / 8%)";
const textPrimary = "oklch(0.92 0.008 240)";
const textMuted = "oklch(0.55 0.015 240)";
const blue = "oklch(0.6 0.2 255)";
const green = "oklch(0.65 0.18 165)";
const amber = "oklch(0.75 0.18 75)";
const red = "oklch(0.65 0.22 25)";

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: blue,
  facebook: "oklch(0.6 0.18 240)",
  instagram: "oklch(0.65 0.2 320)",
  twitter: "oklch(0.65 0.15 200)",
  tiktok: green,
};

const STATUS_COLORS: Record<string, string> = {
  new: blue,
  contacted: amber,
  replied: green,
  meeting: "oklch(0.65 0.2 280)",
  closed_won: green,
  closed_lost: red,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "oklch(0.22 0.025 255)", border, borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
      <p style={{ color: textPrimary, fontFamily: "Sora, sans-serif", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color ?? blue, fontSize: "0.75rem" }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="g2a-stat-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color.replace(")", " / 15%)")}`, color }}>
          <Icon size={16} />
        </div>
        <TrendingUp size={14} style={{ color: green }} />
      </div>
      <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{value}</p>
      <p className="text-xs font-medium" style={{ color: textMuted }}>{label}</p>
      <p className="text-xs mt-1" style={{ color }}>{sub}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: {
  icon: any; title: string; description: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${blue.replace(")", " / 10%)")}`, color: blue }}>
        <Icon size={24} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{title}</p>
      <p className="text-xs max-w-xs" style={{ color: textMuted }}>{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg"
          style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}
        >
          {actionLabel} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

export default function Analytics() {
  const { activeProfile } = useProfile();
  const [, navigate] = useLocation();
  const subscription = useSubscription();

  const { data: leads = [], isLoading: leadsLoading } = trpc.leads.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: contentItems = [], isLoading: contentLoading } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: outboundEmails = [], isLoading: outboundLoading } = trpc.outbound.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const isLoading = leadsLoading || contentLoading || outboundLoading;
  const hasAnyData = leads.length > 0 || contentItems.length > 0;

  // ─── Derived analytics ────────────────────────────────────────────────────────

  const leadsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({
      name: status === "new" ? "Új" : status === "contacted" ? "Megkeresett" : status === "replied" ? "Válaszolt" : status === "meeting" ? "Meeting" : status === "closed_won" ? "Megnyert" : "Elveszett",
      value: count,
      color: STATUS_COLORS[status] ?? blue,
    }));
  }, [leads]);

  const contentByPlatform = useMemo(() => {
    const counts: Record<string, number> = {};
    contentItems.forEach(c => { counts[c.platform] = (counts[c.platform] ?? 0) + 1; });
    return Object.entries(counts).map(([platform, count]) => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      tartalom: count,
      color: PLATFORM_COLORS[platform] ?? blue,
    }));
  }, [contentItems]);

  const contentByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    contentItems.forEach(c => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return [
      { name: "Vázlat", value: counts["draft"] ?? 0, color: textMuted },
      { name: "Jóváhagyott", value: counts["approved"] ?? 0, color: amber },
      { name: "Ütemezett", value: counts["scheduled"] ?? 0, color: blue },
      { name: "Publikált", value: counts["published"] ?? 0, color: green },
    ].filter(s => s.value > 0);
  }, [contentItems]);

  const wonLeads = leads.filter(l => l.status === "closed_won").length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;
  const publishedContent = contentItems.filter(c => c.status === "published").length;
  const scheduledContent = contentItems.filter(c => c.status === "scheduled").length;

  // Email stats
  const sentEmails = (outboundEmails as any[]).filter(e => e.status === "sent" || e.status === "opened" || e.status === "replied").length;
  const repliedEmails = (outboundEmails as any[]).filter(e => e.status === "replied").length;
  const emailReplyRate = sentEmails > 0 ? Math.round((repliedEmails / sentEmails) * 100) : 0;

  // Monthly trend: last 6 months
  const monthlyTrend = useMemo(() => {
    const months: { month: string; leads: number; tartalom: number; emailek: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("hu-HU", { month: "short" });
      const monthStart = d.getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const leadsInMonth = leads.filter(l => {
        const t = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        return t >= monthStart && t <= monthEnd;
      }).length;
      const contentInMonth = contentItems.filter(c => {
        const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return t >= monthStart && t <= monthEnd;
      }).length;
      const emailsInMonth = (outboundEmails as any[]).filter(e => {
        const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
        return t >= monthStart && t <= monthEnd;
      }).length;
      months.push({ month: label, leads: leadsInMonth, tartalom: contentInMonth, emailek: emailsInMonth });
    }
    return months;
  }, [leads, contentItems, outboundEmails]);

  // Feature gate: Analytics requires Starter plan or above
  if (!subscription.canUseAnalytics) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <UpgradePrompt
            feature="Analytics modul"
            requiredPlan="starter"
            description="Az analytics modul Starter csomagtól érhető el. Kövesd nyomon a lead-ek, tartalmak és email kampányok teljesítményét valós idejű grafikonokkal."
          />
        </div>
      </DashboardLayout>
    );
  }

  const handleExport = () => {
    if (!subscription.canExportData) {
      toast.warning("Az export Starter csomagtól érhető el. Frissítsd az előfizetésed a Beállítások menüben.");
      return;
    }
    // Build CSV from leads
    const rows = [["Név", "Cég", "Státusz", "Email", "Létrehozva"],
      ...leads.map(l => [l.contact ?? "", l.company ?? "", l.status ?? "", l.email ?? "", new Date(l.createdAt).toLocaleDateString("hu-HU")])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "analytics-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Analitika" subtitle="Valós idejű teljesítmény áttekintő">
      <div className="p-6 space-y-6 overflow-y-auto h-full">

        {/* Free tier notice */}
        {!subscription.canExportData && (
          <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm" style={{ background: "oklch(0.6 0.2 255 / 8%)", border: "1px solid oklch(0.6 0.2 255 / 20%)" }}>
            <span style={{ color: "oklch(0.75 0.015 240)" }}>📊 Ingyenes csomag – Az analitika megtekinthető, de az export Starter csomagtól érhető el.</span>
            <button onClick={handleExport} className="ml-4 px-3 py-1 rounded-lg text-xs font-medium" style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.8 0.1 255)" }}>Exportálás 🔒</button>
          </div>
        )}
        {subscription.canExportData && (
          <div className="flex justify-end">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.8 0.1 255)", border: "1px solid oklch(0.6 0.2 255 / 30%)" }}>CSV exportálás</button>
          </div>
        )}

        {/* Stat Cards */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {[
            { icon: Users, label: "Összes lead", value: String(leads.length), sub: leads.length > 0 ? `${wonLeads} megnyert` : "Még nincs lead", color: blue },
            { icon: Target, label: "Konverzió", value: `${conversionRate}%`, sub: leads.length > 0 ? "Lead → Ügyfél" : "Nincs elég adat", color: green },
            { icon: Layers, label: "Tartalmak", value: String(contentItems.length), sub: publishedContent > 0 ? `${publishedContent} publikált` : "Még nincs tartalom", color: amber },
            { icon: Mail, label: "Küldött emailek", value: String(sentEmails), sub: sentEmails > 0 ? `${emailReplyRate}% válaszarány` : "Még nincs küldött email", color: red },
          ].map((card, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
              <StatCard icon={card.icon} label={card.label} value={card.value} sub={card.sub} color={card.color} />
            </motion.div>
          ))}
        </motion.div>

        {/* Empty state if no data at all */}
        {!isLoading && !hasAnyData && (
          <div className="rounded-2xl p-8" style={{ background: cardBg, border }}>
            <EmptyState
              icon={BarChart2}
              title="Még nincs elegendő adat az analitikához"
              description="Adj hozzá leadeket az Értékesítés menüpontban, és hozz létre tartalmakat a Tartalom Stúdióban, hogy itt megjelenjenek a teljesítmény adatok."
              actionLabel="Tartalom létrehozása"
              onAction={() => navigate("/tartalom-studio")}
            />
          </div>
        )}

        {/* Lead Analytics */}
        {(isLoading || leads.length > 0) && (
          <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
                <Users size={15} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>Lead Tölcsér</p>
                <p className="text-xs" style={{ color: textMuted }}>Leadek státusz szerint</p>
              </div>
            </div>

            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: blue, borderTopColor: "transparent" }} />
              </div>
            ) : leads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Még nincs lead"
                description="Adj hozzá leadeket az Értékesítés menüpontban, hogy itt megjelenjenek a konverziós adatok."
                actionLabel="Lead hozzáadása"
                onAction={() => navigate("/ertekesites")}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leadsByStatus} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Leadek" radius={[4, 4, 0, 0]}>
                        {leadsByStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {leadsByStatus.map(item => (
                    <div key={item.name} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-xs font-medium" style={{ color: textPrimary }}>{item.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg mt-2" style={{ background: `${green.replace(")", " / 10%)")}`, border: `1px solid ${green.replace(")", " / 20%)")}` }}>
                    <span className="text-xs font-semibold" style={{ color: green }}>Konverzió</span>
                    <span className="text-sm font-bold" style={{ color: green }}>{conversionRate}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Analytics */}
        {(isLoading || contentItems.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Platform */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${amber.replace(")", " / 15%)")}`, color: amber }}>
                  <Layers size={15} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>Tartalom platformonként</p>
                  <p className="text-xs" style={{ color: textMuted }}>Létrehozott tartalmak</p>
                </div>
              </div>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: amber, borderTopColor: "transparent" }} />
                </div>
              ) : contentByPlatform.length === 0 ? (
                <EmptyState icon={Layers} title="Nincs tartalom" description="Hozz létre tartalmakat a Tartalom Stúdióban." actionLabel="Tartalom létrehozása" onAction={() => navigate("/tartalom-studio")} />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={contentByPlatform} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                    <XAxis dataKey="platform" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="tartalom" name="Tartalom" radius={[4, 4, 0, 0]}>
                      {contentByPlatform.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By Status */}
            <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${green.replace(")", " / 15%)")}`, color: green }}>
                  <BarChart2 size={15} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>Tartalom státusza</p>
                  <p className="text-xs" style={{ color: textMuted }}>Vázlat → Publikált</p>
                </div>
              </div>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: green, borderTopColor: "transparent" }} />
                </div>
              ) : contentByStatus.length === 0 ? (
                <EmptyState icon={BarChart2} title="Nincs tartalom" description="Hozz létre és ütemezz tartalmakat." />
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  {contentByStatus.map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: textPrimary }}>{item.name}</span>
                          <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.22 0.02 255)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.round((item.value / contentItems.length) * 100)}%`, background: item.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: textMuted }}>Publikálási arány</span>
                      <span className="text-sm font-bold" style={{ color: green }}>
                        {contentItems.length > 0 ? Math.round((publishedContent / contentItems.length) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Trend Chart */}
        {(isLoading || leads.length > 0 || contentItems.length > 0 || (outboundEmails as any[]).length > 0) && (
          <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
                <TrendingUp size={15} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>Hónapos trend</p>
                <p className="text-xs" style={{ color: textMuted }}>Leadek, tartalmak és emailek az elmúlt 6 hónapban</p>
              </div>
            </div>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: blue, borderTopColor: "transparent" }} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyTrend} barSize={14} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="leads" name="Leadek" fill={blue} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="tartalom" name="Tartalom" fill={amber} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="emailek" name="Emailek" fill={red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-3">
              {[{ color: blue, label: "Leadek" }, { color: amber, label: "Tartalom" }, { color: red, label: "Emailek" }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                  <span className="text-xs" style={{ color: textMuted }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email Analytics */}
        {(isLoading || (outboundEmails as any[]).length > 0) && (
          <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${red.replace(")", " / 15%)")}`, color: red }}>
                <Mail size={15} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>Email Kampány</p>
                <p className="text-xs" style={{ color: textMuted }}>Kimenő emailek teljesítménye</p>
              </div>
            </div>
            {isLoading ? (
              <div className="h-24 flex items-center justify-center">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: red, borderTopColor: "transparent" }} />
              </div>
            ) : (outboundEmails as any[]).length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: textMuted }}>Még nincs kimenő email. Küldj emaileket az Értékesítés menüpontban.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Összes piszkozat", value: (outboundEmails as any[]).filter(e => e.status === "draft").length, color: textMuted },
                  { label: "Elküldött", value: sentEmails, color: green },
                  { label: "Válaszolt", value: repliedEmails, color: blue },
                  { label: "Válaszarány", value: `${emailReplyRate}%`, color: amber },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: "oklch(0.22 0.02 255)" }}>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                    <p className="text-xs mt-1" style={{ color: textMuted }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics hero image – shown when no data yet */}
        {!isLoading && !hasAnyData && (
          <div className="rounded-2xl overflow-hidden border" style={{ border }}>
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/analytics-hero_b702831f.png"
              alt="Analytics preview"
              className="w-full object-cover opacity-60"
            />
          </div>
        )}

        {/* CTA if no data */}
        {!isLoading && !hasAnyData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { icon: Zap, title: "Töltsd ki az onboardingot", desc: "A Company Intelligence profil az analitika alapja.", href: "/onboarding", color: blue },
              { icon: Layers, title: "Hozz létre tartalmakat", desc: "A Tartalom Stúdióban tervezett tartalmak megjelennek itt.", href: "/tartalom-studio", color: amber },
              { icon: Users, title: "Adj hozzá leadeket", desc: "Az Értékesítés menüpontban rögzített leadek konverziója itt látható.", href: "/ertekesites", color: green },
            ].map(({ icon: Icon, title, desc, href, color }) => (
              <button
                key={href}
                onClick={() => navigate(href)}
                className="text-left p-5 rounded-2xl transition-all hover:scale-[1.02]"
                style={{ background: cardBg, border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color.replace(")", " / 15%)")}`, color }}>
                  <Icon size={18} />
                </div>
                <p className="text-sm font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{title}</p>
                <p className="text-xs" style={{ color: textMuted }}>{desc}</p>
                <div className="flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color }}>
                  Megnyitás <ArrowRight size={11} />
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
