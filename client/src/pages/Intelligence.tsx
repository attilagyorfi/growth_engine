/**
 * G2A Growth Engine – Company Intelligence Page
 * Shows AI-generated company insights, SWOT, buyer personas, competitor analysis
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import {
  Brain, RefreshCw, Loader2, TrendingUp, TrendingDown,
  Users, Target, AlertTriangle, Star, Lightbulb,
  BarChart3, Globe, Zap, ChevronDown, ChevronUp,
  Building2, MessageSquare, Eye, Edit3, Check, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwotItem { text: string; source?: string }
interface Persona { name: string; role: string; painPoints: string[]; goals: string[]; channels: string[]; messagingAngle: string }
interface Competitor { name: string; strengths: string[]; weaknesses: string[]; differentiator: string }
interface ContentPillar { name: string; description: string; percentage: number; exampleTopics: string[] }
interface IntelligenceData {
  id?: string;
  companySummary?: string;
  swot?: { strengths: SwotItem[]; weaknesses: SwotItem[]; opportunities: SwotItem[]; threats: SwotItem[] };
  personas?: Persona[];
  competitors?: Competitor[];
  contentPillars?: ContentPillar[];
  positioningStatement?: string;
  uniqueValueProposition?: string;
  keyMessages?: string[];
  toneGuidelines?: string;
  generatedAt?: Date;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SwotCard({ title, items, color, icon: Icon }: {
  title: string; items: SwotItem[]; color: string; icon: React.ElementType
}) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
      <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color }}>
        <Icon size={16} /> {title}
      </h3>
      <ul className="space-y-2">
        {(items ?? []).map((item, i) => (
          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            {typeof item === "string" ? item : item.text}
          </li>
        ))}
        {(!items || items.length === 0) && <li className="text-gray-500 text-sm italic">Nincs adat</li>}
      </ul>
    </div>
  );
}

function PersonaCard({ persona }: { persona: Persona }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
            {persona.name?.[0] ?? "?"}
          </div>
          <div>
            <div className="text-white font-medium">{persona.name}</div>
            <div className="text-gray-400 text-sm">{persona.role}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
          <div className="pt-3">
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Fájdalompontok</h4>
            <ul className="space-y-1">
              {(persona.painPoints ?? []).map((p, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <AlertTriangle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Célok</h4>
            <ul className="space-y-1">
              {(persona.goals ?? []).map((g, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <Target size={12} className="text-green-400 mt-0.5 flex-shrink-0" /> {g}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Üzenetszög</h4>
            <p className="text-gray-300 text-sm italic">"{persona.messagingAngle}"</p>
          </div>
          <div>
            <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Preferált csatornák</h4>
            <div className="flex flex-wrap gap-2">
              {(persona.channels ?? []).map((c, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: "oklch(0.22 0.03 255)", color: "oklch(0.7 0.15 255)" }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Intelligence() {
  const { activeProfile: currentProfile } = useProfile();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: intel, isLoading, refetch } = trpc.intelligence.get.useQuery(
    { profileId: currentProfile?.id ?? "" },
    { enabled: !!currentProfile?.id }
  );

  const generateMutation = trpc.intelligence.generate.useMutation();

  const handleRegenerate = async () => {
    if (!currentProfile) return;
    setIsRegenerating(true);
    try {
      await generateMutation.mutateAsync({
        profileId: currentProfile.id,
        profileData: {
          name: currentProfile.name,
          website: currentProfile.website ?? "",
          industry: currentProfile.industry ?? "",
          description: currentProfile.description ?? "",
          brandVoice: currentProfile.brandVoice as { tone: string; style: string; keywords: string[] } | undefined,
        },
        onboardingAnswers: [],
      });
      await refetch();
      toast.success("Company Intelligence frissítve!");
    } catch {
      toast.error("Hiba a generálás során.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const intelData = intel as IntelligenceData | undefined;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: "Sora, sans-serif" }}>
              <Brain size={24} className="text-purple-400" />
              Company Intelligence
            </h1>
            <p className="text-gray-400 mt-1">
              {currentProfile?.name} – AI-alapú elemzés és stratégiai összefoglaló
              {intelData?.generatedAt && (
                <span className="ml-2 text-xs text-gray-500">
                  · Utoljára frissítve: {new Date(intelData.generatedAt).toLocaleDateString("hu-HU")}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 285), oklch(0.5 0.15 255))" }}
          >
            {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isRegenerating ? "Generálás..." : "Újragenerálás"}
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-purple-400" />
          </div>
        )}

        {!isLoading && !intelData && (
          <div className="text-center py-20">
            <Brain size={48} className="mx-auto mb-4 text-gray-600" />
            <h3 className="text-white font-semibold mb-2">Még nincs Company Intelligence</h3>
            <p className="text-gray-400 text-sm mb-6">Hozz létre egy ügyfélprofilt az Onboarding Wizard segítségével, vagy generáld manuálisan.</p>
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 285), oklch(0.5 0.15 255))" }}
            >
              {isRegenerating ? <Loader2 size={16} className="animate-spin inline mr-2" /> : <Zap size={16} className="inline mr-2" />}
              Intelligence generálása
            </button>
          </div>
        )}

        {!isLoading && intelData && (
          <div className="space-y-6">
            {/* Company Summary + UVP */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-400" /> Cégprofil összefoglaló
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{intelData.companySummary ?? "–"}</p>
              </div>
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Zap size={18} className="text-yellow-400" /> Egyedi értékajánlat (UVP)
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed italic">"{intelData.uniqueValueProposition ?? "–"}"</p>
                {intelData.positioningStatement && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Pozicionálás</p>
                    <p className="text-gray-300 text-sm">{intelData.positioningStatement}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Key Messages */}
            {intelData.keyMessages && intelData.keyMessages.length > 0 && (
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare size={18} className="text-cyan-400" /> Kulcsüzenetek
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {intelData.keyMessages.map((msg, i) => (
                    <div key={i} className="p-3 rounded-lg flex items-start gap-2" style={{ background: "oklch(0.18 0.02 255)" }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "oklch(0.4 0.15 255)" }}>{i + 1}</span>
                      <p className="text-gray-300 text-sm">{msg}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SWOT */}
            {intelData.swot && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 size={18} className="text-green-400" /> SWOT Elemzés
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <SwotCard title="Erősségek" items={intelData.swot.strengths ?? []} color="oklch(0.65 0.18 145)" icon={Star} />
                  <SwotCard title="Gyengeségek" items={intelData.swot.weaknesses ?? []} color="oklch(0.65 0.18 30)" icon={TrendingDown} />
                  <SwotCard title="Lehetőségek" items={intelData.swot.opportunities ?? []} color="oklch(0.65 0.18 255)" icon={TrendingUp} />
                  <SwotCard title="Fenyegetések" items={intelData.swot.threats ?? []} color="oklch(0.65 0.18 0)" icon={AlertTriangle} />
                </div>
              </div>
            )}

            {/* Buyer Personas */}
            {intelData.personas && intelData.personas.length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Users size={18} className="text-pink-400" /> Vevői Personák
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {intelData.personas.map((persona, i) => (
                    <PersonaCard key={i} persona={persona} />
                  ))}
                </div>
              </div>
            )}

            {/* Content Pillars */}
            {intelData.contentPillars && intelData.contentPillars.length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb size={18} className="text-amber-400" /> Tartalmi Pillérek
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {intelData.contentPillars.map((pillar, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">{pillar.name}</h3>
                        <span className="text-sm font-bold" style={{ color: `hsl(${i * 60}, 70%, 60%)` }}>{pillar.percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: "oklch(0.22 0.02 255)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pillar.percentage}%`, background: `hsl(${i * 60}, 70%, 60%)` }} />
                      </div>
                      <p className="text-gray-400 text-xs mb-2">{pillar.description}</p>
                      {pillar.exampleTopics && pillar.exampleTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pillar.exampleTopics.slice(0, 3).map((topic, j) => (
                            <span key={j} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.22 0.03 255)", color: "oklch(0.65 0.1 255)" }}>{topic}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitors */}
            {intelData.competitors && intelData.competitors.length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Globe size={18} className="text-red-400" /> Versenytárs Elemzés
                </h2>
                <div className="space-y-3">
                  {intelData.competitors.map((comp, i) => (
                    <div key={i} className="rounded-xl p-4 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                      <h3 className="text-white font-medium mb-3">{comp.name}</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-green-400 text-xs uppercase tracking-wider mb-2">Erősségek</p>
                          <ul className="space-y-1">
                            {(comp.strengths ?? []).map((s, j) => <li key={j} className="text-gray-300 text-xs">• {s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-orange-400 text-xs uppercase tracking-wider mb-2">Gyengeségek</p>
                          <ul className="space-y-1">
                            {(comp.weaknesses ?? []).map((w, j) => <li key={j} className="text-gray-300 text-xs">• {w}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-blue-400 text-xs uppercase tracking-wider mb-2">Mi a különbségünk</p>
                          <p className="text-gray-300 text-xs">{comp.differentiator}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tone Guidelines */}
            {intelData.toneGuidelines && (
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Edit3 size={18} className="text-violet-400" /> Kommunikációs irányelvek
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{intelData.toneGuidelines}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
