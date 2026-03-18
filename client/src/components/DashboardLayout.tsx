/*
 * G2A Growth Engine – DashboardLayout
 * Design: "Dark Ops Dashboard" – persistent left sidebar + top bar
 * Colors: bg-background sidebar, card for content area
 */

import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  BarChart3,
  Zap,
  ChevronRight,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Áttekintés", icon: LayoutDashboard },
  { href: "/leads", label: "Lead Adatbázis", icon: Users },
  { href: "/outbound", label: "Outbound Emailek", icon: Mail },
  { href: "/content", label: "Tartalmak", icon: FileText },
  { href: "/strategy", label: "Stratégia", icon: BarChart3 },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "oklch(0.13 0.025 255)" }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col border-r"
        style={{
          background: "oklch(0.16 0.022 255)",
          borderColor: "oklch(1 0 0 / 8%)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))",
                boxShadow: "0 0 16px oklch(0.6 0.2 255 / 40%)",
              }}
            >
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                G2A
              </p>
              <p className="text-xs leading-none mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                Growth Engine
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.45 0.015 240)" }}>
            Modulok
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "nav-item",
                    isActive && "active"
                  )}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <div className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-xs font-semibold mb-2" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.75 0.015 240)" }}>
              Rendszer Státusz
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>Napi Outbound</span>
                <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Aktív
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>Heti Tartalom</span>
                <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Aktív
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>Havi Stratégia</span>
                <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Aktív
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: "oklch(0.16 0.022 255)",
            borderColor: "oklch(1 0 0 / 8%)",
          }}
        >
          <div>
            <h1 className="text-lg font-bold leading-none" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}
            >
              <Bell size={16} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: "oklch(0.65 0.22 25)" }}
              />
            </button>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{
                background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.22 280))",
                color: "white",
                fontFamily: "Sora, sans-serif",
              }}
            >
              G2
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
