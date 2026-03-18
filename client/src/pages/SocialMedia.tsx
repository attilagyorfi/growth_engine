/*
 * G2A Growth Engine – Social Media Integration Page
 * Design: "Dark Ops Dashboard"
 * Features: Connect/disconnect social accounts, connection status, platform info
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Linkedin, Facebook, Instagram, Twitter, Music2, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import DetailModal from "@/components/DetailModal";

type Platform = {
  id: string;
  name: string;
  handle: string;
  icon: React.ReactNode;
  color: string;
  connected: boolean;
  lastSync?: string;
  followers?: number;
  authUrl: string;
  description: string;
  features: string[];
};

const initialPlatforms: Platform[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    handle: "",
    icon: <Linkedin size={22} />,
    color: "oklch(0.55 0.18 255)",
    connected: false,
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    description: "B2B lead generálás és thought leadership tartalmak publikálása.",
    features: ["Posztok automatikus közzététele", "Cégoldal kezelés", "Analytics hozzáférés", "Lead Gen Forms"],
  },
  {
    id: "facebook",
    name: "Facebook",
    handle: "",
    icon: <Facebook size={22} />,
    color: "oklch(0.55 0.2 240)",
    connected: false,
    authUrl: "https://www.facebook.com/dialog/oauth",
    description: "Cégoldal kezelés, tartalmak ütemezése és közönség elérése.",
    features: ["Oldal posztok közzététele", "Ütemezés", "Insights hozzáférés", "Hirdetéskezelő integráció"],
  },
  {
    id: "instagram",
    name: "Instagram",
    handle: "",
    icon: <Instagram size={22} />,
    color: "oklch(0.6 0.2 330)",
    connected: false,
    authUrl: "https://api.instagram.com/oauth/authorize",
    description: "Vizuális tartalmak és reel-ek közzététele, brand building.",
    features: ["Feed posztok közzététele", "Story ütemezés", "Reels támogatás", "Hashtag analytics"],
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    handle: "",
    icon: <Twitter size={22} />,
    color: "oklch(0.7 0.01 240)",
    connected: false,
    authUrl: "https://twitter.com/i/oauth2/authorize",
    description: "Gyors tartalmak, trendek követése és valós idejű kommunikáció.",
    features: ["Tweet ütemezés", "Thread közzététel", "Analytics", "Trending témák figyelés"],
  },
  {
    id: "tiktok",
    name: "TikTok",
    handle: "",
    icon: <Music2 size={22} />,
    color: "oklch(0.65 0.22 5)",
    connected: false,
    authUrl: "https://www.tiktok.com/auth/authorize",
    description: "Rövid videók és virális tartalmak közzététele, fiatal közönség elérése.",
    features: ["Videó feltöltés és ütemezés", "TikTok Business API", "Analytics és trendek", "Hashtag követés"],
  },
];

export default function SocialMedia() {
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [connectModal, setConnectModal] = useState<Platform | null>(null);
  const [handleInput, setHandleInput] = useState("");

  const handleConnect = (platform: Platform) => {
    if (!handleInput.trim()) {
      toast.error("Add meg a fiók nevét / URL-jét!");
      return;
    }
    setPlatforms((prev) => prev.map((p) =>
      p.id === platform.id
        ? { ...p, connected: true, handle: handleInput.trim(), lastSync: new Date().toLocaleString("hu-HU") }
        : p
    ));
    toast.success(`${platform.name} sikeresen csatlakoztatva!`, {
      description: `A @${handleInput.trim()} fiók össze van kötve a Growth Engine-nel.`,
    });
    setConnectModal(null);
    setHandleInput("");
  };

  const handleDisconnect = (id: string) => {
    setPlatforms((prev) => prev.map((p) =>
      p.id === id ? { ...p, connected: false, handle: "", lastSync: undefined, followers: undefined } : p
    ));
    toast.info("Fiók leválasztva.");
    setSelectedPlatform(null);
  };

  const handleSync = (id: string) => {
    setPlatforms((prev) => prev.map((p) =>
      p.id === id ? { ...p, lastSync: new Date().toLocaleString("hu-HU") } : p
    ));
    toast.success("Szinkronizálás sikeres!");
  };

  const connected = platforms.filter((p) => p.connected);
  const disconnected = platforms.filter((p) => !p.connected);

  return (
    <DashboardLayout title="Social Media Integráció" subtitle="Közösségi média fiókok összekapcsolása és kezelése">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Csatlakoztatott Fiók", value: String(connected.length), color: "oklch(0.65 0.18 165)" },
          { label: "Elérhető Platform", value: String(platforms.length), color: "oklch(0.6 0.2 255)" },
          { label: "Ütemezett Poszt", value: "0", color: "oklch(0.75 0.18 75)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Connected Accounts */}
      {connected.length > 0 && (
        <div className="g2a-card p-5 mb-5">
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
            Csatlakoztatott Fiókok
          </h3>
          <div className="space-y-3">
            {connected.map((p) => (
              <div key={p.id} className="flex items-center gap-4 rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(0.65 0.18 165 / 20%)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${p.color.replace(")", " / 15%)")}`, color: p.color }}>
                  {p.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{p.name}</p>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.75 0.15 165)" }}>
                      <CheckCircle size={11} />Csatlakoztatva
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>@{p.handle} · Szinkron: {p.lastSync}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSync(p.id)} className="p-2 rounded-lg transition-opacity hover:opacity-80" style={{ background: "oklch(0.6 0.2 255 / 12%)", color: "oklch(0.75 0.18 255)" }}>
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => handleDisconnect(p.id)} className="p-2 rounded-lg transition-opacity hover:opacity-80" style={{ background: "oklch(0.65 0.22 25 / 12%)", color: "oklch(0.75 0.2 25)" }}>
                    <Unlink size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Platforms */}
      <div className="g2a-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
          Elérhető Platformok
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {disconnected.map((p) => (
            <div key={p.id} className="rounded-xl p-5" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${p.color.replace(")", " / 12%)")}`, color: p.color }}>
                  {p.icon}
                </div>
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ background: "oklch(0.65 0.22 25 / 10%)", color: "oklch(0.65 0.22 25)" }}>
                  <AlertCircle size={10} />Nincs csatlakoztatva
                </span>
              </div>
              <p className="text-sm font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{p.name}</p>
              <p className="text-xs mb-3" style={{ color: "oklch(0.55 0.015 240)" }}>{p.description}</p>
              <div className="space-y-1 mb-4">
                {p.features.map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>
                    <CheckCircle size={10} style={{ color: p.color }} />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setConnectModal(p); setHandleInput(""); }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ background: p.color, color: "white", fontFamily: "Sora, sans-serif" }}
                >
                  Csatlakoztatás
                </button>
                <button
                  onClick={() => setSelectedPlatform(p)}
                  className="p-2 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: "oklch(0.28 0.02 255)", color: "oklch(0.6 0.015 240)" }}
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      {connectModal && (
        <DetailModal
          isOpen={!!connectModal}
          onClose={() => { setConnectModal(null); setHandleInput(""); }}
          title={`${connectModal.name} Csatlakoztatása`}
          subtitle="Add meg a fiók adatait az összekapcsoláshoz"
          footer={
            <>
              <button onClick={() => { setConnectModal(null); setHandleInput(""); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Mégse
              </button>
              <button onClick={() => handleConnect(connectModal)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: connectModal.color, color: "white", fontFamily: "Sora, sans-serif" }}>
                Csatlakoztatás
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: `1px solid ${connectModal.color.replace(")", " / 20%)")}` }}>
              <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.015 240)" }}>Platform</p>
              <div className="flex items-center gap-2">
                <span style={{ color: connectModal.color }}>{connectModal.icon}</span>
                <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{connectModal.name}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>
                Fiók neve / Handle *
              </label>
              <input
                type="text"
                placeholder={`pl. g2a.marketing`}
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                onKeyDown={(e) => e.key === "Enter" && handleConnect(connectModal)}
              />
            </div>
            <div className="rounded-lg p-3" style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}>
              <p className="text-xs" style={{ color: "oklch(0.75 0.15 75)" }}>
                <strong>Megjegyzés:</strong> Éles API integráció esetén a rendszer OAuth-on keresztül kéri az engedélyeket. A jelenlegi verzióban a fiók adatai manuálisan rögzíthetők.
              </p>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Info Modal */}
      {selectedPlatform && (
        <DetailModal
          isOpen={!!selectedPlatform}
          onClose={() => setSelectedPlatform(null)}
          title={`${selectedPlatform.name} – Részletek`}
          subtitle={selectedPlatform.description}
          footer={
            <>
              <button onClick={() => setSelectedPlatform(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
                Bezárás
              </button>
              <button onClick={() => { setConnectModal(selectedPlatform); setSelectedPlatform(null); setHandleInput(""); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: selectedPlatform.color, color: "white" }}>
                Csatlakoztatás
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: "oklch(0.75 0.015 240)", fontFamily: "Sora, sans-serif" }}>Elérhető funkciók:</p>
            {selectedPlatform.features.map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                <CheckCircle size={14} style={{ color: selectedPlatform.color }} />
                <p className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{f}</p>
              </div>
            ))}
          </div>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
