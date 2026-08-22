/**
 * G2A Growth Engine – DashboardLayout v5.0 (Quiet Authority)
 * Design: Quiet Authority – Stripe/Mercury-inspired premium dark mode
 * Navigation: 7 primary items (public) / 9 items (super_admin)
 * Features: persistent sidebar, notification panel, own profile menu only
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import CommandPalette from "@/components/CommandPalette";
import ChangelogDrawer from "@/components/ChangelogDrawer";
import { useChangelog } from "@/hooks/useChangelog";
import {
  LayoutDashboard, Users, BarChart3, Layers, TrendingUp, Settings,
  Zap, ChevronRight, Bell, X, CheckCircle, AlertCircle, Info, Mail,
  ChevronDown, LogOut, Shield, Megaphone, SearchCheck, Video,
  User, KeyRound, UserCog, Crown, Sparkles, Menu, Brain, FolderOpen, Plus, Check, PenLine, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import GrowthEngineLogo from "@/components/GrowthEngineLogo";
import CopilotPanel from "@/components/CopilotPanel";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useSubscription } from "@/hooks/useSubscription";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// Nav item: comingSoon=true → disabled, badge "Hamarosan", nem klikkelhető.
// gate: melyik plan-tól látható ez a menüpont. "all" → mindenki, "starter+" →
// starter/pro/agency, "pro+" → pro/agency. A user kérése: "csak és kifejezetten
// azokat a menüpontokat kell, hogy lássa, amire előfizetett". A super_admin
// minden item-et lát (lásd lent: az adminNavItems-en nincs gate-szűrés).
type PlanGate = "all" | "starter+" | "pro+";
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  comingSoon?: boolean;
  /** Plan-láthatóság a sima user számára ("all" → mindenki). */
  gate?: PlanGate;
  /** Csak super_admin látja (ügynökségi / admin funkció). */
  adminOnly?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };

// UI-mockup (design_handoff_growth_engine_ui): 5 csoportos, zsargonmentes magyar
// navigáció a laikus KKV-tulajra hangolva. A super_admin mindent lát; a sima
// user a plan-gate + adminOnly szerint szűrve. A régi "Több" lenyíló megszűnt —
// a csoportosítás váltja ki (a sidebar így sem görget).
const NAV_GROUPS: NavGroup[] = [
  { label: "Napi munka", items: [
    { href: "/iranyitopult", label: "Irányítópult", icon: LayoutDashboard, gate: "all" },
    { href: "/tartalom-studio", label: "Tartalom", icon: Layers, gate: "all" },
  ]},
  { label: "Tervezés", items: [
    { href: "/strategia", label: "Stratégia", icon: BarChart3, gate: "starter+" },
    { href: "/kampanyok", label: "Kampányok", icon: Megaphone, gate: "pro+" },
    { href: "/intelligencia", label: "Cégelemzés", icon: Brain, gate: "all" },
  ]},
  { label: "Gyártás", items: [
    { href: "/ai-iro", label: "AI Író", icon: PenLine, gate: "all" },
    { href: "/video-studio", label: "Videó stúdió", icon: Video, gate: "pro+", comingSoon: true },
    { href: "/hirlevel", label: "Hírlevél", icon: Mail, adminOnly: true },
  ]},
  { label: "Mérés", items: [
    { href: "/analitika", label: "Kimutatások", icon: TrendingUp, gate: "all" },
    { href: "/riportok", label: "Riportok", icon: BarChart3, gate: "pro+" },
    { href: "/seo", label: "Weboldal check", icon: SearchCheck, gate: "all" },
  ]},
  { label: "Rendszer", items: [
    { href: "/projektek", label: "Ügyfeleim", icon: FolderOpen, adminOnly: true },
    { href: "/beallitasok", label: "Beállítások", icon: Settings, gate: "all" },
    { href: "/admin/felhasznalok", label: "Felhasználók", icon: Shield, adminOnly: true },
  ]},
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
  /** Brand oldal-háttér neve (client/public/brand/backgrounds/{name}.svg), pl. "iranyitopult". */
  background?: string;
}

