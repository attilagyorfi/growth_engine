import { Skeleton } from './ui/skeleton';

/**
 * Quiet Authority – Full-page loading shell
 * Matches the DashboardLayout structure with QA surface tokens.
 */
export default function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--qa-bg)" }}>
      {/* Sidebar skeleton */}
      <div
        className="w-[220px] flex-shrink-0 flex flex-col p-4 gap-6 relative"
        style={{ background: "var(--qa-surface)", borderRight: "1px solid var(--qa-border)" }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-3.5 w-20" />
        </div>

        {/* Menu items */}
        <div className="flex flex-col gap-1 px-1">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" style={{ opacity: 1 - i * 0.07 }} />
          ))}
        </div>

        {/* User profile area at bottom */}
        <div className="mt-auto">
          <div
            className="flex items-center gap-2.5 p-2 rounded-lg"
            style={{ background: "var(--qa-surface2)" }}
          >
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <div
          className="h-12 flex items-center px-6 gap-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--qa-border)" }}
        >
          <Skeleton className="h-3.5 w-32" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 p-6 space-y-5">
          {/* Page title */}
          <Skeleton className="h-6 w-44 rounded-md" />

          {/* KPI cards row */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 space-y-3"
                style={{ background: "var(--qa-surface)", border: "1px solid var(--qa-border)" }}
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))}
          </div>

          {/* Main content block */}
          <div
            className="rounded-xl p-5 space-y-4"
            style={{ background: "var(--qa-surface)", border: "1px solid var(--qa-border)" }}
          >
            <Skeleton className="h-4 w-36" />
            <div className="space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
