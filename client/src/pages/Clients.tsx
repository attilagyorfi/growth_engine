/**
 * G2A Growth Engine – Admin CRM Panel
 * Csak super_admin számára elérhető – ügyfelek CRM áttekintője
 * Szenzitív adatokat (jelszó, stratégia, stb.) NEM tartalmaz
 */

import { useState } from "react";
import {
  Users, Search, Pencil, X, Loader2, Globe, Building2,
  Phone, Mail, Package, CheckCircle, XCircle, Clock,
  ChevronDown, StickyNote, RefreshCw,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/hooks/useAppAuth";
import { toast } from "sonner";
import { useLocation } from "wouter";

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:    { label: "Free",    color: "var(--qa-fg3)" },
  starter: { label: "Starter", color: "var(--qa-success)" },
  pro:     { label: "Pro",     color: "var(--qa-accent)" },
  agency:  { label: "Agency",  color: "var(--qa-warning)" },
};

const PLAN_OPTIONS = ["free", "starter", "pro", "agency"] as const;

type CRMClient = {
  id: string;
  email: string;
  name: string | null;
  companyName: string | null;
  contactPerson: string | null;
  phone: string | null;
  website: string | null;
  subscriptionPlan: string;
  active: boolean;
  onboardingCompleted: boolean;
  profileId: string | null;
  notes: string | null;
  createdAt: Date;
  lastSignedIn: Date | null;
};

