/*
 * G2A Growth Engine – Settings v1.0
 * Brand Center, Integrations, Team, Audit Log összevonva
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";
import {
  Palette, Plug, Users, ClipboardList, X, Loader2, Plus,
  Save, Globe, Mail, Check, AlertCircle, Settings2, Eye, EyeOff, PlayCircle,
  CreditCard, Sparkles, Rocket, Building2, Crown, CheckCircle2, Zap, Brain,
  Send,
} from "lucide-react";
import AiMemorySection from "@/components/settings/AiMemorySection";
import { useSubscription, PLAN_FEATURES, type SubscriptionPlan } from "@/hooks/useSubscription";
import BillingPlanCards from "@/components/BillingPlanCards";
import DashboardLayout from "@/components/DashboardLayout";
import AuditLogTimeline from "@/components/AuditLogTimeline";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";

type Tab = "brand" | "integrations" | "team" | "audit" | "admin" | "fiok" | "billing" | "ai-memory";

const BASE_TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "fiok", label: "Fiók", icon: <Users size={14} /> },
  { id: "billing", label: "Előfizetés", icon: <CreditCard size={14} /> },
  { id: "brand", label: "Brand Center", icon: <Palette size={14} /> },
  { id: "integrations", label: "Integrációk", icon: <Plug size={14} /> },
  { id: "ai-memory", label: "AI Memória", icon: <Brain size={14} /> },
  { id: "team", label: "Csapat", icon: <Users size={14} />, badge: "Hamarosan" },
  { id: "audit", label: "Audit Log", icon: <ClipboardList size={14} /> },
];
// A Hírlevél tab eltávolítva — átkerült a sidebar fő menübe (/hirlevel route).
const ADMIN_TAB: { id: Tab; label: string; icon: React.ReactNode; badge?: string } =
  { id: "admin", label: "Admin", icon: <Settings2 size={14} /> };

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

export default function Settings() {
  const { activeProfile } = useProfile();
  const { user: appUser, isSuperAdmin } = useAppAuth();
  const { restartTour } = useTour();
  const subscription = useSubscription();
  // Initialize tab from URL query param (?tab=billing, ?tab=fiok, etc.)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as Tab | null;
      const validTabs: Tab[] = ["fiok", "billing", "brand", "integrations", "ai-memory", "team", "audit", "admin"];
      if (tab && validTabs.includes(tab)) return tab;
    }
    return "brand";
  });
  const [linkedInCredForm, setLinkedInCredForm] = useState({ clientId: "", clientSecret: "" });
  const [showLinkedInSecret, setShowLinkedInSecret] = useState(false);
  const { data: apiConfigStatus, refetch: refetchApiConfig } = trpc.apiConfig.status.useQuery(
    undefined,
    { enabled: isSuperAdmin }
  );
  const [, navigate] = useLocation();
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Detect checkout=success URL param and show banner
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        setCheckoutSuccess(true);
        // Clean URL without reload
        const newUrl = window.location.pathname + "?tab=billing";
        window.history.replaceState({}, "", newUrl);
        // Konfetti — Quiet Authority paletta színeivel
        const fire = (ratio: number, opts: confetti.Options) =>
          confetti({
            particleCount: Math.floor(180 * ratio),
            spread: 70,
            origin: { y: 0.7 },
            colors: ["#3D7BFD", "#22C55E", "#F0F2F8", "#9BA3B8"],
            ...opts,
          });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
        // Auto-dismiss after 8 seconds
        setTimeout(() => setCheckoutSuccess(false), 8000);
      }
    }
  }, []);

  const resetMyOnboarding = trpc.appAuth.resetMyOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Onboarding állapot visszaállítva. Az onboarding oldal most betöltődik...");
      setTimeout(() => navigate("/onboarding"), 1200);
    },
    onError: (e) => toast.error(e.message),
  });
  const resetOnboarding = trpc.appAuth.resetOnboardingForTesting.useMutation({
    onSuccess: () => {
      toast.success("Onboarding állapot visszaállítva. Következő bejelentkezéskor az onboarding oldal jelenik meg.");
    },
    onError: (e) => toast.error(e.message),
  });
  const setLinkedInCreds = trpc.apiConfig.setLinkedInCredentials.useMutation({
    onSuccess: () => {
      refetchApiConfig();
      toast.success("LinkedIn OAuth credentials mentve (session-ig érvényes)");
      setLinkedInCredForm({ clientId: "", clientSecret: "" });
    },
    onError: (e) => toast.error(e.message),
  });
  const [brandForm, setBrandForm] = useState<any>({
    primaryColor: activeProfile.primaryColor ?? "#6366f1",
    secondaryColor: activeProfile.secondaryColor ?? "#10b981",
    fontHeading: activeProfile.fontHeading ?? "Sora",
    fontBody: activeProfile.fontBody ?? "Inter",
    brandVoice: activeProfile.brandVoice ?? { tone: "", style: "", avoid: "", keywords: [] },
  });
  const [newKeyword, setNewKeyword] = useState("");
  const utils = trpc.useUtils();

  const upsertProfile = trpc.profiles.upsert.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast.success("Brand beállítások mentve");
    }
  });

  const { data: emailIntegration } = trpc.emailIntegration.get.useQuery(
    { profileId: activeProfile.id }, { enabled: !!activeProfile.id }
  );

  const { data: auditLogs, isLoading: auditLoading } = trpc.auditLog.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id && activeTab === "audit" }
  );

  const upsertEmailIntegration = trpc.emailIntegration.upsert.useMutation({
    onSuccess: () => {
      utils.emailIntegration.get.invalidate({ profileId: activeProfile.id });
      toast.success("Email integráció mentve");
    }
  });

  const [emailForm, setEmailForm] = useState<any>({ provider: "gmail", email: "" });
  // A social-integráció logika átkerült az /integraciok dedikált oldalra
  // (IntegrationsHub.tsx). A Settings integrations tab most csak egy
  // redirect-kártyát mutat.

  const handleSaveBrand = async () => {
    await upsertProfile.mutateAsync({ id: activeProfile.id, name: activeProfile.name, initials: activeProfile.initials, ...brandForm });
  };

  const FONT_OPTIONS = ["Sora", "Inter", "Poppins", "Roboto", "Montserrat", "Playfair Display", "Raleway"];

  // Aktív tab label a breadcrumb-hoz — a BASE_TABS + ADMIN_TAB egyesítéséből
  const activeTabLabel = [...BASE_TABS, ADMIN_TAB].find(t => t.id === activeTab)?.label ?? "Beállítások";

  return (
    <DashboardLayout>
      {/* Breadcrumb — orientáció a mély tab-struktúrában */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: "var(--qa-fg3)" }}>
          <li>
            <a
              href="/iranyitopult"
              className="hover:underline transition-colors"
              style={{ color: "var(--qa-fg3)" }}
              onClick={(e) => { e.preventDefault(); navigate("/iranyitopult"); }}
            >
              Vezérlőpult
            </a>
          </li>
          <li aria-hidden="true" style={{ color: "var(--qa-fg4)" }}>›</li>
          <li>
            <span className="font-medium" style={{ color: "var(--qa-fg3)" }}>Beállítások</span>
          </li>
          <li aria-hidden="true" style={{ color: "var(--qa-fg4)" }}>›</li>
          <li>
            <span className="font-semibold" style={{ color: "var(--qa-fg2)" }}>{activeTabLabel}</span>
          </li>
        </ol>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>Beállítások</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--qa-fg3)" }}>{activeProfile.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--qa-surface)" }}>
        {[...BASE_TABS, ...(isSuperAdmin ? [ADMIN_TAB] : [])].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeTab === tab.id ? "var(--qa-accent)" : "transparent", color: activeTab === tab.id ? "white" : "var(--qa-fg3)" }}
          >
            {tab.icon} {tab.label}
            {tab.badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "oklch(0.65 0.18 75 / 20%)", color: "var(--qa-warning)" }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Fiók */}
      {activeTab === "fiok" && (
        <div className="space-y-5">
          {/* Profil adatok */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--qa-fg2)" }}>Profil adatok</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--qa-bg)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "oklch(from var(--qa-accent) l c h / 20%)", color: "var(--qa-accent)" }}>
                  {appUser?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--qa-fg2)" }}>{appUser?.name ?? "Ismeretlen"}</p>
                  <p className="text-xs" style={{ color: "var(--qa-fg3)" }}>{appUser?.email ?? ""}</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>
                  {appUser?.role === "super_admin" ? "Super Admin" : "Felhasználó"}
                </span>
              </div>
            </div>
          </div>

          {/* Interaktív bemutato */}
          <div className="rounded-xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "oklch(from var(--qa-accent) l c h / 30%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)" }}>
                <PlayCircle size={16} style={{ color: "var(--qa-accent)" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "var(--qa-fg2)" }}>Interaktív bemutato</h3>
                <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
                  Végigvezet a platform főbb funkcióin. Hasznos új csapattagoknak vagy ha szeretnéd újra átnézni a lehetőségeket.
                </p>
                <button
                  onClick={restartTour}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--qa-accent)" }}
                >
                  <PlayCircle size={13} />
                  Bemutato indítása
                </button>
              </div>
            </div>
          </div>

          {/* Onboarding tesztelési mód */}
          <div className="rounded-xl border p-5" style={{ background: "oklch(from var(--qa-danger) l c h / 8%)", borderColor: "oklch(from var(--qa-danger) l c h / 25%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "oklch(from var(--qa-danger) l c h / 12%)" }}>🧪</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "var(--qa-fg2)" }}>Onboarding tesztelési mód</h3>
                <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
                  Visszaállítja az onboarding állapotot. A következő belépéskor az onboarding oldal jelenik meg, mintha új felhasználó lennél.
                  A profil adatok törlődnek, de a meglévő tartalmak és lead-ek megmaradnak.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Biztosan visszaállítod az onboarding állapotot? A profil adatok törlődnek.')) {
                      resetMyOnboarding.mutate();
                    }
                  }}
                  disabled={resetMyOnboarding.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--qa-danger)" }}
                >
                  {resetMyOnboarding.isPending ? (
                    <><Loader2 size={13} className="animate-spin" /> Visszaállítás...</>
                  ) : (
                    <>🔄 Onboarding visszaállítása</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand Center */}
      {activeTab === "brand" && (
        <div className="space-y-5">
          {/* Colors */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--qa-fg2)" }}>Brand Színek</h3>
            <div className="grid grid-cols-2 gap-4">
              {([["primaryColor", "Elsődleges szín"], ["secondaryColor", "Másodlagos szín"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandForm[k] ?? "#6366f1"} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0" style={{ background: "none" }} />
                    <input value={brandForm[k] ?? ""} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm border font-mono" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--qa-fg2)" }}>Tipográfia</h3>
            <div className="grid grid-cols-2 gap-4">
              {([["fontHeading", "Cím betűtípus"], ["fontBody", "Szöveg betűtípus"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                  <select value={brandForm[k] ?? "Sora"} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}>
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Voice */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--qa-fg2)" }}>Brand Hang</h3>
            <div className="space-y-3">
              {([["tone", "Hangnem (pl. Szakmai, barátságos)"], ["style", "Stílus (pl. Informatív, inspiráló)"], ["avoid", "Kerülendő (pl. Zsargon, túlzás)"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                  <input value={brandForm.brandVoice?.[k] ?? ""} onChange={e => setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, [k]: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--qa-fg3)" }}>Kulcsszavak</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(brandForm.brandVoice?.keywords ?? []).map((kw: string, i: number) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>
                      {kw}
                      <button onClick={() => setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: f.brandVoice.keywords.filter((_: any, j: number) => j !== i) } }))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="Új kulcsszó..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}
                    onKeyDown={e => { if (e.key === "Enter" && newKeyword.trim()) { setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: [...(f.brandVoice?.keywords ?? []), newKeyword.trim()] } })); setNewKeyword(""); } }} />
                  <button onClick={() => { if (newKeyword.trim()) { setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: [...(f.brandVoice?.keywords ?? []), newKeyword.trim()] } })); setNewKeyword(""); } }}
                    className="px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSaveBrand} disabled={upsertProfile.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, var(--qa-accent), oklch(0.55 0.18 165))" }}>
            {upsertProfile.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Brand beállítások mentése
          </button>
        </div>
      )}

      {/* Integrations */}
      {activeTab === "integrations" && (
        <div className="rounded-xl border p-6 flex flex-col items-center text-center" style={{ background: cardBg, borderColor: border }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
            <Plug size={22} style={{ color: "var(--qa-accent)" }} />
          </div>
          <h3 className="text-base font-bold mb-1" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
            Az Integrációk saját oldalt kaptak
          </h3>
          <p className="text-sm mb-5 max-w-sm" style={{ color: "var(--qa-fg3)" }}>
            A közösségi média, analitika és email integrációk mostantól egy dedikált, kategóriákra bontott oldalon érhetők el — átláthatóbban.
          </p>
          <button
            onClick={() => navigate("/integraciok")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--qa-accent)" }}
          >
            <Plug size={14} /> Integrációk megnyitása
          </button>
        </div>
      )}

      {/* AI Memory */}
      {activeTab === "ai-memory" && activeProfile.id && (
        <AiMemorySection profileId={activeProfile.id} />
      )}

      {/* Team */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Csapattagok</h3>
              <button onClick={() => toast.info("Csapatkezelés hamarosan")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>
                <Plus size={12} /> Meghívó
              </button>
            </div>
            <div className="text-center py-10">
              <Users size={32} className="mx-auto mb-3" style={{ color: "var(--qa-fg4)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-fg3)" }}>Csak te vagy itt</p>
              <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>Hívj meg csapattagokat az együttműködéshez</p>
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: "oklch(from var(--qa-warning) l c h / 8%)", borderColor: "oklch(from var(--qa-warning) l c h / 15%)" }}>
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--qa-warning)" }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-warning)" }}>Csapatkezelés hamarosan</p>
                <p className="text-xs" style={{ color: "var(--qa-fg3)" }}>A csapatmeghívó és jogosultságkezelő funkció fejlesztés alatt áll.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log — új timeline UI (bal oldali vonal + dot marker + user avatar) */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Audit Log</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg4)" }}>
              Rendszeresemények és változások naplója — dátum-csoportosítva, kategória-ikonnal.
            </p>
          </div>
          <AuditLogTimeline logs={auditLogs ?? undefined} isLoading={auditLoading} />
        </div>
      )}

      {/* Előfizetés / Billing */}
      {activeTab === "billing" && (
        <div className="space-y-5">
          {/* Checkout success banner */}
          {checkoutSuccess && (
            <div
              className="flex items-center gap-4 rounded-xl border px-5 py-4"
              style={{
                background: "oklch(from var(--qa-success) l c h / 12%)",
                borderColor: "oklch(from var(--qa-success) l c h / 35%)",
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "oklch(from var(--qa-success) l c h / 20%)" }}>
                <CheckCircle2 size={20} style={{ color: "var(--qa-success)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "var(--qa-success)" }}>Csomag sikeresen aktiválva!</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>Az előfizetésed aktív. Az összes funkció most már elérhető számodra.</p>
              </div>
              <button
                onClick={() => setCheckoutSuccess(false)}
                className="flex-shrink-0 p-1 rounded-lg transition-colors"
                style={{ color: "var(--qa-fg4)" }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {/* Aktív csomag */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "var(--qa-fg2)" }}>Aktív előfizetés</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "oklch(from var(--qa-accent) l c h / 8%)", border: "1.5px solid oklch(from var(--qa-accent) l c h / 25%)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)" }}>
                {subscription.plan === "free" && <Sparkles size={22} style={{ color: "var(--qa-accent)" }} />}
                {subscription.plan === "starter" && <Rocket size={22} style={{ color: "var(--qa-accent)" }} />}
                {subscription.plan === "pro" && <Building2 size={22} style={{ color: "var(--qa-warning)" }} />}
                {subscription.plan === "agency" && <Crown size={22} style={{ color: "var(--qa-success)" }} />}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
                  {PLAN_FEATURES[subscription.plan as SubscriptionPlan]?.planLabel ?? subscription.plan} csomag
                </p>
                <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
                  {subscription.monthlyPrice === 0 ? "Ingyenes" : `${subscription.monthlyPrice.toLocaleString("hu-HU")} Ft/hó`}
                </p>
              </div>
              {subscription.plan !== "agency" && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "oklch(from var(--qa-warning) l c h / 15%)", color: "var(--qa-warning)" }}>Frissítés elérhető</span>
              )}
            </div>
          </div>

          {/* Csomagok összehasonlítása */}
          <BillingPlanCards currentPlan={subscription.plan as SubscriptionPlan} />
        </div>
      )}

      {/* Hírlevél tab eltávolítva — most a /hirlevel route az új helye. */}

      {/* Admin Panel – super_admin only */}
      {activeTab === "admin" && isSuperAdmin && (
        <div className="space-y-4">
          {/* Inbound IMAP panel eltávolítva — az értékesítés/inbound modul teljesen kivéve. */}

          {/* API Config Status */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--qa-fg2)" }}>API Konfiguráció Állapot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "LinkedIn OAuth", ok: apiConfigStatus?.linkedInConfigured, detail: apiConfigStatus?.linkedInClientId ? `Client ID: ${apiConfigStatus.linkedInClientId}` : "Nincs beállítva" },
                { label: "Resend Email", ok: apiConfigStatus?.resendConfigured, detail: apiConfigStatus?.resendConfigured ? "Beállítva" : "Nincs beállítva" },
              ].map(({ label, ok, detail }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
                  {ok
                    ? <Check size={16} style={{ color: "var(--qa-success)" }} />
                    : <AlertCircle size={16} style={{ color: "var(--qa-warning)" }} />
                  }
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--qa-fg2)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LinkedIn OAuth Credentials */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--qa-fg2)" }}>LinkedIn OAuth Credentials</h3>
            <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
              Ideiglenes beállítás (szerver újraindításig érvényes). Tartós tároláshoz használd a Secrets panelt.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>LinkedIn Client ID</label>
                <input
                  value={linkedInCredForm.clientId}
                  onChange={e => setLinkedInCredForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="86xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>LinkedIn Client Secret</label>
                <div className="relative">
                  <input
                    type={showLinkedInSecret ? "text" : "password"}
                    value={linkedInCredForm.clientSecret}
                    onChange={e => setLinkedInCredForm(f => ({ ...f, clientSecret: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg text-sm border font-mono pr-10"
                    style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLinkedInSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--qa-fg4)" }}
                  >
                    {showLinkedInSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  if (!linkedInCredForm.clientId || !linkedInCredForm.clientSecret) {
                    toast.error("Mindkét mező kitöltése kötelező");
                    return;
                  }
                  setLinkedInCreds.mutate(linkedInCredForm);
                }}
                disabled={setLinkedInCreds.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--qa-accent)" }}
              >
                {setLinkedInCreds.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Mentés
              </button>
            </div>
          </div>

          {/* Onboarding tesztelési mód */}
          <div className="rounded-xl border p-5" style={{ background: "oklch(from var(--qa-danger) l c h / 8%)", borderColor: "oklch(from var(--qa-danger) l c h / 25%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "oklch(from var(--qa-danger) l c h / 12%)" }}>🧪</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "var(--qa-fg2)" }}>Onboarding tesztelési mód</h3>
                <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
                  Visszaállítja az onboarding állapotot. A következő bejelentkezéskor az onboarding oldal jelenik meg friss felhasználóként.
                  A profil adatok törlődnek, de a meglévő tartalmak és lead-ek megmaradnak.
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Biztosan visszaállítod az onboarding állapotot? A profil adatok törlődnek.')) {
                      resetOnboarding.mutate({});
                    }
                  }}
                  disabled={resetOnboarding.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--qa-danger)" }}
                >
                  {resetOnboarding.isPending ? (
                    <><Loader2 size={13} className="animate-spin" /> Visszaállítás...</>
                  ) : (
                    <>🔄 Onboarding visszaállítása</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* LinkedIn App Setup Guide */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--qa-fg2)" }}>LinkedIn App Beállítási útmutató</h3>
            <ol className="space-y-2 text-xs" style={{ color: "var(--qa-fg3)" }}>
              {[
                "Nyisd meg: https://www.linkedin.com/developers/apps",
                "Hozz létre új alkalmazást (Create App)",
                "Products fülön add hozzá: \"Share on LinkedIn\" és \"Sign In with LinkedIn\"",
                "Auth fülön másold ki a Client ID és Client Secret értékeket",
                `Authorized redirect URL: ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.manus.space"}/api/oauth/linkedin/callback`,
                "Illeszd be a credentials-eket a fenti mezőkbe, vagy add hozzá a Secrets panelhez (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET)",
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
