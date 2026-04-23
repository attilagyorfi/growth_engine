/**
 * G2A Growth Engine – DashboardLayout v4.0
 * Design: "Dark Ops Dashboard" (dark only)
 * Navigation: 7 primary items (public) / 9 items (super_admin)
 * Features: persistent sidebar, notification panel, own profile menu only
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart3, Layers, TrendingUp, Settings,
  Zap, ChevronRight, Bell, X, CheckCircle, AlertCircle, Info, Mail,
  ChevronDown, LogOut, Shield, Megaphone,
  User, KeyRound, UserCog, Crown, Sparkles, Menu, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppAuth } from "@/hooks/useAppAuth";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const publicNavItems = [
  { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard },
  { href: "/intelligencia", label: "Intelligencia", icon: Brain },
  { href: "/strategia", label: "Stratégia", icon: BarChart3 },
  { href: "/tartalom-studio", label: "Tartalom Studio", icon: Layers },
  { href: "/kampanyok", label: "Kampányok", icon: Megaphone },
  { href: "/analitika", label: "Analitika", icon: TrendingUp },
  { href: "/beallitasok", label: "Beállítások", icon: Settings },
];

const adminNavItems = [
  { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard },
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/intelligencia", label: "Intelligencia", icon: Brain },
  { href: "/strategia", label: "Stratégia", icon: BarChart3 },
  { href: "/tartalom-studio", label: "Tartalom Studio", icon: Layers },
  { href: "/ertekesites", label: "Értékesítés", icon: Mail },
  { href: "/kampanyok", label: "Kampányok", icon: Megaphone },
  { href: "/analitika", label: "Analitika", icon: TrendingUp },
  { href: "/beallitasok", label: "Beállítások", icon: Settings },
];

const notifIcons: Record<string, React.ReactNode> = {
  email_reply: <Mail size={14} />,
  approval_needed: <AlertCircle size={14} />,
  scheduled: <CheckCircle size={14} />,
  info: <Info size={14} />,
};

const notifColors: Record<string, string> = {
  email_reply: "oklch(0.6 0.2 255)",
  approval_needed: "oklch(0.75 0.18 75)",
  scheduled: "oklch(0.65 0.18 165)",
  info: "oklch(0.6 0.015 240)",
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

  // DB-alapú értesítések tRPC-n keresztül
  const { data: dbNotifications = [], refetch: refetchNotifs } = trpc.notifications.list.useQuery(
    undefined,
    { staleTime: 30_000, refetchInterval: 60_000 }
  );
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetchNotifs(),
  });

  // Adapter: DB AppNotification → helyi Notification shape
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

  const updateSelf = trpc.appAuth.updateSelf.useMutation({
    onSuccess: () => {
      toast.success("Név frissítve!");
      setEditingName(false);
      refetch?.();
    },
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

  const PLAN_LABELS: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    agency: "Agency",
  };
  const PLAN_COLORS: Record<string, string> = {
    free: "oklch(0.55 0.015 240)",
    starter: "oklch(0.6 0.2 255)",
    pro: "oklch(0.75 0.18 75)",
    agency: "oklch(0.65 0.18 165)",
  };
  const planKey = user?.subscriptionPlan ?? "free";
  const planLabel = isSuperAdmin ? "Super Admin" : (PLAN_LABELS[planKey] ?? planKey);
  const planColor = isSuperAdmin ? "oklch(0.75 0.18 75)" : (PLAN_COLORS[planKey] ?? PLAN_COLORS.free);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.13 0.025 255)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 flex flex-col border-r z-50 transition-transform duration-200",
          "fixed md:relative inset-y-0 left-0 w-56",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))", boxShadow: "0 0 16px oklch(0.6 0.2 255 / 40%)" }}>
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>G2A</p>
                <p className="text-xs leading-none mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>Growth Engine</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Profile Badge */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg border" style={{ background: "oklch(0.6 0.2 255 / 8%)", borderColor: "oklch(0.6 0.2 255 / 25%)" }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
            {isSuperAdmin ? "Super Admin" : "Saját profil"}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: isSuperAdmin ? "oklch(0.75 0.18 75)" : "oklch(0.6 0.2 255)" }}>
              {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
            </div>
            <p className="text-sm font-bold truncate" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              {user?.name ?? user?.email ?? "Felhasználó"}
            </p>
          </div>
        </div>

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
                    {isActive && <ChevronRight size={13} className="ml-auto opacity-60" />}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom: admin link + logout */}
        <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          {isSuperAdmin && (
            <Link href="/admin/felhasznalok" className={cn("nav-item", location.startsWith("/admin") && "active")}>
              <Shield size={15} />
              <span>Felhasználók</span>
              {location.startsWith("/admin") && <ChevronRight size={13} className="ml-auto opacity-60" />}
            </Link>
          )}
          <div className="px-3 py-2 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-xs font-semibold truncate" style={{ color: "oklch(0.88 0.008 240)" }}>
              {user?.name ?? user?.email ?? "Felhasználó"}
            </p>
            {user?.name && (
              <p className="text-xs truncate" style={{ color: "oklch(0.5 0.015 240)" }}>{user.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="nav-item w-full text-left"
          >
            <LogOut size={15} />
            <span>Kijelentkezés</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3.5 border-b" style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Menü megnyitása"
            >
              <Menu size={18} />
            </button>
            <div>
              {title && <h1 className="text-base font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{title}</h1>}
              {subtitle && <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowUserMenu(false); }}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: showNotifs ? "oklch(0.6 0.2 255 / 20%)" : "oklch(0.22 0.02 255)", color: showNotifs ? "oklch(0.75 0.18 255)" : "oklch(0.65 0.015 240)" }}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "oklch(0.65 0.22 25)", fontSize: "10px" }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {showNotifs && (
                <div className="absolute right-0 top-11 w-80 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)" }}>
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Értesítések</p>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllNotificationsRead} className="text-xs" style={{ color: "oklch(0.6 0.2 255)" }}>Mind olvasott</button>
                      )}
                      <button onClick={() => setShowNotifs(false)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={14} /></button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm" style={{ color: "oklch(0.5 0.015 240)" }}>Nincsenek értesítések</p>
                    ) : notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n.id, n.link)}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-b last:border-0"
                        style={{ borderColor: "oklch(1 0 0 / 6%)", background: n.read ? "transparent" : "oklch(0.6 0.2 255 / 5%)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "oklch(0.6 0.2 255 / 5%)")}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${notifColors[n.type].replace(")", " / 15%)")}`, color: notifColors[n.type] }}>
                          {notifIcons[n.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "oklch(0.6 0.2 255)" }} />}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: "oklch(0.42 0.015 240)" }}>{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu – same for all users (own profile only) */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu((v) => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all border"
                style={{
                  background: showUserMenu ? "oklch(0.6 0.2 255 / 15%)" : "oklch(0.22 0.02 255)",
                  borderColor: showUserMenu ? "oklch(0.6 0.2 255 / 40%)" : "oklch(1 0 0 / 8%)"
                }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: isSuperAdmin ? "oklch(0.75 0.18 75)" : "oklch(0.6 0.2 255)" }}>
                  {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold leading-none max-w-28 truncate" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                    {user?.name ?? "Felhasználó"}
                  </p>
                  <p className="text-xs leading-none mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>Saját fiók</p>
                </div>
                <ChevronDown size={12} style={{ color: "oklch(0.55 0.015 240)" }} />
              </button>

              {/* User Profile Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 top-12 w-72 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)" }}>
                  {/* Header */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: isSuperAdmin ? "linear-gradient(135deg, oklch(0.75 0.18 75), oklch(0.7 0.2 80))" : "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))" }}>
                        {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{user?.name ?? "Felhasználó"}</p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{user?.email}</p>
                        {/* Plan badge */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: `${planColor}20`, color: planColor, border: `1px solid ${planColor}40` }}>
                            {isSuperAdmin || planKey === "pro" || planKey === "agency" ? <Crown size={9} /> : <Sparkles size={9} />}
                            {planLabel}
                          </span>
                          {aiUsageStatus && !aiUsageStatus.unlimited && (
                            <span className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                              {aiUsageStatus.used}/{aiUsageStatus.limit} AI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Usage bar (for free/starter plans, not for super_admin) */}
                  {aiUsageStatus && !aiUsageStatus.unlimited && !isSuperAdmin && (
                    <div className="px-4 py-2.5 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "oklch(0.65 0.015 240)" }}>AI generálások ebben a hónapban</span>
                        <span className="text-xs font-bold" style={{ color: aiUsageStatus.remaining === 0 ? "oklch(0.65 0.18 25)" : "oklch(0.75 0.015 240)" }}>
                          {aiUsageStatus.used}/{aiUsageStatus.limit}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.25 0.02 255)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (aiUsageStatus.used / aiUsageStatus.limit) * 100)}%`,
                            background: aiUsageStatus.remaining === 0
                              ? "linear-gradient(90deg, oklch(0.65 0.18 25), oklch(0.7 0.2 30))"
                              : "linear-gradient(90deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))"
                          }}
                        />
                      </div>
                      {aiUsageStatus.remaining === 0 && (
                        <Link
                          href="/beallitasok"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold w-full transition-all"
                          style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))", color: "white" }}
                        >
                          <Crown size={11} />
                          Csomag frissítése
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Name edit */}
                  <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                      <User size={11} /> Megjelenítési név
                    </p>
                    {editingName ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                          style={{ background: "oklch(0.25 0.02 255)", border: "1px solid oklch(0.6 0.2 255 / 40%)", color: "oklch(0.92 0.008 240)" }}
                          placeholder="Teljes neved"
                          autoFocus
                        />
                        <button onClick={handleSaveName} disabled={updateSelf.isPending} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "oklch(0.6 0.2 255)" }}>
                          {updateSelf.isPending ? "..." : "Ment"}
                        </button>
                        <button onClick={() => setEditingName(false)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background: "oklch(0.28 0.02 255)", color: "oklch(0.7 0.015 240)" }}>X</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNewName(user?.name ?? ""); setEditingName(true); }}
                        className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                        style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.28 0.03 255)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.22 0.02 255)")}
                      >
                        <UserCog size={12} />
                        {user?.name ? "Név szerkesztése" : "Név hozzáadása"}
                      </button>
                    )}
                  </div>

                  {/* Password reset */}
                  <div className="px-3 py-2 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <Link
                      href="/elfelejtett-jelszo"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full"
                      style={{ color: "oklch(0.65 0.015 240)" }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.28 0.03 255)")}
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
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full"
                      style={{ color: "oklch(0.65 0.18 25)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.65 0.18 25 / 10%)")}
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
