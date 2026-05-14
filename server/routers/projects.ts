/**
 * G2A Growth Engine – Projects router (super_admin only)
 *
 * Több-projektes setup a super_admin felhasználónak: projekt CRUD,
 * onboarding indítás, archiválás, restore, és getProgress (cross-table
 * aggregát: onboarding/strategy/content/leads státusz egy projekthez).
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor 2. körében.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { superAdminProcedure, router } from "../_core/trpc";
import {
  upsertProfile,
  getStrategyVersionsByProfile, getContentByProfile, getLeadsByProfile,
  getOnboardingSession,
} from "../db";
import {
  getProjectsByOwner, getProjectById, upsertProject, setActiveProject, deleteProject,
  getActiveProjectByOwner, archiveProject, restoreProject, getArchivedProjectsByOwner,
} from "../projectsDb";

export const projectsRouter = router({
  list: superAdminProcedure.query(({ ctx }) => getProjectsByOwner(ctx.appUser.id)),

  get: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const project = await getProjectById(input.id);
      if (!project || project.ownerId !== ctx.appUser.id) throw new TRPCError({ code: "NOT_FOUND" });
      return project;
    }),

  getActive: superAdminProcedure.query(({ ctx }) => getActiveProjectByOwner(ctx.appUser.id)),

  upsert: superAdminProcedure
    .input(z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      website: z.string().optional(),
      industry: z.string().optional(),
      description: z.string().optional(),
      logoUrl: z.string().optional(),
      color: z.string().optional(),
      profileId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = input.id ?? nanoid();
      return upsertProject({ id, ownerId: ctx.appUser.id, ...input, isActive: false });
    }),

  setActive: superAdminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await setActiveProject(ctx.appUser.id, input.projectId);
      return { success: true };
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await deleteProject(input.id, ctx.appUser.id);
      return { success: true };
    }),

  startOnboarding: superAdminProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.ownerId !== ctx.appUser.id) throw new TRPCError({ code: "NOT_FOUND" });
      // Ha már van profileId, azt adjuk vissza
      if (project.profileId) return { profileId: project.profileId };
      // Különben létrehozunk egy új clientProfile-t
      const profileId = nanoid();
      const projectName = project.name;
      const initials = projectName
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0]?.toUpperCase() ?? "")
        .join("") || "PR";
      await upsertProfile({
        id: profileId,
        appUserId: ctx.appUser.id,
        name: projectName,
        initials,
        color: project.color ?? "oklch(0.6 0.2 255)",
        website: project.website ?? undefined,
        industry: project.industry ?? undefined,
        description: project.description ?? undefined,
      });
      // Hozzárendelünk a projekthez
      await upsertProject({ ...project, profileId });
      return { profileId };
    }),

  listArchived: superAdminProcedure.query(({ ctx }) => getArchivedProjectsByOwner(ctx.appUser.id)),

  archive: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await archiveProject(input.id, ctx.appUser.id);
      return { success: true };
    }),

  restore: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await restoreProject(input.id, ctx.appUser.id);
      return { success: true };
    }),

  getProgress: superAdminProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const project = await getProjectById(input.projectId);
      if (!project || project.ownerId !== ctx.appUser.id) throw new TRPCError({ code: "NOT_FOUND" });
      const profileId = project.profileId;
      if (!profileId) {
        return {
          onboarding: { done: false, count: 0 },
          strategy: { done: false, count: 0, latest: null as null | { id: string; title: string; createdAt: Date | null } },
          content: { done: false, count: 0, upcoming: [] as Array<{ id: string; title: string; platform: string; scheduledAt: Date | null }> },
          leads: { done: false, count: 0, latest: null as null | { id: string; company: string; contact: string; createdAt: Date | null } },
        };
      }
      const [strategies, posts, leadsData, onboardingSession] = await Promise.all([
        getStrategyVersionsByProfile(profileId),
        getContentByProfile(profileId),
        getLeadsByProfile(profileId),
        getOnboardingSession(profileId),
      ]);
      const latestStrategy = strategies[0] ?? null;
      const upcomingPosts = posts
        .filter(p => p.scheduledAt && new Date(p.scheduledAt) >= new Date())
        .slice(0, 3)
        .map(p => ({ id: p.id, title: p.title, platform: p.platform, scheduledAt: p.scheduledAt ?? null }));
      const latestLead = leadsData[0] ?? null;
      const onboardingCurrentStep = onboardingSession?.currentStep ?? 1;
      const ONBOARDING_TOTAL_STEPS = 6;
      const onboardingCompleted = onboardingSession?.status === "completed";
      return {
        onboarding: {
          done: true,
          count: 1,
          currentStep: onboardingCurrentStep,
          totalSteps: ONBOARDING_TOTAL_STEPS,
          completed: onboardingCompleted,
        },
        strategy: {
          done: strategies.length > 0,
          count: strategies.length,
          latest: latestStrategy ? { id: latestStrategy.id, title: latestStrategy.title, createdAt: latestStrategy.createdAt ?? null } : null,
        },
        content: {
          done: posts.length > 0,
          count: posts.length,
          upcoming: upcomingPosts,
        },
        leads: {
          done: leadsData.length > 0,
          count: leadsData.length,
          latest: latestLead ? { id: latestLead.id, company: latestLead.company, contact: latestLead.contact, createdAt: latestLead.createdAt ?? null } : null,
        },
      };
    }),
});