export default function Clients() {
  const { isSuperAdmin } = useAppAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CRMClient | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const utils = trpc.useUtils();

  const { data: clients = [], isLoading } = trpc.appAuth.adminGetCRMClients.useQuery(undefined, {
    enabled: isSuperAdmin,
  });

  const updateClient = trpc.appAuth.adminUpdateCRMClient.useMutation({
    onSuccess: () => {
      utils.appAuth.adminGetCRMClients.invalidate();
      setEditModal(false);
      setSelectedClient(null);
      toast.success("Ügyfél adatai frissítve");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <XCircle size={40} style={{ color: "var(--qa-danger)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--qa-fg3)" }}>
            Ez az oldal csak G2A adminok számára érhető el.
          </p>
          <button onClick={() => navigate("/iranyitopult")}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--qa-accent)" }}>
            Vissza az irányítópultra
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const filtered = clients.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (client: CRMClient) => {
    setSelectedClient(client);
    setEditForm({
      companyName: client.companyName ?? "",
      contactPerson: client.contactPerson ?? "",
      phone: client.phone ?? "",
      subscriptionPlan: client.subscriptionPlan,
      notes: client.notes ?? "",
      active: client.active,
    });
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!selectedClient) return;
    await updateClient.mutateAsync({ userId: selectedClient.id, ...editForm });
  };

  const formatDate = (d: Date | null) => {
    if (!d) return "–";
    return new Date(d).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
            Ügyfelek CRM
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--qa-fg3)" }}>
            {clients.length} regisztrált ügyfél · csak G2A admin látja
          </p>
        </div>
        <button onClick={() => utils.appAuth.adminGetCRMClients.invalidate()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>
          <RefreshCw size={13} /> Frissítés
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--qa-fg4)" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Keresés név, email, cég alapján..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border"
          style={{ background: "var(--qa-surface)", borderColor: border, color: "var(--qa-fg2)" }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {PLAN_OPTIONS.map(plan => {
          const count = clients.filter(c => c.subscriptionPlan === plan).length;
          const { label, color } = PLAN_LABELS[plan];
          return (
            <div key={plan} className="rounded-xl border p-4" style={{ background: cardBg, borderColor: border }}>
              <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
              <p className="text-2xl font-bold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Client table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--qa-accent)" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Users size={32} style={{ color: "var(--qa-fg4)" }} />
          <p className="text-sm" style={{ color: "var(--qa-fg4)" }}>Nincs találat</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => {
            const plan = PLAN_LABELS[client.subscriptionPlan] ?? PLAN_LABELS.free;
            return (
              <div key={client.id} className="rounded-xl border p-4 transition-all"
                style={{ background: cardBg, borderColor: border }}>
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: "var(--qa-accent)" }}>
                    {(client.name ?? client.email).slice(0, 2).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>
                        {client.companyName || client.name || "–"}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${plan.color} / 15%`, color: plan.color }}>
                        {plan.label}
                      </span>
                      {client.active ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "oklch(from var(--qa-success) l c h / 15%)", color: "var(--qa-success)" }}>
                          Aktív
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "var(--qa-danger)" }}>
                          Inaktív
                        </span>
                      )}
                      {client.onboardingCompleted ? (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--qa-success)" }}>
                          <CheckCircle size={11} /> Onboarding kész
                        </span>
                      ) : (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--qa-warning)" }}>
                          <Clock size={11} /> Onboarding folyamatban
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs flex items-center gap-1" style={{ color: "var(--qa-fg3)" }}>
                        <Mail size={10} /> {client.email}
                      </span>
                      {client.contactPerson && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--qa-fg3)" }}>
                          <Users size={10} /> {client.contactPerson}
                        </span>
                      )}
                      {client.phone && (
                        <span className="text-xs flex items-center gap-1" style={{ color: "var(--qa-fg3)" }}>
                          <Phone size={10} /> {client.phone}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                        Regisztrált: {formatDate(client.createdAt)} · Utolsó belépés: {formatDate(client.lastSignedIn)}
                      </span>
                    </div>

                    {client.notes && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <StickyNote size={11} style={{ color: "var(--qa-warning)", flexShrink: 0, marginTop: 2 }} />
                        <p className="text-xs line-clamp-2" style={{ color: "var(--qa-fg3)" }}>{client.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Edit button */}
                  <button onClick={() => openEdit(client)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                    style={{ background: "var(--qa-surface2)" }}>
                    <Pencil size={13} style={{ color: "var(--qa-fg3)" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "var(--qa-border-hi)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
                Ügyfél CRM Adatai
              </h3>
              <button onClick={() => { setEditModal(false); setSelectedClient(null); }} style={{ color: "var(--qa-fg4)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 p-3 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--qa-fg)" }}>{selectedClient.name ?? "–"}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg3)" }}>{selectedClient.email}</p>
            </div>

            <div className="space-y-3">
              {/* Company name */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Cég neve</label>
                <input value={editForm.companyName ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, companyName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
              </div>
              {/* Contact person */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Kapcsolattartó személy</label>
                <input value={editForm.contactPerson ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, contactPerson: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
              </div>
              {/* Phone */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Telefonszám</label>
                <input value={editForm.phone ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
              </div>
              {/* Subscription plan */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Előfizetési csomag</label>
                <select value={editForm.subscriptionPlan ?? "free"} onChange={e => setEditForm((f: any) => ({ ...f, subscriptionPlan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}>
                  {PLAN_OPTIONS.map(p => <option key={p} value={p}>{PLAN_LABELS[p].label}</option>)}
                </select>
              </div>
              {/* Active */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold" style={{ color: "var(--qa-fg3)" }}>Aktív ügyfél</label>
                <button onClick={() => setEditForm((f: any) => ({ ...f, active: !f.active }))}
                  className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                  style={{ background: editForm.active ? "var(--qa-success)" : "oklch(0.3 0.02 255)" }}>
                  <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: editForm.active ? "calc(100% - 18px)" : "2px" }} />
                </button>
              </div>
              {/* Notes */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Megjegyzések (belső)</label>
                <textarea value={editForm.notes ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => { setEditModal(false); setSelectedClient(null); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>
                Mégse
              </button>
              <button onClick={handleSave} disabled={updateClient.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: "var(--qa-accent)" }}>
                {updateClient.isPending ? <Loader2 size={13} className="animate-spin" /> : null} Mentés
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
