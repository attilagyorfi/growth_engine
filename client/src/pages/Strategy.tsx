/*
 * G2A Growth Engine – Strategy Page
 * Design: "Dark Ops Dashboard"
 */

import DashboardLayout from "@/components/DashboardLayout";
import { BarChart3, Target, Calendar, TrendingUp } from "lucide-react";

const weeklyPlan = [
  {
    week: "1. Hét",
    focus: "AI eszközök a napi marketing munkában",
    message: "Mutasd meg, hogyan spórol időt az AI a tartalomgyártásban",
    type: "Edukációs poszt",
  },
  {
    week: "2. Hét",
    focus: "Stratégiai marketing vs. taktikai marketing",
    message: "A legtöbb cég taktikázik, miközben stratégiára lenne szüksége",
    type: "Gondolatvezető poszt",
  },
  {
    week: "3. Hét",
    focus: "Social media audit – 5 hiba, amit a legtöbb cég elkövet",
    message: "Konkrét hibák bemutatása és a megoldás",
    type: "Audit/Hibák poszt",
  },
  {
    week: "4. Hét",
    focus: "CTA hét – Ingyenes marketing audit ajánlat",
    message: "Foglalj időpontot egy ingyenes 30 perces marketing auditre",
    type: "Konverziós poszt",
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
  return (
    <DashboardLayout title="Stratégia" subtitle="Aktuális havi marketingstratégia és heti bontás">
      {/* Strategy Header */}
      <div className="g2a-stat-card p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} style={{ color: "oklch(0.6 0.2 255)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.6 0.2 255)" }}>
                Aktív Stratégia
              </p>
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              2026. Április – AI és Stratégiai Marketing a B2B Szektorban
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.6 0.015 240)" }}>
              Cégvezetők edukálása az AI marketing lehetőségeiről, konverzió: ingyenes audit foglalása
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)", fontFamily: "Sora, sans-serif" }}
          >
            Aktív
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Weekly Breakdown */}
        <div className="col-span-2 g2a-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={15} style={{ color: "oklch(0.6 0.2 255)" }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              Heti Bontás
            </h3>
          </div>
          <div className="space-y-3">
            {weeklyPlan.map((w, i) => (
              <div
                key={i}
                className="rounded-lg p-4"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 6%)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      background: "oklch(0.6 0.2 255 / 15%)",
                      color: "oklch(0.75 0.18 255)",
                      fontFamily: "Sora, sans-serif",
                    }}
                  >
                    {w.week}
                  </span>
                  <span className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                    {w.type}
                  </span>
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                  {w.focus}
                </p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>
                  {w.message}
                </p>
              </div>
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
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: p.active ? p.color : "oklch(0.4 0.015 240)" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: p.active ? p.color : "oklch(0.5 0.015 240)" }}
                  >
                    {p.name}
                  </span>
                  {p.active && (
                    <span className="ml-auto text-xs" style={{ color: p.color }}>
                      Aktív
                    </span>
                  )}
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
            <div
              className="rounded-lg p-3"
              style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}
            >
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
    </DashboardLayout>
  );
}
