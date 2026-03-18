/*
 * G2A Growth Engine – Outbound Page
 * Design: "Dark Ops Dashboard"
 * Features: View email draft modal, Approve action with status update
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { Mail, CheckCircle, Clock, Eye } from "lucide-react";
import { toast } from "sonner";

type Draft = {
  id: string;
  company: string;
  contact: string;
  email: string;
  subject: string;
  date: string;
  status: "pending_approval" | "approved" | "sent";
  body: string;
};

const initialDrafts: Draft[] = [
  {
    id: "1",
    company: "TechVision Kft.",
    contact: "Kovács Péter",
    email: "kovacs.peter@techvision.hu",
    subject: "Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért",
    date: "2026-03-18",
    status: "pending_approval",
    body: `Kovács Úr,

A TechVision dinamikus bővülése az IT szolgáltatások terén figyelemre méltó, ugyanakkor a LinkedIn jelenlétük fejlesztésével jelentősen növelhető lenne a B2B ügyfélszerzés hatékonysága.

A G2A Marketing AI-alapú tartalomoptimalizálással és célzott social media stratégiával támogatja, hogy a TechVision erőteljesebb márkaismertséget építsen és releváns vállalati döntéshozókhoz jusson el.

Szívesen megosztanék néhány konkrét javaslatot egy rövid, informális beszélgetés során.

Üdvözlettel,
G2A Marketing`,
  },
  {
    id: "2",
    company: "Nexus Solutions Zrt.",
    contact: "Nagy Andrea",
    email: "nagy.andrea@nexussolutions.hu",
    subject: "Friss tartalom és AI-alapú social media a Nexus Solutions számára",
    date: "2026-03-18",
    status: "pending_approval",
    body: `Kedves Andrea,

Észrevettem, hogy a Nexus Solutions weboldalán aktív termékkommunikáció zajlik, azonban a blog és tartalommarketing terén kevés friss anyag található. Ez a terület jelentős lehetőséget rejt a szakmai hitelesség és SEO erősítésére.

A G2A Marketing AI-alapú tartalomstratégia és social media kampányok segítségével támogatni tudja a Nexus Solutions-t abban, hogy hatékonyabban érje el a célpiac döntéshozóit.

Szívesen beszélnék Önnel erről – lenne rá egy rövid időpontja a héten?

Üdvözlettel,
G2A Marketing`,
  },
];

const statusLabels: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  approved: { label: "Jóváhagyva", cls: "status-sent" },
  sent: { label: "Kiküldve", cls: "status-replied" },
};

export default function Outbound() {
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [viewDraft, setViewDraft] = useState<Draft | null>(null);
  const [approveDraft, setApproveDraft] = useState<Draft | null>(null);

  const handleApprove = (draft: Draft) => {
    setDrafts((prev) => prev.map((d) => d.id === draft.id ? { ...d, status: "approved" } : d));
    setApproveDraft(null);
    setViewDraft(null);
    toast.success(`Email jóváhagyva: ${draft.company}`, { description: "Az email piszkozat jóváhagyásra került és kiküldésre kész." });
  };

  const pending = drafts.filter((d) => d.status === "pending_approval");
  const approved = drafts.filter((d) => d.status === "approved" || d.status === "sent");

  return (
    <DashboardLayout title="Outbound Emailek" subtitle="Generált email piszkozatok és kiküldési napló">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jóváhagyásra Vár", value: String(pending.length), color: "oklch(0.75 0.18 75)", icon: Clock },
          { label: "Jóváhagyott / Kiküldve", value: String(approved.length), color: "oklch(0.65 0.18 165)", icon: CheckCircle },
          { label: "Összes Email", value: String(drafts.length), color: "oklch(0.6 0.2 255)", icon: Mail },
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
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
            Összes Email Piszkozat
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          {drafts.map((draft) => {
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
                    <span className={`status-badge ${st.cls} flex-shrink-0`}>{st.label}</span>
                  </div>
                  <p className="text-xs mt-2 line-clamp-2" style={{ color: "oklch(0.5 0.015 240)" }}>
                    {draft.body.split("\n")[0]}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => setViewDraft(draft)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                      style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}
                    >
                      <Eye size={12} />
                      Megtekintés
                    </button>
                    {draft.status === "pending_approval" && (
                      <button
                        onClick={() => setApproveDraft(draft)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                        style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)" }}
                      >
                        <CheckCircle size={12} />
                        Jóváhagyás
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
        <DetailModal
          isOpen={!!viewDraft}
          onClose={() => setViewDraft(null)}
          title={`Email – ${viewDraft.company}`}
          subtitle={`Tárgy: ${viewDraft.subject}`}
          footer={
            <>
              <button onClick={() => setViewDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Bezárás
              </button>
              {viewDraft.status === "pending_approval" && (
                <button
                  onClick={() => { setApproveDraft(viewDraft); setViewDraft(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "oklch(0.65 0.18 165)", color: "white", fontFamily: "Sora, sans-serif" }}
                >
                  <CheckCircle size={14} className="inline mr-1.5" />
                  Jóváhagyás
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cím", value: viewDraft.contact },
                { label: "Email", value: viewDraft.email },
                { label: "Tárgy", value: viewDraft.subject },
                { label: "Dátum", value: viewDraft.date },
              ].map((f) => (
                <div key={f.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                  <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>{f.label}</p>
                  <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.008 240)" }}>{f.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>EMAIL SZÖVEG</p>
              {viewDraft.body.split("\n").map((line, i) => (
                line === "" ? <div key={i} className="h-3" /> : <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>
              ))}
            </div>
          </div>
        </DetailModal>
      )}

      {/* Approve Confirm Modal */}
      {approveDraft && (
        <DetailModal
          isOpen={!!approveDraft}
          onClose={() => setApproveDraft(null)}
          title="Email Jóváhagyása"
          subtitle="Biztosan jóváhagyod ezt az emailt?"
          footer={
            <>
              <button onClick={() => setApproveDraft(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Mégse
              </button>
              <button
                onClick={() => handleApprove(approveDraft)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "oklch(0.65 0.18 165)", color: "white", fontFamily: "Sora, sans-serif" }}
              >
                Igen, Jóváhagyom
              </button>
            </>
          }
        >
          <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{approveDraft.company}</p>
            <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>{approveDraft.contact} · {approveDraft.email}</p>
            <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>Tárgy: {approveDraft.subject}</p>
          </div>
          <p className="text-sm mt-4" style={{ color: "oklch(0.65 0.015 240)" }}>
            A jóváhagyás után az email kiküldésre kész állapotba kerül. Ez a művelet visszavonható.
          </p>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
