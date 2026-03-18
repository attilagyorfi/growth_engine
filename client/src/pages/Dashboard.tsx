/*
 * G2A Growth Engine – Dashboard Overview
 * Design: "Dark Ops Dashboard"
 * Features: Live stats from DataContext, clickable activity items, scheduled tasks
 */

import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { Users, Mail, FileText, BarChart3, TrendingUp, Calendar, Inbox } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useData } from "@/contexts/DataContext";

const weeklyData = [
  { week: "H1", emails: 0, leads: 0 },
  { week: "H2", emails: 0, leads: 0 },
  { week: "H3", emails: 2, leads: 2 },
  { week: "H4", emails: 2, leads: 2 },
];

const scheduledTasks = [
  { label: "Napi Outbound Workflow", schedule: "H-P, 08:00", next: "Holnap, 08:00", active: true },
  { label: "Heti Tartalomgenerálás", schedule: "Péntek, 10:00", next: "Péntek, 10:00", active: true },
  { label: "Havi Stratégia és Elemzés", schedule: "Hónap 1., 09:00", next: "Április 1., 09:00", active: true },
];

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { leads, outbound, inbound } = useData();
  const [selectedActivity, setSelectedActivity] = useState<null | { title: string; body: string; link?: string }>(null);

  const pendingEmails = outbound.filter((e) => e.status === "draft");
  const unreadInbound = inbound.filter((e) => !e.read);

  const statCards = [
    { label: "Összes Lead", value: String(leads.length), sub: `${leads.filter(l => l.status === "new").length} új`, color: "oklch(0.6 0.2 255)", icon: Users, link: "/leads" },
    { label: "Jóváhagyásra Vár", value: String(pendingEmails.length), sub: "Email piszkozat", color: "oklch(0.75 0.18 75)", icon: Mail, link: "/outbound" },
    { label: "Inbound Válasz", value: String(unreadInbound.length), sub: `${unreadInbound.length} olvasatlan`, color: "oklch(0.65 0.18 165)", icon: Inbox, link: "/inbound" },
    { label: "Aktív Stratégia", value: "1", sub: "Április havi", color: "oklch(0.6 0.2 290)", icon: BarChart3, link: "/strategy" },
  ];

  const activities = [
    ...outbound.slice(0, 2).map((e) => ({
      id: `out_${e.id}`,
      icon: Mail,
      color: "oklch(0.6 0.2 255)",
      title: `Email piszkozat generálva`,
      desc: `${e.company ?? e.to} – ${e.subject}`,
      time: e.createdAt ? new Date(e.createdAt).toLocaleDateString("hu-HU") : "–",
      link: "/outbound",
      body: `**Cég:** ${e.company ?? "–"}\n**Kapcsolattartó:** ${e.toName ?? e.to}\n**Tárgy:** ${e.subject}\n\n${e.body}`,
    })),
    ...inbound.slice(0, 2).map((e) => ({
      id: `in_${e.id}`,
      icon: Inbox,
      color: "oklch(0.65 0.18 165)",
      title: `Válasz érkezett`,
      desc: `${e.fromName ?? e.from} (${e.company ?? "–"})`,
      time: e.receivedAt ? new Date(e.receivedAt).toLocaleDateString("hu-HU") : "–",
      link: "/inbound",
      body: `**Feladó:** ${e.fromName ?? e.from}\n**Cég:** ${e.company ?? "–"}\n**Tárgy:** ${e.subject}\n\n${e.body}`,
    })),
    ...leads.slice(0, 1).map((l) => ({
      id: `lead_${l.id}`,
      icon: Users,
      color: "oklch(0.75 0.18 75)",
      title: `Új lead azonosítva`,
      desc: `${l.company} – ${l.contact}`,
      time: l.createdAt ? new Date(l.createdAt).toLocaleDateString("hu-HU") : "–",
      link: "/leads",
      body: `**Cég:** ${l.company}\n**Kapcsolattartó:** ${l.contact}\n**Beosztás:** ${l.position ?? "–"}\n**Email:** ${l.email}\n**Iparág:** ${l.industry ?? "–"}`,
    })),
  ].slice(0, 5);

  return (
    <DashboardLayout title="Áttekintés" subtitle={`G2A Growth Engine – ${new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}`}>
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.label} onClick={() => navigate(s.link)} className="g2a-stat-card p-4 text-left hover:opacity-90 transition-opacity w-full">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color.replace(")", " / 15%)")}` }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                <TrendingUp size={13} style={{ color: "oklch(0.65 0.18 165)" }} />
              </div>
              <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
              <p className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.65 0.015 240)" }}>{s.label}</p>
              <p className="text-xs" style={{ color: s.color }}>{s.sub}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Chart */}
        <div className="col-span-2 g2a-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} style={{ color: "oklch(0.6 0.2 255)" }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Heti Aktivitás</h3>
            <p className="text-xs ml-1" style={{ color: "oklch(0.5 0.015 240)" }}>Emailek és leadek száma hetente</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="emailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.6 0.2 255)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.6 0.2 255)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 165)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 165)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fill: "oklch(0.5 0.015 240)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.5 0.015 240)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "8px", color: "oklch(0.88 0.008 240)", fontSize: "12px" }} />
              <Area type="monotone" dataKey="emails" stroke="oklch(0.6 0.2 255)" fill="url(#emailGrad)" strokeWidth={2} name="Emailek" />
              <Area type="monotone" dataKey="leads" stroke="oklch(0.65 0.18 165)" fill="url(#leadGrad)" strokeWidth={2} name="Leadek" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Scheduled Tasks */}
        <div className="g2a-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} style={{ color: "oklch(0.75 0.18 75)" }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Ütemezett Feladatok</h3>
          </div>
          <div className="space-y-3">
            {scheduledTasks.map((t) => (
              <div key={t.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{t.label}</p>
                  <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />Aktív
                  </span>
                </div>
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{t.schedule}</p>
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "oklch(0.6 0.2 255)" }}>
                  <Calendar size={10} />Következő: {t.next}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="g2a-card p-5 mt-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={15} style={{ color: "oklch(0.6 0.2 290)" }} />
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Legutóbbi Tevékenységek</h3>
        </div>
        <div className="space-y-2">
          {activities.length === 0 ? (
            <p className="text-center text-sm py-4" style={{ color: "oklch(0.5 0.015 240)" }}>Még nincs adat. Adj hozzá leadeket vagy emaileket!</p>
          ) : activities.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedActivity({ title: a.title, body: a.body, link: a.link })}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                style={{ background: "oklch(0.22 0.02 255)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.24 0.025 255)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.22 0.02 255)")}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color.replace(")", " / 15%)")}` }}>
                  <Icon size={13} style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{a.title}</p>
                  <p className="text-xs truncate" style={{ color: "oklch(0.55 0.015 240)" }}>{a.desc}</p>
                </div>
                <p className="text-xs flex-shrink-0" style={{ color: "oklch(0.45 0.015 240)" }}>{a.time}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <DetailModal isOpen={!!selectedActivity} onClose={() => setSelectedActivity(null)} title={selectedActivity.title} subtitle="Részletek"
          footer={
            <>
              <button onClick={() => setSelectedActivity(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Bezárás</button>
              {selectedActivity.link && (
                <button onClick={() => { navigate(selectedActivity.link!); setSelectedActivity(null); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 255)", color: "white" }}>
                  Ugrás az oldalra
                </button>
              )}
            </>
          }
        >
          <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
            {selectedActivity.body.split("\n").map((line, i) => {
              if (line.startsWith("**") && line.includes(":**")) {
                const [key, ...rest] = line.split(":**");
                return (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: "oklch(0.6 0.2 255)", fontFamily: "Sora, sans-serif" }}>{key.replace("**", "")}:</span>
                    <span className="text-xs" style={{ color: "oklch(0.78 0.01 240)" }}>{rest.join(":**")}</span>
                  </div>
                );
              }
              if (line === "") return <div key={i} className="h-2" />;
              return <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>;
            })}
          </div>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