export default function DashboardLayout({ children, title, subtitle, background }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  // AI Copilot panel — nyitva-állapot localStorage-ban marad (handoff).
  const [copilotOpen, setCopilotOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("g2a_copilot_open") === "true";
  });
  const toggleCopilot = () => setCopilotOpen((v) => {
    const next = !v;
    try { localStorage.setItem("g2a_copilot_open", String(next)); } catch { /* ignore */ }
    return next;
  });
  const { activeProfile } = useProfile();
  const changelog = useChangelog();

  // Globális ⌘K / Ctrl+K keyboard shortcut a parancspalettához.
  // A meta/ctrl+k IDE/browser search-t is triggerelheti (különösen
  // Firefox address bar), ezért preventDefault-tal blokkoljuk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdPaletteOpen(open => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
  const subscription = useSubscription();
  // Plan-alapú menü-szűrés: a sima user csak az előfizetése szerint
  // jogosult menüpontokat látja. Super_admin mindent. A canUseStrategy
  // a "starter+" gate, a canUseCampaigns a "pro+" gate vetítője — a
  // useSubscription hook már tartalmazza ezeket a flag-eket.
  // Csoportonként szűrjük az elemeket: adminOnly → csak super_admin; a sima
  // user a plan-gate szerint. Az üres csoportok kiesnek.
  const visibleGroups = NAV_GROUPS
    .map(group => ({
      label: group.label,
      items: group.items.filter(item => {
        if (item.adminOnly) return isSuperAdmin;
        if (isSuperAdmin) return true;
        if (!item.gate || item.gate === "all") return true;
        if (item.gate === "starter+") return subscription.canUseStrategy;
        if (item.gate === "pro+") return subscription.canUseCampaigns;
        return true;
      }),
    }))
    .filter(group => group.items.length > 0);

  const isNavActive = (href: string) => location === href || (href !== "/iranyitopult" && location.startsWith(href));

  const renderNavItem = ({ href, label, icon: Icon, comingSoon }: NavItem) => {
    const isActive = isNavActive(href);
    if (comingSoon) {
      return (
        <Tooltip key={href} delayDuration={400}>
          <TooltipTrigger asChild>
            <div
              className="nav-item cursor-not-allowed opacity-50 select-none"
              style={{ pointerEvents: "none" }}
              aria-disabled="true"
            >
              <Icon size={15} />
              <span>{label}</span>
              <span
                className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: "oklch(0.75 0.18 75 / 18%)", color: "oklch(0.85 0.16 75)" }}
              >
                Hamarosan
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{label} — hamarosan</TooltipContent>
        </Tooltip>
      );
    }
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
  };

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
    starter: { bg: "var(--qa-accent-soft)", text: "var(--qa-accent)", border: "var(--qa-accent-soft)" },
    pro:     { bg: "oklch(0.76 0.17 68 / 10%)", text: "var(--qa-warning)", border: "oklch(0.76 0.17 68 / 25%)" },
    agency:  { bg: "oklch(0.72 0.19 145 / 10%)", text: "var(--qa-success)", border: "oklch(0.72 0.19 145 / 25%)" },
  };
  const planStyle = isSuperAdmin
    ? { bg: "oklch(0.76 0.17 68 / 10%)", text: "var(--qa-warning)", border: "oklch(0.76 0.17 68 / 25%)" }
    : (planAccentStyle[planKey] ?? planAccentStyle.free);

  // Breadcrumb a felső sávhoz (UI-mockup): [ügyfél v. csoport] › [oldal].
  // Admin + kiválasztott projekt → ügyfélnév; egyébként az aktív menüpont
  // csoportja. Az oldalcím a title prop, vagy fallback az aktív nav-elem címke.
  const currentNav = NAV_GROUPS
    .flatMap(g => g.items.map(i => ({ label: i.label, group: g.label, href: i.href })))
    .find(i => isNavActive(i.href));
  const breadcrumbContext = isSuperAdmin && activeProject ? activeProject.name : (currentNav?.group ?? null);
  const pageLabel = title ?? currentNav?.label ?? "";

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
          "fixed md:relative inset-y-0 left-0 w-[252px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "var(--qa-bg-nav)", borderColor: "var(--qa-border)" }}
      >
        {/* Logo — a Growth Engine termék-jel (bars) + írott lockup */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--qa-border)" }}>
          <Link href="/iranyitopult">
            <div className="flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80">
              <GrowthEngineLogo size={30} />
              <div>
                <p className="font-bold leading-none" style={{ fontFamily: "var(--font-heading)", fontSize: "15px", letterSpacing: "-0.03em", color: "var(--qa-fg)" }}>Growth Engine</p>
                <p className="leading-none mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.18em", color: "var(--qa-fg4)" }}>BY G2A</p>
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
            <p className="text-sm font-semibold truncate" style={{ fontFamily: "var(--font-heading)", color: "var(--qa-fg)" }}>
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

        {/* Navigation — 5 csoportos (UI-mockup). A csoportosítás váltja ki a
            régi "Több" lenyílót; a sidebar így sem görget. */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto no-scrollbar">
          {visibleGroups.map(group => (
            <div key={group.label} className="space-y-0.5">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map(renderNavItem)}
            </div>
          ))}
        </nav>

        {/* Bottom: user info + plan badge + logout
            (a "Felhasználók" link átkerült a fenti Rendszer csoportba) */}
        <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: "var(--qa-border)" }}>
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
            <div className="min-w-0">
              {/* Breadcrumb (UI-mockup): [ügyfél v. csoport] › [oldal] */}
              <div className="flex items-center gap-1.5 leading-none">
                {breadcrumbContext && (
                  <>
                    <span className="text-xs font-medium truncate max-w-[35vw] md:max-w-[200px]" style={{ color: "var(--qa-fg4)" }}>
                      {breadcrumbContext}
                    </span>
                    <ChevronRight size={12} className="flex-shrink-0" style={{ color: "var(--qa-fg5)" }} />
                  </>
                )}
                {pageLabel && (
                  <h1 className="font-bold leading-none truncate" style={{ fontFamily: "var(--font-heading)", fontSize: "17px", letterSpacing: "-0.02em", color: "var(--qa-fg)" }}>
                    {pageLabel}
                  </h1>
                )}
              </div>
              {subtitle && (
                <p className="text-xs mt-1 truncate" style={{ color: "var(--qa-fg3)" }}>{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Kereső-mező (⌘K parancspaletta) — a felső sáv kinézete a UI-mockup szerint */}
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md text-xs transition-colors w-[200px]"
              style={{
                background: "var(--qa-inset)",
                color: "var(--qa-fg4)",
                border: "1px solid var(--qa-border)",
              }}
              aria-label="Keresés / parancspaletta (Ctrl+K)"
              title="Keresés (Ctrl+K)"
            >
              <Search size={13} className="flex-shrink-0" />
              <span className="flex-1 text-left">Keresés…</span>
              <kbd
                className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                style={{ background: "var(--qa-surface2)", color: "var(--qa-fg4)", fontSize: "10px", fontFamily: "var(--font-mono)" }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Asszisztens — az AI Copilot panel nyit/zár gombja */}
            <button
              onClick={toggleCopilot}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)", boxShadow: copilotOpen ? "none" : "var(--qa-accent-glow)", opacity: copilotOpen ? 0.9 : 1 }}
              aria-label="AI Asszisztens"
              aria-pressed={copilotOpen}
              title="AI Asszisztens"
            >
              <Sparkles size={14} className="flex-shrink-0" />
              <span className="hidden sm:inline">Asszisztens</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }}
                className="relative w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: showNotifs ? "var(--qa-accent-soft)" : "var(--qa-surface2)",
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
                    <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--qa-fg)" }}>Értesítések</p>
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
                          background: n.read ? "transparent" : "var(--qa-accent-soft)"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "var(--qa-accent-soft)")}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "var(--qa-surface)", color: "var(--qa-fg3)" }}
                        >
                          {notifIcons[n.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-semibold" style={{ color: "var(--qa-fg)", fontFamily: "var(--font-heading)" }}>{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: "var(--qa-accent)" }} />}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  {/* Footer link — összes értesítés az /ertesitesek dedikált oldalon */}
                  {notifications.length > 0 && (
                    <div
                      className="px-4 py-2.5 border-t text-center"
                      style={{ borderColor: "var(--qa-border)", background: "var(--qa-surface)" }}
                    >
                      <Link
                        href="/ertesitesek"
                        className="text-xs font-semibold transition-colors hover:opacity-80"
                        style={{ color: "var(--qa-accent)" }}
                        onClick={() => setShowNotifs(false)}
                      >
                        Összes értesítés →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors border"
                style={{
                  background: showUserMenu ? "var(--qa-accent-soft)" : "var(--qa-surface2)",
                  borderColor: showUserMenu ? "var(--qa-accent-soft)" : "var(--qa-border)"
                }}
              >
                <div
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--qa-accent)" }}
                >
                  {(user?.name ?? user?.email ?? "?")[0].toUpperCase()}
                  {/* Changelog notification dot — a user-menu-avatar sarkán */}
                  {changelog.hasUnread && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2"
                      style={{ background: "var(--qa-warning)", '--tw-ring-color': "var(--qa-surface2)" } as React.CSSProperties}
                      aria-label={`${changelog.unreadCount} új újdonság`}
                    />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold leading-none max-w-28 truncate" style={{ color: "var(--qa-fg)", fontFamily: "var(--font-heading)" }}>
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
                        <p className="text-sm font-semibold" style={{ color: "var(--qa-fg)", fontFamily: "var(--font-heading)" }}>
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

                  {/* Újdonságok — changelog drawer */}
                  <div className="px-3 py-2 border-b" style={{ borderColor: "var(--qa-border)" }}>
                    <button
                      onClick={() => { changelog.setOpen(true); setShowUserMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors w-full"
                      style={{ color: "var(--qa-fg3)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--qa-surface)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Sparkles size={12} />
                      <span className="flex-1 text-left">Újdonságok</span>
                      {changelog.hasUnread && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: "var(--qa-accent)", minWidth: 18, textAlign: "center" }}
                        >
                          {changelog.unreadCount}
                        </span>
                      )}
                    </button>
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
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Brand oldal-háttér (design_handoff) — a fejléc + első kártyasor mögé,
              pointer-events nélkül, a tartalom fölé z-index:1-en. */}
          {background && (
            <img
              src={`/brand/backgrounds/${background}.svg`}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "auto",
                pointerEvents: "none", zIndex: 0, opacity: 0.7,
                maskImage: "linear-gradient(to bottom, black 55%, transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
              }}
            />
          )}
          <div className="relative" style={{ zIndex: 1 }}>
            {children}
          </div>
        </main>
      </div>

      {/* AI Copilot panel — asztalon 344px in-flow oszlop, mobilon overlay */}
      <CopilotPanel
        open={copilotOpen}
        onClose={toggleCopilot}
        page={pageLabel || title}
        profileId={activeProfile?.id}
      />

      {/* Overlay for dropdowns */}
      {(showNotifs || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifs(false); setShowUserMenu(false); }} />
      )}

      {/* Command palette — global Cmd+K / Ctrl+K */}
      <CommandPalette open={cmdPaletteOpen} onOpenChange={setCmdPaletteOpen} />

      {/* Changelog drawer — user menu "Újdonságok" gomb nyitja meg */}
      <ChangelogDrawer open={changelog.open} onOpenChange={changelog.setOpen} />
    </div>
  );
}
