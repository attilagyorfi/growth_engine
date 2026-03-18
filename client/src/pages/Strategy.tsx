/*
 * G2A Growth Engine – Strategy Page
 * Design: "Dark Ops Dashboard"
 * Features: Clickable weekly plan items (detail modal), Active strategy detail modal
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { BarChart3, Target, Calendar, TrendingUp, ChevronRight } from "lucide-react";

type WeeklyItem = {
  week: string;
  focus: string;
  message: string;
  type: string;
  details: string;
  cta: string;
  format: string;
};

const weeklyPlan: WeeklyItem[] = [
  {
    week: "1. Hét",
    focus: "AI eszközök a napi marketing munkában",
    message: "Mutasd meg, hogyan spórol időt az AI a tartalomgyártásban",
    type: "Edukációs poszt",
    details: `Az első hét célja az edukáció: megmutatni a célközönségnek (cégvezetők, marketing döntéshozók), hogy az AI nem egy futurisztikus fogalom, hanem ma már napi szinten alkalmazható eszköz.

**Javasolt tartalom:**
- Konkrét példák: "5 feladat, amit az AI elvégez helyetted 10 perc alatt"
- Vizuális: infografika az AI marketing workflow-ról
- Hangnem: informatív, szakmai, de könnyen érthető

**Célzott platform:** LinkedIn (elsődleges), Facebook (másodlagos)

**Elvárt eredmény:** 200+ megtekintés, 15+ reakció, 3-5 komment`,
    cta: "Kérdezd meg a követőidet: 'Milyen marketing feladatot automatizálnál először?'",
    format: "Szöveges poszt + infografika",
  },
  {
    week: "2. Hét",
    focus: "Stratégiai marketing vs. taktikai marketing",
    message: "A legtöbb cég taktikázik, miközben stratégiára lenne szüksége",
    type: "Gondolatvezető poszt",
    details: `A második hét célja a gondolatvezetés: pozicionálni a G2A Marketinget mint stratégiai partnert, nem csupán kivitelezőt.

**Javasolt tartalom:**
- Szembeállítás: "Taktika = posztolás. Stratégia = rendszer."
- Konkrét példa: egy cég, amely taktikázott vs. egy, amely stratégiát épített
- Hangnem: határozott, véleményvezér, provokatív (de konstruktív)

**Célzott platform:** LinkedIn (elsődleges)

**Elvárt eredmény:** 300+ megtekintés, 20+ reakció, 5-10 komment`,
    cta: "Kérd meg a követőket: 'Ti stratégiát vagy taktikát alkalmaztok?'",
    format: "Hosszú LinkedIn szöveges poszt (thought leadership)",
  },
  {
    week: "3. Hét",
    focus: "Social media audit – 5 hiba, amit a legtöbb cég elkövet",
    message: "Konkrét hibák bemutatása és a megoldás",
    type: "Audit/Hibák poszt",
    details: `A harmadik hét célja a fájdalompontok azonosítása: megmutatni a célközönségnek, hogy ők is elkövetik ezeket a hibákat, és van rá megoldás.

**Javasolt tartalom:**
1. Hiba: Nincs következetes posztolási ritmus
2. Hiba: Csak termékposztok, nincs értékteremtő tartalom
3. Hiba: Nem mérik az eredményeket
4. Hiba: Minden platformon ugyanazt posztolják
5. Hiba: Nincs CTA (cselekvésre ösztönzés)

**Célzott platform:** LinkedIn + Facebook + Instagram (carousel)

**Elvárt eredmény:** 400+ megtekintés, 30+ reakció, 10+ komment, 5+ megosztás`,
    cta: "Ajánld fel az ingyenes auditot: 'Szeretnéd tudni, te melyik hibát követed el?'",
    format: "Carousel poszt (5 dia) + szöveges összefoglaló",
  },
  {
    week: "4. Hét",
    focus: "CTA hét – Ingyenes marketing audit ajánlat",
    message: "Foglalj időpontot egy ingyenes 30 perces marketing auditre",
    type: "Konverziós poszt",
    details: `A negyedik hét célja a konverzió: az eddig felépített bizalom és ismertség alapján konkrét cselekvésre ösztönözni.

**Javasolt tartalom:**
- Direkt ajánlat: "Ingyenes 30 perces marketing audit – korlátozott helyek"
- Szociális bizonyíték: eddigi ügyfelek eredményei (ha van)
- Sürgősség: "Ezen a héten 3 időpont elérhető"

**Célzott platform:** LinkedIn (elsődleges), Facebook (másodlagos)

**Elvárt eredmény:** 2-5 időpontfoglalás, 10+ üzenet/megkeresés`,
    cta: "Direkt CTA: 'Írj üzenetet vagy foglalj időpontot a bio linkjén keresztül'",
    format: "Rövid, ütős szöveges poszt + közvetlen CTA",
  },
];

const pillars = [
  { name: "AI a marketingben", color: "oklch(0.6 0.2 255)", active: true },
  { name: "Stratégiai gondolkodás", color: "oklch(0.65 0.18 165)", active: true },
  { name: "Social media üzleti szerepe", color: "oklch(0.6 0.2 290)", active: false },
  { name: "Audit és hibák", color: "oklch(0.75 0.18 75)", active: false },
  { name: "Cégvezetői edukáció", color: "oklch(0.65 0.22 25)", active: false },
];

export default function Strategy() {
  const [selectedWeek, setSelectedWeek] = useState<WeeklyItem | null>(null);
  const [showStrategyDetail, setShowStrategyDetail] = useState(false);

  return (
    <DashboardLayout title="Stratégia" subtitle="Aktuális havi marketingstratégia és heti bontás">
      {/* Strategy Header – clickable */}
      <button
        onClick={() => setShowStrategyDetail(true)}
        className="w-full text-left g2a-stat-card p-5 mb-5 transition-all hover:opacity-90 group"
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} style={{ color: "oklch(0.6 0.2 255)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.6 0.2 255)" }}>
                Aktív Stratégia – Kattints a részletekért
              </p>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              2026. Április – AI és Stratégiai Marketing a B2B Szektorban
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.6 0.015 240)" }}>
              Cégvezetők edukálása az AI marketing lehetőségeiről, konverzió: ingyenes audit foglalása
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)", fontFamily: "Sora, sans-serif" }}>
              Aktív
            </div>
            <ChevronRight size={16} style={{ color: "oklch(0.5 0.015 240)" }} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </button>

      <div className="grid grid-cols-3 gap-4">
        {/* Weekly Breakdown – each item clickable */}
        <div className="col-span-2 g2a-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} style={{ color: "oklch(0.6 0.2 255)" }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              Heti Bontás – Kattints a részletekért
            </h3>
          </div>
          <div className="space-y-3">
            {weeklyPlan.map((w, i) => (
              <button
                key={i}
                onClick={() => setSelectedWeek(w)}
                className="w-full text-left rounded-lg p-4 transition-all group"
                style={{
                  background: "oklch(0.22 0.02 255)",
                  border: "1px solid oklch(1 0 0 / 6%)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid oklch(0.6 0.2 255 / 30%)"; (e.currentTarget as HTMLElement).style.background = "oklch(0.23 0.025 255)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.border = "1px solid oklch(1 0 0 / 6%)"; (e.currentTarget as HTMLElement).style.background = "oklch(0.22 0.02 255)"; }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)", fontFamily: "Sora, sans-serif" }}>
                    {w.week}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{w.type}</span>
                    <ChevronRight size={13} style={{ color: "oklch(0.45 0.015 240)" }} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
                <p className="text-sm font-semibold mb-1 text-left" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                  {w.focus}
                </p>
                <p className="text-xs text-left" style={{ color: "oklch(0.55 0.015 240)" }}>
                  {w.message}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Pillars + CTA */}
        <div className="space-y-4">
          <div className="g2a-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} style={{ color: "oklch(0.65 0.18 165)" }} />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                Tartalmi Pillérek
              </h3>
            </div>
            <div className="space-y-2">
              {pillars.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{
                    background: p.active ? `${p.color.replace(")", " / 12%)")}` : "oklch(0.22 0.02 255)",
                    border: `1px solid ${p.active ? p.color.replace(")", " / 25%)") : "oklch(1 0 0 / 6%)"}`,
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.active ? p.color : "oklch(0.4 0.015 240)" }} />
                  <span className="text-xs font-medium" style={{ color: p.active ? p.color : "oklch(0.5 0.015 240)" }}>
                    {p.name}
                  </span>
                  {p.active && <span className="ml-auto text-xs" style={{ color: p.color }}>Aktív</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="g2a-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} style={{ color: "oklch(0.75 0.18 75)" }} />
              <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                CTA Stratégia
              </h3>
            </div>
            <div className="rounded-lg p-3" style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "oklch(0.8 0.15 75)", fontFamily: "Sora, sans-serif" }}>
                Ingyenes Marketing Audit
              </p>
              <p className="text-xs" style={{ color: "oklch(0.6 0.012 240)" }}>
                Foglalj időpontot egy ingyenes 30 perces marketing auditre – minden héten 1-2 hellyel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Detail Modal */}
      {selectedWeek && (
        <DetailModal
          isOpen={!!selectedWeek}
          onClose={() => setSelectedWeek(null)}
          title={`${selectedWeek.week} – ${selectedWeek.focus}`}
          subtitle={`Típus: ${selectedWeek.type} · Formátum: ${selectedWeek.format}`}
          footer={
            <button onClick={() => setSelectedWeek(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
              Bezárás
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>Fő Üzenet</p>
              <p className="text-sm font-medium" style={{ color: "oklch(0.85 0.008 240)" }}>{selectedWeek.message}</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>Részletes Terv</p>
              {selectedWeek.details.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-bold mt-3 mb-1 text-sm" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.88 0.008 240)" }}>{line.replace(/\*\*/g, "")}</p>;
                }
                if (line.match(/^\d\./)) {
                  return <p key={i} className="text-sm pl-2 mb-1" style={{ color: "oklch(0.72 0.01 240)" }}>{line}</p>;
                }
                if (line === "") return <div key={i} className="h-2" />;
                return <p key={i} className="text-sm mb-1" style={{ color: "oklch(0.72 0.01 240)" }}>{line}</p>;
              })}
            </div>
            <div className="rounded-lg p-4" style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "oklch(0.8 0.15 75)", fontFamily: "Sora, sans-serif" }}>CTA Javaslat</p>
              <p className="text-sm" style={{ color: "oklch(0.72 0.01 240)" }}>{selectedWeek.cta}</p>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Active Strategy Detail Modal */}
      <DetailModal
        isOpen={showStrategyDetail}
        onClose={() => setShowStrategyDetail(false)}
        title="2026. Április – Teljes Stratégia"
        subtitle="AI és Stratégiai Marketing a B2B Szektorban"
        footer={
          <button onClick={() => setShowStrategyDetail(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
            Bezárás
          </button>
        }
      >
        <div className="space-y-4">
          {[
            { label: "Havi Téma", value: "AI és stratégiai marketing a B2B szektorban" },
            { label: "Célközönség", value: "Cégvezetők, marketing döntéshozók, 50-1000 fős vállalatok" },
            { label: "Fő CTA", value: "Ingyenes 30 perces marketing audit foglalása" },
            { label: "Elsődleges Platform", value: "LinkedIn" },
            { label: "Másodlagos Platformok", value: "Facebook, Instagram" },
            { label: "Elvárt Eredmény", value: "5-10 audit foglalás, 50+ új LinkedIn kapcsolat" },
          ].map((f) => (
            <div key={f.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>{f.label}</p>
              <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.008 240)" }}>{f.value}</p>
            </div>
          ))}
          <div className="rounded-lg p-4" style={{ background: "oklch(0.6 0.2 255 / 8%)", border: "1px solid oklch(0.6 0.2 255 / 20%)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.75 0.18 255)", fontFamily: "Sora, sans-serif" }}>Tartalmi Pillérek (Aktív)</p>
            <div className="flex flex-wrap gap-2">
              {pillars.filter((p) => p.active).map((p) => (
                <span key={p.name} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${p.color.replace(")", " / 15%)")}`, color: p.color }}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DetailModal>
    </DashboardLayout>
  );
}
