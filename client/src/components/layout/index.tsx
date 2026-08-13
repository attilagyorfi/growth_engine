/**
 * G2A Growth Engine — Layout wrapper komponensek
 *
 * Az audit-agent talált: "Inline styling káosz — 431 db style={{background:}}.
 * shadcn <Card> csak 10, <Button> csak 15 oldalon → mindenki saját div-kártyát
 * csinál. 3 wrapper (PageSection, StatCard, ContentCard) → a 431 inline
 * stílus 80%-át lecseréli. Dizájn nem változik, csak DRY."
 *
 * Ez a modul a 4 leggyakrabban újraírt layout-mintát adja reusable
 * komponensként. Mind a Quiet Authority tokeneket (var(--qa-*)) használja.
 *
 * Fokozatos migráció: az új oldalak ezeket használják; a régiek átírhatók
 * PR-enként (nem egyszerre, hogy a vizuális regresszió-kockázat kicsi legyen).
 */
import { cn } from "@/lib/utils";

// ─── PageContainer ──────────────────────────────────────────────────────
// A dashboard-oldalak külső konténere: max-width + padding + függőleges tér.
// A leggyakoribb minta: `max-w-5xl mx-auto p-6 space-y-6`.
export function PageContainer({
  children, maxWidth = "5xl", className,
}: {
  children: React.ReactNode;
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
  className?: string;
}) {
  const maxWidthClass = {
    "3xl": "max-w-3xl", "4xl": "max-w-4xl", "5xl": "max-w-5xl",
    "6xl": "max-w-6xl", "7xl": "max-w-7xl",
  }[maxWidth];
  return (
    <div className={cn(maxWidthClass, "mx-auto p-6 space-y-6", className)}>
      {children}
    </div>
  );
}

// ─── PageHeader ─────────────────────────────────────────────────────────
// Az oldal-fejléc: színes ikon-badge + cím (Sora) + alcím + opcionális
// jobb-oldali akció. Ez a minta minden dashboard-oldalon újra van írva.
export function PageHeader({
  icon, title, subtitle, action, accentColor = "var(--qa-accent)",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Az ikon-badge háttér-tint alapszíne. Default: qa-accent. */
  accentColor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in oklch, ${accentColor} 15%, transparent)`, color: accentColor }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── SectionCard ────────────────────────────────────────────────────────
// A leggyakoribb konténer: `rounded-xl border p-5` + qa-surface bg + qa-border.
// Opcionális címsor (title + subtitle) a tetején.
export function SectionCard({
  title, subtitle, action, children, className, padding = "p-5",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border", padding, className)}
      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>{title}</h3>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg4)" }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────
// KPI kártya: kis címke + nagy szám + opcionális ikon és alcím.
// A Dashboard / Analytics / Reports mind ilyen kártyákkal dolgozik.
export function StatCard({
  label, value, icon, sub, accentColor = "var(--qa-accent)",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sub?: string;
  accentColor?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in oklch, ${accentColor} 15%, transparent)`, color: accentColor }}
          >
            {icon}
          </span>
        )}
        <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{label}</span>
      </div>
      <p className="text-2xl font-bold leading-none" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "var(--qa-fg4)" }}>{sub}</p>}
    </div>
  );
}
