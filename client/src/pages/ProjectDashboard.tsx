import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { useActiveProject } from "@/hooks/useActiveProject";
import { toast } from "sonner";

export default function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: project, isLoading, error } = trpc.projects.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const utils = trpc.useUtils();
  const startOnboarding = trpc.projects.startOnboarding.useMutation({
    onSuccess: (data) => {
      utils.projects.get.invalidate({ id: id! });
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
      // Már van profileId – folytatjuk az onboardingot
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
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

  const hasProfile = !!project.profileId;
  // We consider onboarding "done" if there's a profileId linked
  // (the actual onboarding completion status lives in the onboarding session)
  const onboardingStatus = hasProfile ? "linked" : "not_started";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/projektek")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Projektek
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Project color avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ background: project.color ?? "oklch(0.6 0.2 255)" }}
            >
              {project.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              {project.industry && (
                <p className="text-gray-400 text-sm mt-0.5">{project.industry}</p>
              )}
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex gap-2 flex-shrink-0">
            {hasProfile ? (
              <Button
                onClick={handleOpenDashboard}
                disabled={setActive.isPending}
                className="text-white"
                style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
              >
                {setActive.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                )}
                Irányítópult megnyitása
              </Button>
            ) : null}
          </div>
        </div>

        {/* Project Details Card */}
        <Card className="border-0" style={{ background: "oklch(0.15 0.02 255)" }}>
          <CardHeader>
            <CardTitle className="text-white text-base">Projekt adatok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <a
                  href={project.website.startsWith("http") ? project.website : `https://${project.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 truncate"
                >
                  {project.website}
                </a>
              </div>
            )}
            {project.industry && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-300">{project.industry}</span>
              </div>
            )}
            {project.description && (
              <div className="flex items-start gap-3 text-sm">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-300">{project.description}</span>
              </div>
            )}
            {!project.website && !project.industry && !project.description && (
              <p className="text-gray-500 text-sm">Nincsenek megadott projekt adatok.</p>
            )}
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Onboarding Status */}
          <Card className="border-0" style={{ background: "oklch(0.15 0.02 255)" }}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Onboarding</span>
                {onboardingStatus === "linked" ? (
                  <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Összekapcsolva
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Nem indult el
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-xs mb-4">
                {onboardingStatus === "linked"
                  ? "A projekt profil össze van kapcsolva. Az onboarding adatok megadva."
                  : "Az onboarding kitöltésével AI-alapú stratégia és tartalom naptár generálható."}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:text-white hover:border-gray-400"
                onClick={handleStartOnboarding}
                disabled={startOnboarding.isPending}
              >
                {startOnboarding.isPending ? (
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                ) : onboardingStatus === "linked" ? (
                  <RefreshCw className="w-3 h-3 mr-2" />
                ) : (
                  <PlayCircle className="w-3 h-3 mr-2" />
                )}
                {onboardingStatus === "linked" ? "Onboarding szerkesztése" : "Onboarding indítása"}
              </Button>
            </CardContent>
          </Card>

          {/* Strategy Status */}
          <Card className="border-0" style={{ background: "oklch(0.15 0.02 255)" }}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Stratégia</span>
                {hasProfile ? (
                  <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Elérhető
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-0 text-xs">
                    –
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-xs mb-4">
                {hasProfile
                  ? "A stratégia az irányítópulton érhető el."
                  : "Az onboarding elvégzése után válik elérhetővé."}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:text-white hover:border-gray-400"
                onClick={handleOpenDashboard}
                disabled={!hasProfile || setActive.isPending}
              >
                <LayoutDashboard className="w-3 h-3 mr-2" />
                Megnyitás
              </Button>
            </CardContent>
          </Card>

          {/* Content Calendar Status */}
          <Card className="border-0" style={{ background: "oklch(0.15 0.02 255)" }}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Tartalom naptár</span>
                {hasProfile ? (
                  <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Elérhető
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-0 text-xs">
                    –
                  </Badge>
                )}
              </div>
              <p className="text-gray-400 text-xs mb-4">
                {hasProfile
                  ? "A tartalom naptár az irányítópulton érhető el."
                  : "Az onboarding elvégzése után válik elérhetővé."}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-gray-600 text-gray-300 hover:text-white hover:border-gray-400"
                onClick={handleOpenDashboard}
                disabled={!hasProfile || setActive.isPending}
              >
                <LayoutDashboard className="w-3 h-3 mr-2" />
                Megnyitás
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
