/*
 * G2A Growth Engine – Content Page
 * Design: "Dark Ops Dashboard"
 */

import DashboardLayout from "@/components/DashboardLayout";
import { FileText, Linkedin, Facebook, Instagram, Eye, CheckCircle } from "lucide-react";

const contentPackages = [
  {
    id: "1",
    week: "2026. március, 3. hét",
    focus: "AI a marketingben – Hogyan automatizálja a G2A az üzletszerzést?",
    pillar: "AI a marketingben",
    date: "2026-03-18",
    status: "pending_approval",
    platforms: ["linkedin", "facebook", "instagram"],
  },
];

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: <Linkedin size={13} />,
  facebook: <Facebook size={13} />,
  instagram: <Instagram size={13} />,
};

const platformColors: Record<string, string> = {
  linkedin: "oklch(0.55 0.18 255)",
  facebook: "oklch(0.55 0.2 240)",
  instagram: "oklch(0.6 0.2 330)",
};

export default function Content() {
  return (
    <DashboardLayout title="Tartalmak" subtitle="Generált social media tartalmak jóváhagyásra várva">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jóváhagyásra Vár", value: "1", color: "oklch(0.75 0.18 75)" },
          { label: "Jóváhagyott", value: "0", color: "oklch(0.65 0.18 165)" },
          { label: "Összes Csomag", value: "1", color: "oklch(0.6 0.2 255)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              {s.value}
            </p>
            <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Content Packages */}
      <div className="g2a-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
            Tartalomcsomagok
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          {contentPackages.map((pkg) => (
            <div key={pkg.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(0.65 0.18 165 / 12%)" }}
                  >
                    <FileText size={16} style={{ color: "oklch(0.65 0.18 165)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                      {pkg.week}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                      Pillér: {pkg.pillar}
                    </p>
                  </div>
                </div>
                <span className="status-badge status-pending flex-shrink-0">Jóváhagyásra vár</span>
              </div>

              <p className="text-sm mb-3" style={{ color: "oklch(0.7 0.01 240)" }}>
                <span className="font-medium" style={{ color: "oklch(0.75 0.015 240)" }}>Heti fókusz: </span>
                {pkg.focus}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pkg.platforms.map((p) => (
                    <div
                      key={p}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                      style={{ background: `${platformColors[p].replace(")", " / 12%)")}`, color: platformColors[p] }}
                    >
                      {platformIcons[p]}
                      <span className="capitalize">{p}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
