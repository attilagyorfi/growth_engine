/**
 * useActiveProject – Super Admin project context hook
 * Returns the currently active project for the super_admin.
 * Normal users always get null (they use client_profiles instead).
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAppAuth } from "./useAppAuth";

const STORAGE_KEY = "g2a_active_project_id";

export function useActiveProject() {
  const { isSuperAdmin } = useAppAuth();

  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const { data: projects = [], isLoading, refetch } = trpc.projects.list.useQuery(
    undefined,
    { enabled: isSuperAdmin, staleTime: 30_000 }
  );

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
      }
    }
  }, [projects, isSuperAdmin, activeProjectId]);

  const setActiveProject = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    setActiveMutation.mutate({ projectId: id });
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects.find((p) => p.isActive) ?? projects[0] ?? null;

  return {
    activeProject,
    activeProjectId: activeProject?.id ?? null,
    projects,
    isLoading,
    setActiveProject,
    refetch,
  };
}
