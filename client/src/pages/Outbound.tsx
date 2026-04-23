/**
 * G2A Growth Engine – Outbound Emails Page (tRPC-backed)
 */

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Mail, Eye, CheckCircle, Send, Edit3, X, ChevronDown, Plus, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import { useData, OutboundEmail, EmailStatus } from "@/contexts/DataContext";
import { trpc } from "@/lib/trpc";

const statusLabels: Record<EmailStatus, { label: string; cls: string }> = {
  draft: { label: "Piszkozat", cls: "status-pending" },
  approved: { label: "Jóváhagyva", cls: "status-sent" },
  sent: { label: "Kiküldve", cls: "status-sent" },
  opened: { label: "Megnyitva", cls: "status-replied" },
  replied: { label: "Válaszolt", cls: "status-replied" },
  bounced: { label: "Visszapattant", cls: "status-rejected" },
};

const statusOptions: { value: EmailStatus; label: string }[] = [
  { value: "draft", label: "Piszkozat" },
  { value: "approved", label: "Jóváhagyva" },
  { value: "sent", label: "Kiküldve" },
  { value: "opened", label: "Megnyitva" },
  { value: "replied", label: "Válaszolt" },
  { value: "bounced", label: "Visszapattant" },
];

export default function Outbound() {
  const { outbound, outboundLoading, addOutbound, updateOutbound, deleteOutbound } = useData();
  const [selected, setSelected] = useState<OutboundEmail | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [showApproveModal, setShowApproveModal] = useState<OutboundEmail | null>(null);
  const [showSendModal, setShowSendModal] = useState<OutboundEmail | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "">("");
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ to: "", toName: "", company: "", subject: "", body: "" });
  const [smtpConfig, setSmtpConfig] = useState({ provider: "gmail" as "gmail" | "outlook", user: "", password: "", fromName: "G2A Marketing" });
  const [showSmtpSetup, setShowSmtpSetup] = useState(false);

  const sendEmailMutation = trpc.emailSend.send.useMutation();
  const verifyEmailMutation = trpc.emailSend.verify.useMutation();

  const filtered = useMemo(() => {
    return statusFilter ? outbound.filter(e => e.status === statusFilter) : outbound;
  }, [outbound, statusFilter]);

  const pendingCount = outbound.filter(e => e.status === "draft").length;

  const openView = (email: OutboundEmail) => {
    setSelected(email);
    setEditMode(false);
    setEditSubject(email.subject);
    setEditBody(email.body);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateOutbound(selected.id, { subject: editSubject, body: editBody });
      toast.success("Email frissítve.");
      setEditMode(false);
      setSelected(prev => prev ? { ...prev, subject: editSubject, body: editBody } : null);
    } catch {
      toast.error("Mentés sikertelen.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (email: OutboundEmail) => {
    setSaving(true);
    try {
      await updateOutbound(email.id, { status: "approved" });
      toast.success("Email jóváhagyva!");
      setShowApproveModal(null);
      setSelected(null);
    } catch {
      toast.error("Jóváhagyás sikertelen.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (email: OutboundEmail) => {
    if (!smtpConfig.user || !smtpConfig.password) {
      setShowSmtpSetup(true);
      return;
    }
    setSaving(true);
    try {
      const result = await sendEmailMutation.mutateAsync({
        emailId: email.id,
        to: email.to,
        toName: email.toName,
        subject: email.subject,
        body: email.body,
        config: { ...smtpConfig },
      });
      if (result.success) {
        toast.success(`Email sikeresen elküldve! (ID: ${result.messageId?.slice(0, 20)}...)`);
        setShowSendModal(null);
        setSelected(null);
      } else {
        toast.error(`Küldés sikertelen: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Hiba: ${err.message ?? "Ismeretlen hiba"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySmtp = async () => {
    if (!smtpConfig.user || !smtpConfig.password) { toast.error("Email cím és jelszó megadása kötelező."); return; }
    setSaving(true);
    try {
      const result = await verifyEmailMutation.mutateAsync(smtpConfig);
      if (result.success) {
        toast.success("SMTP kapcsolat sikeres! Az email fiók csatlakoztatva.");
        setShowSmtpSetup(false);
      } else {
        toast.error(`SMTP hiba: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`Hiba: ${err.message ?? "Ismeretlen hiba"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: EmailStatus) => {
    await updateOutbound(id, { status });
    setOpenStatusId(null);
    toast.success("Státusz frissítve.");
  };

  const handleDelete = async (id: string) => {
    await deleteOutbound(id);
    setSelected(null);
    toast.success("Email törölve.");
  };

  const handleNewEmail = async () => {
    if (!newForm.to || !newForm.subject || !newForm.body) { toast.error("Email cím, tárgy és szöveg megadása kötelező."); return; }
    setSaving(true);
    try {
      await addOutbound({ ...newForm, status: "draft" });
      toast.success("Email piszkozat létrehozva!");
      setShowNewModal(false);
      setNewForm({ to: "", toName: "", company: "", subject: "", body: "" });
    } catch {
      toast.error("Létrehozás sikertelen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>Outbound Emailek</h1>
            <p className="text-gray-400 text-sm mt-1">{pendingCount} piszkozat vár jóváhagyásra</p>
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EmailStatus | "")} className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm focus:outline-none focus:border-blue-500">
              <option value="">Összes státusz</option>
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "oklch(0.6 0.2 255)" }}>
              <Plus size={16} /> Új Email
            </button>
          </div>
        </div>

        {/* Email List */}
        <div className="space-y-3">
          {outboundLoading ? (
            <div className="p-8 text-center text-gray-400">Betöltés...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nincs email.</div>
          ) : filtered.map((email) => (
            <div key={email.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={14} className="text-blue-400 flex-shrink-0" />
                    <span className="text-white font-medium text-sm truncate">{email.subject}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Címzett: <span className="text-gray-300">{email.toName ?? email.to}</span>
                    {email.company && <span className="text-gray-500"> · {email.company}</span>}
                  </div>
                  <div className="text-gray-500 text-xs mt-1 line-clamp-1">{email.body.slice(0, 100)}...</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  {/* Status dropdown */}
                  <div className="relative">
                    <button onClick={() => setOpenStatusId(openStatusId === email.id ? null : email.id)} className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusLabels[email.status]?.cls ?? "status-pending"}`}>
                      {statusLabels[email.status]?.label ?? email.status} <ChevronDown size={10} />
                    </button>
                    {openStatusId === email.id && (
                      <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[140px]">
                        {statusOptions.map(o => (
                          <button key={o.value} onClick={() => handleStatusChange(email.id, o.value)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700">{o.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => openView(email)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors">
                    <Eye size={12} /> Megtekintés
                  </button>
                  {email.status === "draft" && (
                    <button onClick={() => setShowApproveModal(email)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white transition-colors" style={{ background: "oklch(0.55 0.18 145)" }}>
                      <CheckCircle size={12} /> Jóváhagyás
                    </button>
                  )}
                  {(email.status === "approved" || email.status === "draft") && (
                    <button onClick={() => setShowSendModal(email)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white transition-colors" style={{ background: "oklch(0.6 0.2 255)" }}>
                      <Send size={12} /> Küldés
                    </button>
                  )}
                  <button onClick={() => handleDelete(email.id)} className="text-gray-500 hover:text-red-400 p-1 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View / Edit Modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{editMode ? "Email Szerkesztése" : "Email Megtekintése"}</h2>
                <div className="flex items-center gap-2">
                  {!editMode && (
                    <button onClick={() => setEditMode(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs">
                      <Edit3 size={12} /> Szerkesztés
                    </button>
                  )}
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-400">Címzett:</span> <span className="text-white">{selected.toName ?? selected.to}</span></div>
                  <div><span className="text-gray-400">Email:</span> <span className="text-white">{selected.to}</span></div>
                  {selected.company && <div><span className="text-gray-400">Cég:</span> <span className="text-white">{selected.company}</span></div>}
                  <div>
                    <span className="text-gray-400">Státusz:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${statusLabels[selected.status]?.cls ?? "status-pending"}`}>
                      {statusLabels[selected.status]?.label ?? selected.status}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tárgy</label>
                  {editMode ? (
                    <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                  ) : (
                    <p className="text-white text-sm font-medium">{selected.subject}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Szöveg</label>
                  {editMode ? (
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={12} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500 resize-none font-mono" />
                  ) : (
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">{selected.body}</pre>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                {editMode ? (
                  <>
                    <button onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                    <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.6 0.2 255)" }}>
                      {saving ? "Mentés..." : "Mentés"}
                    </button>
                  </>
                ) : (
                  <>
                    {selected.status === "draft" && (
                      <button onClick={() => { setShowApproveModal(selected); setSelected(null); }} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "oklch(0.55 0.18 145)" }}>
                        Jóváhagyás
                      </button>
                    )}
                    {(selected.status === "approved" || selected.status === "draft") && (
                      <button onClick={() => { setShowSendModal(selected); setSelected(null); }} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "oklch(0.6 0.2 255)" }}>
                        Küldés
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approve Confirm Modal */}
        {showApproveModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-white">Email Jóváhagyása</h2>
              <p className="text-gray-300 text-sm">Biztosan jóváhagyod az emailt <strong>{showApproveModal.toName ?? showApproveModal.to}</strong> részére?</p>
              <p className="text-gray-400 text-xs">Tárgy: {showApproveModal.subject}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowApproveModal(null)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                <button onClick={() => handleApprove(showApproveModal)} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.55 0.18 145)" }}>
                  {saving ? "..." : "Jóváhagyás"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Confirm Modal */}
        {showSendModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Email Küldése</h2>
                <button onClick={() => setShowSendModal(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 space-y-1">
                <p className="text-gray-300 text-sm">Címzett: <strong className="text-white">{showSendModal.toName ?? showSendModal.to}</strong></p>
                <p className="text-gray-400 text-xs">Tárgy: {showSendModal.subject}</p>
              </div>
              {/* SMTP Config */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 font-medium">Küldő email fiók</label>
                  <button onClick={() => setShowSmtpSetup(!showSmtpSetup)} className="text-xs text-blue-400 flex items-center gap-1">
                    <Settings size={10} /> Beállítások
                  </button>
                </div>
                {(!smtpConfig.user || !smtpConfig.password || showSmtpSetup) ? (
                  <div className="space-y-2 bg-gray-800 rounded-lg p-3">
                    <div className="flex gap-2">
                      {(["gmail", "outlook"] as const).map(p => (
                        <button key={p} onClick={() => setSmtpConfig(c => ({ ...c, provider: p }))} className={`px-3 py-1 rounded text-xs font-medium ${smtpConfig.provider === p ? "text-white" : "text-gray-400 bg-gray-700"}`} style={smtpConfig.provider === p ? { background: "oklch(0.6 0.2 255)" } : {}}>
                          {p === "gmail" ? "Gmail" : "Outlook"}
                        </button>
                      ))}
                    </div>
                    <input value={smtpConfig.user} onChange={e => setSmtpConfig(c => ({ ...c, user: e.target.value }))} placeholder="Email cím (pl. nev@gmail.com)" className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                    <input type="password" value={smtpConfig.password} onChange={e => setSmtpConfig(c => ({ ...c, password: e.target.value }))} placeholder={smtpConfig.provider === "gmail" ? "Gmail App Jelszó (16 karakter)" : "Outlook jelszó"} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                    <input value={smtpConfig.fromName} onChange={e => setSmtpConfig(c => ({ ...c, fromName: e.target.value }))} placeholder="Feladó neve (pl. G2A Marketing)" className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                    {smtpConfig.provider === "gmail" && (
                      <p className="text-xs text-yellow-400">Gmail esetén App Jelszó szükséges: Google Fiók → Biztonság → 2FA → App jelszavak</p>
                    )}
                    <button onClick={handleVerifySmtp} disabled={saving} className="w-full py-1.5 rounded-lg text-xs text-white disabled:opacity-50" style={{ background: "oklch(0.55 0.18 145)" }}>
                      {saving ? "Ellenőrzés..." : "Kapcsolat tesztelése"}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 rounded-lg p-2">
                    <CheckCircle size={14} className="text-green-400" />
                    <span className="text-green-300 text-xs">{smtpConfig.user} ({smtpConfig.provider})</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSendModal(null)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                <button onClick={() => handleSend(showSendModal)} disabled={saving || !smtpConfig.user || !smtpConfig.password} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.6 0.2 255)" }}>
                  {saving ? "Küldés..." : "Küldés"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Email Modal */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Új Email Piszkozat</h2>
                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "to", label: "Email cím *", placeholder: "pelda@ceg.hu" },
                  { key: "toName", label: "Neve", placeholder: "Vezeték Keresztnév" },
                  { key: "company", label: "Cég", placeholder: "Cégnév Kft." },
                  { key: "subject", label: "Tárgy *", placeholder: "Email tárgya..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className={key === "subject" ? "col-span-2" : ""}>
                    <label className="block text-xs text-gray-400 mb-1">{label}</label>
                    <input value={(newForm as any)[key]} onChange={(e) => setNewForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email szöveg *</label>
                <textarea value={newForm.body} onChange={(e) => setNewForm(f => ({ ...f, body: e.target.value }))} rows={8} placeholder="Email szövege..." className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewModal(false)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Mégse</button>
                <button onClick={handleNewEmail} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: "oklch(0.6 0.2 255)" }}>
                  {saving ? "Mentés..." : "Piszkozat Mentése"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
