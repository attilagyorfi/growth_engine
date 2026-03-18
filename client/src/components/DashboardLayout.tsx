/*
 * G2A Growth Engine – DashboardLayout
 * Design: "Dark Ops Dashboard"
 * Features: persistent sidebar, notification panel, profile switcher, all nav items
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Mail, FileText, BarChart3,
  Zap, ChevronRight, Bell, Share2, PenTool, Inbox, X,
  CheckCircle, AlertCircle, Info, TrendingUp, UserCircle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/contexts/DataContext";
import { useProfile } from "@/contexts/ProfileContext";

const navItems = [
  { href: "/", label: "Áttekintés", icon: LayoutDashboard },
  { href: "/leads", label: "Lead Adatbázis", icon: Users },
  { href: "/outbound", label: "Outbound Emailek", icon: Mail },
  { href: "/inbound", label: "Inbound Emailek", icon: Inbox },
  { href: "/content", label: "Tartalmak", icon: FileText },
  { href: "/content-creator", label: "Tartalomgyártó", icon: PenTool },
  { href: "/strategy", label: "Stratégia", icon: BarChart3 },
  { href: "/social-media", label: "Social Media", icon: Share2 },
  { href: "/analytics", label: "Analitika", icon: TrendingUp },
  { href: "/profile", label: "Profilok", icon: UserCircle },
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
  title: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const { notifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useData();
  const { profiles, activeProfile, setActiveProfileId } = useProfile();

  const handleNotifClick = (id: string, link?: string) => {
    markNotificationRead(id);
    if (link) { navigate(link); setShowNotifs(false); }
  };

  const handleProfileSwitch = (id: string) => {
    setActiveProfileId(id);
    setShowProfileSwitcher(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.13 0.025 255)" }}>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r" style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
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

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.45 0.015 240)" }}>Modulok</p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            return (
              <Link key={href} href={href} className={cn("nav-item", isActive && "active")}>
                <Icon size={15} />
                <span>{label}</span>
                {isActive && <ChevronRight size={13} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <div className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-xs font-semibold mb-2" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.75 0.015 240)" }}>Rendszer Státusz</p>
            {[
              { label: "Napi Outbound", active: true },
              { label: "Heti Tartalom", active: true },
              { label: "Havi Stratégia", active: true },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between mb-1 last:mb-0">
                <span className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</span>
                <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />Aktív
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b" style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}>
          <div>
            <h1 className="text-lg font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{title}</h1>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
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

            {/* Profile Switcher */}
            <div className="relative">
              <button
                onClick={() => { setShowProfileSwitcher((v) => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ background: showProfileSwitcher ? "oklch(0.6 0.2 255 / 20%)" : "oklch(0.22 0.02 255)" }}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: activeProfile.color }}>
                  {activeProfile.initials}
                </div>
                <span className="text-xs font-semibold max-w-24 truncate" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                  {activeProfile.name}
                </span>
                <ChevronDown size={12} style={{ color: "oklch(0.55 0.015 240)" }} />
              </button>

              {/* Profile Dropdown */}
              {showProfileSwitcher && (
                <div className="absolute right-0 top-11 w-64 rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.5 0.015 240)" }}>Ügyfél váltás</p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {profiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => handleProfileSwitch(profile.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                        style={{ background: activeProfile.id === profile.id ? "oklch(0.6 0.2 255 / 10%)" : "transparent" }}
                        onMouseEnter={(e) => { if (activeProfile.id !== profile.id) e.currentTarget.style.background = "oklch(1 0 0 / 4%)"; }}
                        onMouseLeave={(e) => { if (activeProfile.id !== profile.id) e.currentTarget.style.background = "transparent"; }}
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
                    <Link href="/profile" onClick={() => setShowProfileSwitcher(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full" style={{ color: "oklch(0.6 0.2 255)" }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 10%)")}
                      onMouseLeave={(e: any) => (e.currentTarget.style.background = "transparent")}
                    >
                      <UserCircle size={13} /> Profilok kezelése
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
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowProfileSwitcher(false); }} />
      )}
    </div>
  );
}
