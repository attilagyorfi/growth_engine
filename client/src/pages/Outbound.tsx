/*
 * G2A Growth Engine – Outbound Page
 * Design: "Dark Ops Dashboard"
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Mail, CheckCircle, Clock, Eye } from "lucide-react";

const drafts = [
  {
    id: "1",
    company: "TechVision Kft.",
    contact: "Kovács Péter",
    subject: "Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért",
    date: "2026-03-18",
    status: "pending_approval",
    preview:
      "Kovács Úr, A TechVision dinamikus bővülése az IT szolgáltatások terén figyelemre méltó...",
  },
  {
    id: "2",
    company: "Nexus Solutions Zrt.",
    contact: "Nagy Andrea",
    subject: "Friss tartalom és AI-alapú social media a Nexus Solutions számára",
    date: "2026-03-18",
    status: "pending_approval",
    preview:
      "Kedves Andrea, Észrevettem, hogy a Nexus Solutions weboldalán aktív termékkommunikáció zajlik...",
  },
];

export default function Outbound() {
  return (
    <DashboardLayout title="Outbound Emailek" subtitle="Generált email piszkozatok és kiküldési napló">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jóváhagyásra Vár", value: "2", color: "oklch(0.75 0.18 75)", icon: Clock },
          { label: "Kiküldve (ma)", value: "0", color: "oklch(0.65 0.18 165)", icon: CheckCircle },
          { label: "Összes Email", value: "2", color: "oklch(0.6 0.2 255)", icon: Mail },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="g2a-stat-card p-4 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color.replace(")", " / 15%)")}` }}
              >
                <Icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                  {s.value}
                </p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>
                  {s.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drafts List */}
      <div className="g2a-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
            Piszkozatok – Jóváhagyásra Várnak
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          {drafts.map((draft) => (
            <div key={draft.id} className="px-5 py-4 flex items-start gap-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "oklch(0.6 0.2 255 / 12%)" }}
              >
                <Mail size={16} style={{ color: "oklch(0.6 0.2 255)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                      {draft.company}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                      {draft.contact} · Tárgy: {draft.subject}
                    </p>
                  </div>
                  <span className="status-badge status-pending flex-shrink-0">
                    Jóváhagyásra vár
                  </span>
                </div>
                <p className="text-xs mt-2 line-clamp-2" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {draft.preview}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
                    style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}
                  >
                    <Eye size={12} />
                    Megtekintés
                  </button>
                  <button
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
                    style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)" }}
                  >
                    <CheckCircle size={12} />
                    Jóváhagyás
                  </button>
                  <p className="text-xs ml-auto" style={{ color: "oklch(0.45 0.015 240)" }}>
                    {draft.date}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
