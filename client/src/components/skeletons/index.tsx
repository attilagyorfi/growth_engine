/**
 * G2A Growth Engine – Reusable Skeleton shapes
 *
 * Az audit-agent talált: "Skeleton loading szinte sehol — 28 másik oldal
 * <Loader2> spinnerrel vár → enterprise SaaS-nál kizáró tényező."
 *
 * Ez a modul 3 alap-shape-t ad, ami a leggyakoribb loading-mintákat lefedi.
 * Használat:
 *   {isPending ? <ListSkeleton rows={5} /> : <ActualList data={...} />}
 *
 * A shadcn `<Skeleton>` primitívre épül (animate-pulse + qa-surface2).
 * Egységes látvány, konzisztens ütem, minimal cognitive load.
 */
import { Skeleton } from "@/components/ui/skeleton";

/**
 * StatCardSkeleton — KPI kártya placeholder.
 * Címke fent (kis), nagy szám lent, opcionálisan alcím.
 */
export function StatCardSkeleton({ withSub = true }: { withSub?: boolean }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-20 mb-2" />
      {withSub && <Skeleton className="h-2.5 w-32" />}
    </div>
  );
}

/**
 * StatCardGridSkeleton — több StatCard rács (a Dashboard/Analytics fejléc-KPI
 * blokkjához). Alapból 4 kártya, minden méretre reszponzív.
 */
export function StatCardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * ListSkeleton — vertikális lista placeholder (avatar + két text sor).
 * Használható: AdminUsers, Projektek, hírlevél feliratkozók, kampányok lista.
 */
export function ListSkeleton({ rows = 4, showAvatar = true }: { rows?: number; showAvatar?: boolean }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl border"
          style={{
            background: "var(--qa-surface)",
            borderColor: "var(--qa-border)",
            // A későbbi sorok halványabbak — mélyülő perspektíva, cognitive
            // hint hogy a végük "elmosódik" (mint egy scroll-fade).
            opacity: 1 - i * 0.08,
          }}
        >
          {showAvatar && <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-7 w-16 rounded-md flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * TableSkeleton — táblázat-jellegű grid placeholder (fejléc + N sor × M oszlop).
 * Használható: report metrics, audit log, mindenhol ahol táblázat a fő layout.
 */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
    >
      {/* Fejléc */}
      <div
        className="grid gap-3 px-4 py-3 border-b"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          borderColor: "var(--qa-border)",
          background: "var(--qa-surface2)",
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {/* Sorok */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-3 px-4 py-3 border-b last:border-b-0"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            borderColor: "var(--qa-border)",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * CardBlockSkeleton — nagy card content placeholder (heading + 3-4 text sor).
 * Ideális egy szekció-block-hoz (Intelligencia sub-card, Strategy vázlat, stb).
 */
export function CardBlockSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
