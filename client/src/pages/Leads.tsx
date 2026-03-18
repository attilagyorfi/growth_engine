/*
 * G2A Growth Engine – Leads Page
 * Design: "Dark Ops Dashboard"
 * Features: search filter, status filter, status change dropdown, Add Lead modal, DataContext
 */

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { UserPlus, Search, Filter, X, ChevronDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useData, Lead, LeadStatus } from "@/contexts/DataContext";

const statusLabels: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "Új", cls: "status-new" },
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  sent: { label: "Kiküldve", cls: "status-sent" },
  replied: { label: "Válaszolt", cls: "status-replied" },
  rejected: { label: "Elutasítva", cls: "status-rejected" },
};

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Új" },
  { value: "pending_approval", label: "Jóváhagyásra vár" },
  { value: "sent", label: "Kiküldve" },
  { value: "replied", label: "Válaszolt" },
  { value: "rejected", label: "Elutasítva" },
];

const industryOptions = ["IT Services", "Manufacturing", "Finance", "Healthcare", "Retail", "Egyéb"];
const emptyForm = { company: "", contact: "", title: "", email: "", industry: "IT Services", size: "50-200", status: "new" as LeadStatus };

export default function Leads() {
  const { leads, setLeads } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.company.toLowerCase().includes(q) || l.contact.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q);
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const updateStatus = (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    setOpenStatusId(null);
    toast.success(`Lead státusz frissítve: ${statusLabels[status].label}`);
  };

  const handleAdd = () => {
    if (!form.company.trim() || !form.contact.trim() || !form.email.trim()) {
      setFormError("A cég neve, kapcsolattartó és email megadása kötelező.");
      return;
    }
    const newLead: Lead = {
      id: String(Date.now()),
      company: form.company, contact: form.contact, title: form.title,
      email: form.email, industry: form.industry, size: form.size,
      status: form.status, added: new Date().toISOString().split("T")[0],
    };
    setLeads((prev) => [newLead, ...prev]);
    setForm({ ...emptyForm });
    setFormError("");
    setShowAddModal(false);
    toast.success(`Lead hozzáadva: ${form.company}`);
  };

  return (
    <DashboardLayout title="Lead Adatbázis" subtitle="Összes azonosított és minősített potenciális ügyfél">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <Search size={14} style={{ color: "oklch(0.55 0.015 240)" }} />
            <input type="text" placeholder="Keresés cég, kontakt, iparág..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-48" style={{ color: "oklch(0.85 0.008 240)" }} />
            {search && <button onClick={() => setSearch("")}><X size={12} style={{ color: "oklch(0.55 0.015 240)" }} /></button>}
          </div>
          <button onClick={() => setShowFilter((v) => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: showFilter ? "oklch(0.6 0.2 255 / 15%)" : "oklch(0.18 0.022 255)", border: `1px solid ${showFilter ? "oklch(0.6 0.2 255 / 40%)" : "oklch(1 0 0 / 8%)"}`, color: showFilter ? "oklch(0.75 0.18 255)" : "oklch(0.55 0.015 240)" }}>
            <Filter size={14} />
            Szűrő {statusFilter && <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "oklch(0.6 0.2 255 / 30%)" }}>1</span>}
          </button>
          {showFilter && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.85 0.008 240)" }}>
              <option value="" style={{ background: "oklch(0.18 0.022 255)" }}>Minden státusz</option>
              {statusOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "oklch(0.18 0.022 255)" }}>{o.label}</option>)}
            </select>
          )}
          {(search || statusFilter) && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); }} className="text-xs px-2 py-1.5 rounded-md" style={{ color: "oklch(0.65 0.22 25)", background: "oklch(0.65 0.22 25 / 10%)" }}>
              Szűrők törlése
            </button>
          )}
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
          style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}>
          <UserPlus size={14} />Lead Hozzáadása
        </button>
      </div>

      {/* Table */}
      <div className="g2a-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
              {["Cég", "Kapcsolattartó", "Iparág", "Méret", "Státusz", "Hozzáadva"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.45 0.015 240)", fontFamily: "Sora, sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "oklch(0.5 0.015 240)" }}>Nincs találat.</td></tr>
            ) : filtered.map((lead, i) => {
              const st = statusLabels[lead.status];
              return (
                <tr key={lead.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedLead(lead)} className="text-left hover:underline">
                      <p className="font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{lead.company}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: "oklch(0.75 0.008 240)" }}>{lead.contact}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{lead.title}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>{lead.industry}</td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>{lead.size} fő</td>
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <button onClick={() => setOpenStatusId(openStatusId === lead.id ? null : lead.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium status-badge ${st.cls}`}>
                        {st.label}<ChevronDown size={10} />
                      </button>
                      {openStatusId === lead.id && (
                        <div className="absolute left-0 top-8 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "oklch(0.2 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)", minWidth: "160px" }}>
                          {statusOptions.map((o) => (
                            <button key={o.value} onClick={() => updateStatus(lead.id, o.value)}
                              className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                              style={{ color: lead.status === o.value ? "oklch(0.75 0.18 255)" : "oklch(0.72 0.01 240)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 6%)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              {lead.status === o.value && <CheckCircle size={10} style={{ color: "oklch(0.75 0.18 255)" }} />}
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.5 0.015 240)" }}>{lead.added}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>{filtered.length} lead / {leads.length} összesen</p>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <DetailModal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead.company} subtitle={`Hozzáadva: ${selectedLead.added}`}
          footer={<button onClick={() => setSelectedLead(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Bezárás</button>}
        >
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Kapcsolattartó", value: selectedLead.contact },
              { label: "Beosztás", value: selectedLead.title },
              { label: "Email", value: selectedLead.email },
              { label: "Iparág", value: selectedLead.industry },
              { label: "Cégméret", value: `${selectedLead.size} fő` },
            ].map((f) => (
              <div key={f.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>{f.label}</p>
                <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.008 240)" }}>{f.value}</p>
              </div>
            ))}
            <div className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>Státusz</p>
              <div className="relative inline-block">
                <button onClick={() => setOpenStatusId(openStatusId === selectedLead.id + "_modal" ? null : selectedLead.id + "_modal")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium status-badge ${statusLabels[selectedLead.status].cls}`}>
                  {statusLabels[selectedLead.status].label}<ChevronDown size={10} />
                </button>
                {openStatusId === selectedLead.id + "_modal" && (
                  <div className="absolute left-0 top-8 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "oklch(0.2 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)", minWidth: "160px" }}>
                    {statusOptions.map((o) => (
                      <button key={o.value} onClick={() => { updateStatus(selectedLead.id, o.value); setSelectedLead((prev) => prev ? { ...prev, status: o.value } : null); }}
                        className="w-full text-left px-3 py-2 text-xs transition-colors"
                        style={{ color: selectedLead.status === o.value ? "oklch(0.75 0.18 255)" : "oklch(0.72 0.01 240)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 6%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >{o.label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Add Lead Modal */}
      <DetailModal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setForm({ ...emptyForm }); setFormError(""); }} title="Új Lead Hozzáadása" subtitle="Töltsd ki az alábbi mezőket"
        footer={
          <>
            <button onClick={() => { setShowAddModal(false); setForm({ ...emptyForm }); setFormError(""); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}>Lead Mentése</button>
          </>
        }
      >
        <div className="space-y-3">
          {formError && <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.75 0.2 25)" }}>{formError}</p>}
          {[
            { key: "company", label: "Cég neve *", placeholder: "pl. TechVision Kft." },
            { key: "contact", label: "Kapcsolattartó neve *", placeholder: "pl. Kovács Péter" },
            { key: "title", label: "Beosztás", placeholder: "pl. CEO" },
            { key: "email", label: "Email cím *", placeholder: "pl. kovacs@ceg.hu" },
            { key: "size", label: "Cégméret (fő)", placeholder: "pl. 50-200" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>{f.label}</label>
              <input type={f.key === "email" ? "email" : "text"} placeholder={f.placeholder}
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Iparág</label>
            <select value={form.industry} onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
              {industryOptions.map((o) => <option key={o} value={o} style={{ background: "oklch(0.22 0.02 255)" }}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Kezdeti Státusz</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as LeadStatus }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}>
              {statusOptions.map((o) => <option key={o.value} value={o.value} style={{ background: "oklch(0.22 0.02 255)" }}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </DetailModal>

      {openStatusId && <div className="fixed inset-0 z-10" onClick={() => setOpenStatusId(null)} />}
    </DashboardLayout>
  );
}
