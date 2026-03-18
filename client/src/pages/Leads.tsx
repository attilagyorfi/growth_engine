/*
 * G2A Growth Engine – Leads Page
 * Design: "Dark Ops Dashboard"
 * Features: search filter, status filter, Add Lead modal, row click detail modal
 */

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { UserPlus, Search, Filter, X } from "lucide-react";

type Lead = {
  id: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  industry: string;
  size: string;
  status: string;
  added: string;
};

const initialLeads: Lead[] = [
  { id: "1", company: "TechVision Kft.", contact: "Kovács Péter", title: "CEO", email: "kovacs.peter@techvision.hu", industry: "IT Services", size: "200-500", status: "pending_approval", added: "2026-03-18" },
  { id: "2", company: "Nexus Solutions Zrt.", contact: "Nagy Andrea", title: "Marketing Director", email: "nagy.andrea@nexussolutions.hu", industry: "Manufacturing", size: "500-1000", status: "pending_approval", added: "2026-03-18" },
];

const statusLabels: Record<string, { label: string; cls: string }> = {
  new: { label: "Új", cls: "status-new" },
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  sent: { label: "Kiküldve", cls: "status-sent" },
  replied: { label: "Válaszolt", cls: "status-replied" },
  rejected: { label: "Elutasítva", cls: "status-rejected" },
};

const statusOptions = [
  { value: "", label: "Minden státusz" },
  { value: "new", label: "Új" },
  { value: "pending_approval", label: "Jóváhagyásra vár" },
  { value: "sent", label: "Kiküldve" },
  { value: "replied", label: "Válaszolt" },
  { value: "rejected", label: "Elutasítva" },
];

const industryOptions = ["", "IT Services", "Manufacturing", "Finance", "Healthcare", "Retail", "Egyéb"];

const emptyForm = { company: "", contact: "", title: "", email: "", industry: "IT Services", size: "50-200", status: "new" };

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const q = search.toLowerCase();
      const matchSearch = !q || l.company.toLowerCase().includes(q) || l.contact.toLowerCase().includes(q) || l.industry.toLowerCase().includes(q);
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const handleAdd = () => {
    if (!form.company.trim() || !form.contact.trim() || !form.email.trim()) {
      setFormError("A cég neve, kapcsolattartó és email megadása kötelező.");
      return;
    }
    const newLead: Lead = {
      id: String(Date.now()),
      company: form.company,
      contact: form.contact,
      title: form.title,
      email: form.email,
      industry: form.industry,
      size: form.size,
      status: form.status,
      added: new Date().toISOString().split("T")[0],
    };
    setLeads((prev) => [newLead, ...prev]);
    setForm({ ...emptyForm });
    setFormError("");
    setShowAddModal(false);
  };

  return (
    <DashboardLayout title="Lead Adatbázis" subtitle="Összes azonosított és minősített potenciális ügyfél">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <Search size={14} style={{ color: "oklch(0.55 0.015 240)" }} />
            <input
              type="text"
              placeholder="Keresés cég, kontakt, iparág..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-52"
              style={{ color: "oklch(0.85 0.008 240)" }}
            />
            {search && (
              <button onClick={() => setSearch("")}><X size={12} style={{ color: "oklch(0.55 0.015 240)" }} /></button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: showFilter ? "oklch(0.6 0.2 255 / 15%)" : "oklch(0.18 0.022 255)",
              border: `1px solid ${showFilter ? "oklch(0.6 0.2 255 / 40%)" : "oklch(1 0 0 / 8%)"}`,
              color: showFilter ? "oklch(0.75 0.18 255)" : "oklch(0.55 0.015 240)",
            }}
          >
            <Filter size={14} />
            Szűrő {statusFilter && <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "oklch(0.6 0.2 255 / 30%)" }}>1</span>}
          </button>

          {/* Status filter (visible when showFilter) */}
          {showFilter && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.85 0.008 240)" }}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: "oklch(0.18 0.022 255)" }}>{o.label}</option>
              ))}
            </select>
          )}

          {(search || statusFilter) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); }}
              className="text-xs px-2 py-1.5 rounded-md"
              style={{ color: "oklch(0.65 0.22 25)", background: "oklch(0.65 0.22 25 / 10%)" }}
            >
              Szűrők törlése
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}
        >
          <UserPlus size={14} />
          Lead Hozzáadása
        </button>
      </div>

      {/* Table */}
      <div className="g2a-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
              {["Cég", "Kapcsolattartó", "Iparág", "Méret", "Státusz", "Hozzáadva"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.45 0.015 240)", fontFamily: "Sora, sans-serif" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "oklch(0.5 0.015 240)" }}>
                  Nincs találat a megadott szűrőkre.
                </td>
              </tr>
            ) : filtered.map((lead, i) => {
              const st = statusLabels[lead.status] || { label: lead.status, cls: "status-new" };
              return (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{lead.company}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: "oklch(0.75 0.008 240)" }}>{lead.contact}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{lead.title}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>{lead.industry}</td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>{lead.size} fő</td>
                  <td className="px-4 py-3"><span className={`status-badge ${st.cls}`}>{st.label}</span></td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.5 0.015 240)" }}>{lead.added}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>{filtered.length} lead megjelenítve / {leads.length} összesen</p>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <DetailModal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={selectedLead.company}
          subtitle={`Hozzáadva: ${selectedLead.added}`}
          footer={
            <button onClick={() => setSelectedLead(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
              Bezárás
            </button>
          }
        >
          <div className="space-y-4">
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
                <span className={`status-badge ${(statusLabels[selectedLead.status] || { cls: "status-new" }).cls}`}>
                  {(statusLabels[selectedLead.status] || { label: selectedLead.status }).label}
                </span>
              </div>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Add Lead Modal */}
      <DetailModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setForm({ ...emptyForm }); setFormError(""); }}
        title="Új Lead Hozzáadása"
        subtitle="Töltsd ki az alábbi mezőket az új lead rögzítéséhez"
        footer={
          <>
            <button onClick={() => { setShowAddModal(false); setForm({ ...emptyForm }); setFormError(""); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
              Mégse
            </button>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}>
              Lead Mentése
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {formError && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.75 0.2 25)" }}>{formError}</p>
          )}
          {[
            { key: "company", label: "Cég neve *", placeholder: "pl. TechVision Kft." },
            { key: "contact", label: "Kapcsolattartó neve *", placeholder: "pl. Kovács Péter" },
            { key: "title", label: "Beosztás", placeholder: "pl. CEO" },
            { key: "email", label: "Email cím *", placeholder: "pl. kovacs@ceg.hu" },
            { key: "size", label: "Cégméret (fő)", placeholder: "pl. 50-200" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>{f.label}</label>
              <input
                type={f.key === "email" ? "email" : "text"}
                placeholder={f.placeholder}
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Iparág</label>
            <select
              value={form.industry}
              onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
            >
              {industryOptions.filter(Boolean).map((o) => (
                <option key={o} value={o} style={{ background: "oklch(0.22 0.02 255)" }}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Kezdeti Státusz</label>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
            >
              {statusOptions.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value} style={{ background: "oklch(0.22 0.02 255)" }}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </DetailModal>
    </DashboardLayout>
  );
}
