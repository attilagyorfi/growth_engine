/*
 * G2A Growth Engine – DashboardLayout v3.0
 * Design: "Dark Ops Dashboard"
 * Navigation: 7 primary items (Dashboard, Clients, Strategy, Content Studio, Sales Ops, Analytics, Settings)
 * Features: persistent sidebar, notification panel, enhanced client switcher with confirmation
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart3, Layers, TrendingUp, Settings,
  Zap, ChevronRight, Bell, X, CheckCircle, AlertCircle, Info, Mail,
  ChevronDown, ShieldAlert, LogOut, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { toast } from "sonner";

const navItems = [
  { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard },
  { href: "/ugyfelek", label: "Ügyfelek", icon: Users },
  { href: "/strategia", label: "Stratégia", icon: BarChart3 },
  { href: "/tartalom-studio", label: "Tartalom Studio", icon: Layers },
  { href: "/ertekesites", label: "Értékesítés", icon: Mail },
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
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useData();
  const { profiles, activeProfile, setActiveProfileId } = useProfile();
  const { user, logout, isSuperAdmin } = useAppAuth();

  const handleNotifClick = (id: string, link?: string) => {
    markNotificationRead(id);
    if (link) { navigate(link); setShowNotifs(false); }
  };

  const handleProfileSwitchRequest = (id: string) => {
    if (id === activeProfile.id) { setShowProfileSwitcher(false); return; }
    setPendingProfileId(id);
  };

  const confirmProfileSwitch = () => {
    if (!pendingProfileId) return;
    setActiveProfileId(pendingProfileId);
    setPendingProfileId(null);
    setShowProfileSwitcher(false);
    const newProfile = profiles.find(p => p.id === pendingProfileId);
    toast.success(`Átváltva: ${newProfile?.name}`, { description: "Minden adat az új ügyfél kontextusában jelenik meg." });
  };

  const cancelProfileSwitch = () => setPendingProfileId(null);

  const pendingProfile = pendingProfileId ? profiles.find(p => p.id === pendingProfileId) : null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.13 0.025 255)" }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))", boxShadow: "0 0 16px oklch(0.6 0.2 255 / 40%)" }}>
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>G2A</p>
              <p className="text-xs leading-none mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>Growth Engine</p>
            </div>
          </div>
        </div>

        {/* Active Client Badge */}
        <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-lg border" style={{ background: "oklch(0.6 0.2 255 / 8%)", borderColor: "oklch(0.6 0.2 255 / 25%)" }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>Aktív ügyfél</p>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: activeProfile.color }}>
              {activeProfile.initials}
            </div>
            <p className="text-sm font-bold truncate" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{activeProfile.name}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href !== "/iranyitopult" && location.startsWith(href));
            return (
              <Link key={href} href={href} className={cn("nav-item", isActive && "active")}>
                <Icon size={15} />
                <span>{label}</span>
                {isActive && <ChevronRight size={13} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user info + logout + admin */}
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
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b" style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
          <div>
            {title && <h1 className="text-base font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{title}</h1>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs((v) => !v); setShowProfileSwitcher(false); }}
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

            {/* Client Switcher */}
            <div className="relative">
              <button
                onClick={() => { setShowProfileSwitcher((v) => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all border"
                style={{
                  background: showProfileSwitcher ? "oklch(0.6 0.2 255 / 15%)" : "oklch(0.22 0.02 255)",
                  borderColor: showProfileSwitcher ? "oklch(0.6 0.2 255 / 40%)" : "oklch(1 0 0 / 8%)"
                }}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: activeProfile.color }}>
                  {activeProfile.initials}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-none max-w-28 truncate" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                    {activeProfile.name}
                  </p>
                  <p className="text-xs leading-none mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>Aktív ügyfél</p>
                </div>
                <ChevronDown size={12} style={{ color: "oklch(0.55 0.015 240)" }} />
              </button>

              {/* Client Dropdown */}
              {showProfileSwitcher && (
                <div className="absolute right-0 top-12 w-72 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.5 0.015 240)" }}>Ügyfél váltás</p>
                  </div>

                  {/* Pending confirmation */}
                  {pendingProfile && (
                    <div className="mx-3 my-2 p-3 rounded-lg border" style={{ background: "oklch(0.75 0.18 75 / 8%)", borderColor: "oklch(0.75 0.18 75 / 30%)" }}>
                      <div className="flex items-start gap-2 mb-2">
                        <ShieldAlert size={14} style={{ color: "oklch(0.75 0.18 75)", flexShrink: 0, marginTop: 1 }} />
                        <p className="text-xs" style={{ color: "oklch(0.85 0.01 240)" }}>
                          Biztosan átváltasz erre: <strong>{pendingProfile.name}</strong>? Minden következő művelet ennek az ügyfélnek a kontextusában fut.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={confirmProfileSwitch} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "oklch(0.6 0.2 255)" }}>
                          Igen, váltás
                        </button>
                        <button onClick={cancelProfileSwitch} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "oklch(0.28 0.02 255)", color: "oklch(0.7 0.015 240)" }}>
                          Mégse
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="py-1 max-h-60 overflow-y-auto">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => handleProfileSwitchRequest(profile.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                        style={{ background: activeProfile.id === profile.id ? "oklch(0.6 0.2 255 / 10%)" : pendingProfileId === profile.id ? "oklch(0.75 0.18 75 / 8%)" : "transparent" }}
                        onMouseEnter={(e) => { if (activeProfile.id !== profile.id && pendingProfileId !== profile.id) e.currentTarget.style.background = "oklch(1 0 0 / 4%)"; }}
                        onMouseLeave={(e) => { if (activeProfile.id !== profile.id && pendingProfileId !== profile.id) e.currentTarget.style.background = "transparent"; }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: profile.color }}>
                          {profile.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "oklch(0.92 0.008 240)" }}>{profile.name}</p>
                          <p className="text-xs truncate" style={{ color: "oklch(0.55 0.015 240)" }}>{profile.industry}</p>
                        </div>
                        {activeProfile.id === profile.id && (
                          <CheckCircle size={14} style={{ color: "oklch(0.65 0.18 165)", flexShrink: 0 }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <Link href="/clients/new" onClick={() => setShowProfileSwitcher(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full"
                      style={{ color: "oklch(0.6 0.2 255)" }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 10%)")}
                      onMouseLeave={(e: any) => (e.currentTarget.style.background = "transparent")}
                    >
                      + Új ügyfél hozzáadása
                    </Link>
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
      {(showNotifs || showProfileSwitcher) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowProfileSwitcher(false); setPendingProfileId(null); }} />
      )}
    </div>
  );
}
