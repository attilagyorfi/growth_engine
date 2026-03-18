/*
 * G2A Growth Engine – Dashboard Overview Page
 * Design: "Dark Ops Dashboard"
 * All activity items are clickable and open a detail modal.
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { Mail, Users, FileText, TrendingUp, Clock, CheckCircle, ArrowUpRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const kpiData = [
  { label: "Összes Lead", value: "2", change: "+2 ma", icon: Users, color: "oklch(0.6 0.2 255)", bg: "oklch(0.6 0.2 255 / 12%)" },
  { label: "Jóváhagyásra Vár", value: "2", change: "Email piszkozat", icon: Mail, color: "oklch(0.75 0.18 75)", bg: "oklch(0.75 0.18 75 / 12%)" },
  { label: "Tartalmak (Heti)", value: "1", change: "Csomag elkészült", icon: FileText, color: "oklch(0.65 0.18 165)", bg: "oklch(0.65 0.18 165 / 12%)" },
  { label: "Aktív Stratégia", value: "1", change: "Április havi", icon: TrendingUp, color: "oklch(0.6 0.2 290)", bg: "oklch(0.6 0.2 290 / 12%)" },
];

const chartData = [
  { name: "H1", emailek: 0, leadek: 0 },
  { name: "H2", emailek: 0, leadek: 0 },
  { name: "H3", emailek: 2, leadek: 2 },
  { name: "H4", emailek: 0, leadek: 0 },
];

const scheduledTasks = [
  { name: "Napi Outbound Workflow", schedule: "H-P, 08:00", next: "Holnap, 08:00" },
  { name: "Heti Tartalomgenerálás", schedule: "Péntek, 10:00", next: "Péntek, 10:00" },
  { name: "Havi Stratégia és Elemzés", schedule: "Hónap 1., 09:00", next: "Április 1., 09:00" },
];

const recentActivity = [
  {
    time: "Ma, 08:12",
    action: "Email piszkozat generálva",
    detail: "TechVision Kft. – Jóváhagyásra vár",
    type: "email",
    modalTitle: "Email Piszkozat – TechVision Kft.",
    modalContent: `**Döntéshozó:** Kovács Péter (CEO)\n**Email:** kovacs.peter@techvision.hu\n\n**Tárgy:** Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért\n\n**Szöveg:**\n\nKovács Úr,\n\nA TechVision dinamikus bővülése az IT szolgáltatások terén figyelemre méltó, ugyanakkor a LinkedIn jelenlétük fejlesztésével jelentősen növelhető lenne a B2B ügyfélszerzés hatékonysága.\n\nA G2A Marketing AI-alapú tartalomoptimalizálással és célzott social media stratégiával támogatja, hogy a TechVision erőteljesebb márkaismertséget építsen és releváns vállalati döntéshozókhoz jusson el.\n\nSzívesen megosztanék néhány konkrét javaslatot egy rövid, informális beszélgetés során.\n\nÜdvözlettel,\nG2A Marketing`,
  },
  {
    time: "Ma, 08:14",
    action: "Email piszkozat generálva",
    detail: "Nexus Solutions Zrt. – Jóváhagyásra vár",
    type: "email",
    modalTitle: "Email Piszkozat – Nexus Solutions Zrt.",
    modalContent: `**Döntéshozó:** Nagy Andrea (Marketing Director)\n**Email:** nagy.andrea@nexussolutions.hu\n\n**Tárgy:** Friss tartalom és AI-alapú social media a Nexus Solutions számára\n\n**Szöveg:**\n\nKedves Andrea,\n\nÉszrevettem, hogy a Nexus Solutions weboldalán aktív termékkommunikáció zajlik, azonban a blog és tartalommarketing terén kevés friss anyag található. Ez a terület jelentős lehetőséget rejt a szakmai hitelesség és SEO erősítésére.\n\nA G2A Marketing AI-alapú tartalomstratégia és social media kampányok segítségével támogatni tudja a Nexus Solutions-t abban, hogy hatékonyabban érje el a célpiac döntéshozóit.\n\nSzívesen beszélnék Önnel erről – lenne rá egy rövid időpontja a héten?\n\nÜdvözlettel,\nG2A Marketing`,
  },
  {
    time: "Ma, 10:05",
    action: "Heti tartalomcsomag elkészült",
    detail: "2026. március, 3. hét – LinkedIn, Facebook, Instagram",
    type: "content",
    modalTitle: "Tartalomcsomag – 2026. március 3. hét",
    modalContent: `**Heti Fókusz:** AI a marketingben – Hogyan automatizálja a G2A az üzletszerzést?\n\n**Tartalmi Pillér:** AI a marketingben\n\n**LinkedIn Poszt:**\nA legtöbb vállalat még mindig manuálisan végzi azt, amit az AI másodpercek alatt elvégez. Az outbound értékesítés, a tartalomgyártás és a kampányoptimalizálás – mind automatizálható. A G2A Marketing Growth Engine napi szinten azonosít potenciális ügyfeleket, személyre szabott emaileket generál és social media tartalmakat készít. Ez nem a jövő – ez ma elérhető.\n\n**Facebook Poszt:**\nTudtad, hogy az AI ma már képes személyre szabott üzleti emaileket írni, stratégiát alkotni és tartalmat gyártani? A G2A Marketing ezt valósítja meg ügyfeleinek naponta.\n\n**Instagram Poszt:**\nAI + Marketing = Skálázható növekedés 🚀\n#AIMarketing #B2BMarketing #GrowthEngine #G2AMarketing`,
  },
  {
    time: "Ma, 09:00",
    action: "Havi stratégia generálva",
    detail: "2026. április – Stratégia és heti bontás kész",
    type: "strategy",
    modalTitle: "Havi Stratégia – 2026. Április",
    modalContent: `**Havi Téma:** AI és stratégiai marketing a B2B szektorban\n\n**CTA Stratégia:** Ingyenes marketing audit foglalása\n\n**Heti Bontás:**\n\n**1. Hét:** AI eszközök a napi marketing munkában\n→ Mutasd meg, hogyan spórol időt az AI a tartalomgyártásban\n\n**2. Hét:** Stratégiai marketing vs. taktikai marketing\n→ A legtöbb cég taktikázik, miközben stratégiára lenne szüksége\n\n**3. Hét:** Social media audit – 5 hiba, amit a legtöbb cég elkövet\n→ Konkrét hibák bemutatása és a megoldás\n\n**4. Hét:** CTA hét – Ingyenes marketing audit ajánlat\n→ Foglalj időpontot egy ingyenes 30 perces marketing auditre`,
  },
];

const typeColors: Record<string, string> = {
  email: "oklch(0.6 0.2 255)",
  content: "oklch(0.65 0.18 165)",
  strategy: "oklch(0.6 0.2 290)",
};

function renderModalContent(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold mt-3 mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.88 0.008 240)" }}>{line.replace(/\*\*/g, "")}</p>;
    }
    if (line.includes("**")) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="text-sm mb-1" style={{ color: "oklch(0.72 0.01 240)" }}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "oklch(0.88 0.008 240)" }}>{p}</strong> : p)}
        </p>
      );
    }
    if (line.startsWith("→")) {
      return <p key={i} className="text-xs pl-3 mb-1" style={{ color: "oklch(0.6 0.015 240)" }}>{line}</p>;
    }
    if (line.startsWith("#")) {
      return <p key={i} className="text-xs mt-1" style={{ color: "oklch(0.55 0.015 240)" }}>{line}</p>;
    }
    if (line === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm mb-1" style={{ color: "oklch(0.72 0.01 240)" }}>{line}</p>;
  });
}

