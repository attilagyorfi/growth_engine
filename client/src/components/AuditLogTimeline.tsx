/**
 * G2A Growth Engine — AuditLogTimeline
 *
 * Az audit-agent talált: "Audit log timeline UI — most valószínűleg lista.
 * Vertical timeline + user avatar + kategória-ikon = enterprise-érzés."
 *
 * A régi flat lista helyett:
 *   - Vertikális timeline (bal oldali vonal + dot marker)
 *   - Kategória-ikon a `action` mező alapján (create/update/delete/publish/...)
 *   - User avatar (inicialék, az `userName` alapján)
 *   - Csoportosítás dátum-bucket szerint (Ma / Tegnap / Ezen a héten / Régebbi)
 *
 * A router (auditLog.list) már megvan — a security PR-ben user-ownership-tel
 * lockdown-oltuk (super_admin lát mindent, user csak a sajátját).
 */
import { useMemo } from "react";
import {
  Plus, Pencil, Trash2, LogIn, Send, Zap, Info,
  ClipboardList, User,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CardBlockSkeleton } from "@/components/skeletons";

// Kategória-inference az `action` string alapján. A router semmilyen
// enum-ot nem kényszerít, a hívók szabadon nevezik meg az akciót.
// Ezért a UI-oldalon egyszerű prefix/keyword-alapon soroljuk kategóriába.
type Category = "create" | "update" | "delete" | "publish" | "login" | "other";

const CATEGORY_META: Record<Category, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  create:  { icon: <Plus size={12} />,    color: "var(--qa-success)", bg: "oklch(0.72 0.19 145 / 15%)", label: "Létrehozás" },
  update:  { icon: <Pencil size={12} />,  color: "var(--qa-warning)", bg: "oklch(0.76 0.17 68 / 15%)",  label: "Módosítás" },
  delete:  { icon: <Trash2 size={12} />,  color: "var(--qa-danger)",  bg: "oklch(0.63 0.22 25 / 15%)",  label: "Törlés" },
  publish: { icon: <Send size={12} />,    color: "var(--qa-accent)",  bg: "var(--qa-accent-soft)",   label: "Publikálás" },
  login:   { icon: <LogIn size={12} />,   color: "oklch(0.55 0.22 295)", bg: "oklch(0.55 0.22 295 / 15%)", label: "Bejelentkezés" },
  other:   { icon: <Info size={12} />,    color: "var(--qa-fg3)",     bg: "var(--qa-surface2)",         label: "Egyéb" },
};

function categorize(action: string): Category {
  const a = action.toLowerCase();
  if (/(create|created|add|new|register)/.test(a)) return "create";
  if (/(update|edit|change|modif|rename|move|assign)/.test(a)) return "update";
  if (/(delete|remove|archive|reject|discard)/.test(a)) return "delete";
  if (/(publish|send|approve|schedule)/.test(a)) return "publish";
  if (/(login|signin|logout|auth)/.test(a)) return "login";
  return "other";
}

// Dátum-bucketek — ugyanaz a logika mint a Notifications oldalon
type Bucket = "today" | "yesterday" | "week" | "older";
const BUCKET_LABEL: Record<Bucket, string> = {
  today: "Ma", yesterday: "Tegnap", week: "Ezen a héten", older: "Régebbi",
};
function bucketOf(date: Date): Bucket {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOfWeek) return "week";
  return "older";
}

// Inicialék generálás — max 2 karakter
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Deterministic accent-szín az avatarhoz — user-neve hash → hue.
// Ugyanaz a user mindig ugyanolyan színnel jelenik meg.
function avatarColor(name: string | null | undefined): string {
  const s = name || "unknown";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `oklch(0.55 0.15 ${hue})`;
}

// A router return-jenek egyszerű tipusa (a schema-t nem importáljuk itt hogy
// a komponens standalone maradhasson).
export interface AuditLogEntry {
  // A DB `id` a `auditLogs` táblán auto-incr INT. Vékonyabb type-elés
  // (number vagy string) hogy a router return-ok is passolhatók legyenek
  // castolás nélkül.
  id: number | string;
  action: string;
  objectType: string | null;
  objectTitle: string | null;
  userName: string | null;
  createdAt: Date | string | null;
}

