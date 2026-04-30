/**
 * G2A Growth Engine – DashboardLayout v5.0 (Quiet Authority)
 * Design: Quiet Authority – Stripe/Mercury-inspired premium dark mode
 * Navigation: 7 primary items (public) / 9 items (super_admin)
 * Features: persistent sidebar, notification panel, own profile menu only
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart3, Layers, TrendingUp, Settings,
  Zap, ChevronRight, Bell, X, CheckCircle, AlertCircle, Info, Mail,
  ChevronDown, LogOut, Shield, Megaphone, SearchCheck, Video,
  User, KeyRound, UserCog, Crown, Sparkles, Menu, Brain, FolderOpen, Plus, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useSubscription } from "@/hooks/useSubscription";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const publicNavItems = [
  { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard },
  { href: "/intelligencia", label: "Intelligencia", icon: Brain },
  { href: "/strategia", label: "Stratégia", icon: BarChart3 },
  { href: "/tartalom-studio", label: "Tartalom Studio", icon: Layers },
  { href: "/kampanyok", label: "Kampányok", icon: Megaphone },
  { href: "/analitika", label: "Analitika", icon: TrendingUp },
  { href: "/seo", label: "SEO Audit", icon: SearchCheck },
  { href: "/video-studio", label: "Videókészítő", icon: Video },
  { href: "/beallitasok", label: "Beállítások", icon: Settings },
];

const adminNavItems = [
  { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard },
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/projektek", label: "Projektek", icon: FolderOpen },
  { href: "/intelligencia", label: "Intelligencia", icon: Brain },
  { href: "/strategia", label: "Stratégia", icon: BarChart3 },
  { href: "/tartalom-studio", label: "Tartalom Studio", icon: Layers },
  { href: "/ertekesites", label: "Értékesítés", icon: Mail },
  { href: "/kampanyok", label: "Kampányok", icon: Megaphone },
  { href: "/analitika", label: "Analitika", icon: TrendingUp },
  { href: "/seo", label: "SEO Audit", icon: SearchCheck },
  { href: "/video-studio", label: "Videókészítő", icon: Video },
  { href: "/beallitasok", label: "Beállítások", icon: Settings },
];

const notifIcons: Record<string, React.ReactNode> = {
  email_reply: <Mail size={14} />,
  approval_needed: <AlertCircle size={14} />,
  scheduled: <CheckCircle size={14} />,
  info: <Info size={14} />,
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const { data: dbNotifications = [], refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    undefined,
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const markReadMutation = trpc.notifications.markRead.useMutation({ onSuccess: () => refetchNotifs() });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({ onSuccess: () => refetchNotifs() });

  const notifications = dbNotifications.map((n) => ({
    id: n.id,
    type: (n.type === "reply_received" ? "email_reply" : n.type === "approval_ready" ? "approval_needed" : n.type === "campaign_deadline" ? "scheduled" : "info") as "email_reply" | "approval_needed" | "scheduled" | "info",
    title: n.title,
    message: n.body ?? "",
    time: n.createdAt ? new Date(n.createdAt).toLocaleDateString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
    read: n.isRead,
    link: n.actionUrl ?? undefined,
  }));
  const unreadCount = notifications.filter(n => !n.read).length;
  const markNotificationRead = (id: string) => markReadMutation.mutate({ id });
  const markAllNotificationsRead = () => markAllReadMutation.mutate();

  const { user, logout, isSuperAdmin, refetch } = useAppAuth();
  const navItems = isSuperAdmin ? adminNavItems : publicNavItems;
  const subscription = useSubscription();
  const { restartTour } = useTour();

  const updateSelf = trpc.appAuth.updateSelf.useMutation({
    onSuccess: () => { toast.success("Név frissítve!"); setEditingName(false); refetch?.(); },
    onError: (e) => toast.error(e.message),
  });

  const handleNotifClick = (id: string, link?: string) => {
    markNotificationRead(id);
    if (link) { navigate(link); setShowNotifs(false); }
  };

  const handleSaveName = () => {
    if (!newName.trim()) return;
    updateSelf.mutate({ name: newName.trim() });
  };

  const { data: aiUsageStatus } = trpc.aiUsage.status.useQuery(undefined, { staleTime: 60_000 });

  const { activeProject, projects: adminProjects, setActiveProject: setActiveProjectHook, refetch: refetchProjects } = useActiveProject();
  const createProjectMutation = trpc.projects.upsert.useMutation({
    onSuccess: (p: { id: string; name: string }) => {
      toast.success(`"${p.name}" projekt létrehozva!`);
      refetchProjects();
      setShowProjectMenu(false);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" };
  const planKey = user?.subscriptionPlan ?? "free";
  const planLabel = isSuperAdmin ? "Super Admin" : (PLAN_LABELS[planKey] ?? planKey);

  // QA-aligned plan accent colors
  const planAccentStyle: Record<string, { bg: string; text: string; border: string }> = {
    free:    { bg: "var(--qa-surface2)", text: "var(--qa-fg3)", border: "var(--qa-border)" },
    starter: { bg: "oklch(0.58 0.19 258 / 10%)", text: "var(--qa-accent)", border: "oklch(0.58 0.19 258 / 25%)" },
    pro:     { bg: "oklch(0.76 0.17 68 / 10%)", text: "var(--qa-warning)", border: "oklch(0.76 0.17 68 / 25%)" },
    agency:  { bg: "oklch(0.72 0.19 145 / 10%)", text: "var(--qa-success)", border: "oklch(0.72 0.19 145 / 25%)" },
  };
  const planStyle = isSuperAdmin
    ? { bg: "oklch(0.76 0.17 68 / 10%)", text: "var(--qa-warning)", border: "oklch(0.76 0.17 68 / 25%)" }
    : (planAccentStyle[planKey] ?? planAccentStyle.free);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--qa-bg)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex-shrink-0 flex flex-col border-r z-50 transition-transform duration-200",
          "fixed md:relative inset-y-0 left-0 w-56",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--qa-border)" }}>
          <Link href="/iranyitopult">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center transition-opacity group-hover:opacity-80"
                style={{ background: "var(--qa-accent)" }}
              >
                <Zap size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>G2A</p>
                <p className="text-xs leading-none mt-0.5" style={{ color: "var(--qa-fg4)" }}>Growth Engine</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Profile Badge */}
        <div
          className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg border"
          style={{ background: planStyle.bg, borderColor: planStyle.border }}
        >
          <p className="text-xs font-medium mb-0.5" style={{ color: "var(--qa-fg4)" }}>
            {isSuperAdmin ? "Super Admin" : "Saját profil"}
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "var(--qa-accent)" }}
            >
              {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
            </div>
            <p className="text-sm font-semibold truncate" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
              {user?.name ?? user?.email ?? "Felhasználó"}
            </p>
          </div>
        </div>

        {/* Super Admin: Project Switcher */}
        {isSuperAdmin && (
          <div className="mx-3 mb-1 relative">
            <button
              type="button"
              onClick={() => setShowProjectMenu(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors"
              style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)" }}
            >
              <FolderOpen size={13} style={{ color: "var(--qa-fg3)" }} className="flex-shrink-0" />
              <span className="text-xs font-medium truncate flex-1" style={{ color: "var(--qa-fg2)" }}>
                {activeProject ? activeProject.name : "Projekt kiválasztása"}
              </span>
              <ChevronDown size={12} style={{ color: "var(--qa-fg4)" }} />
            </button>
            {showProjectMenu && (
              <div
                className="absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-xl z-50 overflow-hidden"
                style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border-hi)" }}
              >
                {adminProjects.map((p: { id: string; name: string }) => (
                  <div key={p.id} className="flex items-center group">
                    <button
                      type="button"
                      onClick={() => { setActiveProjectHook(p.id); setShowProjectMenu(false); }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                      style={{ color: p.id === activeProject?.id ? "var(--qa-accent)" : "var(--qa-fg2)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {p.id === activeProject?.id ? <Check size={11} /> : <span className="w-[11px]" />}
                      <span className="truncate flex-1">{p.name}</span>
                    </button>
                    <button
                      type="button"
                      title="Projekt irányítópult"
                      onClick={(e) => { e.stopPropagation(); setShowProjectMenu(false); navigate(`/projektek/${p.id}`); }}
                      className="px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                      style={{ color: "var(--qa-fg3)" }}
                    >
                      <ChevronRight size={11} />
                    </button>
                  </div>
                ))}
                <div className="border-t" style={{ borderColor: "var(--qa-border)" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const name = prompt("Projekt neve:");
                      if (name?.trim()) createProjectMutation.mutate({ name: name.trim() });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                    style={{ color: "var(--qa-accent)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Plus size={11} />
                    Új projekt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href !== "/iranyitopult" && location.startsWith(href));
            return (
              <Tooltip key={href} delayDuration={400}>
                <TooltipTrigger asChild>
                  <Link href={href} className={cn("nav-item", isActive && "active")}>
                    <Icon size={15} />
                    <span>{label}</span>
                    {isActive && <ChevronRight size={12} className="ml-auto" style={{ color: "var(--qa-accent)", opacity: 0.7 }} />}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom: user info + plan badge + logout */}
        <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: "var(--qa-border)" }}>
          {isSuperAdmin && (
            <Link href="/admin/felhasznalok" className={cn("nav-item", location.startsWith("/admin") && "active")}>
              <Shield size={15} />
              <span>Felhasználók</span>
              {location.startsWith("/admin") && <ChevronRight size={12} className="ml-auto" style={{ color: "var(--qa-accent)", opacity: 0.7 }} />}
            </Link>
          )}
          <div className="px-3 py-2 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
            <p className="text-xs font-semibold truncate" style={{ color: "var(--qa-fg2)" }}>
              {user?.name ?? user?.email ?? "Felhasználó"}
            </p>
            {user?.name && (
              <p className="text-xs truncate" style={{ color: "var(--qa-fg4)" }}>{user.email}</p>
            )}
          </div>
          {/* Plan badge */}
          {!isSuperAdmin && (
            <div
              className="px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer border transition-colors"
              style={{ background: planStyle.bg, borderColor: planStyle.border }}
              onClick={() => window.location.href = '/beallitasok?tab=billing'}
              title="Csomag kezelése"
            >
              {subscription.plan === 'free'
                ? <Zap size={13} style={{ color: "var(--qa-fg3)" }} />
                : <Crown size={13} style={{ color: planStyle.text }} />
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: planStyle.text }}>
                  {subscription.plan === 'free' ? 'Ingyenes csomag' :
                   subscription.plan === 'starter' ? 'Starter' :
                   subscription.plan === 'pro' ? 'Pro' : 'Agency'}
                </p>
                {subscription.plan === 'free' && (
                  <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>Bővítés →</p>
                )}
              </div>
            </div>
          )}
          <button onClick={logout} className="nav-item w-full text-left">
            <LogOut size={15} />
            <span>Kijelentkezés</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b"
          style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Menü megnyitása"
            >
              <Menu size={16} />
            </button>
            <div>
              {title && (
                <h1 className="text-base font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }}
                className="relative w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: showNotifs ? "oklch(0.58 0.19 258 / 12%)" : "var(--qa-surface2)",
                  color: showNotifs ? "var(--qa-accent)" : "var(--qa-fg3)"
                }}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: "var(--qa-danger)", fontSize: "9px" }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {showNotifs && (
                <div
                  className="absolute right-0 top-10 w-80 rounded-xl shadow-2xl z-50 overflow-hidden"
                  style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border-hi)" }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--qa-border)" }}>
                    <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>Értesítések</p>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllNotificationsRead} className="text-xs" style={{ color: "var(--qa-accent)" }}>
                          Mind olvasott
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} style={{ color: "var(--qa-fg4)" }}><X size={14} /></button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--qa-fg4)" }}>
                        Nincsenek értesítések
                      </p>
                    ) : notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n.id, n.link)}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-b last:border-0"
                        style={{
                          borderColor: "var(--qa-border)",
                          background: n.read ? "transparent" : "oklch(0.58 0.19 258 / 5%)"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "oklch(0.58 0.19 258 / 5%)")}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "var(--qa-surface)", color: "var(--qa-fg3)" }}
                        >
                          {notifIcons[n.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-semibold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "var(--qa-accent)" }} />}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors border"
                style={{
                  background: showUserMenu ? "oklch(0.58 0.19 258 / 10%)" : "var(--qa-surface2)",
                  borderColor: showUserMenu ? "oklch(0.58 0.19 258 / 30%)" : "var(--qa-border)"
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--qa-accent)" }}
                >
                  {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold leading-none max-w-28 truncate" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
                    {user?.name ?? "Felhasználó"}
                  </p>
                  <p className="text-xs leading-none mt-0.5" style={{ color: "var(--qa-fg4)" }}>Saját fiók</p>
                </div>
                <ChevronDown size={12} style={{ color: "var(--qa-fg4)" }} />
              </button>

              {/* User Profile Dropdown */}
              {showUserMenu && (
                <div
                  className="absolute right-0 top-11 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
                  style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border-hi)" }}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--qa-border)" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ background: "var(--qa-accent)" }}
                      >
                        {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
                          {user?.name ?? "Felhasználó"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>{user?.email}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: planStyle.bg, color: planStyle.text, border: `1px solid ${planStyle.border}` }}
                          >
                            {isSuperAdmin || planKey === "pro" || planKey === "agency" ? <Crown size={9} /> : <Sparkles size={9} />}
                            {planLabel}
                          </span>
                          {aiUsageStatus && !aiUsageStatus.unlimited && (
                            <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                              {aiUsageStatus.used}/{aiUsageStatus.limit} AI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Usage bar */}
                  {aiUsageStatus && !aiUsageStatus.unlimited && !isSuperAdmin && (
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--qa-border)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>AI generálások ebben a hónapban</span>
                        <span className="text-xs font-semibold" style={{ color: aiUsageStatus.remaining === 0 ? "var(--qa-danger)" : "var(--qa-fg2)" }}>
                          {aiUsageStatus.used}/{aiUsageStatus.limit}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--qa-border)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (aiUsageStatus.used / aiUsageStatus.limit) * 100)}%`,
                            background: aiUsageStatus.remaining === 0 ? "var(--qa-danger)" : "var(--qa-accent)"
                          }}
                        />
                      </div>
                      {aiUsageStatus.remaining === 0 && (
                        <Link
                          href="/beallitasok?tab=billing"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-xs font-semibold w-full transition-opacity hover:opacity-80"
                          style={{ background: "var(--qa-accent)", color: "white" }}
                        >
                          <Crown size={11} />
                          Csomag frissítése
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Name edit */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--qa-border)" }}>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--qa-fg4)" }}>
                      <User size={11} /> Megjelenítési név
                    </p>
                    {editingName ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          className="flex-1 px-2 py-1.5 rounded-md text-xs outline-none"
                          style={{ background: "var(--qa-surface)", border: "1px solid var(--qa-accent)", color: "var(--qa-fg)" }}
                          placeholder="Teljes neved"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={updateSelf.isPending}
                          className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-80"
                          style={{ background: "var(--qa-accent)" }}
                        >
                          {updateSelf.isPending ? "..." : "Ment"}
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="px-2.5 py-1.5 rounded-md text-xs"
                          style={{ background: "var(--qa-surface)", color: "var(--qa-fg3)" }}
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNewName(user?.name ?? ""); setEditingName(true); }}
                        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors"
                        style={{ background: "var(--qa-surface)", color: "var(--qa-fg2)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--qa-border)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--qa-surface)")}
                      >
                        <UserCog size={12} />
                        {user?.name ? "Név szerkesztése" : "Név hozzáadása"}
                      </button>
                    )}
                  </div>

                  {/* Password reset */}
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--qa-border)" }}>
                    <Link
                      href="/elfelejtett-jelszo"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors w-full"
                      style={{ color: "var(--qa-fg3)" }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.background = "var(--qa-surface)")}
                      onMouseLeave={(e: any) => (e.currentTarget.style.background = "transparent")}
                    >
                      <KeyRound size={12} />
                      Jelszó visszaállítása
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="px-3 py-2">
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors w-full"
                      style={{ color: "var(--qa-danger)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.63 0.22 25 / 8%)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <LogOut size={12} />
                      Kijelentkezés
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Overlay for dropdowns */}
      {(showNotifs || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowUserMenu(false); }} />
      )}
    </div>
  );
}
