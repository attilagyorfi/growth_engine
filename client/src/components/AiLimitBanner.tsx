import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "@/hooks/useAppAuth";

export function AiLimitBanner() {
  const [, navigate] = useLocation();
  const { user } = useAppAuth();

  const { data: aiUsage } = trpc.aiUsage.status.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (!aiUsage) return null;

  // Super admin / unlimited plan
  if (aiUsage.limit === -1) return null;

  // At limit
  if (aiUsage.remaining === 0) {
    return (
      <Alert className="border-destructive/50 bg-destructive/5 mb-4">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <AlertTitle>Elérted a havi AI limitedet</AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            A(z) <strong>{aiUsage.plan}</strong> csomag {aiUsage.limit} generálást tartalmaz havonta. Holnap elsejétől újraindul a számláló.
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => navigate("/beallitasok?tab=billing")}
            className="shrink-0"
          >
            Csomag frissítése
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Warning: 1 remaining
  if (aiUsage.remaining === 1) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/5 mb-4">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>
            Csak <strong>1 AI generálásod</strong> maradt ebben a hónapban.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/beallitasok?tab=billing")}
            className="shrink-0 border-yellow-500/50 text-yellow-700 hover:bg-yellow-50"
          >
            Csomag frissítése
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
