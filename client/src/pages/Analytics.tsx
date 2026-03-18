/*
 * G2A Growth Engine – Analytics Page
 * Design: "Dark Ops Dashboard"
 * Features: email metrics, lead conversion, content performance, interactive recharts
 */

import DashboardLayout from "@/components/DashboardLayout";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, Mail, Users, MousePointer, MessageSquare, BarChart2, Target } from "lucide-react";

// ─── Mock Analytics Data ───────────────────────────────────────────────────────

const weeklyEmailData = [
  { week: "H1", kiküldött: 12, megnyitott: 7, válasz: 2 },
  { week: "H2", kiküldött: 18, megnyitott: 11, válasz: 4 },
  { week: "H3", kiküldött: 15, megnyitott: 9, válasz: 3 },
  { week: "H4", kiküldött: 22, megnyitott: 14, válasz: 6 },
  { week: "H5", kiküldött: 20, megnyitott: 13, válasz: 5 },
  { week: "H6", kiküldött: 25, megnyitott: 17, válasz: 8 },
];

const leadFunnelData = [
  { stage: "Azonosított", count: 48 },
  { stage: "Kutatott", count: 32 },
  { stage: "Email kiküldve", count: 22 },
  { stage: "Válasz érkezett", count: 8 },
  { stage: "Meeting", count: 3 },
  { stage: "Ügyfél", count: 1 },
];

const contentPlatformData = [
  { platform: "LinkedIn", bejegyzés: 12, elérés: 3400, interakció: 210 },
  { platform: "Facebook", bejegyzés: 8, elérés: 1800, interakció: 95 },
  { platform: "Instagram", bejegyzés: 10, elérés: 2200, interakció: 180 },
];

const inboundCategoryData = [
  { name: "Meeting kérés", value: 3, color: "oklch(0.65 0.18 165)" },
  { name: "Érdeklődő", value: 5, color: "oklch(0.6 0.2 255)" },
  { name: "Infókérés", value: 4, color: "oklch(0.75 0.18 75)" },
  { name: "Nem érdekli", value: 6, color: "oklch(0.65 0.22 25)" },
  { name: "Irodán kívül", value: 2, color: "oklch(0.6 0.015 240)" },
];

const monthlyTrendData = [
  { month: "Jan", leadek: 8, emailek: 45, ügyfelek: 0 },
  { month: "Feb", leadek: 14, emailek: 72, ügyfelek: 1 },
  { month: "Már", leadek: 22, emailek: 112, ügyfelek: 1 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cardBg = "oklch(0.18 0.022 255)";
const border = "1px solid oklch(1 0 0 / 8%)";
const textPrimary = "oklch(0.92 0.008 240)";
const textMuted = "oklch(0.55 0.015 240)";
const blue = "oklch(0.6 0.2 255)";
const green = "oklch(0.65 0.18 165)";
const amber = "oklch(0.75 0.18 75)";
const red = "oklch(0.65 0.22 25)";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "oklch(0.22 0.025 255)", border, borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
      <p style={{ color: textPrimary, fontFamily: "Sora, sans-serif", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color, fontSize: "0.75rem" }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

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

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{title}</p>
        <p className="text-xs" style={{ color: textMuted }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Analytics() {
  const openRate = Math.round((weeklyEmailData.reduce((s, d) => s + d.megnyitott, 0) / weeklyEmailData.reduce((s, d) => s + d.kiküldött, 0)) * 100);
  const replyRate = Math.round((weeklyEmailData.reduce((s, d) => s + d.válasz, 0) / weeklyEmailData.reduce((s, d) => s + d.kiküldött, 0)) * 100);
  const totalEmails = weeklyEmailData.reduce((s, d) => s + d.kiküldött, 0);
  const totalReplies = weeklyEmailData.reduce((s, d) => s + d.válasz, 0);

  return (
    <DashboardLayout title="Teljesítmény Analitika" subtitle="Email, lead és tartalom metrikák összesítve">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Mail} label="Összes kiküldött email" value={String(totalEmails)} sub="+25 ezen a héten" color={blue} />
        <StatCard icon={MousePointer} label="Átlagos megnyitási arány" value={`${openRate}%`} sub="Iparági átlag: 42%" color={green} />
        <StatCard icon={MessageSquare} label="Válaszarány" value={`${replyRate}%`} sub="+2% az előző hónaphoz" color={amber} />
        <StatCard icon={Users} label="Összes lead" value="48" sub="22 aktív pipeline-ban" color="oklch(0.6 0.2 290)" />
      </div>

      {/* Email Performance + Inbound Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Email Weekly Chart */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: cardBg, border }}>
          <SectionHeader icon={Mail} title="Heti Email Teljesítmény" subtitle="Kiküldött, megnyitott és megválaszolt emailek" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyEmailData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis dataKey="week" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: textMuted }} />
              <Line type="monotone" dataKey="kiküldött" stroke={blue} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="megnyitott" stroke={green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="válasz" stroke={amber} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inbound Categories Pie */}
        <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
          <SectionHeader icon={MessageSquare} title="Inbound Kategóriák" subtitle="Beérkező válaszok megoszlása" />
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={inboundCategoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {inboundCategoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: "oklch(0.22 0.025 255)", border, borderRadius: "0.5rem", fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {inboundCategoryData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs" style={{ color: textMuted }}>{d.name}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: textPrimary }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Funnel + Content Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Lead Funnel */}
        <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
          <SectionHeader icon={Target} title="Lead Tölcsér" subtitle="Azonosítástól az ügyfélig" />
          <div className="space-y-2 mt-2">
            {leadFunnelData.map((stage, i) => {
              const pct = Math.round((stage.count / leadFunnelData[0].count) * 100);
              const colors = [blue, "oklch(0.62 0.19 255)", green, amber, "oklch(0.7 0.18 290)", "oklch(0.65 0.22 25)"];
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: textMuted }}>{stage.stage}</span>
                    <span className="text-xs font-semibold" style={{ color: textPrimary }}>{stage.count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 6%)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Platform Performance */}
        <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
          <SectionHeader icon={BarChart2} title="Tartalom Platform Teljesítmény" subtitle="Elérés és interakció platformonként" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={contentPlatformData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis dataKey="platform" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: textMuted }} />
              <Bar dataKey="elérés" fill={blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="interakció" fill={green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
        <SectionHeader icon={TrendingUp} title="Havi Növekedési Trend" subtitle="Leadek, emailek és ügyfelek alakulása" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
            <XAxis dataKey="month" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "11px", color: textMuted }} />
            <Bar dataKey="leadek" fill={blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="emailek" fill={green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="ügyfelek" fill={amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardLayout>
  );
}
