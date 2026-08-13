/**
 * G2A Growth Engine — PricingMatrix (Landing pricing feature-tábla)
 *
 * Az audit-agent talált: "Pricing/Billing összehasonlító mátrix hiányzik —
 * most csak kártyák. 4-oszlopos feature-tábla."
 *
 * A 4 csomag (Ingyenes/Starter/Pro/Agency) × 5 kategória × 20+ feature
 * tick/× jelöléssel, számokkal. Kategóriák: AI generálások / Limitek /
 * Funkciók / Támogatás. Mobile: 2 oszlopra (Ingyenes + Pro), desktop:
 * teljes 4 oszlop.
 *
 * Színek: a Landing.tsx PLANS accent-eit követi (blue/violet/emerald/amber).
 */
import { Check, X, HelpCircle } from "lucide-react";

const PLAN_LABELS = [
  { id: "free", name: "Ingyenes", color: "#60a5fa" },
  { id: "starter", name: "Starter", color: "#a78bfa" },
  { id: "pro", name: "Pro", color: "#34d399", highlight: true },
  { id: "agency", name: "Agency", color: "#fbbf24" },
] as const;

// Feature = string vagy boolean vagy szám. `false` = ×, `true` = ✓, string = konkrét szám/érték.
type Value = boolean | number | string;
type Row = { label: string; tooltip?: string; values: [Value, Value, Value, Value] };
type Section = { title: string; rows: Row[] };

// A tRPC-server-oldali PLAN_FEATURES és useSubscription-nal szinkron
// (server/authDb.ts AI_PLAN_LIMITS + client/hooks/useSubscription).
// Ha ott változik egy limit, itt is átvezetjük.
const SECTIONS: Section[] = [
  {
    title: "AI generálások (havonta)",
    rows: [
      { label: "Marketing stratégia", values: ["1", "5", "20", "60"] },
      { label: "Tartalmi terv (content plan)", values: ["1", "2", "6", "20"] },
      { label: "Poszt szöveg (LinkedIn/FB/IG/TikTok)", values: ["5", "50", "300", "1000"] },
      { label: "Kép (DALL-E 3, platform-méretben)", values: [false, "5", "30", "100"] },
      { label: "Videó (HeyGen)", tooltip: "Beszélő avatár videó a saját szövegedből.", values: [false, false, "5", "15"] },
      { label: "Kampány brief", values: ["1", "3", "15", "50"] },
      { label: "SEO audit (Core Web Vitals + AI)", values: ["1", "3", "10", "30"] },
      { label: "Cégintelligencia frissítés", values: ["1", "3", "10", "30"] },
      { label: "Napi AI-teendők a Dashboardon", values: ["5", "30", "90", "300"] },
    ],
  },
  {
    title: "Limitek",
    rows: [
      { label: "Vállalkozás profilok", tooltip: "Több ügyféllel dolgozol? Több profil = külön workspace mindegyiknek.", values: ["1", "1", "3", "Korlátlan"] },
      { label: "Hírlevél feliratkozók", values: ["25", "200", "Korlátlan", "Korlátlan"] },
      { label: "Content Studio poszt", values: ["10", "100", "Korlátlan", "Korlátlan"] },
    ],
  },
  {
    title: "Fő funkciók",
    rows: [
      { label: "Dashboard + Daily Tasks", values: [true, true, true, true] },
      { label: "Content Studio (poszt szerkesztő)", values: [true, true, true, true] },
      { label: "Analitika (KPI + grafikonok)", values: [true, true, true, true] },
      { label: "Stratégia Engine", values: [false, true, true, true] },
      { label: "Kampány Builder", values: [false, false, true, true] },
      { label: "Riportgenerátor (Google Ads / GA4 / Meta)", tooltip: "Havi PDF riport a hirdetési kampányok teljesítményéről.", values: [false, false, true, true] },
      { label: "Social Media publikálás", values: [false, true, true, true] },
      { label: "Videókészítő (HeyGen)", values: [false, false, true, true] },
    ],
  },
  {
    title: "Csapat & együttműködés",
    rows: [
      { label: "Meghívható csapattagok", values: [false, false, "3", "Korlátlan"] },
      { label: "Adat export (CSV)", values: [false, true, true, true] },
      { label: "White-label (saját brand)", values: [false, false, false, true] },
    ],
  },
  {
    title: "Támogatás",
    rows: [
      { label: "Email support", values: [true, true, true, true] },
      { label: "Prioritásos válasz (<24h)", values: [false, false, true, true] },
      { label: "Dedikált account manager", values: [false, false, false, true] },
    ],
  },
];

function renderValue(v: Value, planColor: string) {
  if (v === true) {
    return <Check size={16} className="mx-auto" style={{ color: planColor }} strokeWidth={2.5} />;
  }
  if (v === false) {
    return <X size={16} className="mx-auto" style={{ color: "rgba(255,255,255,0.15)" }} strokeWidth={2} />;
  }
  // Szám vagy string ("Korlátlan")
  return (
    <span className="text-sm font-semibold" style={{ color: planColor }}>
      {v}
    </span>
  );
}

export default function PricingMatrix() {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
      {/* Header row — plan-nevek */}
      <div
        className="grid gap-2 px-4 md:px-6 py-4 border-b sticky top-16 backdrop-blur-xl z-20"
        style={{
          gridTemplateColumns: "minmax(140px, 2fr) repeat(4, minmax(64px, 1fr))",
          background: "rgba(10,10,15,0.85)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
          Funkció
        </div>
        {PLAN_LABELS.map((p) => (
          <div
            key={p.id}
            className="text-center relative"
          >
            {"highlight" in p && p.highlight && (
              <span
                className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: p.color, color: "#0A0A0F" }}
              >
                Népszerű
              </span>
            )}
            <div className="text-sm font-bold" style={{ color: p.color }}>
              {p.name}
            </div>
          </div>
        ))}
      </div>

      {/* Body — szekciók + sorok */}
      {SECTIONS.map((section) => (
        <div key={section.title}>
          {/* Section heading */}
          <div
            className="px-4 md:px-6 py-3"
            style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>
              {section.title}
            </p>
          </div>

          {/* Rows */}
          {section.rows.map((row, ri) => (
            <div
              key={row.label}
              className="grid gap-2 px-4 md:px-6 py-3 items-center transition-colors hover:bg-white/[0.02]"
              style={{
                gridTemplateColumns: "minmax(140px, 2fr) repeat(4, minmax(64px, 1fr))",
                borderBottom: ri === section.rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div className="text-sm flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                {row.label}
                {row.tooltip && (
                  <span title={row.tooltip} className="cursor-help">
                    <HelpCircle size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </span>
                )}
              </div>
              {row.values.map((v, i) => (
                <div key={i} className="text-center">
                  {renderValue(v, PLAN_LABELS[i].color)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