interface AuditLogTimelineProps {
  logs: AuditLogEntry[] | undefined;
  isLoading: boolean;
}

export default function AuditLogTimeline({ logs, isLoading }: AuditLogTimelineProps) {
  // Csoportosítás dátum-bucket szerint
  const grouped = useMemo(() => {
    const g: Record<Bucket, AuditLogEntry[]> = { today: [], yesterday: [], week: [], older: [] };
    (logs ?? []).forEach((log) => {
      const dt = log.createdAt ? new Date(log.createdAt) : new Date();
      g[bucketOf(dt)].push(log);
    });
    return g;
  }, [logs]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <CardBlockSkeleton lines={3} />
        <CardBlockSkeleton lines={2} />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={22} />}
        title="Nincs rögzített esemény"
        description="A rendszer automatikusan naplózza a fontosabb eseményeket: profil-módosítások, poszt-jóváhagyások, kampány-változások, bejelentkezések. Itt fognak megjelenni."
      />
    );
  }

  return (
    <div className="space-y-6">
      {(["today", "yesterday", "week", "older"] as Bucket[]).map((bucket) => {
        const items = grouped[bucket];
        if (items.length === 0) return null;
        return (
          <section key={bucket}>
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
              style={{ color: "var(--qa-fg4)" }}
            >
              {BUCKET_LABEL[bucket]} <span style={{ color: "var(--qa-fg4)" }}>({items.length})</span>
            </h3>
            {/* A timeline vonal a bal oldalon: absolute pos-elt oszlop */}
            <ol className="relative space-y-3 pl-6">
              {/* Bal oldali függőleges vonal — egy CSS pseudo helyett explicit
                  div, mert így a színt tokenre tudjuk kötni. */}
              <div
                className="absolute left-2.5 top-2 bottom-2 w-px"
                style={{ background: "var(--qa-border)" }}
                aria-hidden="true"
              />
              {items.map((log) => {
                const cat = categorize(log.action);
                const meta = CATEGORY_META[cat];
                const when = log.createdAt
                  ? new Date(log.createdAt).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <li key={log.id} className="relative">
                    {/* Dot marker a bal oldali vonalon */}
                    <span
                      className="absolute -left-[15px] top-3 w-2.5 h-2.5 rounded-full ring-4"
                      style={{
                        background: meta.color,
                        // A ring a card BG-jével egyezik (van/qa-surface),
                        // hogy a vonal ne látsszon "keresztül" a dot-on.
                        // A --tw-ring-color CSS változóra megyünk mert
                        // Tailwind arbitrary values nem támogatják a var()-t
                        // itt konzisztensen.
                        "--tw-ring-color": "var(--qa-surface)",
                      } as React.CSSProperties}
                    />

                    {/* Row content */}
                    <div
                      className="flex items-start gap-3 p-3 rounded-xl border transition-colors"
                      style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
                    >
                      {/* Category icon-badge */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: meta.bg, color: meta.color }}
                        title={meta.label}
                      >
                        {meta.icon}
                      </div>

                      {/* Middle: user avatar + action + object */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ background: avatarColor(log.userName) }}
                            title={log.userName ?? "Ismeretlen felhasználó"}
                          >
                            {log.userName ? initials(log.userName) : <User size={9} />}
                          </div>
                          <p className="text-xs font-semibold" style={{ color: "var(--qa-fg2)" }}>
                            {log.userName ?? "Rendszer"}
                          </p>
                          <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>{when}</span>
                        </div>
                        <p className="text-sm" style={{ color: "var(--qa-fg)" }}>
                          {log.action}
                          {(log.objectType || log.objectTitle) && (
                            <span style={{ color: "var(--qa-fg3)" }}>
                              {" "}
                              — {log.objectType}
                              {log.objectTitle && `: `}
                              {log.objectTitle && (
                                <span style={{ color: "var(--qa-fg2)", fontWeight: 500 }}>
                                  {log.objectTitle}
                                </span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
