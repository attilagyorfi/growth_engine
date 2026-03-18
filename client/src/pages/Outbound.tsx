/*
 * G2A Growth Engine – Outbound Page
 * Design: "Dark Ops Dashboard"
 * Features: View, Edit, Approve, Send email; status change dropdown; DataContext integration
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { Mail, CheckCircle, Clock, Eye, Edit2, Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useData, OutboundEmail, EmailStatus } from "@/contexts/DataContext";

const statusLabels: Record<EmailStatus, { label: string; cls: string }> = {
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  approved: { label: "Jóváhagyva", cls: "status-sent" },
  sent: { label: "Kiküldve", cls: "status-replied" },
  rejected: { label: "Elutasítva", cls: "status-rejected" },
};

const statusOptions: { value: EmailStatus; label: string }[] = [
  { value: "pending_approval", label: "Jóváhagyásra vár" },
  { value: "approved", label: "Jóváhagyva" },
  { value: "sent", label: "Kiküldve" },
  { value: "rejected", label: "Elutasítva" },
];

export default function Outbound() {
  const { outbound, setOutbound } = useData();
  const [viewDraft, setViewDraft] = useState<OutboundEmail | null>(null);
  const [editDraft, setEditDraft] = useState<OutboundEmail | null>(null);
  const [approveDraft, setApproveDraft] = useState<OutboundEmail | null>(null);
  const [sendDraft, setSendDraft] = useState<OutboundEmail | null>(null);
  const [editForm, setEditForm] = useState({ subject: "", body: "" });
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);

  const updateStatus = (id: string, status: EmailStatus) => {
    setOutbound((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
    setOpenStatusId(null);
    toast.success(`Státusz frissítve: ${statusLabels[status].label}`);
  };

  const handleApprove = (draft: OutboundEmail) => {
    setOutbound((prev) => prev.map((d) => d.id === draft.id ? { ...d, status: "approved" } : d));
    setApproveDraft(null);
    setViewDraft(null);
    toast.success(`Email jóváhagyva: ${draft.company}`);
  };

  const handleSend = (draft: OutboundEmail) => {
    setOutbound((prev) => prev.map((d) => d.id === draft.id ? { ...d, status: "sent" } : d));
    setSendDraft(null);
    setViewDraft(null);
    toast.success(`Email elküldve: ${draft.company}`, { description: `Címzett: ${draft.email}` });
  };

  const handleSaveEdit = () => {
    if (!editDraft) return;
    setOutbound((prev) => prev.map((d) => d.id === editDraft.id ? { ...d, subject: editForm.subject, body: editForm.body } : d));
    setEditDraft(null);
    toast.success("Email szerkesztve és mentve.");
  };

  const openEdit = (draft: OutboundEmail) => {
    setEditForm({ subject: draft.subject, body: draft.body });
    setEditDraft(draft);
    setViewDraft(null);
  };

  const pending = outbound.filter((d) => d.status === "pending_approval");
  const approved = outbound.filter((d) => d.status === "approved");
  const sent = outbound.filter((d) => d.status === "sent");

  return (
    <DashboardLayout title="Outbound Emailek" subtitle="Generált email piszkozatok, szerkesztés és kiküldés">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jóváhagyásra Vár", value: String(pending.length), color: "oklch(0.75 0.18 75)", icon: Clock },
          { label: "Jóváhagyott", value: String(approved.length), color: "oklch(0.65 0.18 165)", icon: CheckCircle },
          { label: "Kiküldve", value: String(sent.length), color: "oklch(0.6 0.2 255)", icon: Send },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="g2a-stat-card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.color.replace(")", " / 15%)")}` }}>
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drafts List */}
      <div className="g2a-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Összes Email Piszkozat</h3>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          {outbound.map((draft) => {
            const st = statusLabels[draft.status];
            return (
              <div key={draft.id} className="px-5 py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "oklch(0.6 0.2 255 / 12%)" }}>
                  <Mail size={16} style={{ color: "oklch(0.6 0.2 255)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{draft.company}</p>
                      <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{draft.contact} · {draft.email}</p>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "oklch(0.65 0.015 240)" }}>Tárgy: {draft.subject}</p>
                    </div>
                    {/* Status Dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenStatusId(openStatusId === draft.id ? null : draft.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all status-badge ${st.cls}`}
                      >
                        {st.label}
                        <ChevronDown size={11} />
                      </button>
                      {openStatusId === draft.id && (
                        <div className="absolute right-0 top-8 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "oklch(0.2 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)", minWidth: "160px" }}>
                          {statusOptions.map((o) => (
                            <button
                              key={o.value}
                              onClick={() => updateStatus(draft.id, o.value)}
                              className="w-full text-left px-3 py-2 text-xs transition-colors"
                              style={{ color: draft.status === o.value ? "oklch(0.75 0.18 255)" : "oklch(0.72 0.01 240)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 6%)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs mt-2 line-clamp-2" style={{ color: "oklch(0.5 0.015 240)" }}>
                    {draft.body.split("\n")[0]}
                  </p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button onClick={() => setViewDraft(draft)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}>
                      <Eye size={12} />Megtekintés
                    </button>
                    <button onClick={() => openEdit(draft)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.75 0.18 75 / 15%)", color: "oklch(0.8 0.15 75)" }}>
                      <Edit2 size={12} />Szerkesztés
                    </button>
                    {draft.status === "pending_approval" && (
                      <button onClick={() => setApproveDraft(draft)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)" }}>
                        <CheckCircle size={12} />Jóváhagyás
                      </button>
                    )}
                    {(draft.status === "approved" || draft.status === "pending_approval") && (
                      <button onClick={() => setSendDraft(draft)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.6 0.2 290 / 15%)", color: "oklch(0.7 0.18 290)" }}>
                        <Send size={12} />Küldés
                      </button>
                    )}
                    <p className="text-xs ml-auto" style={{ color: "oklch(0.45 0.015 240)" }}>{draft.date}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* View Modal */}
      {viewDraft && (
        <DetailModal isOpen={!!viewDraft} onClose={() => setViewDraft(null)} title={`Email – ${viewDraft.company}`} subtitle={`Tárgy: ${viewDraft.subject}`}
          footer={
            <>
              <button onClick={() => setViewDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Bezárás</button>
              <button onClick={() => openEdit(viewDraft)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.75 0.18 75)", color: "white" }}>
                <Edit2 size={13} className="inline mr-1.5" />Szerkesztés
              </button>
              {viewDraft.status === "pending_approval" && (
                <button onClick={() => { setApproveDraft(viewDraft); setViewDraft(null); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.65 0.18 165)", color: "white" }}>
                  <CheckCircle size={13} className="inline mr-1.5" />Jóváhagyás
                </button>
              )}
              {(viewDraft.status === "approved" || viewDraft.status === "pending_approval") && (
                <button onClick={() => { setSendDraft(viewDraft); setViewDraft(null); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 290)", color: "white" }}>
                  <Send size={13} className="inline mr-1.5" />Küldés
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "Cím", value: viewDraft.contact }, { label: "Email", value: viewDraft.email }, { label: "Tárgy", value: viewDraft.subject }, { label: "Dátum", value: viewDraft.date }].map((f) => (
                <div key={f.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                  <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>{f.label}</p>
                  <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.008 240)" }}>{f.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>EMAIL SZÖVEG</p>
              {viewDraft.body.split("\n").map((line, i) => (
                line === "" ? <div key={i} className="h-3" /> : <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>
              ))}
            </div>
          </div>
        </DetailModal>
      )}

      {/* Edit Modal */}
      {editDraft && (
        <DetailModal isOpen={!!editDraft} onClose={() => setEditDraft(null)} title={`Szerkesztés – ${editDraft.company}`} subtitle="Módosítsd az email tárgyát és szövegét"
          footer={
            <>
              <button onClick={() => setEditDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}>Mentés</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>Tárgy</label>
              <input type="text" value={editForm.subject} onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>Email szöveg</label>
              <textarea value={editForm.body} onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))} rows={12}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)", lineHeight: "1.6" }}
              />
            </div>
          </div>
        </DetailModal>
      )}

      {/* Approve Modal */}
      {approveDraft && (
        <DetailModal isOpen={!!approveDraft} onClose={() => setApproveDraft(null)} title="Email Jóváhagyása" subtitle="Biztosan jóváhagyod ezt az emailt?"
          footer={
            <>
              <button onClick={() => setApproveDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
              <button onClick={() => handleApprove(approveDraft)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.65 0.18 165)", color: "white" }}>Igen, Jóváhagyom</button>
            </>
          }
        >
          <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{approveDraft.company}</p>
            <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>{approveDraft.contact} · {approveDraft.email}</p>
            <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>Tárgy: {approveDraft.subject}</p>
          </div>
        </DetailModal>
      )}

      {/* Send Modal */}
      {sendDraft && (
        <DetailModal isOpen={!!sendDraft} onClose={() => setSendDraft(null)} title="Email Küldése" subtitle="Manuálisan küldd el ezt az emailt"
          footer={
            <>
              <button onClick={() => setSendDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
              <button onClick={() => handleSend(sendDraft)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 290)", color: "white" }}>
                <Send size={13} className="inline mr-1.5" />Email Küldése
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{sendDraft.company}</p>
              <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>Címzett: {sendDraft.contact} &lt;{sendDraft.email}&gt;</p>
              <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>Tárgy: {sendDraft.subject}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}>
              <p className="text-xs" style={{ color: "oklch(0.75 0.15 75)" }}>
                <strong>Megjegyzés:</strong> Éles Gmail/Outlook API integráció esetén az email közvetlenül kiküldésre kerül. A jelenlegi verzióban a státusz "Kiküldve"-re változik.
              </p>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Close status dropdown on outside click */}
      {openStatusId && <div className="fixed inset-0 z-10" onClick={() => setOpenStatusId(null)} />}
    </DashboardLayout>
  );
}
