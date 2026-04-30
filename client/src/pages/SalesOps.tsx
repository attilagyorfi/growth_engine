/*
 * G2A Growth Engine – Sales Ops v3.0
 * Összevont értékesítési műveletek: Leads, Outbound, Replies (Inbound)
 */

import { useState, useRef } from "react";
import {
  Users, Send, Inbox, Plus, Pencil, Trash2, X, Loader2, Search,
  CheckCircle2, Upload,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";

type Tab = "leads" | "outbound" | "inbound";

type LeadStatus = "new" | "researched" | "email_draft" | "approved" | "sent" | "replied" | "meeting" | "closed_won" | "closed_lost";
type OutboundStatus = "draft" | "approved" | "sent" | "opened" | "replied" | "bounced";

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Új",
  researched: "Kutatott",
  email_draft: "Email piszkozat",
  approved: "Jóváhagyva",
  sent: "Elküldve",
  replied: "Válaszolt",
  meeting: "Találkozó",
  closed_won: "Nyert",
  closed_lost: "Elveszett",
};

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "var(--qa-accent)",
  researched: "oklch(0.7 0.18 220)",
  email_draft: "var(--qa-warning)",
  approved: "var(--qa-success)",
  sent: "oklch(0.65 0.18 145)",
  replied: "oklch(0.65 0.18 130)",
  meeting: "var(--qa-accent-purple)",
  closed_won: "oklch(0.65 0.18 145)",
  closed_lost: "var(--qa-danger)",
};

const OUTBOUND_STATUS_LABELS: Record<OutboundStatus, string> = {
  draft: "Piszkozat",
  approved: "Jóváhagyva",
  sent: "Elküldve",
  opened: "Megnyitva",
  replied: "Válaszolt",
  bounced: "Visszapattant",
};

const OUTBOUND_STATUS_COLORS: Record<OutboundStatus, string> = {
  draft: "var(--qa-warning)",
  approved: "var(--qa-success)",
  sent: "oklch(0.65 0.18 145)",
  opened: "var(--qa-accent)",
  replied: "oklch(0.65 0.18 130)",
  bounced: "var(--qa-danger)",
};

const INBOUND_CATEGORY_LABELS: Record<string, string> = {
  interested: "Érdeklődő",
  not_interested: "Nem érdeklődő",
  question: "Kérdés",
  meeting_request: "Találkozó kérés",
  out_of_office: "Irodán kívül",
  unsubscribe: "Leiratkozás",
  other: "Egyéb",
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "leads", label: "Lead Adatbázis", icon: <Users size={14} /> },
  { id: "outbound", label: "Kimenő Emailek", icon: <Send size={14} /> },
  { id: "inbound", label: "Bejövő Válaszok", icon: <Inbox size={14} /> },
];

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

