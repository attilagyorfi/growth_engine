import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarRange, Target, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

type QuarterlyPlanKpi = { label: string; target: string; current?: string };

type QuarterlyPlanMonth = {
  month: string;
  theme: string;
  priorities: string[];
  kpis: QuarterlyPlanKpi[];
  risks: string[];
};

export type QuarterlyPlanResult = {
  generatedAt: string;
  months: string[];
  plan: {
    quarterFocus: string;
    expectedOutcomes: string[];
    monthlyBreakdown: QuarterlyPlanMonth[];
  };
};

interface QuarterlyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: QuarterlyPlanResult | null;
}

// Magyar hónap nevek a YYYY-MM formátumhoz
function formatMonth(yyyyMm: string): string {
  const [year, monthStr] = yyyyMm.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthNames = [
    "Január", "Február", "Március", "Április", "Május", "Június",
    "Július", "Augusztus", "Szeptember", "Október", "November", "December",
  ];
  return `${year}. ${monthNames[monthIdx] ?? monthStr}`;
}

export default function QuarterlyPlanDialog({ open, onOpenChange, result }: QuarterlyPlanDialogProps) {
  if (!result) return null;
  const { plan, months, generatedAt } = result;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            90 napos (negyedéves) terv
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Generálva: {new Date(generatedAt).toLocaleString("hu-HU")} ·{" "}
            {months.map(formatMonth).join(" → ")}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quarter focus */}
          {plan.quarterFocus && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  A 3 hónap fő üzenete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{plan.quarterFocus}</p>
              </CardContent>
            </Card>
          )}

          {/* Expected outcomes */}
          {plan.expectedOutcomes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Várt eredmények
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.expectedOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Monthly breakdown */}
          {plan.monthlyBreakdown?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Havi bontás
              </h3>
              {plan.monthlyBreakdown.map((m, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{formatMonth(m.month)}</span>
                      <Badge variant="outline" className="text-xs">
                        {i + 1}. hónap
                      </Badge>
                    </CardTitle>
                    {m.theme && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{m.theme}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {m.priorities?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Prioritások</p>
                        <ul className="space-y-1">
                          {m.priorities.map((p, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {m.kpis?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">KPI-ok</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.kpis.map((k, j) => (
                            <div key={j} className="p-2 bg-muted/50 rounded text-xs">
                              <div className="font-medium">{k.label}</div>
                              <div className="text-muted-foreground mt-0.5">
                                Cél: <span className="font-semibold text-foreground">{k.target}</span>
                                {k.current && (
                                  <>
                                    {" · "}Jelenleg: <span className="font-semibold">{k.current}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.risks?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-orange-500" />
                          Kockázatok
                        </p>
                        <ul className="space-y-1">
                          {m.risks.map((r, j) => (
                            <li key={j} className="text-sm text-muted-foreground">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg leading-relaxed">
            <strong>Megjegyzés:</strong> Ez a terv egy AI által generált javaslat. Még nem mentődött el — átolvasásod után dönthetsz arról, hogy beépíted-e a meglévő stratégiádba vagy kérsz egy újabb generálást.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
