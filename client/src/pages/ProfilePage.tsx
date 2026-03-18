/*
 * G2A Growth Engine – Profile Page
 * Design: "Dark Ops Dashboard"
 * Features: multi-client management, brand guidelines, voice, content pillars, social accounts
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { useProfile, ClientProfile, ContentPillar } from "@/contexts/ProfileContext";
import {
  Building2, Globe, Palette, Mic2, LayoutList, Share2,
  Plus, Edit2, Trash2, Check, X, ChevronRight, Linkedin,
  Facebook, Instagram, Twitter, ExternalLink, Users,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cardBg = "oklch(0.18 0.022 255)";
const border = "1px solid oklch(1 0 0 / 8%)";
const textPrimary = "oklch(0.92 0.008 240)";
const textMuted = "oklch(0.55 0.015 240)";
const blue = "oklch(0.6 0.2 255)";
const green = "oklch(0.65 0.18 165)";
const amber = "oklch(0.75 0.18 75)";
const red = "oklch(0.65 0.22 25)";

const platformIcons: Record<string, any> = {
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
};

const platformColors: Record<string, string> = {
  linkedin: "oklch(0.55 0.18 240)",
  facebook: "oklch(0.55 0.2 260)",
  instagram: "oklch(0.65 0.2 20)",
  twitter: "oklch(0.6 0.015 240)",
};

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
        <Icon size={14} />
      </div>
      <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{title}</p>
    </div>
  );
}

// ─── New Client Form ──────────────────────────────────────────────────────────

const emptyProfile = (): ClientProfile => ({
  id: `client_${Date.now()}`,
  name: "",
  initials: "",
  color: "oklch(0.6 0.2 255)",
  website: "",
  industry: "",
  description: "",
  primaryColor: "#3B82F6",
  secondaryColor: "#10B981",
  fontHeading: "Sora",
  fontBody: "Inter",
  brandVoice: { tone: "", style: "", avoid: "", keywords: [] },
  contentPillars: [],
  socialAccounts: [],
  createdAt: new Date().toISOString().slice(0, 10),
  active: true,
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profiles, activeProfile, setActiveProfileId, addProfile, updateProfile, deleteProfile } = useProfile();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<ClientProfile>(activeProfile);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState<ClientProfile>(emptyProfile());
  const [newKeyword, setNewKeyword] = useState("");
  const [newPillar, setNewPillar] = useState({ name: "", description: "", percentage: 25 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync editData when activeProfile changes
  const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    setEditMode(false);
    setEditData(profiles.find((p) => p.id === id) ?? profiles[0]);
  };

  const handleStartEdit = () => {
    setEditData({ ...activeProfile });
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    updateProfile(activeProfile.id, editData);
    setEditMode(false);
    toast.success("Profil sikeresen mentve!");
  };

  const handleCancelEdit = () => {
    setEditData(activeProfile);
    setEditMode(false);
  };

  const handleAddClient = () => {
    if (!newClient.name.trim()) { toast.error("A cég neve kötelező!"); return; }
    const initials = newClient.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    addProfile({ ...newClient, initials });
    setShowNewClient(false);
    setNewClient(emptyProfile());
    toast.success(`${newClient.name} profil létrehozva!`);
  };

  const handleDeleteProfile = () => {
    if (profiles.length <= 1) { toast.error("Legalább egy profil szükséges!"); return; }
    deleteProfile(activeProfile.id);
    setShowDeleteConfirm(false);
    toast.success("Profil törölve.");
  };

  const addKeyword = (isEdit: boolean) => {
    if (!newKeyword.trim()) return;
    if (isEdit) {
      setEditData((p) => ({ ...p, brandVoice: { ...p.brandVoice, keywords: [...p.brandVoice.keywords, newKeyword.trim()] } }));
    } else {
      setNewClient((p) => ({ ...p, brandVoice: { ...p.brandVoice, keywords: [...p.brandVoice.keywords, newKeyword.trim()] } }));
    }
    setNewKeyword("");
  };

  const removeKeyword = (kw: string, isEdit: boolean) => {
    if (isEdit) {
      setEditData((p) => ({ ...p, brandVoice: { ...p.brandVoice, keywords: p.brandVoice.keywords.filter((k) => k !== kw) } }));
    } else {
      setNewClient((p) => ({ ...p, brandVoice: { ...p.brandVoice, keywords: p.brandVoice.keywords.filter((k) => k !== kw) } }));
    }
  };

  const addPillar = () => {
    if (!newPillar.name.trim()) return;
    const pillar: ContentPillar = {
      id: `cp_${Date.now()}`,
      name: newPillar.name,
      description: newPillar.description,
      active: true,
      percentage: newPillar.percentage,
    };
    setEditData((p) => ({ ...p, contentPillars: [...p.contentPillars, pillar] }));
    setNewPillar({ name: "", description: "", percentage: 25 });
  };

  const togglePillar = (id: string) => {
    setEditData((p) => ({
      ...p,
      contentPillars: p.contentPillars.map((cp) => cp.id === id ? { ...cp, active: !cp.active } : cp),
    }));
  };

  const removePillar = (id: string) => {
    setEditData((p) => ({ ...p, contentPillars: p.contentPillars.filter((cp) => cp.id !== id) }));
  };

  const data = editMode ? editData : activeProfile;

  return (
    <DashboardLayout title="Ügyfél Profilok" subtitle="Kezelj több ügyfelet, arculatot és tartalmi irányt">
      <div className="flex gap-6">
        {/* Left: Client Switcher */}
        <div className="w-56 flex-shrink-0">
          <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Ügyfelek</p>
            </div>
            <div className="py-1">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleSwitchProfile(profile.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: activeProfile.id === profile.id ? "oklch(0.6 0.2 255 / 10%)" : "transparent",
                    borderLeft: activeProfile.id === profile.id ? `3px solid ${blue}` : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (activeProfile.id !== profile.id) e.currentTarget.style.background = "oklch(1 0 0 / 4%)"; }}
                  onMouseLeave={(e) => { if (activeProfile.id !== profile.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: profile.color }}>
                    {profile.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: textPrimary }}>{profile.name}</p>
                    <p className="text-xs truncate" style={{ color: textMuted }}>{profile.industry}</p>
                  </div>
                  {activeProfile.id === profile.id && <ChevronRight size={12} className="ml-auto flex-shrink-0" style={{ color: blue }} />}
                </button>
              ))}
            </div>
            <div className="px-3 py-3 border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
              <button
                onClick={() => setShowNewClient(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "oklch(0.6 0.2 255 / 10%)", color: blue }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 20%)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 10%)")}
              >
                <Plus size={13} /> Új ügyfél
              </button>
            </div>
          </div>
        </div>

        {/* Right: Profile Details */}
        <div className="flex-1 space-y-4">
          {/* Header */}
          <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ background: data.color }}>
                  {data.initials}
                </div>
                <div>
                  {editMode ? (
                    <input
                      value={editData.name}
                      onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                      className="text-lg font-bold bg-transparent border-b outline-none"
                      style={{ fontFamily: "Sora, sans-serif", color: textPrimary, borderColor: blue }}
                    />
                  ) : (
                    <h2 className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{data.name}</h2>
                  )}
                  <p className="text-sm mt-0.5" style={{ color: textMuted }}>{data.industry}</p>
                  {data.website && (
                    <a href={data.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-1" style={{ color: blue }}>
                      <Globe size={11} /> {data.website} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: green, color: "white" }}>
                      <Check size={12} /> Mentés
                    </button>
                    <button onClick={handleCancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "oklch(1 0 0 / 8%)", color: textMuted }}>
                      <X size={12} /> Mégse
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleStartEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: blue }}>
                      <Edit2 size={12} /> Szerkesztés
                    </button>
                    {profiles.length > 1 && (
                      <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: `${red.replace(")", " / 15%)")}`, color: red }}>
                        <Trash2 size={12} /> Törlés
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {editMode ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full mt-3 text-sm bg-transparent border rounded-lg p-2 outline-none resize-none"
                style={{ color: textMuted, borderColor: "oklch(1 0 0 / 15%)" }}
              />
            ) : (
              <p className="text-sm mt-3" style={{ color: textMuted }}>{data.description}</p>
            )}
          </div>

          {/* Two-column: Brand + Voice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Arculati Kézikönyv */}
            <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
              <SectionHeader icon={Palette} title="Arculati Kézikönyv" />
              <div className="space-y-3">
                <div>
                  <p className="text-xs mb-1.5" style={{ color: textMuted }}>Weboldal</p>
                  {editMode ? (
                    <input value={editData.website} onChange={(e) => setEditData((p) => ({ ...p, website: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="https://..." />
                  ) : (
                    <p className="text-xs" style={{ color: textPrimary }}>{data.website || "–"}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Elsődleges szín</p>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded" style={{ background: data.primaryColor }} />
                      {editMode ? (
                        <input type="color" value={editData.primaryColor} onChange={(e) => setEditData((p) => ({ ...p, primaryColor: e.target.value }))} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
                      ) : (
                        <span className="text-xs" style={{ color: textPrimary }}>{data.primaryColor}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Másodlagos szín</p>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded" style={{ background: data.secondaryColor }} />
                      {editMode ? (
                        <input type="color" value={editData.secondaryColor} onChange={(e) => setEditData((p) => ({ ...p, secondaryColor: e.target.value }))} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0" />
                      ) : (
                        <span className="text-xs" style={{ color: textPrimary }}>{data.secondaryColor}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Cím betűtípus</p>
                    {editMode ? (
                      <input value={editData.fontHeading} onChange={(e) => setEditData((p) => ({ ...p, fontHeading: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} />
                    ) : (
                      <p className="text-xs" style={{ color: textPrimary }}>{data.fontHeading}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Szöveg betűtípus</p>
                    {editMode ? (
                      <input value={editData.fontBody} onChange={(e) => setEditData((p) => ({ ...p, fontBody: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} />
                    ) : (
                      <p className="text-xs" style={{ color: textPrimary }}>{data.fontBody}</p>
                    )}
                  </div>
                </div>
                {editMode && (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: textMuted }}>Arculati kézikönyv URL</p>
                    <input value={editData.brandGuidelineUrl ?? ""} onChange={(e) => setEditData((p) => ({ ...p, brandGuidelineUrl: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="https://..." />
                  </div>
                )}
              </div>
            </div>

            {/* Márkahangg */}
            <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
              <SectionHeader icon={Mic2} title="Márkahangg" />
              <div className="space-y-3">
                {(["tone", "style", "avoid"] as const).map((field) => {
                  const labels: Record<string, string> = { tone: "Hangnem", style: "Stílus", avoid: "Kerülendő" };
                  return (
                    <div key={field}>
                      <p className="text-xs mb-1.5" style={{ color: textMuted }}>{labels[field]}</p>
                      {editMode ? (
                        <input value={editData.brandVoice[field]} onChange={(e) => setEditData((p) => ({ ...p, brandVoice: { ...p.brandVoice, [field]: e.target.value } }))} className="w-full text-xs bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} />
                      ) : (
                        <p className="text-xs" style={{ color: textPrimary }}>{data.brandVoice[field] || "–"}</p>
                      )}
                    </div>
                  );
                })}
                <div>
                  <p className="text-xs mb-1.5" style={{ color: textMuted }}>Kulcsszavak</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {data.brandVoice.keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
                        {kw}
                        {editMode && <button onClick={() => removeKeyword(kw, true)}><X size={10} /></button>}
                      </span>
                    ))}
                  </div>
                  {editMode && (
                    <div className="flex gap-2">
                      <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword(true)} className="flex-1 text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="Kulcsszó hozzáadása..." />
                      <button onClick={() => addKeyword(true)} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: `${blue.replace(")", " / 20%)")}`, color: blue }}><Plus size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content Pillars */}
          <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
            <SectionHeader icon={LayoutList} title="Tartalmi Irányok (Pillérek)" />
            <div className="space-y-2 mb-3">
              {data.contentPillars.map((cp) => (
                <div key={cp.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold" style={{ color: textPrimary }}>{cp.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: cp.active ? `${green.replace(")", " / 15%)")}` : "oklch(1 0 0 / 8%)", color: cp.active ? green : textMuted }}>
                        {cp.active ? "Aktív" : "Inaktív"}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: amber }}>{cp.percentage}%</span>
                    </div>
                    <p className="text-xs" style={{ color: textMuted }}>{cp.description}</p>
                    <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "oklch(1 0 0 / 8%)" }}>
                      <div className="h-full rounded-full" style={{ width: `${cp.percentage}%`, background: blue }} />
                    </div>
                  </div>
                  {editMode && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => togglePillar(cp.id)} className="p-1.5 rounded-lg text-xs" style={{ background: "oklch(1 0 0 / 8%)", color: textMuted }}>
                        {cp.active ? <X size={12} /> : <Check size={12} />}
                      </button>
                      <button onClick={() => removePillar(cp.id)} className="p-1.5 rounded-lg" style={{ background: `${red.replace(")", " / 10%)")}`, color: red }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {data.contentPillars.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: textMuted }}>Még nincsenek tartalmi irányok megadva.</p>
              )}
            </div>
            {editMode && (
              <div className="flex gap-2 items-end p-3 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                <div className="flex-1">
                  <input value={newPillar.name} onChange={(e) => setNewPillar((p) => ({ ...p, name: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none mb-1.5" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="Pillér neve..." />
                  <input value={newPillar.description} onChange={(e) => setNewPillar((p) => ({ ...p, description: e.target.value }))} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="Leírás..." />
                </div>
                <div className="w-16">
                  <p className="text-xs mb-1" style={{ color: textMuted }}>Arány %</p>
                  <input type="number" min={1} max={100} value={newPillar.percentage} onChange={(e) => setNewPillar((p) => ({ ...p, percentage: Number(e.target.value) }))} className="w-full text-xs bg-transparent border rounded-lg px-2 py-1.5 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} />
                </div>
                <button onClick={addPillar} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: `${blue.replace(")", " / 20%)")}`, color: blue }}>
                  <Plus size={12} /> Hozzáad
                </button>
              </div>
            )}
          </div>

          {/* Social Accounts */}
          <div className="rounded-xl p-5" style={{ background: cardBg, border }}>
            <SectionHeader icon={Share2} title="Social Media Fiókok" />
            <div className="grid grid-cols-2 gap-3">
              {data.socialAccounts.map((acc) => {
                const Icon = platformIcons[acc.platform] ?? Share2;
                const color = platformColors[acc.platform];
                return (
                  <div key={acc.platform} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color.replace(")", " / 15%)")}`, color }}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold capitalize" style={{ color: textPrimary }}>{acc.platform}</p>
                      <p className="text-xs truncate" style={{ color: textMuted }}>@{acc.handle || "–"}</p>
                      {acc.followers && <p className="text-xs" style={{ color: green }}>{acc.followers.toLocaleString()} követő</p>}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: acc.connected ? `${green.replace(")", " / 15%)")}` : "oklch(1 0 0 / 8%)", color: acc.connected ? green : textMuted }}>
                      {acc.connected ? "Csatlakozva" : "Nincs"}
                    </span>
                  </div>
                );
              })}
              {data.socialAccounts.length === 0 && (
                <p className="text-xs col-span-2 text-center py-4" style={{ color: textMuted }}>Nincsenek social fiókok megadva. A Social Media menüpontban csatlakoztathatsz fiókokat.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Client Modal */}
      <DetailModal isOpen={showNewClient} onClose={() => setShowNewClient(false)} title="Új Ügyfél Profil" subtitle="Töltsd ki az alapadatokat az induláshoz"
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewClient(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "oklch(1 0 0 / 8%)", color: textMuted }}>Mégse</button>
            <button onClick={handleAddClient} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: blue, color: "white" }}>Profil létrehozása</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: textMuted }}>Cég neve *</label>
              <input value={newClient.name} onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="pl. Nexus Solutions Zrt." />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: textMuted }}>Iparág</label>
              <input value={newClient.industry} onChange={(e) => setNewClient((p) => ({ ...p, industry: e.target.value }))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="pl. Manufacturing" />
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: textMuted }}>Weboldal</label>
            <input value={newClient.website} onChange={(e) => setNewClient((p) => ({ ...p, website: e.target.value }))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="https://..." />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: textMuted }}>Rövid leírás</label>
            <textarea value={newClient.description} onChange={(e) => setNewClient((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none resize-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="Mivel foglalkozik a cég?" />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: textMuted }}>Márkahangg – Hangnem</label>
            <input value={newClient.brandVoice.tone} onChange={(e) => setNewClient((p) => ({ ...p, brandVoice: { ...p.brandVoice, tone: e.target.value } }))} className="w-full text-sm bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="pl. Szakmai, hiteles, közvetlen" />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: textMuted }}>Kulcsszavak</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {newClient.brandVoice.keywords.map((kw) => (
                <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: `${blue.replace(")", " / 15%)")}`, color: blue }}>
                  {kw} <button onClick={() => removeKeyword(kw, false)}><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword(false)} className="flex-1 text-sm bg-transparent border rounded-lg px-3 py-2 outline-none" style={{ color: textPrimary, borderColor: "oklch(1 0 0 / 15%)" }} placeholder="Kulcsszó + Enter" />
              <button onClick={() => addKeyword(false)} className="px-3 py-2 rounded-lg text-sm" style={{ background: `${blue.replace(")", " / 20%)")}`, color: blue }}><Plus size={14} /></button>
            </div>
          </div>
        </div>
      </DetailModal>

      {/* Delete Confirm Modal */}
      <DetailModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Profil törlése" subtitle={`Biztosan törlöd a(z) ${activeProfile.name} profilt?`}
        footer={
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ background: "oklch(1 0 0 / 8%)", color: textMuted }}>Mégse</button>
            <button onClick={handleDeleteProfile} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: red, color: "white" }}>Törlés</button>
          </div>
        }
      >
        <p className="text-sm" style={{ color: textMuted }}>Ez a művelet visszavonhatatlan. Az összes hozzá kapcsolódó adat törlésre kerül.</p>
      </DetailModal>
    </DashboardLayout>
  );
}
