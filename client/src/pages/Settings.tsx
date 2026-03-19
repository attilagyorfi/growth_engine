/*
 * G2A Growth Engine – Settings v1.0
 * Brand Center, Integrations, Team, Audit Log összevonva
 */

import { useState } from "react";
import {
  Palette, Plug, Users, ClipboardList, X, Loader2, Plus,
  Save, Globe, Mail, Check, AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";

type Tab = "brand" | "integrations" | "team" | "audit";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "brand", label: "Brand Center", icon: <Palette size={14} /> },
  { id: "integrations", label: "Integrációk", icon: <Plug size={14} /> },
  { id: "team", label: "Csapat", icon: <Users size={14} /> },
  { id: "audit", label: "Audit Log", icon: <ClipboardList size={14} /> },
];

const cardBg = "oklch(0.17 0.022 255)";
const border = "oklch(1 0 0 / 8%)";

export default function Settings() {
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("brand");
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

  const upsertEmailIntegration = trpc.emailIntegration.upsert.useMutation({
    onSuccess: () => {
      utils.emailIntegration.get.invalidate({ profileId: activeProfile.id });
      toast.success("Email integráció mentve");
    }
  });

  const [emailForm, setEmailForm] = useState<any>({ provider: "gmail", email: "" });

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
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeTab === tab.id ? "oklch(0.6 0.2 255)" : "transparent", color: activeTab === tab.id ? "white" : "oklch(0.55 0.015 240)" }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

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
            <h3 className="text-sm font-bold mb-4" style={{ color: "oklch(0.88 0.008 240)" }}>Social Media</h3>
            <div className="space-y-3">
              {[
                { platform: "LinkedIn", color: "oklch(0.6 0.2 255)", connected: false },
                { platform: "Facebook", color: "oklch(0.6 0.2 240)", connected: false },
                { platform: "Instagram", color: "oklch(0.7 0.18 300)", connected: false },
              ].map(s => (
                <div key={s.platform} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color} / 15%` }}>
                      <Globe size={14} style={{ color: s.color }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "oklch(0.82 0.008 240)" }}>{s.platform}</p>
                  </div>
                  <button onClick={() => toast.info("Social media integráció hamarosan")}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: `${s.color} / 15%`, color: s.color }}>
                    Csatlakoztatás
                  </button>
                </div>
              ))}
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
          <div className="text-center py-16">
            <ClipboardList size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Nincs rögzített esemény</p>
            <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>A rendszeresemények itt lesznek láthatók</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