export default function SalesOps() {
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [newLeadModal, setNewLeadModal] = useState(false);
  const [newLead, setNewLead] = useState<any>({});
  const [newEmailModal, setNewEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState<any>({});
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvModal, setCsvModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Data queries
  const { data: leads = [], isLoading: leadsLoading } = trpc.leads.list.useQuery(
    { profileId: activeProfile.id }, { enabled: !!activeProfile.id }
  );
  const { data: outboundEmails = [], isLoading: outboundLoading } = trpc.outbound.list.useQuery(
    { profileId: activeProfile.id }, { enabled: !!activeProfile.id }
  );
  const { data: inboundEmails = [], isLoading: inboundLoading } = trpc.inbound.list.useQuery(
    { profileId: activeProfile.id }, { enabled: !!activeProfile.id }
  );

  // Mutations
  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate({ profileId: activeProfile.id });
      setNewLeadModal(false);
      setNewLead({});
    }
  });
  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => utils.leads.list.invalidate({ profileId: activeProfile.id })
  });
  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => utils.leads.list.invalidate({ profileId: activeProfile.id })
  });
  const createEmail = trpc.outbound.create.useMutation({
    onSuccess: () => {
      utils.outbound.list.invalidate({ profileId: activeProfile.id });
      setNewEmailModal(false);
      setNewEmail({});
    }
  });
  const updateEmail = trpc.outbound.update.useMutation({
    onSuccess: () => utils.outbound.list.invalidate({ profileId: activeProfile.id })
  });
  const deleteEmail = trpc.outbound.delete.useMutation({
    onSuccess: () => utils.outbound.list.invalidate({ profileId: activeProfile.id })
  });
  const sendEmailViaResend = trpc.outbound.sendViaResend.useMutation({
    onSuccess: () => {
      utils.outbound.list.invalidate({ profileId: activeProfile.id });
      setEditModal(false);
      setSelectedItem(null);
      toast.success("Email sikeresen elküldve!");
    },
    onError: (err) => toast.error("Küldés sikertelen: " + err.message),
  });
  const updateInboundCategory = trpc.inbound.updateCategory.useMutation({
    onSuccess: () => utils.inbound.list.invalidate({ profileId: activeProfile.id })
  });

  // Filtered data
  const filteredLeads = (leads as any[]).filter(l => {
    const matchSearch = !search || [l.contact, l.email, l.company, l.position].some((f: any) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredOutbound = (outboundEmails as any[]).filter(e => {
    const matchSearch = !search || [e.subject, e.to, e.toName].some((f: any) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredInbound = (inboundEmails as any[]).filter(e => {
    const matchSearch = !search || [e.subject, e.from, e.fromName].some((f: any) => f?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || e.category === statusFilter;
    return matchSearch && matchStatus;
  });

  // CSV import
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      }).filter(r => r.email || r.name || r.contact);
      setCsvPreview(rows);
      setCsvModal(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    let imported = 0;
    for (const r of csvPreview) {
      try {
        await createLead.mutateAsync({
          profileId: activeProfile.id,
          contact: r.name || r.full_name || r.contact || ((r.firstname || "") + " " + (r.lastname || "")).trim() || "Ismeretlen",
          email: r.email || "",
          company: r.company || r.organization || "Ismeretlen cég",
          position: r.position || r.title || r.job_title || undefined,
          phone: r.phone || r.telephone || undefined,
          website: r.website || r.url || undefined,
          source: "csv_import",
        });
        imported++;
      } catch { /* skip invalid rows */ }
    }
    utils.leads.list.invalidate({ profileId: activeProfile.id });
    setCsvModal(false);
    setCsvPreview([]);
    toast.success(`${imported} lead importálva`);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    if (activeTab === "leads") {
      await updateLead.mutateAsync({ id: selectedItem.id, ...editForm });
    } else if (activeTab === "outbound") {
      await updateEmail.mutateAsync({ id: selectedItem.id, ...editForm });
    }
    toast.success("Mentve");
    setEditModal(false);
    setSelectedItem(null);
  };

  const handleApproveEmail = async (email: any) => {
    await updateEmail.mutateAsync({ id: email.id, status: "approved" });
    toast.success("Email jóváhagyva");
  };

  const handleCategorizeInbound = async (email: any, category: string) => {
    await updateInboundCategory.mutateAsync({ id: email.id, category: category as any });
    toast.success("Kategorizálva: " + (INBOUND_CATEGORY_LABELS[category] ?? category));
  };

  const isLoading = activeTab === "leads" ? leadsLoading : activeTab === "outbound" ? outboundLoading : inboundLoading;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>Sales Ops</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--qa-fg3)" }}>
            {activeProfile.name} · {(leads as any[]).length} lead · {(outboundEmails as any[]).length} kimenő · {(inboundEmails as any[]).length} bejövő
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "leads" && (
            <>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}
              >
                <Upload size={13} /> CSV Import
              </button>
              <button onClick={() => setNewLeadModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, var(--qa-accent), oklch(0.55 0.18 165))" }}
              >
                <Plus size={14} /> Új Lead
              </button>
            </>
          )}
          {activeTab === "outbound" && (
            <button onClick={() => setNewEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--qa-accent), oklch(0.55 0.18 165))" }}
            >
              <Plus size={14} /> Új Email
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "var(--qa-surface)" }}>
        {TABS.map(tab => {
          const count = tab.id === "leads" ? (leads as any[]).length : tab.id === "outbound" ? (outboundEmails as any[]).length : (inboundEmails as any[]).length;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); setStatusFilter("all"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "var(--qa-accent)" : "transparent",
                color: activeTab === tab.id ? "white" : "var(--qa-fg3)",
              }}
            >
              {tab.icon} {tab.label}
              {count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: activeTab === tab.id ? "oklch(1 0 0 / 20%)" : "oklch(from var(--qa-accent) l c h / 20%)", color: activeTab === tab.id ? "white" : "var(--qa-accent)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--qa-fg4)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Keresés..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border" style={{ background: cardBg, borderColor: border, color: "var(--qa-fg2)" }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border" style={{ background: cardBg, borderColor: border, color: "var(--qa-fg2)" }}
        >
          <option value="all">Összes státusz</option>
          {activeTab === "leads" && Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {activeTab === "outbound" && Object.entries(OUTBOUND_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {activeTab === "inbound" && Object.entries(INBOUND_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--qa-accent)" }} />
        </div>
      )}

      {/* Leads Tab */}
      {!isLoading && activeTab === "leads" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
          {filteredLeads.length === 0 ? (
            <div className="text-center py-16" style={{ background: cardBg }}>
              <Users size={32} className="mx-auto mb-3" style={{ color: "var(--qa-fg4)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-fg3)" }}>Még nincs egyetlen lead sem</p>
              <p className="text-xs mb-3" style={{ color: "var(--qa-fg4)" }}>Add hozzá az első potenciális ügyféldet, és kövesd nyomon az értékesítési folyamatot</p>
              <button onClick={() => setNewLeadModal(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "var(--qa-accent)" }}>+ Első lead hozzáadása</button>
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden divide-y" style={{ borderColor: border }}>
                {filteredLeads.map((lead: any) => (
                  <div key={lead.id} className="p-4 flex flex-col gap-2" style={{ background: cardBg }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "oklch(from var(--qa-accent) l c h / 20%)", color: "var(--qa-accent)" }}>
                          {(lead.contact || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: "var(--qa-fg2)" }}>{lead.contact}</p>
                          <p className="text-xs truncate" style={{ color: "var(--qa-fg3)" }}>{lead.company}{lead.position ? ` · ${lead.position}` : ""}</p>
                        </div>
                      </div>
                      <select value={lead.status}
                        onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                          await updateLead.mutateAsync({ id: lead.id, status: e.target.value as LeadStatus });
                          toast.success("Státusz frissítve");
                        }}
                        className="text-xs px-2 py-1.5 rounded-lg border-0 font-semibold flex-shrink-0"
                        style={{ background: `${LEAD_STATUS_COLORS[lead.status as LeadStatus] ?? "var(--qa-accent)"} / 15%`, color: LEAD_STATUS_COLORS[lead.status as LeadStatus] ?? "var(--qa-accent)" }}
                      >
                        {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs truncate" style={{ color: "var(--qa-fg3)" }}>{lead.email}</p>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setSelectedItem(lead); setEditForm({ contact: lead.contact, email: lead.email, company: lead.company, position: lead.position, phone: lead.phone, website: lead.website, notes: lead.notes }); setEditModal(true); }}
                          className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center" style={{ background: "oklch(from var(--qa-accent) l c h / 10%)" }}>
                          <Pencil size={13} style={{ color: "var(--qa-accent)" }} />
                        </button>
                        <button onClick={async () => { await deleteLead.mutateAsync({ id: lead.id }); toast.success("Lead törölve"); }}
                          className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 10%)" }}>
                          <Trash2 size={13} style={{ color: "var(--qa-danger)" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "oklch(0.2 0.022 255)", borderBottom: `1px solid ${border}` }}>
                      {["Kapcsolattartó", "Email", "Cég", "Pozíció", "Státusz", "Forrás", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "var(--qa-fg4)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead: any, i: number) => (
                      <tr key={lead.id} style={{ background: i % 2 === 0 ? cardBg : "oklch(0.185 0.022 255)", borderBottom: `1px solid ${border}` }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "oklch(from var(--qa-accent) l c h / 20%)", color: "var(--qa-accent)" }}>
                              {(lead.contact || "?")[0].toUpperCase()}
                            </div>
                            <span className="font-medium" style={{ color: "var(--qa-fg2)" }}>{lead.contact}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--qa-fg3)" }}>{lead.email}</td>
                        <td className="px-4 py-3" style={{ color: "var(--qa-fg3)" }}>{lead.company}</td>
                        <td className="px-4 py-3" style={{ color: "var(--qa-fg3)" }}>{lead.position || "—"}</td>
                        <td className="px-4 py-3">
                          <select value={lead.status}
                            onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                              await updateLead.mutateAsync({ id: lead.id, status: e.target.value as LeadStatus });
                              toast.success("Státusz frissítve");
                            }}
                            className="text-xs px-2 py-1 rounded-lg border-0 font-semibold"
                            style={{ background: `${LEAD_STATUS_COLORS[lead.status as LeadStatus] ?? "var(--qa-accent)"} / 15%`, color: LEAD_STATUS_COLORS[lead.status as LeadStatus] ?? "var(--qa-accent)" }}
                          >
                            {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--qa-fg4)" }}>{lead.source || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setSelectedItem(lead); setEditForm({ contact: lead.contact, email: lead.email, company: lead.company, position: lead.position, phone: lead.phone, website: lead.website, notes: lead.notes }); setEditModal(true); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(from var(--qa-accent) l c h / 10%)" }}>
                              <Pencil size={12} style={{ color: "var(--qa-accent)" }} />
                            </button>
                            <button onClick={async () => { await deleteLead.mutateAsync({ id: lead.id }); toast.success("Lead törölve"); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 10%)" }}>
                              <Trash2 size={12} style={{ color: "var(--qa-danger)" }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Outbound Tab */}
      {!isLoading && activeTab === "outbound" && (
        <div className="space-y-3">
          {filteredOutbound.length === 0 ? (
            <div className="text-center py-16 rounded-xl border" style={{ background: cardBg, borderColor: border }}>
              <Send size={32} className="mx-auto mb-3" style={{ color: "var(--qa-fg4)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-fg3)" }}>Nincsenek kimenő emailek</p>
              <button onClick={() => setNewEmailModal(true)} className="mt-2 text-sm" style={{ color: "var(--qa-accent)" }}>Első email létrehozása →</button>
            </div>
          ) : filteredOutbound.map((email: any) => (
            <div key={email.id} className="rounded-xl border p-4" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: `${OUTBOUND_STATUS_COLORS[email.status as OutboundStatus] ?? "var(--qa-accent)"} / 15%`, color: OUTBOUND_STATUS_COLORS[email.status as OutboundStatus] ?? "var(--qa-accent)" }}>
                      {OUTBOUND_STATUS_LABELS[email.status as OutboundStatus] ?? email.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--qa-fg2)" }}>{email.subject}</p>
                  <p className="text-xs mb-2" style={{ color: "var(--qa-fg3)" }}>→ {email.toName || email.to}</p>
                  <p className="text-xs line-clamp-2" style={{ color: "var(--qa-fg3)" }}>{email.body}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setSelectedItem(email); setEditForm({ subject: email.subject, body: email.body, toName: email.toName, to: email.to }); setEditModal(true); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(from var(--qa-accent) l c h / 10%)" }}>
                    <Pencil size={12} style={{ color: "var(--qa-accent)" }} />
                  </button>
                  <button onClick={async () => { await deleteEmail.mutateAsync({ id: email.id }); toast.success("Email törölve"); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 10%)" }}>
                    <Trash2 size={12} style={{ color: "var(--qa-danger)" }} />
                  </button>
                </div>
              </div>
              {email.status === "draft" && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleApproveEmail(email)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: "oklch(from var(--qa-success) l c h / 15%)", color: "var(--qa-success)" }}
                  >
                    <CheckCircle2 size={12} /> Jóváhagyás
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inbound Tab */}
      {!isLoading && activeTab === "inbound" && (
        <div className="space-y-3">
          {filteredInbound.length === 0 ? (
            <div className="text-center py-16 rounded-xl border" style={{ background: cardBg, borderColor: border }}>
              <Inbox size={32} className="mx-auto mb-3" style={{ color: "var(--qa-fg4)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-fg3)" }}>Nincsenek bejövő válaszok</p>
              <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>A bejövő emailek itt jelennek meg automatikusan</p>
            </div>
          ) : filteredInbound.map((email: any) => (
            <div key={email.id} className="rounded-xl border p-4" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {email.category && (
                      <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}>
                        {INBOUND_CATEGORY_LABELS[email.category] ?? email.category}
                      </span>
                    )}
                    {!email.read && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--qa-accent)" }} />
                    )}
                  </div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--qa-fg2)" }}>{email.subject}</p>
                  <p className="text-xs mb-2" style={{ color: "var(--qa-fg3)" }}>← {email.fromName || email.from}</p>
                  <p className="text-xs line-clamp-3" style={{ color: "var(--qa-fg3)" }}>{email.body}</p>
                </div>
                {email.receivedAt && (
                  <p className="text-xs flex-shrink-0" style={{ color: "var(--qa-fg4)" }}>
                    {new Date(email.receivedAt).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(INBOUND_CATEGORY_LABELS).map(([v, l]) => (
                  <button key={v} onClick={() => handleCategorizeInbound(email, v)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: email.category === v ? "oklch(from var(--qa-accent) l c h / 20%)" : "var(--qa-surface2)",
                      color: email.category === v ? "var(--qa-accent)" : "var(--qa-fg3)",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "var(--qa-border-hi)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
                {activeTab === "leads" ? "Lead Szerkesztése" : "Email Szerkesztése"}
              </h3>
              <button onClick={() => { setEditModal(false); setSelectedItem(null); }} style={{ color: "var(--qa-fg4)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {activeTab === "leads" && (
                <>
                  {([["contact", "Kapcsolattartó *"], ["email", "Email *"], ["company", "Cég *"], ["position", "Pozíció"], ["phone", "Telefon"], ["website", "Weboldal"]] as [string, string][]).map(([k, l]) => (
                    <div key={k}>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                      <input value={editForm[k] ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Megjegyzés</label>
                    <textarea value={editForm.notes ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                      className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                  </div>
                </>
              )}
              {activeTab === "outbound" && (
                <>
                  {([["subject", "Tárgy *"], ["toName", "Címzett neve"], ["to", "Címzett email *"]] as [string, string][]).map(([k, l]) => (
                    <div key={k}>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                      <input value={editForm[k] ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Szöveg *</label>
                    <textarea value={editForm.body ?? ""} onChange={e => setEditForm((f: any) => ({ ...f, body: e.target.value }))} rows={8}
                      className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setEditModal(false); setSelectedItem(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>Mégse</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--qa-accent)" }}>Mentés</button>
              {activeTab === "outbound" && selectedItem && selectedItem.status !== "sent" && (
                <button
                  onClick={async () => {
                    if (!editForm.to || !editForm.subject || !editForm.body) {
                      toast.error("Címzett email, tárgy és szöveg kötelező");
                      return;
                    }
                    // Save first, then send
                    await updateEmail.mutateAsync({ id: selectedItem.id, subject: editForm.subject, body: editForm.body });
                    await sendEmailViaResend.mutateAsync({
                      emailId: selectedItem.id,
                      to: editForm.to,
                      toName: editForm.toName,
                      subject: editForm.subject,
                      body: editForm.body,
                    });
                  }}
                  disabled={sendEmailViaResend.isPending || updateEmail.isPending}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                  style={{ background: "oklch(0.55 0.18 145)" }}
                >
                  {sendEmailViaResend.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Elküldés
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Lead Modal */}
      {newLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "var(--qa-border-hi)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>Új Lead Hozzáadása</h3>
              <button onClick={() => setNewLeadModal(false)} style={{ color: "var(--qa-fg4)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["contact", "Kapcsolattartó *"], ["email", "Email *"], ["company", "Cég *"], ["position", "Pozíció"], ["phone", "Telefon"], ["website", "Weboldal"], ["source", "Forrás"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                  <input value={newLead[k] ?? ""} onChange={e => setNewLead((p: any) => ({ ...p, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setNewLeadModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>Mégse</button>
              <button onClick={async () => {
                if (!newLead.contact || !newLead.email || !newLead.company) { toast.error("Kapcsolattartó, email és cég kötelező"); return; }
                await createLead.mutateAsync({ profileId: activeProfile.id, contact: newLead.contact, email: newLead.email, company: newLead.company, position: newLead.position, phone: newLead.phone, website: newLead.website, source: newLead.source });
                toast.success("Lead létrehozva");
              }} disabled={createLead.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "var(--qa-accent)" }}>
                {createLead.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Email Modal */}
      {newEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "var(--qa-border-hi)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>Új Kimenő Email</h3>
              <button onClick={() => setNewEmailModal(false)} style={{ color: "var(--qa-fg4)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {([["subject", "Tárgy *"], ["toName", "Címzett neve"], ["to", "Címzett email *"]] as [string, string][]).map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{l}</label>
                  <input value={newEmail[k] ?? ""} onChange={e => setNewEmail((p: any) => ({ ...p, [k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Szöveg *</label>
                <textarea value={newEmail.body ?? ""} onChange={e => setNewEmail((p: any) => ({ ...p, body: e.target.value }))} rows={7}
                  className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setNewEmailModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>Mégse</button>
              <button onClick={async () => {
                if (!newEmail.subject || !newEmail.to || !newEmail.body) { toast.error("Töltsd ki a kötelező mezőket"); return; }
                await createEmail.mutateAsync({ profileId: activeProfile.id, subject: newEmail.subject, body: newEmail.body, to: newEmail.to, toName: newEmail.toName });
                toast.success("Email létrehozva");
              }} disabled={createEmail.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "var(--qa-accent)" }}>
                {createEmail.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "var(--qa-border-hi)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>CSV Import Előnézet</h3>
              <button onClick={() => { setCsvModal(false); setCsvPreview([]); }} style={{ color: "var(--qa-fg4)" }}><X size={18} /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--qa-fg3)" }}>{csvPreview.length} lead importálásra kész</p>
            <div className="rounded-xl border overflow-hidden mb-5" style={{ borderColor: border }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "oklch(0.2 0.022 255)" }}>
                    {["Név", "Email", "Cég", "Pozíció"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: "var(--qa-fg4)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(0, 10).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? cardBg : "oklch(0.185 0.022 255)", borderTop: `1px solid ${border}` }}>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg2)" }}>{row.name || row.full_name || row.contact || "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg3)" }}>{row.email || "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg3)" }}>{row.company || row.organization || "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg3)" }}>{row.position || row.title || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.length > 10 && <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>+ {csvPreview.length - 10} további sor</p>}
            <div className="flex gap-3">
              <button onClick={() => { setCsvModal(false); setCsvPreview([]); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}>Mégse</button>
              <button onClick={handleImportConfirm} disabled={createLead.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "var(--qa-accent)" }}>
                {createLead.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Importálás ({csvPreview.length} lead)
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
