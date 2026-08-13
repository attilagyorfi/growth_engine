/**
 * G2A Growth Engine — Notification Center (dedikált oldal)
 *
 * Az audit-agent talált: "Notification center dedikált oldal — bell dropdown
 * jó, de nincs 'összes értesítés' nézet dátumszűrővel."
 *
 * Ez az oldal teljes lista + típus-szűrő + dátum-csoportosítás (Ma / Tegnap /
 * Régebbi) + "mind olvasottnak jelöl" gomb.
 *
 * Route: /ertesitesek (AppRoute)
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Bell, CheckCheck, Mail, AlertCircle, CheckCircle, Info,
  TrendingUp, Calendar, Filter,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";

// Notification típusok — a schema mysqlEnum-ját tükrözi
type NotifType = "reply_received" | "approval_ready" | "campaign_deadline" | "strategy_update" | "new_lead" | "system";

const TYPE_META: Record<NotifType, { label: string; icon: React.ReactNode; color: string }> = {
  reply_received:    { label: "Email válasz",     icon: <Mail size={14} />,        color: "var(--qa-accent)" },
  approval_ready:    { label: "Jóváhagyás",       icon: <AlertCircle size={14} />, color: "var(--qa-warning)" },
  campaign_deadline: { label: "Kampány határidő", icon: <Calendar size={14} />,    color: "oklch(0.65 0.22 25)" },
  strategy_update:   { label: "Stratégia",        icon: <TrendingUp size={14} />,  color: "oklch(0.55 0.22 295)" },
  new_lead:          { label: "Új lead",          icon: <CheckCircle size={14} />, color: "var(--qa-success)" },
  system:            { label: "Rendszer",         icon: <Info size={14} />,        color: "var(--qa-fg3)" },
};

// Dátum-bucketek magyarul
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

export default function Notifications() {
  const utils = trpc.useUtils();
  const { data: notifs = [], isLoading, refetch } = trpc.notifications.list.useQuery(
    undefined,
    { staleTime: 30_000 }
  );
  const [typeFilter, setTypeFilter] = useState<NotifType | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => { utils.notifications.list.invalidate(); },
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      toast.success("Minden értesítés olvasottnak jelölve");
    },
  });

  // Szűrés + dátum-csoportosítás — memo-zva a re-renderelés miatt
  const groupedNotifs = useMemo(() => {
    const filtered = notifs.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (readFilter === "unread" && n.isRead) return false;
      return true;
    });
    const groups: Record<Bucket, typeof filtered> = { today: [], yesterday: [], week: [], older: [] };
    for (const n of filtered) {
      const dt = n.createdAt ? new Date(n.createdAt) : new Date();
      groups[bucketOf(dt)].push(n);
    }
    return groups;
  }, [notifs, typeFilter, readFilter]);

  const totalCount = notifs.length;
  const unreadCount = notifs.filter((n) => !n.isRead).length;
  const filteredCount = Object.values(groupedNotifs).reduce((s, g) => s + g.length, 0);

  const handleClick = (id: string, isRead: boolean, actionUrl: string | null) => {
    if (!isRead) markReadMutation.mutate({ id });
    // Az actionUrl navigáció külön — a `<Link>` a card wrapper-en teszi
  };

  // Unique típus-lista a szűrő chip-ekhez (csak azok jelennek meg amiket a user valóban kap)
  const availableTypes = useMemo(() => {
    const set = new Set<NotifType>();
    notifs.forEach((n) => set.add(n.type as NotifType));
    return Array.from(set);
  }, [notifs]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.6 0.2 255 / 15%)" }}
            >
              <Bell size={20} style={{ color: "var(--qa-accent)" }} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}
              >
                Értesítések
              </h1>
              <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
                {totalCount === 0
                  ? "Még nincs értesítésed"
                  : `${totalCount} értesítés · ${unreadCount} olvasatlan`}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllReadMutation.mutate()}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck size={14} /> Mind olvasottnak jelöl
            </Button>
          )}
        </div>

        {/* Szűrő chip-ek */}
        {totalCount > 0 && (
          <div
            className="flex items-center gap-2 flex-wrap p-3 rounded-xl border"
            style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
          >
            <Filter size={14} style={{ color: "var(--qa-fg4)" }} />
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Read/Unread */}
              <ChipButton active={readFilter === "all"} onClick={() => setReadFilter("all")}>
                Összes
              </ChipButton>
              <ChipButton
                active={readFilter === "unread"}
                onClick={() => setReadFilter("unread")}
                badge={unreadCount > 0 ? String(unreadCount) : undefined}
              >
                Olvasatlan
              </ChipButton>
              <span className="w-px h-4 mx-1" style={{ background: "var(--qa-border)" }} />
              {/* Type filter */}
              <ChipButton active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
                Minden típus
              </ChipButton>
              {availableTypes.map((t) => (
                <ChipButton
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                  iconColor={TYPE_META[t]?.color}
                >
                  {TYPE_META[t]?.label ?? t}
                </ChipButton>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : totalCount === 0 ? (
          <EmptyState
            icon={<Bell size={22} />}
            title="Még nincs értesítésed"
            description="Új értesítést kapsz, ha egy poszt jóváhagyást igényel, új lead érkezik, vagy a stratégia frissül. Az értesítések itt gyűlnek."
          />
        ) : filteredCount === 0 ? (
          <EmptyState
            icon={<Filter size={22} />}
            title="Nincs találat"
            description="A jelenlegi szűrők egyetlen értesítést sem adnak. Módosítsd a szűrőket vagy válaszd az 'Összes' opciót."
          />
        ) : (
          <div className="space-y-6">
            {(["today", "yesterday", "week", "older"] as Bucket[]).map((bucket) => {
              const items = groupedNotifs[bucket];
              if (items.length === 0) return null;
              return (
                <section key={bucket}>
                  <h2
                    className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--qa-fg4)" }}
                  >
                    {BUCKET_LABEL[bucket]} <span style={{ color: "var(--qa-fg4)" }}>({items.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((n) => {
                      const meta = TYPE_META[n.type as NotifType] ?? TYPE_META.system;
                      const inner = (
                        <div
                          className="flex items-start gap-3 p-4 rounded-xl border transition-all hover:opacity-90 cursor-pointer"
                          style={{
                            background: n.isRead ? "var(--qa-surface)" : "oklch(0.6 0.2 255 / 6%)",
                            borderColor: n.isRead ? "var(--qa-border)" : "oklch(0.6 0.2 255 / 25%)",
                          }}
                          onClick={() => handleClick(n.id, n.isRead, n.actionUrl)}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                            style={{ background: `${meta.color}22`, color: meta.color }}
                          >
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-0.5">
                              <p
                                className="text-sm font-semibold"
                                style={{ color: n.isRead ? "var(--qa-fg2)" : "var(--qa-fg)" }}
                              >
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                                  style={{ background: "var(--qa-accent)" }}
                                  aria-label="Olvasatlan"
                                />
                              )}
                            </div>
                            {n.body && (
                              <p className="text-xs leading-relaxed mb-1" style={{ color: "var(--qa-fg3)" }}>
                                {n.body}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                style={{ background: `${meta.color}18`, color: meta.color }}
                              >
                                {meta.label}
                              </span>
                              <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                                {n.createdAt
                                  ? new Date(n.createdAt).toLocaleString("hu-HU", {
                                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                      // Ha van action URL, wrap-eljük Link-be. Egyébként div.
                      return n.actionUrl
                        ? <Link key={n.id} href={n.actionUrl}>{inner as any}</Link>
                        : <div key={n.id}>{inner}</div>;
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Chip button — szűrő-toggle. Aktív állapot: qa-accent bg. Passzív: qa-surface2.
function ChipButton({
  active, onClick, children, badge, iconColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: string;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
      style={{
        background: active ? (iconColor ? `${iconColor}22` : "oklch(0.6 0.2 255 / 20%)") : "var(--qa-surface2)",
        color: active ? (iconColor ?? "var(--qa-accent)") : "var(--qa-fg3)",
      }}
    >
      {children}
      {badge && (
        <span
          className="text-[10px] font-bold px-1 py-0.5 rounded"
          style={{ background: "var(--qa-accent)", color: "white" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
