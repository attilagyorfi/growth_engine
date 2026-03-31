/**
 * G2A Growth Engine – Language Switcher Component
 * Compact HU/EN toggle button for navbar and sidebar
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "pill" | "flag" | "compact";
  className?: string;
}

export function LanguageSwitcher({ variant = "pill", className }: LanguageSwitcherProps) {
  const { lang, setLang } = useLanguage();

  if (variant === "compact") {
    return (
      <button
        onClick={() => setLang(lang === "hu" ? "en" : "hu")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
          "border hover:opacity-80",
          className
        )}
        style={{
          background: "oklch(0.22 0.02 255)",
          borderColor: "oklch(0.3 0.03 255)",
          color: "oklch(0.75 0.015 240)",
        }}
        title={lang === "hu" ? "Switch to English" : "Váltás magyarra"}
      >
        <span className="text-sm">{lang === "hu" ? "🇭🇺" : "🇬🇧"}</span>
        <span>{lang === "hu" ? "HU" : "EN"}</span>
      </button>
    );
  }

  if (variant === "flag") {
    return (
      <div className={cn("flex items-center gap-1 p-1 rounded-lg", className)}
        style={{ background: "oklch(0.18 0.02 255)" }}>
        {(["hu", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
              lang === l ? "text-white" : "opacity-50 hover:opacity-75"
            )}
            style={lang === l ? {
              background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))",
            } : {}}
          >
            <span>{l === "hu" ? "🇭🇺" : "🇬🇧"}</span>
            <span>{l.toUpperCase()}</span>
          </button>
        ))}
      </div>
    );
  }

  // Default: pill variant
  return (
    <div className={cn("flex items-center gap-0.5 p-0.5 rounded-lg", className)}
      style={{ background: "oklch(0.18 0.02 255)", border: "1px solid oklch(0.28 0.03 255)" }}>
      {(["hu", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold transition-all",
            lang === l ? "text-white shadow-sm" : "hover:opacity-75"
          )}
          style={lang === l ? {
            background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))",
            color: "white",
          } : { color: "oklch(0.55 0.015 240)" }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
