/*
 * G2A Growth Engine – Settings v1.0
 * Brand Center, Integrations, Team, Audit Log összevonva
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Palette, Plug, Users, ClipboardList, X, Loader2, Plus,
  Save, Globe, Mail, Check, AlertCircle, Settings2, Eye, EyeOff, PlayCircle,
  CreditCard, Sparkles, Rocket, Building2, Crown, CheckCircle2, Zap,
} from "lucide-react";
import { useSubscription, PLAN_FEATURES, type SubscriptionPlan } from "@/hooks/useSubscription";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useTour } from "@/hooks/useTour";
import { toast } from "sonner";

type Tab = "brand" | "integrations" | "team" | "audit" | "admin" | "fiok" | "billing";

const BASE_TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "fiok", label: "Fiók", icon: <Users size={14} /> },
  { id: "billing", label: "Előfizetés", icon: <CreditCard size={14} /> },
  { id: "brand", label: "Brand Center", icon: <Palette size={14} /> },
  { id: "integrations", label: "Integrációk", icon: <Plug size={14} /> },
  { id: "team", label: "Csapat", icon: <Users size={14} />, badge: "Hamarosan" },
  { id: "audit", label: "Audit Log", icon: <ClipboardList size={14} /> },
];
const ADMIN_TAB: { id: Tab; label: string; icon: React.ReactNode; badge?: string } =
  { id: "admin", label: "Admin", icon: <Settings2 size={14} /> };

const cardBg = "oklch(0.17 0.022 255)";
const border = "oklch(1 0 0 / 8%)";

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
      const validTabs: Tab[] = ["fiok", "billing", "brand", "integrations", "team", "audit", "admin"];
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
  // Social connections
  const { data: socialConnections = [], refetch: refetchSocial } = trpc.social.listConnections.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id && activeTab === "integrations" }
  );
  const disconnectSocial = trpc.social.disconnect.useMutation({
    onSuccess: () => { refetchSocial(); toast.success("Kapcsolat megszakítva"); },
  });
  const saveConnection = trpc.social.saveConnection.useMutation({
    onSuccess: () => { refetchSocial(); toast.success("LinkedIn fiók csatlakoztatva!"); setLinkedInModal(false); },
    onError: (e) => toast.error(e.message),
  });
  const [linkedInModal, setLinkedInModal] = useState(false);
  const [linkedInForm, setLinkedInForm] = useState({ accessToken: "", platformUserId: "", platformUsername: "" });
  const { data: linkedInConfig } = trpc.social.isLinkedInConfigured.useQuery();
  const { data: linkedInOAuthData } = trpc.social.getLinkedInOAuthUrl.useQuery(
    { profileId: activeProfile.id, origin: typeof window !== "undefined" ? window.location.origin : "" },
    { enabled: !!activeProfile.id && !!linkedInConfig?.configured }
  );

  // Handle LinkedIn OAuth callback result from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get("linkedin");
    if (linkedinStatus === "connected") {
      const username = params.get("username") ?? "";
      toast.success(`LinkedIn fiók csatlakoztatva${username ? `: ${username}` : ""}!`);
      refetchSocial();
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (linkedinStatus === "error") {
      const reason = params.get("reason") ?? "unknown";
      toast.error(`LinkedIn csatlakoztatás sikertelen: ${reason}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveBrand = async () => {
    await upsertProfile.mutateAsync({ id: activeProfile.id, name: activeProfile.name, initials: activeProfile.initials, ...brandForm });
  };

  const FONT_OPTIONS = ["Sora", "Inter", "Poppins", "Roboto", "Montserrat", "Playfair Display", "Raleway"];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Beállítások</h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{activeProfile.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "oklch(0.17 0.022 255)" }}>
        {[...BASE_TABS, ...(isSuperAdmin ? [ADMIN_TAB] : [])].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeTab === tab.id ? "oklch(0.6 0.2 255)" : "transparent", color: activeTab === tab.id ? "white" : "oklch(0.55 0.015 240)" }}
          >
            {tab.icon} {tab.label}
            {tab.badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "oklch(0.65 0.18 75 / 20%)", color: "oklch(0.75 0.18 75)" }}>
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
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Profil adatok</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.14 0.02 255)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.75 0.18 255)" }}>
                  {appUser?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)" }}>{appUser?.name ?? "Ismeretlen"}</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{appUser?.email ?? ""}</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}>
                  {appUser?.role === "super_admin" ? "Super Admin" : "Felhasználó"}
                </span>
              </div>
            </div>
          </div>

          {/* Interaktív bemutato */}
          <div className="rounded-xl border p-5" style={{ background: "oklch(0.18 0.025 255 / 40%)", borderColor: "oklch(0.6 0.2 255 / 30%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
                <PlayCircle size={16} style={{ color: "oklch(0.7 0.18 255)" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "oklch(0.88 0.008 240)" }}>Interaktív bemutato</h3>
                <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
                  Végigvezet a platform főbb funkcióin. Hasznos új csapattagoknak vagy ha szeretnéd újra átnézni a lehetőségeket.
                </p>
                <button
                  onClick={restartTour}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "oklch(0.6 0.2 255)" }}
                >
                  <PlayCircle size={13} />
                  Bemutato indítása
                </button>
              </div>
            </div>
          </div>

          {/* Onboarding tesztelési mód */}
          <div className="rounded-xl border p-5" style={{ background: "oklch(0.18 0.025 30 / 40%)", borderColor: "oklch(0.7 0.2 30 / 30%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "oklch(0.7 0.2 30 / 15%)" }}>🧪</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "oklch(0.88 0.008 240)" }}>Onboarding tesztelési mód</h3>
                <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
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
                  style={{ background: "oklch(0.55 0.18 30)" }}
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
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Brand Színek</h3>
            <div className="grid grid-cols-2 gap-4">
              {([["primaryColor", "Elsődleges szín"], ["secondaryColor", "Másodlagos szín"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "oklch(0.65 0.015 240)" }}>{l}</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandForm[k] ?? "#6366f1"} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0" style={{ background: "none" }} />
                    <input value={brandForm[k] ?? ""} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm border font-mono" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Tipográfia</h3>
            <div className="grid grid-cols-2 gap-4">
              {([["fontHeading", "Cím betűtípus"], ["fontBody", "Szöveg betűtípus"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>{l}</label>
                  <select value={brandForm[k] ?? "Sora"} onChange={e => setBrandForm((f: any) => ({ ...f, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Brand Voice */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Brand Hang</h3>
            <div className="space-y-3">
              {([["tone", "Hangnem (pl. Szakmai, barátságos)"], ["style", "Stílus (pl. Informatív, inspiráló)"], ["avoid", "Kerülendő (pl. Zsargon, túlzás)"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>{l}</label>
                  <input value={brandForm.brandVoice?.[k] ?? ""} onChange={e => setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, [k]: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "oklch(0.65 0.015 240)" }}>Kulcsszavak</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(brandForm.brandVoice?.keywords ?? []).map((kw: string, i: number) => (
                    <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                      style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>
                      {kw}
                      <button onClick={() => setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: f.brandVoice.keywords.filter((_: any, j: number) => j !== i) } }))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="Új kulcsszó..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    onKeyDown={e => { if (e.key === "Enter" && newKeyword.trim()) { setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: [...(f.brandVoice?.keywords ?? []), newKeyword.trim()] } })); setNewKeyword(""); } }} />
                  <button onClick={() => { if (newKeyword.trim()) { setBrandForm((f: any) => ({ ...f, brandVoice: { ...f.brandVoice, keywords: [...(f.brandVoice?.keywords ?? []), newKeyword.trim()] } })); setNewKeyword(""); } }}
                    className="px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleSaveBrand} disabled={upsertProfile.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
            {upsertProfile.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Brand beállítások mentése
          </button>
        </div>
      )}

      {/* Integrations */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          {/* Social Media Integrations */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>Social Media fiókok</h3>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>Csatlakoztasd a közösségi média fiókjaidat a direkt publikáláshoz</p>
              </div>
            </div>

            {/* Platform grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {/* LinkedIn */}
              {(() => {
                const conn = socialConnections.find(c => c.isActive && c.platform === "linkedin");
                return (
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all"
                    style={{ background: conn ? "oklch(0.55 0.18 255 / 12%)" : "oklch(0.22 0.02 255)", borderColor: conn ? "oklch(0.55 0.18 255 / 40%)" : "oklch(1 0 0 / 8%)" }}
                    onClick={() => { if (!conn) { linkedInOAuthData?.url ? window.location.href = linkedInOAuthData.url : setLinkedInModal(true); } }}>
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    <span className="text-xs font-semibold" style={{ color: conn ? "oklch(0.55 0.18 255)" : "oklch(0.65 0.015 240)" }}>LinkedIn</span>
                    {conn ? <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>✓ Csatlakozva</span>
                      : <span className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Csatlakoztatás</span>}
                  </div>
                );
              })()}

              {/* Facebook */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all"
                style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 8%)" }}
                onClick={() => toast.info("Facebook integráció hamarosan elérhető")}>
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span className="text-xs font-semibold" style={{ color: "oklch(0.65 0.015 240)" }}>Facebook</span>
                <span className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Hamarosan</span>
              </div>

              {/* Instagram */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all"
                style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 8%)" }}
                onClick={() => toast.info("Instagram integráció hamarosan elérhető")}>
                <svg viewBox="0 0 24 24" className="w-8 h-8"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                <span className="text-xs font-semibold" style={{ color: "oklch(0.65 0.015 240)" }}>Instagram</span>
                <span className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Hamarosan</span>
              </div>

              {/* TikTok */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all"
                style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 8%)" }}
                onClick={() => toast.info("TikTok integráció hamarosan elérhető")}>
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
                <span className="text-xs font-semibold" style={{ color: "oklch(0.65 0.015 240)" }}>TikTok</span>
                <span className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Hamarosan</span>
              </div>
            </div>

            {/* Connected accounts list */}
            {socialConnections.filter(c => c.isActive).length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.55 0.015 240)" }}>Csatlakoztatott fiókok</p>
                {socialConnections.filter(c => c.isActive).map(conn => (
                  <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "oklch(0.22 0.02 255)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.55 0.18 255 / 20%)" }}>
                        <Globe size={16} style={{ color: "oklch(0.55 0.18 255)" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)" }}>{conn.platformUsername ?? conn.platform}</p>
                        <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{conn.platform} • <span style={{ color: "oklch(0.65 0.18 165)" }}>Csatlakozva</span></p>
                      </div>
                    </div>
                    <button onClick={() => disconnectSocial.mutate({ connectionId: conn.id })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.65 0.22 25)" }}>
                      Lecsatlakoztatás
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LinkedIn Connect Modal */}
      {linkedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 60%)" }} onClick={() => setLinkedInModal(false)}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>LinkedIn fiók csatlakoztatása</h3>
              <button onClick={() => setLinkedInModal(false)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            {linkedInOAuthData?.url ? (
              <div className="mb-4">
                <p className="text-xs mb-3 p-3 rounded-lg" style={{ background: "oklch(0.55 0.18 255 / 8%)", color: "oklch(0.7 0.15 255)" }}>
                  Kattints az alábbi gombra a LinkedIn fiókod biztonságos csatlakoztatásához. Átirányítunk a LinkedIn bejelentkezési oldalára.
                </p>
                <a href={linkedInOAuthData.url}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm"
                  style={{ background: "oklch(0.55 0.18 255)" }}>
                  <Plug size={15} /> Csatlakozás LinkedIn-nel
                </a>
              </div>
            ) : (
              <p className="text-xs mb-4 p-3 rounded-lg" style={{ background: "oklch(0.75 0.18 75 / 8%)", color: "oklch(0.75 0.18 75)" }}>
                A LinkedIn OAuth integráció konfiguráláshoz szükséges a LINKEDIN_CLIENT_ID és LINKEDIN_CLIENT_SECRET env var. Addig manuálisan add meg az access tokent.
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Access Token *</label>
                <input value={linkedInForm.accessToken} onChange={e => setLinkedInForm(f => ({ ...f, accessToken: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                  placeholder="AQV..." />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>LinkedIn Person ID *</label>
                <input value={linkedInForm.platformUserId} onChange={e => setLinkedInForm(f => ({ ...f, platformUserId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                  placeholder="urn:li:person:xxx" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Felhasználónév (megjelenítéshez)</label>
                <input value={linkedInForm.platformUsername} onChange={e => setLinkedInForm(f => ({ ...f, platformUsername: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                  placeholder="Név vagy @handle" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setLinkedInModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button
                onClick={() => {
                  if (!linkedInForm.accessToken || !linkedInForm.platformUserId) { toast.error("Access Token és Person ID kötelező"); return; }
                  saveConnection.mutate({
                    profileId: activeProfile.id,
                    platform: "linkedin",
                    accessToken: linkedInForm.accessToken,
                    platformUserId: linkedInForm.platformUserId,
                    platformUsername: linkedInForm.platformUsername || undefined,
                  });
                }}
                disabled={saveConnection.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.6 0.2 255)" }}>
                {saveConnection.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Csatlakoztatás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>Csapattagok</h3>
              <button onClick={() => toast.info("Csapatkezelés hamarosan")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>
                <Plus size={12} /> Meghívó
              </button>
            </div>
            <div className="text-center py-10">
              <Users size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Csak te vagy itt</p>
              <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Hívj meg csapattagokat az együttműködéshez</p>
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ background: "oklch(0.75 0.18 75 / 8%)", borderColor: "oklch(0.75 0.18 75 / 20%)" }}>
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.75 0.18 75)" }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.8 0.15 75)" }}>Csapatkezelés hamarosan</p>
                <p className="text-xs" style={{ color: "oklch(0.65 0.015 240)" }}>A csapatmeghívó és jogosultságkezelő funkció fejlesztés alatt áll.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log */}
      {activeTab === "audit" && (
        <div className="rounded-xl border" style={{ background: cardBg, borderColor: border }}>
          <div className="p-4 border-b" style={{ borderColor: border }}>
            <h3 className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>Audit Log</h3>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>Rendszeresemények és változások naplója</p>
          </div>
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin" style={{ color: "oklch(0.5 0.015 240)" }} />
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Nincs rögzített esemény</p>
              <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>A rendszeresemények automatikusan kerülnek ide</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: border }}>
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <ClipboardList size={14} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.5 0.2 255)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: "oklch(0.82 0.008 240)" }}>{log.action}</p>
                    {(log.objectTitle || log.objectType) && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.5 0.015 240)" }}>
                        {log.objectType}{log.objectTitle ? `: ${log.objectTitle}` : ""}
                        {log.userName ? ` – ${log.userName}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: "oklch(0.45 0.015 240)" }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("hu-HU") : "–"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Előfizetés / Billing */}
      {activeTab === "billing" && (
        <div className="space-y-5">
          {/* Aktív csomag */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Aktív előfizetés</h3>
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "oklch(0.6 0.2 255 / 8%)", border: "1.5px solid oklch(0.6 0.2 255 / 25%)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
                {subscription.plan === "free" && <Sparkles size={22} style={{ color: "oklch(0.75 0.2 255)" }} />}
                {subscription.plan === "starter" && <Rocket size={22} style={{ color: "oklch(0.75 0.2 255)" }} />}
                {subscription.plan === "pro" && <Building2 size={22} style={{ color: "oklch(0.75 0.18 75)" }} />}
                {subscription.plan === "agency" && <Crown size={22} style={{ color: "oklch(0.75 0.18 165)" }} />}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                  {PLAN_FEATURES[subscription.plan as SubscriptionPlan]?.planLabel ?? subscription.plan} csomag
                </p>
                <p className="text-sm" style={{ color: "oklch(0.55 0.015 240)" }}>
                  {subscription.monthlyPrice === 0 ? "Ingyenes" : `${subscription.monthlyPrice.toLocaleString("hu-HU")} Ft/hó`}
                </p>
              </div>
              {subscription.plan !== "agency" && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "oklch(0.75 0.18 75 / 15%)", color: "oklch(0.75 0.18 75)" }}>Frissítés elérhető</span>
              )}
            </div>
          </div>

          {/* Csomagok összehasonlítása */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Csomagok</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {(["free", "starter", "pro", "agency"] as SubscriptionPlan[]).map(planId => {
                const plan = PLAN_FEATURES[planId];
                const isActive = subscription.plan === planId;
                const icons: Record<SubscriptionPlan, React.ReactNode> = {
                  free: <Sparkles size={16} />,
                  starter: <Rocket size={16} />,
                  pro: <Building2 size={16} />,
                  agency: <Crown size={16} />,
                };
                const colors: Record<SubscriptionPlan, string> = {
                  free: "oklch(0.6 0.2 255)",
                  starter: "oklch(0.6 0.2 255)",
                  pro: "oklch(0.75 0.18 75)",
                  agency: "oklch(0.65 0.18 165)",
                };
                const featureList: string[] = [
                  planId === "free" ? "1 AI stratégia/hó" : planId === "starter" ? "5 AI stratégia/hó" : planId === "pro" ? "20 AI stratégia/hó" : "60 AI stratégia/hó",
                  planId === "free" ? "5 AI poszt/hó" : planId === "starter" ? "50 AI poszt/hó" : planId === "pro" ? "300 AI poszt/hó" : "1 000 AI poszt/hó",
                  planId === "free" ? "1 SEO audit/hó" : planId === "starter" ? "3 SEO audit/hó" : planId === "pro" ? "10 SEO audit/hó" : "30 SEO audit/hó",
                  ...(plan.aiImagePerMonth > 0 ? [`${plan.aiImagePerMonth} AI kép/hó`] : []),
                  ...(plan.aiVideoPerMonth > 0 ? [`${plan.aiVideoPerMonth} HeyGen videó/hó`] : []),
                  ...(plan.canUseCampaigns ? ["Kampány builder"] : []),
                  ...(plan.canWhiteLabel ? ["White-label"] : []),
                ];
                return (
                  <div key={planId} className="rounded-xl border p-4 flex flex-col gap-3"
                    style={{ background: isActive ? `${colors[planId]}10` : "oklch(0.22 0.02 255)", borderColor: isActive ? `${colors[planId]}40` : "oklch(1 0 0 / 8%)" }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: colors[planId] }}>{icons[planId]}</span>
                      <span className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>{plan.planLabel}</span>
                      {isActive && <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${colors[planId]}20`, color: colors[planId] }}>Aktív</span>}
                    </div>
                    <p className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                      {plan.monthlyPrice === 0 ? "Ingyenes" : `${plan.monthlyPrice.toLocaleString("hu-HU")} Ft`}
                      {plan.monthlyPrice > 0 && <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.015 240)" }}>/hó</span>}
                    </p>
                    <ul className="space-y-1.5 flex-1">
                      {featureList.map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.7 0.015 240)" }}>
                          <CheckCircle2 size={11} style={{ color: colors[planId], flexShrink: 0 }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isActive && planId !== "free" && (
                      <button
                        onClick={() => toast.info("💳 Stripe fizetési integráció hamarosan elérhető! Addig lépj kapcsolatba velünk.")}
                        className="w-full py-2 rounded-lg text-xs font-semibold"
                        style={{ background: `${colors[planId]}20`, color: colors[planId] }}
                      >
                        {subscription.plan === "free" ? "Választás" : "Frissítés"}
                      </button>
                    )}
                    {!isActive && planId === "free" && (
                      <span className="text-xs text-center" style={{ color: "oklch(0.45 0.015 240)" }}>Jelenlegi csomag</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stripe placeholder */}
          <div className="rounded-xl border p-4" style={{ background: "oklch(0.75 0.18 75 / 8%)", borderColor: "oklch(0.75 0.18 75 / 20%)" }}>
            <div className="flex items-start gap-3">
              <CreditCard size={16} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.75 0.18 75)" }} />
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.8 0.15 75)" }}>Online fizetés hamarosan</p>
                <p className="text-xs" style={{ color: "oklch(0.65 0.015 240)" }}>A Stripe-alapú bankkártyás fizetés fejlesztés alatt áll. Addig csomag frissítéshez írj az info@g2amarketing.hu címre.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel – super_admin only */}
      {activeTab === "admin" && isSuperAdmin && (
        <div className="space-y-4">
          {/* API Config Status */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "oklch(0.88 0.008 240)" }}>API Konfiguráció Állapot</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "LinkedIn OAuth", ok: apiConfigStatus?.linkedInConfigured, detail: apiConfigStatus?.linkedInClientId ? `Client ID: ${apiConfigStatus.linkedInClientId}` : "Nincs beállítva" },
                { label: "Resend Email", ok: apiConfigStatus?.resendConfigured, detail: apiConfigStatus?.resendConfigured ? "Beállítva" : "Nincs beállítva" },
              ].map(({ label, ok, detail }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                  {ok
                    ? <Check size={16} style={{ color: "oklch(0.65 0.18 165)" }} />
                    : <AlertCircle size={16} style={{ color: "oklch(0.75 0.18 75)" }} />
                  }
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "oklch(0.88 0.008 240)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LinkedIn OAuth Credentials */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <h3 className="text-sm font-bold mb-1" style={{ color: "oklch(0.88 0.008 240)" }}>LinkedIn OAuth Credentials</h3>
            <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
              Ideiglenes beállítás (szerver újraindításig érvényes). Tartós tároláshoz használd a Secrets panelt.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>LinkedIn Client ID</label>
                <input
                  value={linkedInCredForm.clientId}
                  onChange={e => setLinkedInCredForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="86xxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
                  style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>LinkedIn Client Secret</label>
                <div className="relative">
                  <input
                    type={showLinkedInSecret ? "text" : "password"}
                    value={linkedInCredForm.clientSecret}
                    onChange={e => setLinkedInCredForm(f => ({ ...f, clientSecret: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg text-sm border font-mono pr-10"
                    style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLinkedInSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    style={{ color: "oklch(0.5 0.015 240)" }}
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
                style={{ background: "oklch(0.6 0.2 255)" }}
              >
                {setLinkedInCreds.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Mentés
              </button>
            </div>
          </div>

          {/* Onboarding tesztelési mód */}
          <div className="rounded-xl border p-5" style={{ background: "oklch(0.18 0.025 30 / 40%)", borderColor: "oklch(0.7 0.2 30 / 30%)" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "oklch(0.7 0.2 30 / 15%)" }}>🧪</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold mb-1" style={{ color: "oklch(0.88 0.008 240)" }}>Onboarding tesztelési mód</h3>
                <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
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
                  style={{ background: "oklch(0.55 0.18 30)" }}
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
            <h3 className="text-sm font-bold mb-3" style={{ color: "oklch(0.88 0.008 240)" }}>LinkedIn App Beállítási útmutató</h3>
            <ol className="space-y-2 text-xs" style={{ color: "oklch(0.65 0.015 240)" }}>
              {[
                "Nyisd meg: https://www.linkedin.com/developers/apps",
                "Hozz létre új alkalmazást (Create App)",
                "Products fülön add hozzá: \"Share on LinkedIn\" és \"Sign In with LinkedIn\"",
                "Auth fülön másold ki a Client ID és Client Secret értékeket",
                `Authorized redirect URL: ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.manus.space"}/api/oauth/linkedin/callback`,
                "Illeszd be a credentials-eket a fenti mezőkbe, vagy add hozzá a Secrets panelhez (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET)",
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>{i + 1}</span>
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