export default function Dashboard() {
  const [selectedActivity, setSelectedActivity] = useState<typeof recentActivity[0] | null>(null);

  return (
    <DashboardLayout
      title="Áttekintés"
      subtitle={`G2A Growth Engine – ${new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}`}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="g2a-stat-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: kpi.bg }}>
                  <Icon size={18} style={{ color: kpi.color }} />
                </div>
                <ArrowUpRight size={14} style={{ color: "oklch(0.45 0.015 240)" }} />
              </div>
              <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{kpi.value}</p>
              <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>{kpi.label}</p>
              <p className="text-xs font-medium" style={{ color: "oklch(0.75 0.15 165)" }}>{kpi.change}</p>
            </div>
          );
        })}
      </div>

      {/* Charts + Scheduled Tasks */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2 g2a-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Heti Aktivitás</h3>
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>Emailek és leadek száma hetente</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
              <XAxis dataKey="name" tick={{ fill: "oklch(0.5 0.015 240)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.5 0.015 240)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: "0.5rem", color: "oklch(0.92 0.008 240)", fontSize: "12px" }} />
              <Area type="monotone" dataKey="emailek" stroke="oklch(0.6 0.2 255)" fill="url(#emailGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="leadek" stroke="oklch(0.65 0.18 165)" fill="url(#leadGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="g2a-card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Ütemezett Feladatok</h3>
          <div className="space-y-3">
            {scheduledTasks.map((task) => (
              <div key={task.name} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "oklch(0.85 0.008 240)", fontFamily: "Sora, sans-serif" }}>{task.name}</p>
                  <CheckCircle size={13} style={{ color: "oklch(0.65 0.18 165)", flexShrink: 0, marginTop: 1 }} />
                </div>
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{task.schedule}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Clock size={10} style={{ color: "oklch(0.75 0.18 75)" }} />
                  <p className="text-xs" style={{ color: "oklch(0.7 0.12 75)" }}>{task.next}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity – clickable rows */}
      <div className="g2a-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Legutóbbi Tevékenységek</h3>
        <div className="space-y-0">
          {recentActivity.map((item, i) => (
            <button
              key={i}
              onClick={() => setSelectedActivity(item)}
              className="w-full text-left flex items-start gap-4 py-3 rounded-lg px-2 transition-colors"
              style={{ borderBottom: i < recentActivity.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: typeColors[item.type] }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "oklch(0.85 0.008 240)" }}>{item.action}</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>{item.detail}</p>
              </div>
              <p className="text-xs flex-shrink-0" style={{ color: "oklch(0.45 0.015 240)" }}>{item.time}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <DetailModal
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title={selectedActivity.modalTitle}
          subtitle={selectedActivity.time}
          footer={
            <button
              onClick={() => setSelectedActivity(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}
            >
              Bezárás
            </button>
          }
        >
          <div className="space-y-1">
            {renderModalContent(selectedActivity.modalContent)}
          </div>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
