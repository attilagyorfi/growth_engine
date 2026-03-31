/**
 * G2A Growth Engine – Onboarding Help Popup
 * Contextual help tooltips/popups shown during onboarding wizard steps
 */

import { useState } from "react";
import { HelpCircle, X, Lightbulb, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage, type TranslationKey } from "@/contexts/LanguageContext";

interface HelpPopupProps {
  helpKey: TranslationKey;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function HelpPopup({ helpKey, title, position = "bottom", className }: HelpPopupProps) {
  const [open, setOpen] = useState(false);
  const { t, lang } = useLanguage();

  const positionClasses = {
    top: "bottom-full mb-2 left-0",
    bottom: "top-full mt-2 left-0",
    left: "right-full mr-2 top-0",
    right: "left-full ml-2 top-0",
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full flex items-center justify-center transition-all hover:scale-110"
        style={{
          background: open ? "oklch(0.6 0.2 255 / 30%)" : "oklch(0.28 0.04 255)",
          color: open ? "oklch(0.75 0.18 255)" : "oklch(0.6 0.15 255)",
        }}
        title={lang === "hu" ? "Segítség" : "Help"}
      >
        <HelpCircle size={12} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Popup */}
          <div
            className={cn(
              "absolute z-50 w-72 rounded-xl p-4 shadow-2xl",
              positionClasses[position]
            )}
            style={{
              background: "oklch(0.18 0.025 255)",
              border: "1px solid oklch(0.35 0.06 255)",
              boxShadow: "0 8px 32px oklch(0 0 0 / 60%), 0 0 0 1px oklch(0.6 0.2 255 / 20%)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.7 0.18 255)" }}
                >
                  <Lightbulb size={13} />
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}
                >
                  {title ?? (lang === "hu" ? "Segítség" : "Help")}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 hover:opacity-75"
                style={{ color: "oklch(0.5 0.015 240)" }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Content */}
            <p className="text-xs leading-relaxed" style={{ color: "oklch(0.7 0.012 240)" }}>
              {t(helpKey)}
            </p>

            {/* Footer */}
            <button
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ color: "oklch(0.65 0.18 255)" }}
            >
              {lang === "hu" ? "Értettem" : "Got it"}
              <ChevronRight size={11} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Inline Banner Help ───────────────────────────────────────────────────────

interface HelpBannerProps {
  helpKey: TranslationKey;
  title?: string;
  dismissible?: boolean;
  className?: string;
}

export function HelpBanner({ helpKey, title, dismissible = true, className }: HelpBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { t, lang } = useLanguage();

  if (dismissed) return null;

  return (
    <div
      className={cn("flex items-start gap-3 rounded-xl p-3.5 mb-4", className)}
      style={{
        background: "oklch(0.6 0.2 255 / 8%)",
        border: "1px solid oklch(0.6 0.2 255 / 25%)",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.7 0.18 255)" }}
      >
        <Lightbulb size={14} />
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-xs font-semibold mb-1" style={{ color: "oklch(0.78 0.12 255)", fontFamily: "Sora, sans-serif" }}>
            {title}
          </p>
        )}
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.65 0.012 240)" }}>
          {t(helpKey)}
        </p>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 hover:opacity-75 transition-opacity"
          style={{ color: "oklch(0.5 0.015 240)" }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Step Tour Overlay ────────────────────────────────────────────────────────

interface StepTourProps {
  step: number;
  onClose: () => void;
}

const tourSteps: Record<number, { titleHu: string; titleEn: string; bodyKey: TranslationKey; tips: { hu: string; en: string }[] }> = {
  1: {
    titleHu: "Alapadatok megadása",
    titleEn: "Enter Basic Data",
    bodyKey: "help_company_name",
    tips: [
      { hu: "A weboldal elemzés gombbal az AI automatikusan kitölti az adatokat", en: "Use the website analysis button to auto-fill data with AI" },
      { hu: "Minél pontosabb az iparág, annál jobb a generált tartalom", en: "The more precise the industry, the better the generated content" },
      { hu: "A versenytársak megadása segít a megkülönböztető üzenetekben", en: "Adding competitors helps create differentiating messages" },
    ],
  },
  2: {
    titleHu: "Brand & Kommunikáció beállítása",
    titleEn: "Set up Brand & Communication",
    bodyKey: "help_tone",
    tips: [
      { hu: "A hangnem meghatározza az összes generált tartalom stílusát", en: "The tone defines the style of all generated content" },
      { hu: "Brand kulcsszavak mindig megjelennek a tartalmakban", en: "Brand keywords always appear in content" },
      { hu: "Feltölthetsz brand guide dokumentumot is az AI-nak", en: "You can also upload a brand guide document for the AI" },
    ],
  },
  3: {
    titleHu: "Működési adatok megadása",
    titleEn: "Enter Operational Data",
    bodyKey: "help_channels",
    tips: [
      { hu: "A csatornák alapján az AI optimalizálja a tartalom formátumát", en: "The AI optimizes content format based on channels" },
      { hu: "A fő cél meghatározza a stratégia prioritásait", en: "The main goal determines strategy priorities" },
      { hu: "A timeframe segít a 90 napos terv elkészítésében", en: "The timeframe helps create the 90-day plan" },
    ],
  },
  4: {
    titleHu: "A WOW Kimenet értelmezése",
    titleEn: "Understanding the WOW Output",
    bodyKey: "help_wow_output",
    tips: [
      { hu: "A Quick Wins azonnal megvalósítható lépések", en: "Quick Wins are immediately actionable steps" },
      { hu: "A Content Pillars az összes tartalom alapját képezik", en: "Content Pillars form the basis of all content" },
      { hu: "A 90 napos stratégia a Strategy menüpontban lesz elérhető", en: "The 90-day strategy will be available in the Strategy menu" },
    ],
  },
};

export function StepTour({ step, onClose }: StepTourProps) {
  const { lang } = useLanguage();
  const tour = tourSteps[step];
  if (!tour) return null;

  const title = lang === "hu" ? tour.titleHu : tour.titleEn;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: "oklch(0.16 0.025 255)",
          border: "1px solid oklch(0.35 0.06 255)",
          boxShadow: "0 24px 64px oklch(0 0 0 / 70%), 0 0 0 1px oklch(0.6 0.2 255 / 30%)",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-75 transition-opacity"
          style={{ background: "oklch(0.25 0.03 255)", color: "oklch(0.6 0.015 240)" }}
        >
          <X size={14} />
        </button>

        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
          >
            <Lightbulb size={18} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "oklch(0.6 0.15 255)" }}>
              {lang === "hu" ? `${step}. lépés útmutatója` : `Step ${step} guide`}
            </p>
            <h3 className="text-sm font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              {title}
            </h3>
          </div>
        </div>

        {/* Tips */}
        <div className="space-y-2 mb-5">
          {tour.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.7 0.18 255)" }}
              >
                {i + 1}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.68 0.012 240)" }}>
                {lang === "hu" ? tip.hu : tip.en}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
        >
          {lang === "hu" ? "Értettem, kezdjük!" : "Got it, let's go!"}
        </button>
      </div>
    </div>
  );
}
