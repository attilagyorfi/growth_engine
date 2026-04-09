import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Target, Zap, Calendar, TrendingUp, Loader2, CheckCircle2,
  Clock, AlertCircle, ChevronRight, BarChart2, Lightbulb, Archive,
  Star
} from "lucide-react";

const URGENCY_CONFIG = {
  high: { label: "Sürgős", color: "text-red-600 bg-red-50", icon: AlertCircle },
  medium: { label: "Közepes", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  low: { label: "Alacsony", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
};

export default function Strategy() {
  const { activeProfile } = useProfile();
  const utils = trpc.useUtils();
  const search = useSearch();

  const [showGenerate, setShowGenerate] = useState(false);
  const [strategyContext, setStrategyContext] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false);

  const { data: versions = [], isLoading } = trpc.strategyVersions.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: activeVersion } = trpc.strategyVersions.getActive.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: intelligence } = trpc.intelligence.get.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const generateMutation = trpc.strategyVersions.generate.useMutation({
    onSuccess: () => {
      utils.strategyVersions.list.invalidate({ profileId: activeProfile.id });
      utils.strategyVersions.getActive.invalidate({ profileId: activeProfile.id });
      setShowGenerate(false);
      setStrategyContext("");
      toast.success("Stratégia sikeresen generálva!");
    },
    onError: () => toast.error("Nem sikerült a stratégia generálása."),
  });

  const setActiveMutation = trpc.strategyVersions.setActive.useMutation({
    onSuccess: () => {
      utils.strategyVersions.list.invalidate({ profileId: activeProfile.id });
      utils.strategyVersions.getActive.invalidate({ profileId: activeProfile.id });
      toast.success("Aktív stratégia frissítve.");
    },
  });

  const archiveMutation = trpc.strategyVersions.archive.useMutation({
    onSuccess: () => {
      utils.strategyVersions.list.invalidate({ profileId: activeProfile.id });
      toast.success("Stratégia archiválva.");
    },
  });

  // Auto-open generate dialog when coming from onboarding with ?autoGenerate=true
  useEffect(() => {
    if (autoGenerateTriggered) return;
    const params = new URLSearchParams(search);
    if (params.get("autoGenerate") === "true" && !isLoading) {
      setAutoGenerateTriggered(true);
      // Only auto-open if there's no active strategy yet
      if (!activeVersion) {
        setShowGenerate(true);
      }
    }
  }, [search, isLoading, activeVersion, autoGenerateTriggered]);

  const current = selectedVersionId
    ? versions.find(v => v.id === selectedVersionId)
    : activeVersion;

  const activeVersions = versions;
  const archivedVersions: typeof versions = [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stratégia</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {activeVersion
                ? `Aktív: ${activeVersion.title}`
                : "Még nincs aktív stratégia – generálj egyet az AI segítségével"}
            </p>
          </div>
          <div className="flex gap-2">
            {versions.length > 0 && (
              <Button variant="outline" onClick={() => setSelectedVersionId(null)} className="gap-2">
                <Star className="w-4 h-4" />
                Aktív verzió
              </Button>
            )}
            <Button onClick={() => setShowGenerate(true)} className="gap-2">
              <Zap className="w-4 h-4" />
              AI Stratégia generálása
            </Button>
          </div>
        </div>

        {/* Version Selector */}
        {activeVersions.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeVersions.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${
                  (selectedVersionId === v.id || (!selectedVersionId && v.isActive))
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {v.isActive && <Star className="w-3 h-3" />}
                {v.title}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !current ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Még nincs stratégia</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Az AI elemzi a céged profilját és az Intelligence adatokat, majd elkészít egy teljes körű marketing stratégiát negyed-, havi és heti bontásban.
              </p>
              <Button onClick={() => setShowGenerate(true)} className="gap-2">
                <Zap className="w-4 h-4" />
                Stratégia generálása
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="summary">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="summary">Összefoglaló</TabsTrigger>
                <TabsTrigger value="quarterly">Negyedéves</TabsTrigger>
                <TabsTrigger value="monthly">Havi</TabsTrigger>
                <TabsTrigger value="actions">Következő lépések</TabsTrigger>
                <TabsTrigger value="channels">Csatornák</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                {!current.isActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setActiveMutation.mutate({ profileId: activeProfile.id, versionId: current.id })}
                  >
                    <Star className="w-3 h-3" />
                    Aktívvá tétel
                  </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    onClick={() => archiveMutation.mutate({ id: current.id })}
                  >
                    <Archive className="w-3 h-3" />
                    Archiválás
                  </Button>
              </div>
            </div>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              {current.executiveSummary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500" />
                      Stratégiai összefoglaló
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{current.executiveSummary as string}</p>
                  </CardContent>
                </Card>
              )}

              {current.quickWins && Array.isArray(current.quickWins) && (current.quickWins as any[]).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-green-500" />
                      Gyors győzelmek
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(current.quickWins as any[]).map((win: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{win.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{win.description}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Badge variant="outline" className="text-xs">Hatás: {win.impact}</Badge>
                            <Badge variant="outline" className="text-xs">Erőfeszítés: {win.effort}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {current.campaignPriorities && Array.isArray(current.campaignPriorities) && (current.campaignPriorities as string[]).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      Kampány prioritások
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(current.campaignPriorities as string[]).map((priority: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2 border rounded">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm">{priority}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Quarterly Tab */}
            <TabsContent value="quarterly" className="space-y-4">
              {current.quarterlyGoals && typeof current.quarterlyGoals === "object" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(["q1", "q2", "q3", "q4"] as const).map(q => {
                    const goals = (current.quarterlyGoals as any)?.[q] as string[] | undefined;
                    if (!goals?.length) return null;
                    return (
                      <Card key={q}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
                            {q.toUpperCase()} Negyedév
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {goals.map((goal: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                {goal}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2" />
                  <p>Negyedéves célok nem állnak rendelkezésre ebben a verzióban.</p>
                </div>
              )}
            </TabsContent>

            {/* Monthly Tab */}
            <TabsContent value="monthly" className="space-y-4">
              {current.monthlyPriorities && Array.isArray(current.monthlyPriorities) && (current.monthlyPriorities as any[]).length > 0 ? (
                <div className="space-y-4">
                  {(current.monthlyPriorities as any[]).map((month: any, i: number) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          {month.month}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground uppercase mb-2">Prioritások</div>
                            <ul className="space-y-1">
                              {(month.priorities ?? []).map((p: string, j: number) => (
                                <li key={j} className="flex items-start gap-2 text-sm">
                                  <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {month.kpis?.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground uppercase mb-2">KPI-k</div>
                              <div className="space-y-1">
                                {month.kpis.map((kpi: any, j: number) => (
                                  <div key={j} className="flex items-center justify-between text-sm p-1.5 bg-muted/50 rounded">
                                    <span className="text-muted-foreground">{kpi.label}</span>
                                    <span className="font-medium">{kpi.target}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart2 className="w-8 h-8 mx-auto mb-2" />
                  <p>Havi prioritások nem állnak rendelkezésre.</p>
                </div>
              )}
            </TabsContent>

            {/* Next Actions Tab */}
            <TabsContent value="actions" className="space-y-3">
              {current.nextActions && Array.isArray(current.nextActions) && (current.nextActions as any[]).length > 0 ? (
                (current.nextActions as any[]).map((action: any, i: number) => {
                  const urgency = URGENCY_CONFIG[action.urgency as keyof typeof URGENCY_CONFIG] ?? URGENCY_CONFIG.medium;
                  const UrgencyIcon = urgency.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <UrgencyIcon className={`w-4 h-4 mt-0.5 shrink-0 ${urgency.color.split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{action.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{action.description}</div>
                        {action.dueDate && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Határidő: {action.dueDate}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                  <p>Nincsenek következő lépések ebben a verzióban.</p>
                </div>
              )}
            </TabsContent>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-4">
              {current.channelStrategy && Array.isArray(current.channelStrategy) && (current.channelStrategy as any[]).length > 0 ? (
                <div className="grid gap-4">
                  {(current.channelStrategy as any[])
                    .sort((a: any, b: any) => b.priority - a.priority)
                    .map((ch: any, i: number) => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold">{ch.channel}</div>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, j) => (
                                <div
                                  key={j}
                                  className={`w-2 h-2 rounded-full ${j < ch.priority ? "bg-primary" : "bg-muted"}`}
                                />
                              ))}
                              <span className="text-xs text-muted-foreground ml-1">{ch.priority}/5</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{ch.rationale}</p>
                          {ch.tactics?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ch.tactics.map((t: string, j: number) => (
                                <Badge key={j} variant="secondary" className="text-xs">{t}</Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                  <p>Csatorna stratégia nem áll rendelkezésre.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Version History */}
        {archivedVersions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Archive className="w-4 h-4" />
                Archivált verziók ({archivedVersions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {archivedVersions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <span className="text-muted-foreground">{v.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveMutation.mutate({ profileId: activeProfile.id, versionId: v.id })}
                    >
                      Visszaállítás
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              AI Stratégia generálása
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Az AI felhasználja a céged Intelligence profilját és az alábbi kontextust egy teljes marketing stratégia elkészítéséhez.
            </p>
            {!intelligence && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-semibold mb-1">⚠️ Nincs Company Intelligence profil</p>
                <p className="text-xs text-yellow-700 mb-2">
                  A stratégia mindig pontosabb, ha előbb elkészül a Company Intelligence profil. Az AI most általánosabb stratégiát fog generálni.
                </p>
                <a href="/intelligence" className="text-xs font-semibold text-yellow-800 underline hover:text-yellow-900">
                  → Menj az Intelligence oldalra és genéráld el előbb
                </a>
              </div>
            )}
            <div>
              <Label>Kiegészítő kontextus (opcionális)</Label>
              <Textarea
                placeholder="pl. Fókuszálj a Q2-re, prioritás a LinkedIn és az email marketing, 3 hónapos lead generation kampány..."
                value={strategyContext}
                onChange={e => setStrategyContext(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Mégse</Button>
            <Button
              onClick={() => generateMutation.mutate({
                profileId: activeProfile.id,
                intelligenceData: intelligence ?? {},
                strategyContext: strategyContext || undefined,
              })}
              disabled={generateMutation.isPending}
              className="gap-2"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generálás...</>
              ) : (
                <><Zap className="w-4 h-4" />Stratégia generálása</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
