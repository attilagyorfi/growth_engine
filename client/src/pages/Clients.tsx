/*
 * G2A Growth Engine – Clients v1.0
 * Kliens lista, onboarding indítás, intelligence review
 */

import { useState } from "react";
import {
  Users, Plus, Pencil, Trash2, X, Loader2, ChevronRight,
  Globe, Building2, Sparkles, Brain, ExternalLink,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { useLocation } from "wouter";

const cardBg = "oklch(0.17 0.022 255)";
const border = "oklch(1 0 0 / 8%)";

const INDUSTRY_OPTIONS = [
  "Marketing & Reklám", "Technológia", "Pénzügy", "Egészségügy",
  "Kereskedelem", "Ingatlan", "Oktatás", "Vendéglátás", "Gyártás", "Egyéb",
];

const INITIALS_COLORS = [
  "oklch(0.6 0.2 255)", "oklch(0.65 0.18 165)", "oklch(0.7 0.18 300)",
  "oklch(0.75 0.18 75)", "oklch(0.65 0.22 25)", "oklch(0.6 0.2 200)",
];

export default function Clients() {
  const { activeProfile, profiles, setActiveProfileId } = useProfile();
  const [newClientModal, setNewClientModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [newForm, setNewForm] = useState<any>({ name: "", initials: "", industry: "", website: "", description: "" });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const upsertProfile = trpc.profiles.upsert.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      setNewClientModal(false);
      setEditModal(false);
      setNewForm({ name: "", initials: "", industry: "", website: "", description: "" });
      toast.success("Kliens mentve");
    }
  });

  const deleteProfile = trpc.profiles.delete.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      toast.success("Kliens törölve");
    }
  });

  const handleCreateClient = async () => {
    if (!newForm.name) { toast.error("Adj meg egy nevet"); return; }
    const initials = newForm.initials || newForm.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 3);
    const color = INITIALS_COLORS[Math.floor(Math.random() * INITIALS_COLORS.length)];
    await upsertProfile.mutateAsync({
      name: newForm.name,
      initials,
      color,
      industry: newForm.industry,
      website: newForm.website,
      description: newForm.description,
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedClient) return;
    await upsertProfile.mutateAsync({ id: selectedClient.id, ...editForm });
  };

  const handleDeleteClient = async (client: any) => {
    if (profiles.length <= 1) { toast.error("Legalább egy kliens szükséges"); return; }
    await deleteProfile.mutateAsync({ id: client.id });
  };

  const handleStartOnboarding = (client: any) => {
    setActiveProfileId(client.id);
    navigate("/onboarding");
  };

  const handleViewIntelligence = (client: any) => {
    setActiveProfileId(client.id);
    navigate("/intelligence");
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Kliensek</h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
            {profiles.length} kliens · Aktív: {activeProfile.name}
          </p>
        </div>
        <button onClick={() => setNewClientModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
        >
          <Plus size={14} /> Új Kliens
        </button>
      </div>

      {/* Client grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((client: any) => {
          const isActive = client.id === activeProfile.id;
          return (
            <div key={client.id} className="rounded-xl border p-5 transition-all"
              style={{ background: isActive ? "linear-gradient(135deg, oklch(0.6 0.2 255 / 12%), oklch(0.55 0.18 165 / 12%))" : cardBg, borderColor: isActive ? "oklch(0.6 0.2 255 / 40%)" : border }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: `${client.color ?? "oklch(0.6 0.2 255)"} / 20%`, color: client.color ?? "oklch(0.6 0.2 255)", fontFamily: "Sora, sans-serif" }}>
                    {client.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{client.name}</p>
                    {client.industry && <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{client.industry}</p>}
                  </div>
                </div>
                {isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: "oklch(0.65 0.18 165 / 20%)", color: "oklch(0.65 0.18 165)" }}>
                    Aktív
                  </span>
                )}
              </div>

              {/* Description */}
              {client.description && (
                <p className="text-xs mb-4 line-clamp-2" style={{ color: "oklch(0.6 0.015 240)" }}>{client.description}</p>
              )}

              {/* Website */}
              {client.website && (
                <div className="flex items-center gap-1.5 mb-4">
                  <Globe size={11} style={{ color: "oklch(0.5 0.015 240)" }} />
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs hover:underline" style={{ color: "oklch(0.6 0.2 255)" }}>
                    {client.website.replace(/^https?:\/\//, "")}
                  </a>
                  <ExternalLink size={9} style={{ color: "oklch(0.5 0.015 240)" }} />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {!isActive && (
                  <button onClick={() => setActiveProfileId(client.id)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}
                  >
                    Váltás
                  </button>
                )}
                <button onClick={() => handleViewIntelligence(client)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: "oklch(0.7 0.18 300 / 15%)", color: "oklch(0.7 0.18 300)" }}
                >
                  <Brain size={11} /> Intelligence
                </button>
                <button onClick={() => { setSelectedClient(client); setEditForm({ name: client.name, initials: client.initials, industry: client.industry, website: client.website, description: client.description }); setEditModal(true); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "oklch(0.22 0.02 255)" }}
                >
                  <Pencil size={12} style={{ color: "oklch(0.6 0.015 240)" }} />
                </button>
                {profiles.length > 1 && (
                  <button onClick={() => handleDeleteClient(client)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(0.65 0.22 25 / 10%)" }}
                  >
                    <Trash2 size={12} style={{ color: "oklch(0.65 0.22 25)" }} />
                  </button>
                )}
              </div>

              {/* Onboarding CTA */}
              <button onClick={() => handleStartOnboarding(client)}
                className="w-full mt-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                style={{ background: "oklch(0.75 0.18 75 / 10%)", color: "oklch(0.75 0.18 75)" }}
              >
                <Sparkles size={11} /> Onboarding indítása
              </button>
            </div>
          );
        })}

        {/* Add new client card */}
        <button onClick={() => setNewClientModal(true)}
          className="rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center gap-3 transition-all hover:opacity-80 min-h-[200px]"
          style={{ borderColor: "oklch(0.6 0.2 255 / 30%)", color: "oklch(0.6 0.2 255 / 60%)" }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 10%)" }}>
            <Plus size={20} style={{ color: "oklch(0.6 0.2 255)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "oklch(0.6 0.2 255)" }}>Új kliens hozzáadása</p>
        </button>
      </div>

      {/* New Client Modal */}
      {newClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Új Kliens</h3>
              <button onClick={() => setNewClientModal(false)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["name", "Kliens neve *"], ["initials", "Rövidítés (pl. G2A)"], ["industry", "Iparág"], ["website", "Weboldal"], ["description", "Leírás"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>{l}</label>
                  {k === "industry" ? (
                    <select value={newForm[k] ?? ""} onChange={e => setNewForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
                      <option value="">Válassz...</option>
                      {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : k === "description" ? (
                    <textarea value={newForm[k] ?? ""} onChange={e => setNewForm((f: any) => ({ ...f, [k]: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                  ) : (
                    <input value={newForm[k] ?? ""} onChange={e => setNewForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setNewClientModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button onClick={handleCreateClient} disabled={upsertProfile.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "oklch(0.6 0.2 255)" }}>
                {upsertProfile.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Kliens Szerkesztése</h3>
              <button onClick={() => { setEditModal(false); setSelectedClient(null); }} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["name", "Kliens neve *"], ["initials", "Rövidítés"], ["industry", "Iparág"], ["website", "Weboldal"], ["description", "Leírás"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>{l}</label>
                  {k === "industry" ? (
                    <select value={editForm[k] ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
                      <option value="">Válassz...</option>
                      {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : k === "description" ? (
                    <textarea value={editForm[k] ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                  ) : (
                    <input value={editForm[k] ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setEditModal(false); setSelectedClient(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button onClick={handleSaveEdit} disabled={upsertProfile.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "oklch(0.6 0.2 255)" }}>
                {upsertProfile.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
