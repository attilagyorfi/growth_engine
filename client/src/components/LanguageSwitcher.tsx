/**
 * G2A Growth Engine – Language Switcher (HU only)
 * Az angol interfész egyelőre nem elérhető.
 * Ez a komponens egy statikus HU badge-et jelenít meg, nem interaktív.
 */

import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "pill" | "flag" | "compact";
  className?: string;
}

export function LanguageSwitcher({ variant = "pill", className }: LanguageSwitcherProps) {
  // HU-only: no toggle available yet
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold",
          "border cursor-default select-none",
          className
        )}
        style={{
          background: "var(--qa-surface2)",
          borderColor: "var(--qa-border)",
          color: "var(--qa-fg3)",
        }}
        title="Magyar interfész"
      >
        <span className="text-sm">🇭🇺</span>
        <span>HU</span>
      </div>
    );
  }

  // Default: pill variant – static, non-interactive
  return (
    <div
      className={cn("flex items-center gap-0.5 p-0.5 rounded-lg cursor-default select-none", className)}
      style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)" }}
    >
      <div
        className="px-3 py-1 rounded-md text-xs font-semibold text-white shadow-sm"
        style={{ background: "var(--qa-accent)" }}
      >
        HU
      </div>
    </div>
  );
}
