import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { Brain, Trash2, Loader2 } from "lucide-react";

type AiMemoryType =
  | "approved_pattern"
  | "rejected_pattern"
  | "style_preference"
  | "cta_preference"
  | "content_preference"
  | "client_correction";

const TYPE_LABELS: Record<AiMemoryType, string> = {
  approved_pattern: "Jóváhagyott minta",
  rejected_pattern: "Elutasított minta",
  style_preference: "Stílus preferencia",
  cta_preference: "CTA preferencia",
  content_preference: "Tartalom preferencia",
  client_correction: "Ügyfél javítás",
};

// Quiet Authority paletta szerint kategorizálva
const TYPE_BADGE_CLASS: Record<AiMemoryType, string> = {
  approved_pattern: "bg-green-500/15 text-green-500",
  rejected_pattern: "bg-red-500/15 text-red-500",
  style_preference: "bg-primary/15 text-primary",
  cta_preference: "bg-yellow-500/15 text-yellow-500",
  content_preference: "bg-cyan-500/15 text-cyan-500",
  client_correction: "bg-orange-500/15 text-orange-500",
};

interface AiMemorySectionProps {
  profileId: string;
}

export default function AiMemorySection({ profileId }: AiMemorySectionProps) {
  const utils = trpc.useUtils();
  const [typeFilter, setTypeFilter] = useState<AiMemoryType | "all">("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const queryInput = {
    profileId,
    memoryType: typeFilter === "all" ? undefined : typeFilter,
  };

  const { data: memories = [], isLoading } = trpc.aiMemory.list.useQuery(
    queryInput,
    { enabled: !!profileId },
  );

  const deleteMutation = trpc.aiMemory.delete.useMutation({
    onSuccess: () => {
      utils.aiMemory.list.invalidate({ profileId });
      toast.success("Memória bejegyzés törölve.");
      setConfirmDeleteId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Törlés sikertelen.");
      setConfirmDeleteId(null);
    },
  });

  const handleConfirmDelete = () => {
    if (confirmDeleteId != null) {
      deleteMutation.mutate({ memoryId: confirmDeleteId });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + magyarázat */}
      <div className="rounded-xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
        <div className="flex items-start gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(from var(--qa-accent) l c h / 15%)" }}>
            <Brain size={16} style={{ color: "var(--qa-accent)" }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>AI Memória</h3>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--qa-fg3)" }}>
              Az AI tanul a jóváhagyásaidból, elutasításaidból és preferenciáidból. Itt megtekintheted és törölheted a tárolt mintákat — törléssel „elfelejteted" a megfelelő tanulást.
            </p>
          </div>
        </div>
      </div>

      {/* Szűrő */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>Típus</span>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as AiMemoryType | "all")}>
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mind</SelectItem>
              {(Object.keys(TYPE_LABELS) as AiMemoryType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-xs" style={{ color: "var(--qa-fg3)" }}>
          {memories.length} bejegyzés
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Brain className="w-6 h-6" />}
              title="Nincs még AI memória bejegyzés"
              description={
                typeFilter === "all"
                  ? "Az AI az első jóváhagyásaid és elutasításaid után fog tanulni."
                  : "Ehhez a típushoz még nincs tárolt minta."
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => {
            const type = memory.memoryType as AiMemoryType;
            return (
              <Card key={memory.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`text-xs ${TYPE_BADGE_CLASS[type]}`}>
                          {TYPE_LABELS[type] ?? type}
                        </Badge>
                        {memory.weight > 1 && (
                          <Badge variant="outline" className="text-xs">súly: {memory.weight}</Badge>
                        )}
                        {memory.platform && (
                          <Badge variant="outline" className="text-xs">{memory.platform}</Badge>
                        )}
                        {memory.pillar && (
                          <Badge variant="outline" className="text-xs">{memory.pillar}</Badge>
                        )}
                        {memory.context && (
                          <Badge variant="outline" className="text-xs">{memory.context}</Badge>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--qa-fg2)" }}>
                        {memory.content}
                      </p>
                      <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                        {new Date(memory.createdAt).toLocaleString("hu-HU")}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteId(memory.id)}
                      className="shrink-0 p-2 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: "var(--qa-fg4)" }}
                      title="Törlés"
                      aria-label="Memória törlése"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Törlés megerősítés */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "var(--qa-fg)" }}>AI memória törlése</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--qa-fg3)" }}>
              Biztosan törlöd ezt a memória bejegyzést? Az AI „elfelejti" ezt a tanulást, és a jövőbeli generálások már nem fogják figyelembe venni. Ez a művelet nem visszavonható.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)", border: "none" }}>
              Mégse
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-500"
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Törlés...</>
              ) : (
                "Törlés"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
