import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ListChecks } from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "done" | "skipped";
type FunnelStage = "awareness" | "consideration" | "decision" | "retention";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Teendő",
  in_progress: "Folyamatban",
  done: "Kész",
  skipped: "Kihagyva",
};

const FUNNEL_LABELS: Record<FunnelStage, string> = {
  awareness: "Tudatosság",
  consideration: "Megfontolás",
  decision: "Döntés",
  retention: "Megtartás",
};

const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  done: "bg-green-500/15 text-green-500",
  skipped: "bg-muted text-muted-foreground line-through",
};

interface TasksTabProps {
  profileId: string;
  strategyId: string;
}

export default function TasksTab({ profileId, strategyId }: TasksTabProps) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [funnelFilter, setFunnelFilter] = useState<FunnelStage | "all">("all");

  const queryInput = {
    profileId,
    strategyId,
    status: statusFilter === "all" ? undefined : statusFilter,
    funnelStage: funnelFilter === "all" ? undefined : funnelFilter,
  };

  const { data: tasks = [], isLoading } = trpc.strategyVersions.listTasks.useQuery(
    queryInput,
    { enabled: !!profileId && !!strategyId },
  );

  const updateMutation = trpc.strategyVersions.updateTaskStatus.useMutation({
    onMutate: async ({ taskId, status }) => {
      await utils.strategyVersions.listTasks.cancel(queryInput);
      const previous = utils.strategyVersions.listTasks.getData(queryInput);
      utils.strategyVersions.listTasks.setData(queryInput, (old) =>
        (old ?? []).map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) utils.strategyVersions.listTasks.setData(queryInput, ctx.previous);
      toast.error("A státusz frissítése nem sikerült.");
    },
    onSuccess: () => {
      utils.strategyVersions.listTasks.invalidate({ profileId, strategyId });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Státusz</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mind</SelectItem>
              <SelectItem value="todo">Teendő</SelectItem>
              <SelectItem value="in_progress">Folyamatban</SelectItem>
              <SelectItem value="done">Kész</SelectItem>
              <SelectItem value="skipped">Kihagyva</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Funnel szakasz</span>
          <Select value={funnelFilter} onValueChange={(v) => setFunnelFilter(v as FunnelStage | "all")}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mind</SelectItem>
              <SelectItem value="awareness">Tudatosság</SelectItem>
              <SelectItem value="consideration">Megfontolás</SelectItem>
              <SelectItem value="decision">Döntés</SelectItem>
              <SelectItem value="retention">Megtartás</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {tasks.length} feladat
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<ListChecks className="w-6 h-6" />}
              title="Nincs még feladat ehhez a stratégiához"
              description={`Generálj feladatokat a stratégia gyors győzelmeiből és következő lépéseiből a fenti „Feladatokká alakítás” gombbal.`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const status = task.status as TaskStatus;
            const funnel = task.funnelStage as FunnelStage;
            return (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{task.title}</div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {task.description}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {FUNNEL_LABELS[funnel] ?? funnel}
                        </Badge>
                        {task.platform && (
                          <Badge variant="outline" className="text-xs">{task.platform}</Badge>
                        )}
                        {task.weekNumber != null && (
                          <Badge variant="outline" className="text-xs">{task.weekNumber}. hét</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Badge className={`text-xs ${STATUS_BADGE_CLASS[status]}`}>
                        {STATUS_LABELS[status] ?? status}
                      </Badge>
                      <Select
                        value={status}
                        onValueChange={(v) =>
                          updateMutation.mutate({ taskId: task.id, status: v as TaskStatus })
                        }
                        disabled={updateMutation.isPending}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Teendő</SelectItem>
                          <SelectItem value="in_progress">Folyamatban</SelectItem>
                          <SelectItem value="done">Kész</SelectItem>
                          <SelectItem value="skipped">Kihagyva</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
