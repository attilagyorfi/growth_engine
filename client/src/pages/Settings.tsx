/*
 * G2A Growth Engine – Settings v1.0
 * Brand Center, Integrations, Team, Audit Log összevonva
 */

import { useState, useEffect } from "react";
import {
  Palette, Plug, Users, ClipboardList, X, Loader2, Plus,
  Save, Globe, Mail, Check, AlertCircle, Settings2, Eye, EyeOff,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { useAppAuth } from "@/hooks/useAppAuth";
import { toast } from "sonner";

type Tab = "brand" | "integrations" | "team" | "audit" | "admin" | "fiok";

const BASE_TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: "fiok", label: "Fiók", icon: <Users size={14} /> },
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
  const [activeTab, setActiveTab] = useState<Tab>("brand");
  const [linkedInCredForm, setLinkedInCredForm] = useState({ clientId: "", clientSecret: "" });
  const [showLinkedInSecret, setShowLinkedInSecret] = useState(false);
  const { data: apiConfigStatus, refetch: refetchApiConfig } = trpc.apiConfig.status.useQuery(
    undefined,
    { enabled: isSuperAdmin }
  );
  const resetMyOnboarding = trpc.appAuth.resetMyOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Onboarding állapot visszaállítva. Következő belépéskor az onboarding oldal jelenik meg.");
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
          {/* Email Integration */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
                <Mail size={16} style={{ color: "oklch(0.6 0.2 255)" }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>Email Integráció</h3>
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Gmail vagy Outlook csatlakoztatása</p>
              </div>
              {emailIntegration?.connected && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>
                  <Check size={10} /> Csatlakozva
                </span>
              )}
            </div>
            {emailIntegration?.connected ? (
              <div className="p-3 rounded-lg" style={{ background: "oklch(0.65 0.18 165 / 10%)", borderColor: "oklch(0.65 0.18 165 / 20%)" }}>
                <p className="text-sm" style={{ color: "oklch(0.78 0.008 240)" }}>{emailIntegration.email}</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.015 240)" }}>{emailIntegration.provider === "gmail" ? "Gmail" : "Outlook"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Email szolgáltató</label>
                  <select value={emailForm.provider} onChange={e => setEmailForm((f: any) => ({ ...f, provider: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Email cím</label>
                  <input value={emailForm.email} onChange={e => setEmailForm((f: any) => ({ ...f, email: e.target.value }))} type="email" placeholder="pelda@gmail.com"
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                </div>
                <button onClick={async () => {
                  if (!emailForm.email) { toast.error("Add meg az email címet"); return; }
                  await upsertEmailIntegration.mutateAsync({ profileId: activeProfile.id, provider: emailForm.provider, email: emailForm.email, connected: true });
                }} disabled={upsertEmailIntegration.isPending}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "oklch(0.6 0.2 255)" }}>
                  {upsertEmailIntegration.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Csatlakoztatás
                </button>
              </div>
            )}
          </div>

          {/* Social Media Integrations */}
          <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: "oklch(0.88 0.008 240)" }}>Social Media</h3>
              {linkedInOAuthData?.url ? (
                <a href={linkedInOAuthData.url}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "oklch(0.55 0.18 255 / 15%)", color: "oklch(0.55 0.18 255)" }}>
                  <Plus size={12} /> LinkedIn csatlakoztatás
                </a>
              ) : (
                <button onClick={() => setLinkedInModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "oklch(0.55 0.18 255 / 15%)", color: "oklch(0.55 0.18 255)" }}>
                  <Plus size={12} /> LinkedIn csatlakoztatás
                </button>
              )}
            </div>
            {socialConnections.filter(c => c.isActive).length === 0 ? (
              <div className="text-center py-8">
                <Globe size={28} className="mx-auto mb-2" style={{ color: "oklch(0.35 0.015 240)" }} />
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Nincs csatlakoztatott fiók</p>
                <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Csatlakoztass egy LinkedIn fiókot a direkt publikáláshoz</p>
              </div>
            ) : (
              <div className="space-y-2">
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
