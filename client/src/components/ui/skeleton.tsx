import { cn } from "@/lib/utils";

/**
 * Quiet Authority – Skeleton shimmer
 * Uses QA surface2 token for a subtle, professional loading shimmer
 * instead of the accent color which was too prominent.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md", className)}
      style={{ background: "var(--qa-surface2)" }}
      {...props}
    />
  );
}

export { Skeleton };
