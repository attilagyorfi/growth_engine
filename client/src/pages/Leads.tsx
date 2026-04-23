/**
 * G2A Growth Engine – Leads Page (tRPC-backed)
 */

import { useState, useMemo, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { UserPlus, Search, Filter, X, ChevronDown, Upload, FileText, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useData, Lead, LeadStatus } from "@/contexts/DataContext";

const statusLabels: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "Új", cls: "status-new" },
  researched: { label: "Kutatott", cls: "status-pending" },
  email_draft: { label: "Email piszkozat", cls: "status-pending" },
  approved: { label: "Jóváhagyva", cls: "status-sent" },
  sent: { label: "Kiküldve", cls: "status-sent" },
  replied: { label: "Válaszolt", cls: "status-replied" },
  meeting: { label: "Meeting", cls: "status-replied" },
  closed_won: { label: "Lezárva (nyert)", cls: "status-replied" },
  closed_lost: { label: "Lezárva (elveszett)", cls: "status-rejected" },
};

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Új" },
  { value: "researched", label: "Kutatott" },
  { value: "email_draft", label: "Email piszkozat" },
  { value: "approved", label: "Jóváhagyva" },
  { value: "sent", label: "Kiküldve" },
  { value: "replied", label: "Válaszolt" },
  { value: "meeting", label: "Meeting" },
  { value: "closed_won", label: "Lezárva (nyert)" },
  { value: "closed_lost", label: "Lezárva (elveszett)" },
];

const industryOptions = ["IT Services", "Manufacturing", "Finance", "Healthcare", "Retail", "SaaS", "Egyéb"];

const emptyForm = {
  company: "", contact: "", email: "", phone: "", position: "", industry: "IT Services", website: "", source: "LinkedIn", notes: "",
};

