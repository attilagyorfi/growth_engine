/*
 * G2A Growth Engine – Content Page
 * Design: "Dark Ops Dashboard"
 * Features: View content package modal, Approve action with status update
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { FileText, Linkedin, Facebook, Instagram, Eye, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type ContentPackage = {
  id: string;
  week: string;
  focus: string;
  pillar: string;
  date: string;
  status: "pending_approval" | "approved";
  platforms: string[];
  linkedin: string;
  facebook: string;
  instagram: string;
};

const initialPackages: ContentPackage[] = [
  {
    id: "1",
    week: "2026. március, 3. hét",
    focus: "AI a marketingben – Hogyan automatizálja a G2A az üzletszerzést?",
    pillar: "AI a marketingben",
    date: "2026-03-18",
    status: "pending_approval",
    platforms: ["linkedin", "facebook", "instagram"],
    linkedin: `A legtöbb vállalat még mindig manuálisan végzi azt, amit az AI másodpercek alatt elvégez.

Az outbound értékesítés, a tartalomgyártás és a kampányoptimalizálás – mind automatizálható. A G2A Marketing Growth Engine napi szinten azonosít potenciális ügyfeleket, személyre szabott emaileket generál és social media tartalmakat készít.

Ez nem a jövő – ez ma elérhető.

👉 Kíváncsi vagy, hogyan működik? Írj üzenetet!

#AIMarketing #B2BMarketing #GrowthEngine #G2AMarketing`,
    facebook: `Tudtad, hogy az AI ma már képes személyre szabott üzleti emaileket írni, stratégiát alkotni és tartalmat gyártani?

A G2A Marketing ezt valósítja meg ügyfeleinek naponta. Automatizált lead-gyűjtés, email piszkozatok és social media tartalmak – mindezt emberi jóváhagyással kombinálva.

Szeretnéd látni, hogyan működik? Kommentelj vagy küldj üzenetet! 👇`,
    instagram: `AI + Marketing = Skálázható növekedés 🚀

Napi automatizált lead-azonosítás ✅
Személyre szabott email piszkozatok ✅
Heti social media tartalmak ✅

Mindezt emberi kontroll mellett.

#AIMarketing #B2BMarketing #GrowthEngine #G2AMarketing #MarketingAutomation`,
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

const platformLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
};

export default function Content() {
  const [packages, setPackages] = useState<ContentPackage[]>(initialPackages);
  const [viewPkg, setViewPkg] = useState<ContentPackage | null>(null);
  const [approvePkg, setApprovePkg] = useState<ContentPackage | null>(null);
  const [activeTab, setActiveTab] = useState<string>("linkedin");

  const handleApprove = (pkg: ContentPackage) => {
    setPackages((prev) => prev.map((p) => p.id === pkg.id ? { ...p, status: "approved" } : p));
    setApprovePkg(null);
    setViewPkg(null);
    toast.success(`Tartalomcsomag jóváhagyva: ${pkg.week}`, { description: "A tartalmak jóváhagyásra kerültek és publikálásra készek." });
  };

  const pending = packages.filter((p) => p.status === "pending_approval");
  const approved = packages.filter((p) => p.status === "approved");

  return (
    <DashboardLayout title="Tartalmak" subtitle="Generált social media tartalmak jóváhagyásra várva">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Jóváhagyásra Vár", value: String(pending.length), color: "oklch(0.75 0.18 75)" },
          { label: "Jóváhagyott", value: String(approved.length), color: "oklch(0.65 0.18 165)" },
          { label: "Összes Csomag", value: String(packages.length), color: "oklch(0.6 0.2 255)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Content Packages */}
      <div className="g2a-card overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Tartalomcsomagok</h3>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
          {packages.map((pkg) => (
            <div key={pkg.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.65 0.18 165 / 12%)" }}>
                    <FileText size={16} style={{ color: "oklch(0.65 0.18 165)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{pkg.week}</p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>Pillér: {pkg.pillar}</p>
                  </div>
                </div>
                <span className={`status-badge flex-shrink-0 ${pkg.status === "approved" ? "status-sent" : "status-pending"}`}>
                  {pkg.status === "approved" ? "Jóváhagyva" : "Jóváhagyásra vár"}
                </span>
              </div>

              <p className="text-sm mb-3" style={{ color: "oklch(0.7 0.01 240)" }}>
                <span className="font-medium" style={{ color: "oklch(0.75 0.015 240)" }}>Heti fókusz: </span>
                {pkg.focus}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pkg.platforms.map((p) => (
                    <div key={p} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: `${platformColors[p].replace(")", " / 12%)")}`, color: platformColors[p] }}>
                      {platformIcons[p]}
                      <span>{platformLabels[p]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setViewPkg(pkg); setActiveTab("linkedin"); }}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                    style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}
                  >
                    <Eye size={12} />
                    Megtekintés
                  </button>
                  {pkg.status === "pending_approval" && (
                    <button
                      onClick={() => setApprovePkg(pkg)}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                      style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)" }}
                    >
                      <CheckCircle size={12} />
                      Jóváhagyás
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Modal */}
      {viewPkg && (
        <DetailModal
          isOpen={!!viewPkg}
          onClose={() => setViewPkg(null)}
          title={`Tartalomcsomag – ${viewPkg.week}`}
          subtitle={`Fókusz: ${viewPkg.focus}`}
          footer={
            <>
              <button onClick={() => setViewPkg(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Bezárás
              </button>
              {viewPkg.status === "pending_approval" && (
                <button
                  onClick={() => { setApprovePkg(viewPkg); setViewPkg(null); }}
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
          {/* Platform Tabs */}
          <div className="flex gap-2 mb-4">
            {viewPkg.platforms.map((p) => (
              <button
                key={p}
                onClick={() => setActiveTab(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: activeTab === p ? `${platformColors[p].replace(")", " / 20%)")}` : "oklch(0.22 0.02 255)",
                  color: activeTab === p ? platformColors[p] : "oklch(0.55 0.015 240)",
                  border: `1px solid ${activeTab === p ? platformColors[p].replace(")", " / 40%)") : "oklch(1 0 0 / 8%)"}`,
                }}
              >
                {platformIcons[p]}
                {platformLabels[p]}
              </button>
            ))}
          </div>
          <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>
              {platformLabels[activeTab]} Poszt
            </p>
            {((viewPkg as unknown as Record<string, string>)[activeTab] || "").split("\n").map((line: string, i: number) => (
              line === "" ? <div key={i} className="h-2" /> : <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>
            ))}
          </div>
        </DetailModal>
      )}

      {/* Approve Confirm Modal */}
      {approvePkg && (
        <DetailModal
          isOpen={!!approvePkg}
          onClose={() => setApprovePkg(null)}
          title="Tartalomcsomag Jóváhagyása"
          subtitle="Biztosan jóváhagyod ezt a tartalomcsomagot?"
          footer={
            <>
              <button onClick={() => setApprovePkg(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Mégse
              </button>
              <button
                onClick={() => handleApprove(approvePkg)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "oklch(0.65 0.18 165)", color: "white", fontFamily: "Sora, sans-serif" }}
              >
                Igen, Jóváhagyom
              </button>
            </>
          }
        >
          <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{approvePkg.week}</p>
            <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>Pillér: {approvePkg.pillar}</p>
            <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>Platformok: {approvePkg.platforms.map((p) => platformLabels[p]).join(", ")}</p>
          </div>
          <p className="text-sm mt-4" style={{ color: "oklch(0.65 0.015 240)" }}>
            A jóváhagyás után a tartalmak publikálásra kész állapotba kerülnek. A posztokat a közösségi média felületeken manuálisan kell közzétenni.
          </p>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
