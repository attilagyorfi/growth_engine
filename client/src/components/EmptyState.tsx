import { cn } from "@/lib/utils";

/** A design_handoff brand-illusztrációi (client/public/brand/illustrations). */
export type BrandIllustration =
  | "empty-content" | "empty-results" | "empty-analytics" | "empty-calendar"
  | "coming-soon" | "all-clear" | "offline" | "error" | "ai-working" | "onboarding";

interface EmptyStateProps {
  icon?: React.ReactNode;
  /** Brand-illusztráció neve — ha megadva, az ikon-doboz helyett ezt rendereli. */
  illustration?: BrandIllustration;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for inline use inside cards */
  compact?: boolean;
}

/**
 * Quiet Authority – EmptyState v2
 * Unified empty state component used across all dashboard pages.
 * Uses QA CSS variables for consistent theming.
 */
export function EmptyState({ icon, illustration, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      {illustration ? (
        <img
          src={`/brand/illustrations/${illustration}.svg`}
          alt=""
          aria-hidden="true"
          width={compact ? 72 : 120}
          height={compact ? 72 : 120}
          className="mb-4"
          style={{ display: "block" }}
        />
      ) : icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl mb-4",
            compact ? "w-10 h-10" : "w-14 h-14"
          )}
          style={{ background: "var(--qa-surface2)", color: "var(--qa-fg4)" }}
        >
          {icon}
        </div>
      )}
      <h3
        className={cn("font-semibold mb-1", compact ? "text-sm" : "text-base")}
        style={{ fontFamily: "var(--font-heading)", color: "var(--qa-fg2)" }}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn("max-w-xs leading-relaxed", compact ? "text-xs" : "text-sm")}
          style={{ color: "var(--qa-fg4)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