export default function Leads() {
  const { leads, leadsLoading, addLead, updateLead, deleteLead } = useData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Omit<Lead, "id" | "profileId">[]>([]);
  const [csvError, setCsvError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFile = (file: File) => {
    if (!file.name.endsWith(".csv")) { setCsvError("Csak .csv fájl fogadható el."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      if (lines.length < 2) { setCsvError("A fájl üres vagy nem megfelelő formátumú."); return; }
      const headers = lines[0].map((h) => h.toLowerCase());
      const required = ["company", "contact", "email"];
      const missing = required.filter((r) => !headers.includes(r));
      if (missing.length > 0) { setCsvError(`Hiányzó oszlopok: ${missing.join(", ")}. Szükséges: company, contact, email`); return; }
      const parsed = lines.slice(1).filter((row) => row.length >= 3 && row[headers.indexOf("email")]).map((row) => ({
        company: row[headers.indexOf("company")] ?? "",
        contact: row[headers.indexOf("contact")] ?? "",
        email: row[headers.indexOf("email")] ?? "",
        phone: headers.includes("phone") ? row[headers.indexOf("phone")] : undefined,
        position: headers.includes("position") ? row[headers.indexOf("position")] : undefined,
        industry: headers.includes("industry") ? row[headers.indexOf("industry")] : undefined,
        website: headers.includes("website") ? row[headers.indexOf("website")] : undefined,
        source: "CSV import",
        status: "new" as LeadStatus,
      }));
      setCsvPreview(parsed);
      setCsvError("");
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    setSaving(true);
    try {
      for (const lead of csvPreview) {
        await addLead(lead);
      }
      toast.success(`${csvPreview.length} lead sikeresen importálva!`);
      setShowCsvModal(false);
      setCsvPreview([]);
    } catch {
      toast.error("Importálás sikertelen.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch = !search || l.company.toLowerCase().includes(search.toLowerCase()) || l.contact.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const handleAdd = async () => {
    if (!form.company || !form.contact || !form.email) { setFormError("Cég, kapcsolattartó és email megadása kötelező."); return; }
    setSaving(true);
    try {
      await addLead({ ...form, status: "new" });
      toast.success("Lead sikeresen hozzáadva!");
      setShowAddModal(false);
      setForm({ ...emptyForm });
      setFormError("");
    } catch {
      toast.error("Mentés sikertelen.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    await updateLead(id, { status });
    setOpenStatusId(null);
    toast.success("Státusz frissítve.");
  };

  const handleDelete = async (id: string) => {
    await deleteLead(id);
    setSelectedLead(null);
    toast.success("Lead törölve.");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>Lead Adatbázis</h1>
            <p className="text-gray-400 text-sm mt-1">{leads.length} lead összesen</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCsvModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm transition-colors">
              <Upload size={16} /> CSV Import
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: "oklch(0.6 0.2 255)", color: "white" }}>
              <UserPlus size={16} /> Lead Hozzáadása
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Keresés cég, kontakt, email alapján..." className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="relative">
            <button onClick={() => setShowFilter(!showFilter)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700">
              <Filter size={16} /> Státusz {statusFilter && <span className="text-blue-400">({statusLabels[statusFilter]?.label})</span>}
            </button>
            {showFilter && (
              <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[180px]">
                <button onClick={() => { setStatusFilter(""); setShowFilter(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">Összes</button>
                {statusOptions.map((o) => (
                  <button key={o.value} onClick={() => { setStatusFilter(o.value); setShowFilter(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">{o.label}</button>
                ))}
              </div>
            )}
          </div>
          {(search || statusFilter) && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); }} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-700 hover:bg-gray-700">
              <X size={14} /> Szűrők törlése
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {leadsLoading ? (
            <div className="p-8 text-center text-gray-400">Betöltés...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nincs találat.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Cég / Kontakt</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Iparág</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Forrás</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-wider">Státusz</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">{lead.company}</div>
                      <div className="text-gray-400 text-xs">{lead.contact}{lead.position ? ` · ${lead.position}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-sm">{lead.email}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{lead.industry ?? "–"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{lead.source ?? "–"}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button onClick={() => setOpenStatusId(openStatusId === lead.id ? null : lead.id)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusLabels[lead.status]?.cls ?? "status-new"}`}>
                          {statusLabels[lead.status]?.label ?? lead.status} <ChevronDown size={12} />
                        </button>
                        {openStatusId === lead.id && (
                          <div className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[160px]">
                            {statusOptions.map((o) => (
                              <button key={o.value} onClick={() => handleStatusChange(lead.id, o.value)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700">{o.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDelete(lead.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Lead Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Új Lead Hozzáadása</h2>
                <button onClick={() => { setShowAddModal(false); setFormError(""); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              {formError && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "company", label: "Cég neve *", placeholder: "Pl. ABC Kft." },
                  { key: "contact", label: "Kapcsolattartó *", placeholder: "Pl. Vezeték Keresztnév" },
                  { key: "email", label: "Email *", placeholder: "nev@cegnev.hu" },
                  { key: "phone", label: "Telefon", placeholder: "+36 30 123 4567" },
                  { key: "position", label: "Pozíció", placeholder: "Marketing igazgató" },
                  { key: "website", label: "Weboldal", placeholder: "https://cegnev.hu" },
                  { key: "source", label: "Forrás", placeholder: "LinkedIn, Referral..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className={key === "company" || key === "email" ? "col-span-2" : ""}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Iparág</label>
                  <select value={form.industry} onChange={(e) => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500">
                    {industryOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Megjegyzés</label>
                <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Opcionális megjegyzés..." className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowAddModal(false); setFormError(""); }} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.6 0.2 255)" }}>
                  {saving ? "Mentés..." : "Hozzáadás"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lead Detail Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{selectedLead.company}</h2>
                <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Kontakt:</span> <span className="text-white">{selectedLead.contact}</span></div>
                <div><span className="text-gray-400">Pozíció:</span> <span className="text-white">{selectedLead.position ?? "–"}</span></div>
                <div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedLead.email}</span></div>
                <div><span className="text-gray-400">Telefon:</span> <span className="text-white">{selectedLead.phone ?? "–"}</span></div>
                <div><span className="text-gray-400">Iparág:</span> <span className="text-white">{selectedLead.industry ?? "–"}</span></div>
                <div><span className="text-gray-400">Forrás:</span> <span className="text-white">{selectedLead.source ?? "–"}</span></div>
                <div><span className="text-gray-400">Weboldal:</span> <span className="text-white">{selectedLead.website ?? "–"}</span></div>
                <div>
                  <span className="text-gray-400">Státusz:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${statusLabels[selectedLead.status]?.cls ?? "status-new"}`}>
                    {statusLabels[selectedLead.status]?.label ?? selectedLead.status}
                  </span>
                </div>
              </div>
              {selectedLead.notes && (
                <div>
                  <span className="text-gray-400 text-sm">Megjegyzés:</span>
                  <p className="text-gray-300 text-sm mt-1">{selectedLead.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Státusz módosítása</label>
                  <select value={selectedLead.status} onChange={(e) => handleStatusChange(selectedLead.id, e.target.value as LeadStatus)} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500">
                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button onClick={() => handleDelete(selectedLead.id)} className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 text-sm self-end">Törlés</button>
              </div>
            </div>
          </div>
        )}

        {/* CSV Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">CSV Lead Import</h2>
                <button onClick={() => { setShowCsvModal(false); setCsvPreview([]); setCsvError(""); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <p className="text-gray-400 text-sm">Szükséges oszlopok: <code className="text-blue-400">company, contact, email</code>. Opcionális: phone, position, industry, website.</p>
              <div
                className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleCsvFile(file); }}
              >
                <FileText size={32} className="mx-auto text-gray-500 mb-2" />
                <p className="text-gray-400 text-sm">Húzd ide a CSV fájlt, vagy kattints a tallózáshoz</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              </div>
              {csvError && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3"><AlertTriangle size={16} />{csvError}</div>}
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-green-400 text-sm mb-2">{csvPreview.length} lead előnézete:</p>
                  <div className="max-h-48 overflow-y-auto bg-gray-800 rounded-lg">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-gray-700"><th className="text-left px-3 py-2 text-gray-400">Cég</th><th className="text-left px-3 py-2 text-gray-400">Kontakt</th><th className="text-left px-3 py-2 text-gray-400">Email</th></tr></thead>
                      <tbody>{csvPreview.slice(0, 10).map((l, i) => <tr key={i} className="border-b border-gray-700/50"><td className="px-3 py-2 text-white">{l.company}</td><td className="px-3 py-2 text-gray-300">{l.contact}</td><td className="px-3 py-2 text-gray-300">{l.email}</td></tr>)}</tbody>
                    </table>
                    {csvPreview.length > 10 && <p className="text-gray-500 text-xs p-3">...és még {csvPreview.length - 10} lead</p>}
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => { setCsvPreview([]); setCsvError(""); }} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                    <button onClick={handleCsvImport} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.6 0.2 255)" }}>
                      {saving ? "Importálás..." : `${csvPreview.length} lead importálása`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
