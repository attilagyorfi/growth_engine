/*
 * G2A Growth Engine – Leads Page
 * Design: "Dark Ops Dashboard"
 */

import DashboardLayout from "@/components/DashboardLayout";
import { UserPlus, Search, Filter } from "lucide-react";

const leads = [
  {
    id: "1",
    company: "TechVision Kft.",
    contact: "Kovács Péter",
    title: "CEO",
    email: "kovacs.peter@techvision.hu",
    industry: "IT Services",
    size: "200-500",
    status: "pending_approval",
    added: "2026-03-18",
  },
  {
    id: "2",
    company: "Nexus Solutions Zrt.",
    contact: "Nagy Andrea",
    title: "Marketing Director",
    email: "nagy.andrea@nexussolutions.hu",
    industry: "Manufacturing",
    size: "500-1000",
    status: "pending_approval",
    added: "2026-03-18",
  },
];

const statusLabels: Record<string, { label: string; cls: string }> = {
  new: { label: "Új", cls: "status-new" },
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  sent: { label: "Kiküldve", cls: "status-sent" },
  replied: { label: "Válaszolt", cls: "status-replied" },
  rejected: { label: "Elutasítva", cls: "status-rejected" },
};

export default function Leads() {
  return (
    <DashboardLayout title="Lead Adatbázis" subtitle="Összes azonosított és minősített potenciális ügyfél">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.55 0.015 240)" }}
          >
            <Search size={14} />
            <input
              type="text"
              placeholder="Keresés..."
              className="bg-transparent outline-none text-sm w-48"
              style={{ color: "oklch(0.85 0.008 240)" }}
            />
          </div>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "oklch(0.18 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.55 0.015 240)" }}
          >
            <Filter size={14} />
            Szűrő
          </button>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: "oklch(0.6 0.2 255)",
            color: "white",
            fontFamily: "Sora, sans-serif",
          }}
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
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "oklch(0.45 0.015 240)", fontFamily: "Sora, sans-serif" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const st = statusLabels[lead.status] || { label: lead.status, cls: "status-new" };
              return (
                <tr
                  key={lead.id}
                  style={{
                    borderBottom: i < leads.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                      {lead.company}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: "oklch(0.75 0.008 240)" }}>{lead.contact}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{lead.title}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>
                    {lead.industry}
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.65 0.015 240)" }}>
                    {lead.size} fő
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "oklch(0.5 0.015 240)" }}>
                    {lead.added}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
