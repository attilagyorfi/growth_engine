/**
 * useActiveProject – Super Admin project context hook
 * Returns the currently active project for the super_admin.
 * When the active project changes, it also syncs the ProfileContext
 * so all modules (Strategy, ContentStudio, SalesOps) automatically
 * show data for the active project's linked client_profile.
 *
 * Normal users always get null (they use client_profiles directly).
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "./useAppAuth";
import { useProfile } from "@/contexts/ProfileContext";

const STORAGE_KEY = "g2a_active_project_id";

export function useActiveProject() {
  const { isSuperAdmin } = useAppAuth();
  const { setActiveProfileId } = useProfile();

  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: projects = [], isLoading, refetch } = trpc.projects.list.useQuery(
    undefined,
    { enabled: isSuperAdmin, staleTime: 30_000 }
  );

  const utils = trpc.useUtils();

  const setActiveMutation = trpc.projects.setActive.useMutation({
    onSuccess: () => refetch(),
  });

  // Sync: if no local selection, use the DB-active project
  useEffect(() => {
    if (!isSuperAdmin || projects.length === 0) return;
    if (!activeProjectId) {
      const dbActive = projects.find((p) => p.isActive);
      const fallback = dbActive ?? projects[0];
      if (fallback) {
        setActiveProjectIdState(fallback.id);
        localStorage.setItem(STORAGE_KEY, fallback.id);
        // Sync ProfileContext if the project has a linked profileId
        if (fallback.profileId) {
          setActiveProfileId(fallback.profileId);
        }
      }
    }
  }, [projects, isSuperAdmin, activeProjectId, setActiveProfileId]);

  // When activeProjectId changes, sync ProfileContext
  useEffect(() => {
    if (!isSuperAdmin || !activeProjectId || projects.length === 0) return;
    const project = projects.find((p) => p.id === activeProjectId);
    if (project?.profileId) {
      setActiveProfileId(project.profileId);
    }
  }, [activeProjectId, projects, isSuperAdmin, setActiveProfileId]);

  const setActiveProject = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    setActiveMutation.mutate({ projectId: id });

    // Immediately sync ProfileContext
    const project = projects.find((p) => p.id === id);
    if (project?.profileId) {
      setActiveProfileId(project.profileId);
    }

    // Invalidate all module caches so they reload with new profileId
    utils.strategyVersions.list.invalidate();
    utils.strategyVersions.getActive.invalidate();
    utils.content.list.invalidate();
    utils.leads.list.invalidate();
    utils.outbound.list.invalidate();
    utils.intelligence.get.invalidate();
  }, [projects, setActiveMutation, setActiveProfileId, utils]);

  const activeProject = projects.find((p) => p.id === activeProjectId)
    ?? projects.find((p) => p.isActive)
    ?? projects[0]
    ?? null;

  return {
    activeProject,
    activeProjectId: activeProject?.id ?? null,
    activeProjectProfileId: activeProject?.profileId ?? null,
    projects,
    isLoading,
    setActiveProject,
    refetch,
  };
}
