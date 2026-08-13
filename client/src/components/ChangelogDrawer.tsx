/**
 * G2A Growth Engine — ChangelogDrawer
 *
 * Az audit-agent talált: "In-app changelog drawer — user menu-be '1 új' badge,
 * kattintva release notes drawer. Trust-építő."
 *
 * A shadcn `<Sheet>` (Radix drawer) alapján. Kategória-szín, dátum-badge,
 * opcionális "Megnézem" link. LocalStorage tárolja az "utolsó megnyitás"
 * időbélyeget — ha új entry azóta, a `hasUnread` true.
 *
 * Használat:
 *   const { open, setOpen, hasUnread, markSeen } = useChangelog();
 *   <ChangelogDrawer open={open} onOpenChange={setOpen} onOpenChange-nél markSeen() />
 */
import { useMemo } from "react";
import { Link } from "wouter";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Sparkles, Wrench, Shield, Bug, ArrowRight } from "lucide-react";
import { CHANGELOG, type ChangelogCategory } from "@/lib/changelog";

const CATEGORY_META: Record<ChangelogCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  feature:     { label: "Új funkció",  icon: <Sparkles size={12} />, color: "var(--qa-accent)",  bg: "oklch(0.6 0.2 255 / 15%)" },
  improvement: { label: "Fejlesztés",  icon: <Wrench size={12} />,   color: "var(--qa-warning)", bg: "oklch(0.76 0.17 68 / 15%)" },
  security:    { label: "Biztonság",   icon: <Shield size={12} />,   color: "var(--qa-success)", bg: "oklch(0.72 0.19 145 / 15%)" },
  fix:         { label: "Hibajavítás", icon: <Bug size={12} />,      color: "var(--qa-fg3)",     bg: "var(--qa-surface2)" },
};

// A dátum-string YYYY-MM-DD → magyar formátum (pl. "2026. augusztus 13.")
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

interface ChangelogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangelogDrawer({ open, onOpenChange }: ChangelogDrawerProps) {
  // Sort: legfrissebb elöl. A file-ban már csökkenő sorrendben van,
  // de biztos ami biztos memo + toSorted.
  const entries = useMemo(
    () => [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date)),
    []
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-0"
        style={{ background: "var(--qa-surface)" }}
      >
        <SheetHeader className="px-6 py-5 border-b" style={{ borderColor: "var(--qa-border)" }}>
          <SheetTitle style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
            Újdonságok
          </SheetTitle>
          <SheetDescription style={{ color: "var(--qa-fg3)" }}>
            A G2A Growth Engine legutóbbi fejlesztései — mit tud most, amit korábban nem.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 space-y-5">
          {entries.map((entry, i) => {
            const meta = CATEGORY_META[entry.category];
            return (
              <article
                key={entry.id}
                className="relative pl-4"
                style={{
                  borderLeft: `2px solid ${i === 0 ? meta.color : "var(--qa-border)"}`,
                }}
              >
                {/* Dot marker on the timeline */}
                <span
                  className="absolute -left-[5px] top-1 w-2 h-2 rounded-full"
                  style={{ background: i === 0 ? meta.color : "var(--qa-border-hi)" }}
                />

                {/* Category badge + date */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                    {formatDate(entry.date)}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}
                >
                  {entry.title}
                </h3>

                {/* Description */}
                <p className="text-xs leading-relaxed" style={{ color: "var(--qa-fg3)" }}>
                  {entry.description}
                </p>

                {/* Optional "Megnézem" link */}
                {entry.href && (
                  <Link
                    href={entry.href}
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ color: meta.color }}
                  >
                    Megnézem <ArrowRight size={11} />
                  </Link>
                )}
              </article>
            );
          })}

          {/* Footer — feedback CTA */}
          <div
            className="mt-6 pt-4 border-t text-center"
            style={{ borderColor: "var(--qa-border)" }}
          >
            <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
              Van egy javaslatod? Írj az{" "}
              <a
                href="mailto:info@g2amarketing.hu"
                className="hover:underline"
                style={{ color: "var(--qa-accent)" }}
              >
                info@g2amarketing.hu
              </a>{" "}
              címre.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
