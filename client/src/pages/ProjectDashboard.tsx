/**
 * ProjectDashboard – Super admin view for a single project
 * Shows: project details, onboarding status, strategy/content/lead summaries
 */
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Globe,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  Calendar,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter/X",
  tiktok: "TikTok",
};

function StatusBadge({ done, label }: { done: boolean; label: string }) {
  return done ? (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "oklch(0.55 0.18 145 / 20%)", color: "oklch(0.7 0.18 145)" }}
    >
      <CheckCircle2 size={11} />
      {label}
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: "oklch(0.55 0.015 240 / 15%)", color: "oklch(0.55 0.015 240)" }}
    >
      <Clock size={11} />
      Nem kész
    </span>
  );
}

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: project, isLoading, error } = trpc.projects.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const { data: progress, isLoading: progressLoading } = trpc.projects.getProgress.useQuery(
    { projectId: id! },
    { enabled: !!id, staleTime: 30_000 }
  );

  const utils = trpc.useUtils();

  const startOnboarding = trpc.projects.startOnboarding.useMutation({
    onSuccess: (data) => {
      utils.projects.get.invalidate({ id: id! });
      utils.projects.getProgress.invalidate({ projectId: id! });
      navigate(`/projektek/${id}/onboarding?profileId=${data.profileId}`);
    },
    onError: (err) => {
      toast.error("Hiba az onboarding indításakor: " + err.message);
    },
  });

  const setActive = trpc.projects.setActive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.getActive.invalidate();
      navigate("/iranyitopult");
    },
    onError: (err) => {
      toast.error("Hiba a projekt aktiválásakor: " + err.message);
    },
  });

  const handleStartOnboarding = () => {
    if (!id) return;
    if (project?.profileId) {
      navigate(`/projektek/${id}/onboarding?profileId=${project.profileId}`);
    } else {
      startOnboarding.mutate({ projectId: id });
    }
  };

  const handleOpenDashboard = () => {
    if (!id) return;
    setActive.mutate({ projectId: id });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.6 0.2 255)" }} />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-400">A projekt nem található.</p>
          <Button variant="outline" onClick={() => navigate("/projektek")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Vissza a projektekhez
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const accentColor = project.color ?? "oklch(0.6 0.2 255)";
  const hasProfile = !!project.profileId;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.55 0.015 240)" }}>
          <button
            onClick={() => navigate("/projektek")}
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} />
            Projektek
          </button>
          <span>/</span>
          <span className="text-white">{project.name}</span>
        </div>

        {/* Project Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ background: accentColor, boxShadow: `0 0 24px ${accentColor}50` }}
            >
              {project.name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("")}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>
                {project.name}
              </h1>
              {project.industry && (
                <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                  {project.industry}
                </p>
              )}
            </div>
          </div>

          {hasProfile && (
            <Button
              onClick={handleOpenDashboard}
              disabled={setActive.isPending}
              className="text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${accentColor}, oklch(0.55 0.18 165))` }}
            >
              {setActive.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LayoutDashboard className="w-4 h-4 mr-2" />
              )}
              Irányítópult megnyitása
            </Button>
          )}
        </div>

        {/* Project Info */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "oklch(0.16 0.022 255)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <h2 className="text-sm font-semibold text-white mb-3">Projekt adatok</h2>
          {project.website && (
            <div className="flex items-center gap-3 text-sm">
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.55 0.015 240)" }} />
              <a
                href={project.website.startsWith("http") ? project.website : `https://${project.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate"
                style={{ color: "oklch(0.6 0.2 255)" }}
              >
                {project.website}
              </a>
            </div>
          )}
          {project.industry && (
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.55 0.015 240)" }} />
              <span className="text-gray-300">{project.industry}</span>
            </div>
          )}
          {project.description && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }} />
              <span className="text-gray-300">{project.description}</span>
            </div>
          )}
          {!project.website && !project.industry && !project.description && (
            <p className="text-sm" style={{ color: "oklch(0.45 0.015 240)" }}>
              Nincsenek megadott projekt adatok.
            </p>
          )}
        </div>

        {/* Progress Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Onboarding Card */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.022 255)", border: `1px solid ${hasProfile ? "oklch(0.55 0.18 145 / 30%)" : "oklch(1 0 0 / 8%)"}` }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: hasProfile ? "oklch(0.55 0.18 145 / 20%)" : "oklch(0.55 0.015 240 / 15%)" }}
              >
                <Sparkles size={16} style={{ color: hasProfile ? "oklch(0.7 0.18 145)" : "oklch(0.55 0.015 240)" }} />
              </div>
              <StatusBadge done={!!progress?.onboarding.completed} label={progress?.onboarding.completed ? "Kész" : hasProfile ? "Folyamatban" : "Nem indult"} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-0.5">Onboarding</p>
              {progressLoading ? (
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: "oklch(0.25 0.02 255)" }} />
              ) : hasProfile ? (
                <>
                  <p className="text-xs mb-2" style={{ color: "oklch(0.5 0.015 240)" }}>
                    {progress?.onboarding.currentStep ?? 1}/{progress?.onboarding.totalSteps ?? 6} lépés kitöltve
                  </p>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.25 0.02 255)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(((progress?.onboarding.currentStep ?? 1) / (progress?.onboarding.totalSteps ?? 6)) * 100)}%`,
                        background: progress?.onboarding.completed ? "oklch(0.65 0.18 145)" : accentColor,
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>Nincs elíndítva</p>
              )}
            </div>
            <button
              onClick={handleStartOnboarding}
              disabled={startOnboarding.isPending}
              className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{ color: accentColor }}
            >
              {startOnboarding.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : hasProfile ? (
                <RefreshCw size={12} />
              ) : (
                <PlayCircle size={12} />
              )}
              {hasProfile ? (progress?.onboarding.completed ? "Szerkesztés" : "Folytatás") : "Indítás"}
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Strategy Card */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.022 255)", border: `1px solid ${progress?.strategy.done ? "oklch(0.6 0.2 255 / 30%)" : "oklch(1 0 0 / 8%)"}` }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: progress?.strategy.done ? "oklch(0.6 0.2 255 / 20%)" : "oklch(0.55 0.015 240 / 15%)" }}
              >
                <TrendingUp size={16} style={{ color: progress?.strategy.done ? "oklch(0.7 0.18 255)" : "oklch(0.55 0.015 240)" }} />
              </div>
              <StatusBadge done={!!progress?.strategy.done} label={`${progress?.strategy.count ?? 0} verzió`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-0.5">Stratégia</p>
              {progressLoading ? (
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: "oklch(0.25 0.02 255)" }} />
              ) : progress?.strategy.latest ? (
                <p className="text-xs truncate" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {progress.strategy.latest.title}
                </p>
              ) : (
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {hasProfile ? "Még nincs generálva" : "Onboarding szükséges"}
                </p>
              )}
            </div>
            {/* CTA: ha onboarding kész de nincs stratégia → Stratégia generálása gomb */}
            {hasProfile && !progress?.strategy.done && progress?.onboarding.completed ? (
              <button
                onClick={handleOpenDashboard}
                disabled={setActive.isPending}
                className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 px-2.5 py-1.5 rounded-lg"
                style={{ background: "oklch(0.6 0.2 255 / 20%)", color: "oklch(0.7 0.18 255)" }}
              >
                <Sparkles size={12} />
                Stratégia generálása
                <ChevronRight size={12} />
              </button>
            ) : (
              <button
                onClick={handleOpenDashboard}
                disabled={!hasProfile || setActive.isPending}
                className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                style={{ color: progress?.strategy.done ? "oklch(0.7 0.18 255)" : "oklch(0.45 0.015 240)" }}
              >
                <LayoutDashboard size={12} />
                Megnyitás
                <ChevronRight size={12} />
              </button>
            )}
          </div>

          {/* Content Calendar Card */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.022 255)", border: `1px solid ${progress?.content.done ? "oklch(0.55 0.18 165 / 30%)" : "oklch(1 0 0 / 8%)"}` }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: progress?.content.done ? "oklch(0.55 0.18 165 / 20%)" : "oklch(0.55 0.015 240 / 15%)" }}
              >
                <Calendar size={16} style={{ color: progress?.content.done ? "oklch(0.7 0.18 165)" : "oklch(0.55 0.015 240)" }} />
              </div>
              <StatusBadge done={!!progress?.content.done} label={`${progress?.content.count ?? 0} poszt`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-0.5">Tartalom naptár</p>
              {progressLoading ? (
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: "oklch(0.25 0.02 255)" }} />
              ) : progress?.content.upcoming.length ? (
                <div className="space-y-1">
                  {progress.content.upcoming.slice(0, 2).map(p => (
                    <p key={p.id} className="text-xs truncate" style={{ color: "oklch(0.5 0.015 240)" }}>
                      {PLATFORM_LABELS[p.platform] ?? p.platform}: {p.title}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {hasProfile ? "Nincs ütemezett poszt" : "Onboarding szükséges"}
                </p>
              )}
            </div>
            <button
              onClick={handleOpenDashboard}
              disabled={!hasProfile || setActive.isPending}
              className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{ color: progress?.content.done ? "oklch(0.7 0.18 165)" : "oklch(0.45 0.015 240)" }}
            >
              <LayoutDashboard size={12} />
              Megnyitás
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Leads Card */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.022 255)", border: `1px solid ${progress?.leads.done ? "oklch(0.7 0.2 50 / 30%)" : "oklch(1 0 0 / 8%)"}` }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: progress?.leads.done ? "oklch(0.7 0.2 50 / 20%)" : "oklch(0.55 0.015 240 / 15%)" }}
              >
                <Users size={16} style={{ color: progress?.leads.done ? "oklch(0.8 0.18 50)" : "oklch(0.55 0.015 240)" }} />
              </div>
              <StatusBadge done={!!progress?.leads.done} label={`${progress?.leads.count ?? 0} lead`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-0.5">Leadek</p>
              {progressLoading ? (
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: "oklch(0.25 0.02 255)" }} />
              ) : progress?.leads.latest ? (
                <p className="text-xs truncate" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {progress.leads.latest.company} – {progress.leads.latest.contact}
                </p>
              ) : (
                <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>
                  {hasProfile ? "Még nincs lead" : "Onboarding szükséges"}
                </p>
              )}
            </div>
            <button
              onClick={handleOpenDashboard}
              disabled={!hasProfile || setActive.isPending}
              className="mt-auto flex items-center gap-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{ color: progress?.leads.done ? "oklch(0.8 0.18 50)" : "oklch(0.45 0.015 240)" }}
            >
              <LayoutDashboard size={12} />
              Megnyitás
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {!hasProfile && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}30` }}
          >
            <Sparkles size={28} className="mx-auto mb-3" style={{ color: accentColor }} />
            <h3 className="text-white font-semibold mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
              Indítsd el az onboardingot
            </h3>
            <p className="text-sm mb-4" style={{ color: "oklch(0.55 0.015 240)" }}>
              Az onboarding kitöltésével AI-alapú stratégia, tartalom naptár és lead generálás válik elérhetővé.
            </p>
            <Button
              onClick={handleStartOnboarding}
              disabled={startOnboarding.isPending}
              className="text-white"
              style={{ background: accentColor }}
            >
              {startOnboarding.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Onboarding indítása
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
