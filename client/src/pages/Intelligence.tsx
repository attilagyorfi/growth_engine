/**
 * G2A Growth Engine – Cégintelligencia oldal
 *
 * A `companyIntelligence` DB-séma (drizzle/schema.ts) tényleges mezőit jeleníti meg:
 * companySummary, brandDna, offerMap, audienceMap, competitorSnapshot,
 * platformPriorities, successGoals, aiWritingRules. (Korábban régi mezőnevek
 * — swot / personas / contentPillars / uniqueValueProposition — szerepeltek
 * a render-blokkokban, ezért az oldal nagy része üresen maradt.)
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { AiLimitBanner } from "@/components/AiLimitBanner";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import {
  Brain, RefreshCw, Loader2, Users, Target, AlertTriangle,
  Lightbulb, Globe, Zap, ChevronDown, ChevronUp,
  Building2, Edit3, Check, X, Sparkles, Package, BarChart3,
  CalendarDays, Quote, Heart,
} from "lucide-react";

// ─── Types: a valódi DB-séma alapján (drizzle/schema.ts) ──────────────────────

interface BrandDna {
  coreValues?: string[];
  personality?: string[];
  differentiators?: string[];
  brandPromise?: string;
}
interface Offer { name: string; description: string; targetAudience?: string; pricing?: string; usp?: string }
interface Audience { segment: string; description: string; painPoints?: string[]; goals?: string[]; channels?: string[] }
interface Competitor { name: string; strengths?: string[]; weaknesses?: string[]; positioning?: string }
interface Platform { platform: string; priority: number; rationale?: string }
interface SuccessGoals { thirtyDay?: string[]; ninetyDay?: string[]; oneYear?: string[] }
interface AiWritingRules { doList?: string[]; dontList?: string[]; toneGuidelines?: string; examplePhrases?: string[] }

interface IntelligenceData {
  id?: string;
  companySummary?: string | null;
  brandDna?: BrandDna | null;
  offerMap?: Offer[] | null;
  audienceMap?: Audience[] | null;
  competitorSnapshot?: Competitor[] | null;
  platformPriorities?: Platform[] | null;
  successGoals?: SuccessGoals | null;
  aiWritingRules?: AiWritingRules | null;
  generatedAt?: Date | string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 border ${className ?? ""}`}
      style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, color, children }: { icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
      <Icon size={18} style={{ color }} /> {children}
    </h2>
  );
}

function ChipList({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v, i) => (
        <span
          key={i}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{ background: `oklch(from ${color} l c h / 15%)`, color }}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function AudienceCard({ a }: { a: Audience }) {
  const [expanded, setExpanded] = useState(false);
  const has = (xs?: string[]) => !!xs && xs.length > 0;
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}>
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, var(--qa-accent), oklch(0.55 0.18 165))" }}>
            {a.segment?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{a.segment}</div>
            <div className="text-gray-400 text-sm truncate">{a.description}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
          {has(a.painPoints) && (
            <div className="pt-3">
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Fájdalompontok</h4>
              <ul className="space-y-1">
                {a.painPoints!.map((p, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                    <AlertTriangle size={12} className="text-orange-400 mt-0.5 flex-shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {has(a.goals) && (
            <div>
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Célok</h4>
              <ul className="space-y-1">
                {a.goals!.map((g, i) => (
                  <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                    <Target size={12} className="text-green-400 mt-0.5 flex-shrink-0" /> {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {has(a.channels) && (
            <div>
              <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Preferált csatornák</h4>
              <ChipList items={a.channels!} color="oklch(0.7 0.15 255)" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GoalsTimeline({ goals }: { goals: SuccessGoals }) {
  const cols: Array<{ label: string; items?: string[]; color: string }> = [
    { label: "30 nap", items: goals.thirtyDay, color: "oklch(0.7 0.15 145)" },
    { label: "90 nap", items: goals.ninetyDay, color: "oklch(0.7 0.15 255)" },
    { label: "1 év", items: goals.oneYear, color: "oklch(0.7 0.18 295)" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cols.map((c, i) => (
        <div key={i} className="rounded-lg p-4 border" style={{ background: "oklch(0.18 0.02 255)", borderColor: "var(--qa-surface3)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={14} style={{ color: c.color }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.color }}>{c.label}</span>
          </div>
          {c.items && c.items.length > 0 ? (
            <ul className="space-y-2">
              {c.items.map((it, j) => (
                <li key={j} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  {it}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 italic">Nincs adat</p>
          )}
        </div>
      ))}
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
      toast.success("Cégintelligencia frissítve!");
    } catch {
      toast.error("Hiba a generálás során.");
    } finally {
      setIsRegenerating(false);
    }
  };

  const intelData = intel as IntelligenceData | undefined;
  const bd = intelData?.brandDna ?? undefined;
  const uvp = bd?.brandPromise?.trim();
  const has = <T,>(xs?: T[] | null): xs is T[] => Array.isArray(xs) && xs.length > 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <AiLimitBanner />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: "Sora, sans-serif" }}>
              <Brain size={24} className="text-purple-400" />
              Cégintelligencia
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
            <h3 className="text-white font-semibold mb-2">Még nincs cégintelligencia</h3>
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
            {/* Cégprofil + UVP */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Building2 size={18} className="text-blue-400" /> Cégprofil összefoglaló
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">{intelData.companySummary ?? "Nincs adat"}</p>
              </SectionCard>
              <SectionCard>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Zap size={18} className="text-yellow-400" /> Egyedi értékajánlat (UVP)
                </h3>
                {uvp ? (
                  <p className="text-gray-300 text-sm leading-relaxed italic">"{uvp}"</p>
                ) : (
                  <p className="text-gray-500 text-sm italic">A brand ígéret még nem készült el. Generálj újra a fenti gombbal.</p>
                )}
              </SectionCard>
            </div>

            {/* Márka DNS */}
            {bd && (has(bd.coreValues) || has(bd.personality) || has(bd.differentiators)) && (
              <div>
                <SectionTitle icon={Heart} color="oklch(0.65 0.2 0)">Márka DNS</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {has(bd.coreValues) && (
                    <SectionCard>
                      <h4 className="text-xs uppercase tracking-wider mb-3" style={{ color: "oklch(0.7 0.15 30)" }}>Alapértékek</h4>
                      <ChipList items={bd.coreValues!} color="oklch(0.7 0.15 30)" />
                    </SectionCard>
                  )}
                  {has(bd.personality) && (
                    <SectionCard>
                      <h4 className="text-xs uppercase tracking-wider mb-3" style={{ color: "oklch(0.7 0.18 295)" }}>Személyiség</h4>
                      <ChipList items={bd.personality!} color="oklch(0.7 0.18 295)" />
                    </SectionCard>
                  )}
                  {has(bd.differentiators) && (
                    <SectionCard>
                      <h4 className="text-xs uppercase tracking-wider mb-3" style={{ color: "oklch(0.7 0.15 255)" }}>Megkülönböztető tényezők</h4>
                      <ul className="space-y-1.5">
                        {bd.differentiators!.map((d, i) => (
                          <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                            <Sparkles size={12} className="mt-1 flex-shrink-0" style={{ color: "oklch(0.7 0.15 255)" }} /> {d}
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                  )}
                </div>
              </div>
            )}

            {/* Szolgáltatások / Termékek */}
            {has(intelData.offerMap) && (
              <div>
                <SectionTitle icon={Package} color="oklch(0.65 0.18 195)">Szolgáltatások és termékek</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {intelData.offerMap.map((o, i) => (
                    <SectionCard key={i}>
                      <h4 className="text-white font-medium mb-1.5">{o.name}</h4>
                      <p className="text-gray-300 text-sm mb-3">{o.description}</p>
                      <div className="space-y-1.5 text-xs">
                        {o.targetAudience && (
                          <div><span className="text-gray-500">Célcsoport:</span> <span className="text-gray-300">{o.targetAudience}</span></div>
                        )}
                        {o.usp && (
                          <div><span className="text-gray-500">USP:</span> <span className="text-gray-300 italic">{o.usp}</span></div>
                        )}
                        {o.pricing && (
                          <div><span className="text-gray-500">Árazás:</span> <span className="text-gray-300">{o.pricing}</span></div>
                        )}
                      </div>
                    </SectionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Célközönség (audienceMap) */}
            {has(intelData.audienceMap) && (
              <div>
                <SectionTitle icon={Users} color="oklch(0.7 0.18 330)">Célközönség szegmensek</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {intelData.audienceMap.map((a, i) => (
                    <AudienceCard key={i} a={a} />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Kattints egy szegmensre a részletekhez (fájdalompontok, célok, csatornák).</p>
              </div>
            )}

            {/* Versenytárs elemzés */}
            {has(intelData.competitorSnapshot) && (
              <div>
                <SectionTitle icon={Globe} color="oklch(0.65 0.2 0)">Versenytárs elemzés</SectionTitle>
                <div className="space-y-3">
                  {intelData.competitorSnapshot.map((c, i) => (
                    <SectionCard key={i}>
                      <h3 className="text-white font-medium mb-3">{c.name}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-green-400 text-xs uppercase tracking-wider mb-2">Erősségek</p>
                          <ul className="space-y-1">
                            {(c.strengths ?? []).map((s, j) => <li key={j} className="text-gray-300 text-xs">• {s}</li>)}
                            {!has(c.strengths) && <li className="text-gray-500 text-xs italic">–</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-orange-400 text-xs uppercase tracking-wider mb-2">Gyengeségek</p>
                          <ul className="space-y-1">
                            {(c.weaknesses ?? []).map((w, j) => <li key={j} className="text-gray-300 text-xs">• {w}</li>)}
                            {!has(c.weaknesses) && <li className="text-gray-500 text-xs italic">–</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-blue-400 text-xs uppercase tracking-wider mb-2">Pozicionálás</p>
                          <p className="text-gray-300 text-xs">{c.positioning ?? "–"}</p>
                        </div>
                      </div>
                    </SectionCard>
                  ))}
                </div>
              </div>
            )}

            {/* Platform prioritások */}
            {has(intelData.platformPriorities) && (
              <div>
                <SectionTitle icon={BarChart3} color="oklch(0.7 0.15 145)">Csatorna-prioritások</SectionTitle>
                <SectionCard>
                  <div className="space-y-3">
                    {[...intelData.platformPriorities]
                      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                      .map((p, i) => {
                        const pct = Math.max(0, Math.min(100, (p.priority ?? 0) * 20));
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm text-white font-medium">{p.platform}</span>
                              <span className="text-xs text-gray-400">Prioritás: {p.priority}/5</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--qa-surface2)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, oklch(0.6 0.2 255), oklch(0.7 0.18 295))" }} />
                            </div>
                            {p.rationale && <p className="text-xs text-gray-400">{p.rationale}</p>}
                          </div>
                        );
                      })}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* Célok timeline */}
            {intelData.successGoals && (has(intelData.successGoals.thirtyDay) || has(intelData.successGoals.ninetyDay) || has(intelData.successGoals.oneYear)) && (
              <div>
                <SectionTitle icon={Target} color="oklch(0.7 0.18 165)">Sikerstratégia – mérföldkövek</SectionTitle>
                <GoalsTimeline goals={intelData.successGoals} />
              </div>
            )}

            {/* AI írási szabályok */}
            {intelData.aiWritingRules && (has(intelData.aiWritingRules.doList) || has(intelData.aiWritingRules.dontList) || intelData.aiWritingRules.toneGuidelines || has(intelData.aiWritingRules.examplePhrases)) && (
              <div>
                <SectionTitle icon={Edit3} color="oklch(0.7 0.18 295)">AI íráshoz használt szabályok</SectionTitle>
                <div className="space-y-4">
                  {intelData.aiWritingRules.toneGuidelines && (
                    <SectionCard>
                      <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Hangnem</h4>
                      <p className="text-gray-300 text-sm leading-relaxed">{intelData.aiWritingRules.toneGuidelines}</p>
                    </SectionCard>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {has(intelData.aiWritingRules.doList) && (
                      <SectionCard>
                        <h4 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "oklch(0.7 0.15 145)" }}>
                          <Check size={14} /> Ezeket használd
                        </h4>
                        <ul className="space-y-1.5">
                          {intelData.aiWritingRules.doList!.map((d, i) => (
                            <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                              <Check size={12} className="mt-1 flex-shrink-0" style={{ color: "oklch(0.7 0.15 145)" }} /> {d}
                            </li>
                          ))}
                        </ul>
                      </SectionCard>
                    )}
                    {has(intelData.aiWritingRules.dontList) && (
                      <SectionCard>
                        <h4 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "oklch(0.65 0.2 30)" }}>
                          <X size={14} /> Ezeket kerüld
                        </h4>
                        <ul className="space-y-1.5">
                          {intelData.aiWritingRules.dontList!.map((d, i) => (
                            <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                              <X size={12} className="mt-1 flex-shrink-0" style={{ color: "oklch(0.65 0.2 30)" }} /> {d}
                            </li>
                          ))}
                        </ul>
                      </SectionCard>
                    )}
                  </div>
                  {has(intelData.aiWritingRules.examplePhrases) && (
                    <SectionCard>
                      <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                        <Quote size={14} /> Példa kifejezések
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {intelData.aiWritingRules.examplePhrases!.map((e, i) => (
                          <div key={i} className="text-gray-300 text-sm italic p-2 rounded" style={{ background: "oklch(0.18 0.02 255)" }}>
                            "{e}"
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </div>
              </div>
            )}

            {/* Friss generálás javaslat */}
            {!bd && !has(intelData.offerMap) && !has(intelData.audienceMap) && (
              <SectionCard>
                <div className="flex items-start gap-3">
                  <Lightbulb size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-medium mb-1">Tipp</p>
                    <p className="text-gray-400 text-sm">Ez a profil csak alapadatokat tartalmaz. Kattints az <span className="text-white font-medium">Újragenerálás</span> gombra a teljes elemzéshez (márka DNS, célközönség szegmensek, versenytárs elemzés, csatorna-prioritások, sikermutatók, AI írási szabályok).</p>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
