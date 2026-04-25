import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, appUserProcedure, superAdminProcedure, router } from "./_core/trpc";
import { appAuthRouter } from "./routers/appAuth";
import { generateImage } from "./_core/imageGeneration";
import { sendEmail, verifyEmailConfig, type EmailConfig } from "./emailSender";
import { sendOutboundEmail as sendOutboundEmailViaResend } from "./email";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import {
  getAllProfiles, getProfileById, getProfilesByAppUser, upsertProfile, deleteProfile,
  getLeadsByProfile, createLead, updateLead, deleteLead,
  getOutboundByProfile, createOutbound, updateOutbound, deleteOutbound,
  getInboundByProfile, createInbound, markInboundRead, updateInboundCategory,
  getContentByProfile, createContent, updateContent, deleteContent,
  getStrategiesByProfile, createStrategy, updateStrategy,
  getEmailIntegration, upsertEmailIntegration,
  getOnboardingSession, upsertOnboardingSession, saveOnboardingAnswers, getOnboardingAnswers,
  getBrandAssets, createBrandAsset, updateBrandAssetParsed, deleteBrandAsset,
  getCompanyIntelligence, upsertCompanyIntelligence,
  getCompetitors, upsertCompetitor, deleteCompetitor,
  getPersonas, upsertPersona, deletePersona,
  getStrategyTasks, upsertStrategyTask,
  getAiMemories, createAiMemory,
  createAuditLog, getAuditLogs,
  getStrategyVersionsByProfile, getActiveStrategyVersion, upsertStrategyVersion, setActiveStrategyVersion, archiveStrategyVersion,
  getCampaignsByProfile, getCampaignById, upsertCampaign, deleteCampaign,
  getCampaignAssets, upsertCampaignAsset,
  getRecommendationsByProfile, createRecommendation, dismissRecommendation,
  getNotificationsByUser, createNotification, markNotificationRead, markAllNotificationsRead,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { checkAiUsageLimit, recordAiUsage } from "./authDb";
import {
  getProjectsByOwner, getProjectById, upsertProject, setActiveProject, deleteProject, getActiveProjectByOwner,
  archiveProject, restoreProject, getArchivedProjectsByOwner,
  getSocialProfileCache, upsertSocialProfileCache, getSocialProfilesByProfile,
} from "./projectsDb";

// Helper: verify that the profileId belongs to the current appUser (or user is super_admin)
// If userProfileId is null (onboarding in progress), falls back to DB check via appUserId on the profile row
async function assertProfileOwnership(appUserId: string, role: string, profileId: string, userProfileId: string | null) {
  if (role === "super_admin") return; // super admin can access any profile
  if (userProfileId && userProfileId === profileId) return; // fast path: cached profileId matches
  // Slow path: check DB – the profile row stores appUserId so we can verify ownership during onboarding
  const profile = await getProfileById(profileId);
  if (profile && profile.appUserId === appUserId) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Nincs jogosultsága ehhez a profilhoz" });
}

export const appRouter = router({
  system: systemRouter,
  appAuth: appAuthRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Profiles ───────────────────────────────────────────────────────────────
  profiles: router({
    // Super admin sees all profiles; regular user sees only their own
    list: appUserProcedure.query(({ ctx }) => {
      if (ctx.appUser.role === "super_admin") {
        return getAllProfiles();
      }
      return getProfilesByAppUser(ctx.appUser.id);
    }),

    get: appUserProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const profile = await getProfileById(input.id);
        if (!profile) return null;
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.id, ctx.appUser.profileId);
        return profile;
      }),

    upsert: appUserProcedure
      .input(z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        initials: z.string().min(1).max(4),
        color: z.string().optional(),
        website: z.string().optional(),
        industry: z.string().optional(),
        description: z.string().optional(),
        logoUrl: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        fontHeading: z.string().optional(),
        fontBody: z.string().optional(),
        brandGuidelineUrl: z.string().optional(),
        brandVoice: z.object({
          tone: z.string(),
          style: z.string(),
          avoid: z.string(),
          keywords: z.array(z.string()),
        }).optional(),
        contentPillars: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          active: z.boolean(),
          percentage: z.number(),
        })).optional(),
        socialAccounts: z.array(z.object({
          platform: z.string(),
          handle: z.string(),
          connected: z.boolean(),
          followers: z.number().optional(),
          lastSync: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = input.id ?? nanoid();
        // Attach appUserId for new profiles
        return upsertProfile({ ...input, id, appUserId: ctx.appUser.id });
      }),

    delete: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.id, ctx.appUser.profileId);
        return deleteProfile(input.id);
      }),
  }),

  // ─── Leads ──────────────────────────────────────────────────────────────────
  leads: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getLeadsByProfile(input.profileId);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        company: z.string().min(1),
        contact: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        position: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        source: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return createLead({ ...input, id: nanoid(), status: "new" });
      }),

    update: appUserProcedure
      .input(z.object({
        id: z.string(),
        company: z.string().optional(),
        contact: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        position: z.string().optional(),
        industry: z.string().optional(),
        website: z.string().optional(),
        source: z.string().optional(),
        status: z.enum(["new", "researched", "email_draft", "approved", "sent", "replied", "meeting", "closed_won", "closed_lost"]).optional(),
        score: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateLead(id, updates);
      }),

    delete: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteLead(input.id)),
  }),

  // ─── Outbound Emails ────────────────────────────────────────────────────────
  outbound: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getOutboundByProfile(input.profileId);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        leadId: z.string().optional(),
        to: z.string().email(),
        toName: z.string().optional(),
        company: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return createOutbound({ ...input, id: nanoid(), status: "draft" });
      }),

    update: appUserProcedure
      .input(z.object({
        id: z.string(),
        subject: z.string().optional(),
        body: z.string().optional(),
        status: z.enum(["draft", "approved", "sent", "opened", "replied", "bounced"]).optional(),
        sentAt: z.date().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateOutbound(id, updates);
      }),

    delete: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteOutbound(input.id)),

    sendViaResend: appUserProcedure
      .input(z.object({
        emailId: z.string(),
        to: z.string().email(),
        toName: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const result = await sendOutboundEmailViaResend({
          to: input.to,
          toName: input.toName,
          subject: input.subject,
          body: input.body,
        });
        if (result.success) {
          await updateOutbound(input.emailId, { status: "sent", sentAt: new Date() });
        }
        return result;
      }),
  }),

  // ─── Inbound Emails ─────────────────────────────────────────────────────────
  inbound: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getInboundByProfile(input.profileId);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        from: z.string(),
        fromName: z.string().optional(),
        company: z.string().optional(),
        subject: z.string(),
        body: z.string(),
        category: z.enum(["interested", "not_interested", "question", "meeting_request", "out_of_office", "unsubscribe", "other"]).optional(),
        relatedOutboundId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return createInbound({ ...input, id: nanoid() });
      }),

    markRead: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => markInboundRead(input.id)),

    updateCategory: appUserProcedure
      .input(z.object({
        id: z.string(),
        category: z.enum(["interested", "not_interested", "question", "meeting_request", "out_of_office", "unsubscribe", "other"]),
      }))
      .mutation(({ input }) => updateInboundCategory(input.id, input.category)),
  }),

  // ─── Content Posts ──────────────────────────────────────────────────────────
  content: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getContentByProfile(input.profileId);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        title: z.string().min(1),
        platform: z.enum(["linkedin", "facebook", "instagram", "twitter", "tiktok"]),
        content: z.string().min(1),
        imageUrl: z.string().optional(),
        imagePrompt: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        pillar: z.string().optional(),
        weekNumber: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return createContent({ ...input, id: nanoid(), status: "draft" });
      }),

    update: appUserProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        imageUrl: z.string().optional(),
        imagePrompt: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        status: z.enum(["draft", "approved", "scheduled", "published", "rejected"]).optional(),
        scheduledAt: z.date().optional(),
        publishedAt: z.date().optional(),
        pillar: z.string().optional(),
        weekNumber: z.number().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateContent(id, updates);
      }),

    delete: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteContent(input.id)),

    generateMonthlyPlan: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        year: z.number(),
        month: z.number(),
        intelligenceData: z.any().optional(),
        contentPillars: z.array(z.string()).optional(),
        platforms: z.array(z.string()).optional(),
        isOnboarding: z.boolean().optional(), // bypass AI usage quota during onboarding
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const limitCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan, ctx.appUser.role, input.isOnboarding);
        if (!limitCheck.allowed) throw new TRPCError({ code: "FORBIDDEN", message: `AI használati limit elérve (${limitCheck.used}/${limitCheck.limit})` });

        const monthName = new Date(input.year, input.month, 1).toLocaleString("hu-HU", { month: "long", year: "numeric" });
        const platforms = input.platforms ?? ["LinkedIn", "Facebook", "Instagram"];
        const pillars = input.contentPillars ?? ["Edukáció", "Inspiráció", "Termék/Szolgáltatás", "Közösség", "Mögöttes tartalom"];
        const daysInMonth = new Date(input.year, input.month + 1, 0).getDate();

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy tapasztalt közösségi média tartalomtervező vagy. Teljes havi tartalomtervet készítesz. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
            { role: "user", content: `Készíts teljes havi tartalomtervet ${monthName} hónapra.\nPlatformok: ${platforms.join(", ")}\nTartalom pillérek: ${pillars.join(", ")}\n${input.intelligenceData ? `Vállalati kontextus: ${JSON.stringify(input.intelligenceData).slice(0, 800)}` : ""}\n\nGenerálj pontosan 12-16 bejegyzést egyenletesen elosztva a hónapban.\nAdj vissza JSON-t: posts (tömb, minden elem: {title: string, platform: string, pillar: string, caption: string, hashtags: string[], scheduledDay: number (1-${daysInMonth}), format: string})` as string },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "monthly_content_plan",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        platform: { type: "string" },
                        pillar: { type: "string" },
                        caption: { type: "string" },
                        hashtags: { type: "array", items: { type: "string" } },
                        scheduledDay: { type: "number" },
                        format: { type: "string" },
                      },
                      required: ["title", "platform", "pillar", "caption", "hashtags", "scheduledDay", "format"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["posts"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response.choices[0].message.content as string;
        const parsed = JSON.parse(raw);
        const created = [];
        for (const p of parsed.posts as any[]) {
          const platformNorm = (p.platform as string).toLowerCase().replace(/[^a-z]/g, "");
          const validPlatforms = ["linkedin", "facebook", "instagram", "twitter", "tiktok"];
          const platform = validPlatforms.includes(platformNorm) ? platformNorm : "linkedin";
          const day = Math.max(1, Math.min(p.scheduledDay, daysInMonth));
          const result = await createContent({
            id: nanoid(),
            profileId: input.profileId,
            platform: platform as any,
            title: p.title,
            content: p.caption,
            hashtags: p.hashtags,
            status: "draft",
            scheduledAt: new Date(input.year, input.month, day),
            pillar: p.pillar,
          });
          created.push(result);
        }

        await recordAiUsage(ctx.appUser.id, "monthly_content_plan", ctx.appUser.role, input.isOnboarding);
        return { created: created.length, posts: created };
      }),
    // ─── Approval Workflow ──────────────────────────────────────────────────────
    submitForReview: appUserProcedure
      .input(z.object({ postId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, input.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Poszt nem található" });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        await db.update(contentPosts)
          .set({ status: "review", updatedAt: new Date() })
          .where(eq(contentPosts.id, input.postId));
        return { success: true };
      }),

    approvePost: appUserProcedure
      .input(z.object({ postId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, input.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Poszt nem található" });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        await db.update(contentPosts)
          .set({ status: "approved", reviewedBy: ctx.appUser.id, reviewedAt: new Date(), updatedAt: new Date() })
          .where(eq(contentPosts.id, input.postId));
        return { success: true };
      }),

    rejectPost: appUserProcedure
      .input(z.object({ postId: z.string(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, input.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Poszt nem található" });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        await db.update(contentPosts)
          .set({ status: "rejected", rejectionReason: input.reason ?? null, reviewedBy: ctx.appUser.id, reviewedAt: new Date(), updatedAt: new Date() })
          .where(eq(contentPosts.id, input.postId));
        return { success: true };
      }),

    schedulePost: appUserProcedure
      .input(z.object({ postId: z.string(), scheduledAt: z.date() }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, input.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Poszt nem található" });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        if (post.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyott poszt ütemezhető" });
        await db.update(contentPosts)
          .set({ status: "scheduled", scheduledAt: input.scheduledAt, updatedAt: new Date() })
          .where(eq(contentPosts.id, input.postId));
        return { success: true };
      }),

    markPublished: appUserProcedure
      .input(z.object({ postId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, input.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Poszt nem található" });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        await db.update(contentPosts)
          .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
          .where(eq(contentPosts.id, input.postId));
        return { success: true };
      }),

    bulkUpdateStatus: appUserProcedure
      .input(z.object({
        postIds: z.array(z.string()),
        status: z.enum(["draft", "review", "approved", "scheduled", "published", "rejected"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const { contentPosts } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        for (const postId of input.postIds) {
          const [post] = await db.select().from(contentPosts).where(eq(contentPosts.id, postId));
          if (!post) continue;
          await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
          await db.update(contentPosts)
            .set({ status: input.status, updatedAt: new Date() })
            .where(eq(contentPosts.id, postId));
        }
        return { updated: input.postIds.length };
      }),

  }),

  // ─── Strategies ─────────────────────────────────────────────────────────────
  strategies: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getStrategiesByProfile(input.profileId);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        title: z.string().min(1),
        month: z.string(),
        summary: z.string().optional(),
        goals: z.array(z.string()).optional(),
        weeklyPlans: z.array(z.object({
          week: z.number(),
          focus: z.string(),
          actions: z.array(z.string()),
          cta: z.string(),
        })).optional(),
        kpis: z.array(z.object({
          metric: z.string(),
          target: z.string(),
          current: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return createStrategy({ ...input, id: nanoid(), status: "draft" });
      }),

    update: appUserProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().optional(),
        month: z.string().optional(),
        status: z.enum(["active", "draft", "archived"]).optional(),
        summary: z.string().optional(),
        goals: z.array(z.string()).optional(),
        weeklyPlans: z.array(z.object({
          week: z.number(),
          focus: z.string(),
          actions: z.array(z.string()),
          cta: z.string(),
        })).optional(),
        kpis: z.array(z.object({
          metric: z.string(),
          target: z.string(),
          current: z.string().optional(),
        })).optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...updates } = input;
        return updateStrategy(id, updates);
      }),
  }),

  // ─── Email Integrations ─────────────────────────────────────────────────────
  emailIntegration: router({
    get: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getEmailIntegration(input.profileId);
      }),

    upsert: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        provider: z.enum(["gmail", "outlook"]),
        email: z.string().email(),
        connected: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return upsertEmailIntegration({ ...input, connected: input.connected ?? false });
      }),
  }),

  // ─── Email Sending ────────────────────────────────────────────────────────────
  emailSend: router({
    send: appUserProcedure
      .input(z.object({
        emailId: z.string(),
        to: z.string().email(),
        toName: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
        config: z.object({
          provider: z.enum(["gmail", "outlook", "smtp"]),
          host: z.string().optional(),
          port: z.number().optional(),
          secure: z.boolean().optional(),
          user: z.string().email(),
          password: z.string().min(1),
          fromName: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const result = await sendEmail({
          config: input.config as EmailConfig,
          to: input.to,
          toName: input.toName,
          subject: input.subject,
          body: input.body,
        });
        if (result.success) {
          await updateOutbound(input.emailId, { status: "sent", sentAt: new Date() });
        }
        return result;
      }),

    verify: appUserProcedure
      .input(z.object({
        provider: z.enum(["gmail", "outlook", "smtp"]),
        host: z.string().optional(),
        port: z.number().optional(),
        secure: z.boolean().optional(),
        user: z.string().email(),
        password: z.string().min(1),
        fromName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return verifyEmailConfig(input as EmailConfig);
      }),
  }),

  // ─── Onboarding ──────────────────────────────────────────────────────────────
  onboarding: router({
    getSession: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getOnboardingSession(input.profileId)),

    upsertSession: appUserProcedure
      .input(z.object({
        id: z.string().optional(),
        profileId: z.string(),
        status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
        currentStep: z.number().optional(),
        completedAt: z.coerce.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = input.id ?? nanoid();
        return upsertOnboardingSession({ id, profileId: input.profileId, status: input.status ?? "in_progress", currentStep: input.currentStep ?? 1, completedAt: input.completedAt ?? null });
      }),

    saveAnswers: appUserProcedure
      .input(z.object({
        sessionId: z.string(),
        profileId: z.string(),
        step: z.number(),
        answers: z.array(z.object({
          fieldKey: z.string(),
          fieldValue: z.string().nullable().optional(),
          aiGenerated: z.boolean().optional(),
          userConfirmed: z.boolean().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const rows = input.answers.map(a => ({
          sessionId: input.sessionId,
          profileId: input.profileId,
          step: input.step,
          fieldKey: a.fieldKey,
          fieldValue: a.fieldValue ?? null,
          aiGenerated: a.aiGenerated ?? false,
          userConfirmed: a.userConfirmed ?? false,
        }));
        return saveOnboardingAnswers(rows);
      }),

    getAnswers: appUserProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => getOnboardingAnswers(input.sessionId)),

    scrapeWebsite: appUserProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        // Step 1: Fetch the actual HTML content of the website
        let htmlContent = "";
        let fetchError = "";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(input.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; G2A-Scraper/1.0; +https://g2a.marketing)",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
            },
          });
          clearTimeout(timeoutId);
          const rawHtml = await res.text();
          // Extract key text: title, meta tags, h1-h3, nav links, footer
          const extractText = (html: string): string => {
            // Remove scripts, styles, comments
            let clean = html
              .replace(/<script[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[\s\S]*?<\/style>/gi, " ")
              .replace(/<!--[\s\S]*?-->/g, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            return clean.slice(0, 4000);
          };
          // Extract specific meta tags
          const getMetaContent = (html: string, name: string): string => {
            const patterns = [
              new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
              new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
            ];
            for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
            return "";
          };
          const title = (rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
          const metaDesc = getMetaContent(rawHtml, "description") || getMetaContent(rawHtml, "og:description");
          const ogTitle = getMetaContent(rawHtml, "og:title") || getMetaContent(rawHtml, "twitter:title");
          const ogSiteName = getMetaContent(rawHtml, "og:site_name");
          const keywords = getMetaContent(rawHtml, "keywords");
          const bodyText = extractText(rawHtml);
          htmlContent = [
            title ? `TITLE: ${title}` : "",
            ogSiteName ? `SITE NAME: ${ogSiteName}` : "",
            ogTitle ? `OG TITLE: ${ogTitle}` : "",
            metaDesc ? `META DESCRIPTION: ${metaDesc}` : "",
            keywords ? `KEYWORDS: ${keywords}` : "",
            `BODY TEXT (first 3000 chars): ${bodyText}`,
          ].filter(Boolean).join("\n");
        } catch (e: any) {
          fetchError = `Weboldal nem volt elérhető (${e?.message ?? "timeout"}). Az URL és domain név alapján elemzem.`;
        }

        // Step 2: AI analysis with real content (or fallback to URL-only)
        const contextBlock = htmlContent
          ? `A weboldal valódi tartalma:\n${htmlContent}`
          : `FIGYELEM: ${fetchError} URL: ${input.url}`;

        const prompt = `Te egy marketing elemző vagy. Elemezd a következő weboldalt: ${input.url}\n\n${contextBlock}\n\nA fenti valódi weboldal tartalom alapján határozott, tényközlő stílusban írj le mindent a vállalkozásról. TILOS feltételes megfogalmazást használni. CSAK a weboldalón ténylegesen megtalálható információkat használd. MINDEN szöveges választ KIZÁRÓLAG MAGYARUL adj meg.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy marketing elemző vagy, aki strukturált adatokat nyér ki weboldal tartalmakból. CSAK a megadott weboldal tartalmában lévő tényleges információkat használd. TILOS feltételezni vagy kitalálni adatokat. MINDIG érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_schema", json_schema: { name: "website_analysis", strict: true, schema: { type: "object", properties: { companyName: { type: "string" }, industry: { type: "string" }, services: { type: "array", items: { type: "string" } }, keyMessages: { type: "array", items: { type: "string" } }, toneOfVoice: { type: "string" }, targetAudience: { type: "string" }, ctas: { type: "array", items: { type: "string" } }, competitorCandidates: { type: "array", items: { type: "string" } }, companySummary: { type: "string" } }, required: ["companyName", "industry", "services", "keyMessages", "toneOfVoice", "targetAudience", "ctas", "competitorCandidates", "companySummary"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    uploadAsset: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        fileBase64: z.string(),
        assetType: z.enum(["brand_guide", "visual_identity", "sales_material", "strategy", "buyer_persona", "faq", "other"]),
      }))
      .mutation(async ({ input }) => {
        const fileBuffer = Buffer.from(input.fileBase64, "base64");
        const fileKey = `brand-assets/${input.profileId}/${nanoid()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, fileBuffer, input.fileType);
        const asset = await createBrandAsset({
          id: nanoid(),
          profileId: input.profileId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileUrl: url,
          fileKey,
          assetType: input.assetType,
        });
        invokeLLM({
          messages: [
            { role: "system", content: "Te egy márkaelemző vagy. Kulcs márkainformációkat nyérsz ki feltöltött dokumentumokból. MINDEN szöveget KIZÁRÓLAG MAGYARUL adj meg." },
            { role: "user", content: `Elemezd ezt a ${input.assetType} dokumentumot (${input.fileName}) és nyérd ki: márkaértékek, kommunikációs stílus, fő üzenetek, célcsoport, vizuális irányelvek és minden egyéb releváns marketing információ. Adj vissza strukturált szöveges összefoglalót MAGYARUL.` },
          ],
        }).then(async (res) => {
          const parsed = res.choices[0]?.message?.content;
          if (parsed && asset?.id) {
            await updateBrandAssetParsed(asset.id, typeof parsed === "string" ? parsed : JSON.stringify(parsed));
          }
        }).catch(console.error);
        return asset;
      }),

    getBrandAssets: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getBrandAssets(input.profileId)),

    deleteBrandAsset: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteBrandAsset(input.id)),

    scrapeSocialProfile: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: z.string(), // linkedin, facebook, instagram, tiktok, youtube
        url: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check cache first (1 hour TTL)
        const cached = await getSocialProfileCache(input.profileId, input.platform, input.url);
        if (cached && cached.scrapedAt) {
          const ageMs = Date.now() - new Date(cached.scrapedAt).getTime();
          if (ageMs < 3600_000) return cached.analysis;
        }

        // Step 1: Try to fetch publicly visible content from the social profile page
        let pageContent = "";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(input.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; G2A-Scraper/1.0)",
              "Accept": "text/html,application/xhtml+xml",
              "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
            },
          });
          clearTimeout(timeoutId);
          const html = await res.text();
          // Extract visible text (social pages have limited public content)
          const getMetaContent = (h: string, name: string): string => {
            const p1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
            const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i");
            return h.match(p1)?.[1] ?? h.match(p2)?.[1] ?? "";
          };
          const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
          const ogDesc = getMetaContent(html, "og:description") || getMetaContent(html, "description");
          const ogTitle = getMetaContent(html, "og:title") || getMetaContent(html, "twitter:title");
          const ogSiteName = getMetaContent(html, "og:site_name");
          const cleanBody = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<!--[\s\S]*?-->/g, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 2000);
          pageContent = [
            title ? `TITLE: ${title}` : "",
            ogSiteName ? `SITE: ${ogSiteName}` : "",
            ogTitle ? `OG TITLE: ${ogTitle}` : "",
            ogDesc ? `DESCRIPTION: ${ogDesc}` : "",
            cleanBody ? `PAGE TEXT: ${cleanBody}` : "",
          ].filter(Boolean).join("\n");
        } catch {
          // Social platforms often block scrapers – fall back to URL-based analysis
          pageContent = "";
        }

        // Step 2: AI analysis with whatever content we got
        const contextNote = pageContent
          ? `A profil oldalról kinyert tartalom:\n${pageContent}`
          : `A profil URL: ${input.url} (a ${input.platform} platform nem engedte a közvetlen adatkinyerést, így csak a URL és platform-specifikus ismeretek alapján elemzem)`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy közösségi média elemző vagy. A megadott profil URL és az esetlegesen kinyert tartalom alapján határozott, tényközlő stílusban elemzed a profilt. TILOS feltételes megfogalmazást használni. MINDEN szöveges választ KIZÁRÓLAG MAGYARUL adj meg. Adj vissza kizárólag érvényes JSON-t." },
            { role: "user", content: `Elemezd ezt a ${input.platform} profilt: ${input.url}\n\n${contextNote}\n\nAdj vissza JSON-t a profil kommunikációjáról: tone (hangvitel magyarul), contentTypes (tartalom típusok tömb magyarul), postFrequency (becsült poszt frekvencia magyarul), topTopics (fő témakörök tömb magyarul), engagementStyle (elköteleződési stílus magyarul), audienceSignals (célcsoport jelzők tömb magyarul), rawSummary (rövid összefoglaló magyarul - csak tényeket, ne feltételezéseket)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "social_profile_analysis", strict: true, schema: { type: "object", properties: { tone: { type: "string" }, contentTypes: { type: "array", items: { type: "string" } }, postFrequency: { type: "string" }, topTopics: { type: "array", items: { type: "string" } }, engagementStyle: { type: "string" }, audienceSignals: { type: "array", items: { type: "string" } }, rawSummary: { type: "string" } }, required: ["tone", "contentTypes", "postFrequency", "topTopics", "engagementStyle", "audienceSignals", "rawSummary"], additionalProperties: false } } },
        });
        const raw = response.choices[0]?.message?.content ?? "{}";
        const analysis = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
        await upsertSocialProfileCache({
          id: nanoid(),
          profileId: input.profileId,
          platform: input.platform,
          url: input.url,
          analysis,
          scrapedAt: new Date(),
        });
        return analysis;
      }),
  }),

  // ─── Company Intelligence ────────────────────────────────────────────────────
  intelligence: router({
    get: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getCompanyIntelligence(input.profileId);
      }),

    generate: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        profileData: z.object({
          name: z.string(),
          website: z.string().optional(),
          industry: z.string().optional(),
          description: z.string().optional(),
          brandVoice: z.any().optional(),
          contentPillars: z.any().optional(),
        }),
        websiteAnalysis: z.any().optional(),
        onboardingAnswers: z.array(z.object({ fieldKey: z.string(), fieldValue: z.string().nullable() })).optional(),
        isOnboarding: z.boolean().optional(), // bypass AI usage quota during onboarding
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        // Feature gating: check AI usage limit (bypass during onboarding)
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role, input.isOnboarding);
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frísítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
        }
        // Extract social URLs and marketing priorities for richer AI context
        const socialUrlsAnswer = input.onboardingAnswers?.find(a => a.fieldKey === "socialUrls")?.fieldValue;
        const marketingPrioritiesAnswer = input.onboardingAnswers?.find(a => a.fieldKey === "marketingPriorities")?.fieldValue;
        let socialUrlsObj: Record<string, string> = {};
        let marketingPrioritiesList: string[] = [];
        try { if (socialUrlsAnswer) socialUrlsObj = JSON.parse(socialUrlsAnswer); } catch { /* ignore */ }
        try { if (marketingPrioritiesAnswer) marketingPrioritiesList = JSON.parse(marketingPrioritiesAnswer); } catch { /* ignore */ }
        const activeSocialProfiles = Object.entries(socialUrlsObj).filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v}`).join(", ");

        const context = JSON.stringify({
          company: input.profileData,
          websiteAnalysis: input.websiteAnalysis,
          onboardingAnswers: input.onboardingAnswers,
          socialMediaProfiles: activeSocialProfiles || null,
          marketingPriorities: marketingPrioritiesList.length > 0 ? marketingPrioritiesList : null,
        });
        const socialCtx = activeSocialProfiles ? `A következő közösségi média profilok elérhetők: ${activeSocialProfiles}. Ezek alapján következtess a meglévő tartalmakra, hangvételre és elérésekre.` : "";
        const priorityCtx = marketingPrioritiesList.length > 0 ? `A vállalkozás marketing prioritásai: ${marketingPrioritiesList.join(", ")}. Ezeket helyezd előtérbe a stratégiai javaslatokban.` : "";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy tapasztalt marketing stratéga vagy. Átfogó vállalati intelligencia profilt készítesz a megadott adatok alapján. Ha közösségi média profilok elérhetők, azok alapján következtess a meglévő tartalmakra, hangvételre és elérésekre. Iparági trendeket is figyelembe veszel és konkrét javaslatokat adsz azok alapján. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg – ez kötelező." },
            { role: "user", content: `Készíts teljes vállalati intelligencia profilt erről a vállalkozásról (MINDEN szöveg magyarul legyen):\n${context}\n\n${socialCtx}\n${priorityCtx}\n\nFontos: Az iparági trendeket is elemezd (${input.profileData.industry ?? "az adott iparág"} aktuális trendjei) és adj konkrét javaslatokat ezek alapján a successGoals és platformPriorities mezőkben.\n\nAdj vissza JSON-t a következő mezőkkel: companySummary (cég összefoglalója magyarul), brandDna (coreValues[] - alapértékek magyarul, personality[] - márka személyisége magyarul, differentiators[] - megkülönböztető tényezők magyarul, brandPromise - márkaígéret magyarul), offerMap (tömb: {name, description, targetAudience, usp} - mind magyarul), audienceMap (tömb: {segment, description, painPoints[], goals[], channels[]} - mind magyarul), competitorSnapshot (tömb: {name, strengths[], weaknesses[], positioning} - mind magyarul), platformPriorities (tömb: {platform, priority 1-5, rationale} - rationale magyarul), successGoals ({thirtyDay[], ninetyDay[], oneYear[]} - mind magyarul), aiWritingRules ({doList[], dontList[], toneGuidelines, examplePhrases[]} - mind magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "company_intelligence", strict: true, schema: { type: "object", properties: { companySummary: { type: "string" }, brandDna: { type: "object", properties: { coreValues: { type: "array", items: { type: "string" } }, personality: { type: "array", items: { type: "string" } }, differentiators: { type: "array", items: { type: "string" } }, brandPromise: { type: "string" } }, required: ["coreValues", "personality", "differentiators", "brandPromise"], additionalProperties: false }, offerMap: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, targetAudience: { type: "string" }, usp: { type: "string" } }, required: ["name", "description", "targetAudience", "usp"], additionalProperties: false } }, audienceMap: { type: "array", items: { type: "object", properties: { segment: { type: "string" }, description: { type: "string" }, painPoints: { type: "array", items: { type: "string" } }, goals: { type: "array", items: { type: "string" } }, channels: { type: "array", items: { type: "string" } } }, required: ["segment", "description", "painPoints", "goals", "channels"], additionalProperties: false } }, competitorSnapshot: { type: "array", items: { type: "object", properties: { name: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, positioning: { type: "string" } }, required: ["name", "strengths", "weaknesses", "positioning"], additionalProperties: false } }, platformPriorities: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, priority: { type: "number" }, rationale: { type: "string" } }, required: ["platform", "priority", "rationale"], additionalProperties: false } }, successGoals: { type: "object", properties: { thirtyDay: { type: "array", items: { type: "string" } }, ninetyDay: { type: "array", items: { type: "string" } }, oneYear: { type: "array", items: { type: "string" } } }, required: ["thirtyDay", "ninetyDay", "oneYear"], additionalProperties: false }, aiWritingRules: { type: "object", properties: { doList: { type: "array", items: { type: "string" } }, dontList: { type: "array", items: { type: "string" } }, toneGuidelines: { type: "string" }, examplePhrases: { type: "array", items: { type: "string" } } }, required: ["doList", "dontList", "toneGuidelines", "examplePhrases"], additionalProperties: false } }, required: ["companySummary", "brandDna", "offerMap", "audienceMap", "competitorSnapshot", "platformPriorities", "successGoals", "aiWritingRules"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        // Record AI usage (skip during onboarding)
        await recordAiUsage(ctx.appUser.id, "intelligence", ctx.appUser.role, input.isOnboarding);
        return upsertCompanyIntelligence({
          id: nanoid(),
          profileId: input.profileId,
          ...parsed,
          generatedAt: new Date(),
        });
      }),

    generateWowMoment: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        intelligenceData: z.any(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy tapasztalt marketing stratéga vagy. Cselekvhető átlelátásokat és gyors győzelmeket generálsz vállalkozásoknak. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg – ez kötelező." },
            { role: "user", content: `A következő vállalati intelligencia adatok alapján (MINDEN szöveg magyarul legyen):\n${JSON.stringify(input.intelligenceData)}\n\nGenerald a WOW pillanat kimenetet: companySummary (2-3 mondat magyarul), topStrengths (pontosan 3 erősség magyarul), topRisks (pontosan 3 kockázat magyarul), ninetyDayStrategyOutline (3-4 mondat a 90 napos stratégiáról magyarul), contentPillars (pontosan 5 tartalom pillér: {name, description, percentage} - mind magyarul), contentIdeas (pontosan 10 tartalomötlet: {title, platform, format, pillar} - mind magyarul), quickWins (pontosan 3 gyors győzelem: {title, description, impact: magas/közepes/alacsony, effort: magas/közepes/alacsony} - mind magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "wow_moment", strict: true, schema: { type: "object", properties: { companySummary: { type: "string" }, topStrengths: { type: "array", items: { type: "string" } }, topRisks: { type: "array", items: { type: "string" } }, ninetyDayStrategyOutline: { type: "string" }, contentPillars: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, percentage: { type: "number" } }, required: ["name", "description", "percentage"], additionalProperties: false } }, contentIdeas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, platform: { type: "string" }, format: { type: "string" }, pillar: { type: "string" } }, required: ["title", "platform", "format", "pillar"], additionalProperties: false } }, quickWins: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, impact: { type: "string" }, effort: { type: "string" } }, required: ["title", "description", "impact", "effort"], additionalProperties: false } } }, required: ["companySummary", "topStrengths", "topRisks", "ninetyDayStrategyOutline", "contentPillars", "contentIdeas", "quickWins"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    upsert: appUserProcedure
      .input(z.object({ profileId: z.string(), data: z.any() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return upsertCompanyIntelligence({ id: nanoid(), profileId: input.profileId, ...input.data });
      }),

    getCompetitors: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getCompetitors(input.profileId);
      }),

    getPersonas: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getPersonas(input.profileId);
      }),
  }),

  // ─── AI Writing Engine ───────────────────────────────────────────────────────
  aiWrite: router({
    generateEmailDraft: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        leadData: z.object({
          company: z.string(),
          contact: z.string(),
          industry: z.string().optional(),
          notes: z.string().optional(),
        }),
        brandVoice: z.object({
          tone: z.string().optional(),
          style: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          avoidWords: z.array(z.string()).optional(),
        }).optional(),
        emailGoal: z.string().optional(),
        previousContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const brandContext = input.brandVoice
          ? `Brand voice: ${input.brandVoice.tone ?? "professional"}, Style: ${input.brandVoice.style ?? "direct"}, Keywords to use: ${(input.brandVoice.keywords ?? []).join(", ")}, Words to avoid: ${(input.brandVoice.avoidWords ?? []).join(", ")}`
          : "Use a professional, direct tone.";
        const response = await invokeLLM({
          messages: [
           { role: "system", content: `Te egy tapasztalt B2B értékesítési email szakítő vagy. Személyre szabott, tömör hideg megkeresési emaileket írász, amelyek választ kapnak. MINDEN szöveget KIZÁRÓLAG MAGYARUL írj meg. ${brandContext}` },
            { role: "user", content: `Íráj hideg megkeresési emailt ${input.leadData.contact} részére, ${input.leadData.company} cégnél (iparág: ${input.leadData.industry ?? "ismeretlen"}).\nCél: ${input.emailGoal ?? "bemutatni a szolgáltatásainkat és megbeszélést kérni"}.\n${input.previousContext ? `Kontextus: ${input.previousContext}` : ""}\n\nAdj vissza JSON-t: subject (tárgysor magyarul), body (email törzs magyarul, max 3-4 bek.), previewText (előnézeti szöveg magyarul, 1 mondat)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "email_draft", strict: true, schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" }, previewText: { type: "string" } }, required: ["subject", "body", "previewText"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    generateSocialPost: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: z.enum(["linkedin", "facebook", "instagram", "twitter", "tiktok"]),
        pillar: z.string(),
        topic: z.string(),
        format: z.string().optional(),
        brandVoice: z.object({
          tone: z.string().optional(),
          style: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          avoidWords: z.array(z.string()).optional(),
        }).optional(),
        targetAudience: z.string().optional(),
        cta: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const platformGuide: Record<string, string> = {
          linkedin: "Szakmai hangnem, 150-300 szó, 3-5 releváns hashtag, kérdéssel vagy CTA-val zárul",
          facebook: "Közvetlen, 100-200 szó, figyelemfelkeltő kezdés, 2-3 hashtag",
          instagram: "Vizuális fókusz, 80-150 szó, 5-10 hashtag, emoji használat ajánlott",
          twitter: "Tömör, max 280 karakter, 1-2 hashtag, ütős",
          tiktok: "Trendi, laza, 50-100 szó felirat, 3-5 trending hashtag",
        };
        const brandContext = input.brandVoice
          ? `Márka hangnem: ${input.brandVoice.tone ?? "professzionális"}, Stílus: ${input.brandVoice.style ?? "közvetlen"}`
          : "";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `Te egy közösségi média tartalomszakértő vagy. Hozz létre minden platformra optimalizált, vonzó bejegyzéseket. Mindig magyarul válaszolj. ${brandContext}` },
            { role: "user", content: `Hozz létre egy ${input.platform} bejegyzést a következő témában: "${input.topic}" a "${input.pillar}" tartalmi pillérhez.\nCélközönség: ${input.targetAudience ?? "üzleti szakemberek"}.\nFormátum: ${input.format ?? "standard bejegyzés"}.\nCTA: ${input.cta ?? "interakció a tartalommal"}.\nPlatform irányelvek: ${platformGuide[input.platform]}.\n\nAdj vissza JSON-t (MINDEN szöveg magyarul): caption (bejegyzés szövege magyarul), hashtags (hashtagek tömbje), visualBrief (vizuális brief leírása magyarul), ctaText (cselekvésre szólítás magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "social_post", strict: true, schema: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, visualBrief: { type: "string" }, ctaText: { type: "string" } }, required: ["caption", "hashtags", "visualBrief", "ctaText"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),
  }),

  // ─── Audit Logs ──────────────────────────────────────────────────────────────
  auditLog: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        // Non-admin users can only see their own profile's logs
        const profileId = ctx.appUser.role === "super_admin" ? input.profileId : (ctx.appUser.profileId ?? undefined);
        return getAuditLogs(profileId, input.limit ?? 50);
      }),

    create: appUserProcedure
      .input(z.object({
        profileId: z.string().optional(),
        userId: z.string().optional(),
        userName: z.string().optional(),
        action: z.string(),
        objectType: z.string(),
        objectId: z.string().optional(),
        objectTitle: z.string().optional(),
        changes: z.any().optional(),
      }))
      .mutation(({ input }) => createAuditLog(input)),
  }),

  // ─── Strategy Versions ──────────────────────────────────────────────────────
  strategyVersions: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getStrategyVersionsByProfile(input.profileId);
      }),

    getActive: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getActiveStrategyVersion(input.profileId);
      }),

    upsert: appUserProcedure
      .input(z.object({
        id: z.string().optional(),
        profileId: z.string(),
        title: z.string().min(1),
        versionNumber: z.number().optional(),
        isActive: z.boolean().optional(),
        quarterlyGoals: z.any().optional(),
        monthlyPriorities: z.any().optional(),
        weeklySprints: z.any().optional(),
        executiveSummary: z.string().optional(),
        channelStrategy: z.any().optional(),
        campaignPriorities: z.any().optional(),
        quickWins: z.any().optional(),
        nextActions: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return upsertStrategyVersion({ ...input, id: input.id ?? nanoid() });
      }),

    setActive: appUserProcedure
      .input(z.object({ profileId: z.string(), versionId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return setActiveStrategyVersion(input.profileId, input.versionId);
      }),

    archive: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => archiveStrategyVersion(input.id)),

    generate: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        intelligenceData: z.any(),
        strategyContext: z.string().optional(),
        isOnboarding: z.boolean().optional(), // bypass AI usage quota during onboarding
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        // Feature gating: check AI usage limit (bypass during onboarding)
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role, input.isOnboarding);
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frissítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
        }
        const now = new Date();
        const currentDateStr = now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `Te egy tapasztalt marketing stratéga vagy. Átfogó többszintű marketing stratégiát készísz. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg. A mai dátum: ${currentDateStr}. A monthlyPriorities tömbnél a hónapokat a mai dátumhoz képest állítsd be (${currentYearMonth}-tól kezdve), ne használj régebbi dátumokat.` },
            { role: "user", content: `A következő vállalati intelligencia alapján (MINDEN szöveg magyarul):\n${JSON.stringify(input.intelligenceData)}\n\n${input.strategyContext ? `További kontextus: ${input.strategyContext}` : ""}\n\nGeneralj teljes stratégiát: executiveSummary (vezetői összefoglaló magyarul), channelStrategy (tömb: {channel, priority 1-5, rationale, tactics[]} - mind magyarul), campaignPriorities (string[] magyarul), quickWins (tömb: {title, description, impact, effort} - mind magyarul), nextActions (tömb: {title, description, urgency: magas/közepes/alacsony, dueDate?} - mind magyarul), quarterlyGoals ({q1?, q2?, q3?, q4?} - string[] magyarul), monthlyPriorities (tömb: {month: YYYY-MM, priorities: string[], kpis: [{label, target}]} - mind magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "strategy_output", strict: true, schema: { type: "object", properties: { executiveSummary: { type: "string" }, channelStrategy: { type: "array", items: { type: "object", properties: { channel: { type: "string" }, priority: { type: "number" }, rationale: { type: "string" }, tactics: { type: "array", items: { type: "string" } } }, required: ["channel", "priority", "rationale", "tactics"], additionalProperties: false } }, campaignPriorities: { type: "array", items: { type: "string" } }, quickWins: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, impact: { type: "string" }, effort: { type: "string" } }, required: ["title", "description", "impact", "effort"], additionalProperties: false } }, nextActions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, urgency: { type: "string" }, dueDate: { type: "string" } }, required: ["title", "description", "urgency"], additionalProperties: false } }, quarterlyGoals: { type: "object", properties: { q1: { type: "array", items: { type: "string" } }, q2: { type: "array", items: { type: "string" } }, q3: { type: "array", items: { type: "string" } }, q4: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false }, monthlyPriorities: { type: "array", items: { type: "object", properties: { month: { type: "string" }, priorities: { type: "array", items: { type: "string" } }, kpis: { type: "array", items: { type: "object", properties: { label: { type: "string" }, target: { type: "string" } }, required: ["label", "target"], additionalProperties: false } } }, required: ["month", "priorities", "kpis"], additionalProperties: false } } }, required: ["executiveSummary", "channelStrategy", "campaignPriorities", "quickWins", "nextActions", "quarterlyGoals", "monthlyPriorities"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        // Record AI usage (skip during onboarding)
        await recordAiUsage(ctx.appUser.id, "strategy", ctx.appUser.role, input.isOnboarding);
        const existing = await getStrategyVersionsByProfile(input.profileId);
        const versionNumber = existing.length + 1;
        return upsertStrategyVersion({
          id: nanoid(),
          profileId: input.profileId,
          title: `Stratégia v${versionNumber} – ${new Date().toLocaleDateString("hu-HU")}`,
          versionNumber,
          isActive: true,
          ...parsed,
        });
      }),
  }),

  // ─── Campaigns ──────────────────────────────────────────────────────────────
  campaigns: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getCampaignsByProfile(input.profileId);
      }),

    get: appUserProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => getCampaignById(input.id)),

    upsert: appUserProcedure
      .input(z.object({
        id: z.string().optional(),
        profileId: z.string(),
        strategyVersionId: z.string().optional(),
        title: z.string().min(1),
        objective: z.string().optional(),
        targetAudience: z.string().optional(),
        channels: z.array(z.string()).optional(),
        budget: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
        brief: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return upsertCampaign({ ...input, id: input.id ?? nanoid(), status: input.status ?? "draft" });
      }),

    delete: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteCampaign(input.id)),

    generateBrief: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        campaignTitle: z.string(),
        objective: z.string().optional(),
        targetAudience: z.string().optional(),
        channels: z.array(z.string()).optional(),
        intelligenceData: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy kampánystratéga vagy. Részletes kampány briefet készítesz. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
            { role: "user", content: `Készíts kampány briefet a következőhöz: "${input.campaignTitle}"\nCél: ${input.objective ?? "márkaismertsség növelése"}\nCélcsoport: ${input.targetAudience ?? "általános"}\nCsatornák: ${(input.channels ?? []).join(", ") || "minden releváns csatorna"}\nVállalati kontextus: ${JSON.stringify(input.intelligenceData ?? {})}\n\nAdj vissza JSON-t: hook (figyelemfelkeltő üzenet magyarul), mainMessage (fő üzenet magyarul), cta (cselekvésre szólítás magyarul), contentIdeas (tömb: {title, format, platform} - mind magyarul), kpis (tömb: {label, target} - mind magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "campaign_brief", strict: true, schema: { type: "object", properties: { hook: { type: "string" }, mainMessage: { type: "string" }, cta: { type: "string" }, contentIdeas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, format: { type: "string" }, platform: { type: "string" } }, required: ["title", "format", "platform"], additionalProperties: false } }, kpis: { type: "array", items: { type: "object", properties: { label: { type: "string" }, target: { type: "string" } }, required: ["label", "target"], additionalProperties: false } } }, required: ["hook", "mainMessage", "cta", "contentIdeas", "kpis"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    getAssets: appUserProcedure
      .input(z.object({ campaignId: z.string() }))
      .query(({ input }) => getCampaignAssets(input.campaignId)),

    upsertAsset: appUserProcedure
      .input(z.object({
        id: z.string().optional(),
        campaignId: z.string(),
        profileId: z.string(),
        type: z.enum(["copy", "image", "video", "email", "ad", "other"]),
        title: z.string().min(1),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        platform: z.string().optional(),
        status: z.enum(["draft", "review", "approved", "published"]).optional(),
      }))
      .mutation(({ input }) => upsertCampaignAsset({ ...input, id: input.id ?? nanoid(), status: input.status ?? "draft" })),

    generateContentFromBrief: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        campaignId: z.string(),
        campaignTitle: z.string(),
        brief: z.object({
          hook: z.string(),
          mainMessage: z.string(),
          cta: z.string(),
          contentIdeas: z.array(z.object({ title: z.string(), format: z.string(), platform: z.string() })),
          kpis: z.array(z.object({ label: z.string(), target: z.string() })),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const limitCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role);
        if (!limitCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI limit elérve (${limitCheck.used}/${limitCheck.limit})` });
        }
        const PLATFORM_MAP: Record<string, "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok"> = {
          linkedin: "linkedin", facebook: "facebook", instagram: "instagram",
          twitter: "twitter", tiktok: "tiktok",
        };
        const created: string[] = [];
        const ideasToProcess = input.brief.contentIdeas.slice(0, 5);
        for (const idea of ideasToProcess) {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "Te egy marketing tartalomíró vagy. Kizárólag MAGYARUL írj." },
              { role: "user", content: `Írj egy ${idea.format} formátumú tartalmat ${idea.platform} platformra a következő kampányhoz:\nKampány: ${input.campaignTitle}\nCím: ${idea.title}\nFő üzenete: ${input.brief.mainMessage}\nHook: ${input.brief.hook}\nCTA: ${input.brief.cta}\n\nAdj vissza JSON-t: {"title": "...", "content": "...", "hashtags": ["..."]}` },
            ],
            response_format: { type: "json_schema", json_schema: { name: "content_item", strict: true, schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, hashtags: { type: "array", items: { type: "string" } } }, required: ["title", "content", "hashtags"], additionalProperties: false } } },
          });
          const raw = response.choices[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          const platformKey = idea.platform.toLowerCase().replace(/\s+/g, "");
          const platform = PLATFORM_MAP[platformKey] ?? "linkedin";
          const contentId = nanoid();
          await createContent({
            id: contentId,
            profileId: input.profileId,
            platform,
            title: parsed.title ?? idea.title,
            content: parsed.content ?? "",
            hashtags: parsed.hashtags ?? [],
            status: "draft",
            pillar: input.campaignId,
          });
          created.push(contentId);
        }
        await recordAiUsage(ctx.appUser.id, "campaign_content_generation", ctx.appUser.role);
        return { created: created.length, contentIds: created };
      }),
  }),

  // ─── Recommendations ────────────────────────────────────────────────────────
  recommendations: router({
    list: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        return getRecommendationsByProfile(input.profileId);
      }),

    dismiss: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => dismissRecommendation(input.id)),

    generate: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        recentContent: z.any().optional(),
        recentLeads: z.any().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy marketing AI tanácsadó vagy. Cselekvhető javaslatokat generálsz. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
            { role: "user", content: `Generalj 5 cselekvhető marketing javaslatot a következők alapján (MINDEN szöveg magyarul):\nLegutolsó tartalmak: ${JSON.stringify(input.recentContent ?? [])}\nLegutolsó leadek: ${JSON.stringify(input.recentLeads ?? [])}\n\nAdj vissza JSON-t items tömbbel: {type: strategy|content|campaign|lead|analytics, title (magyarul), description (magyarul), urgency: magas|közepes|alacsony}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "recommendations", strict: true, schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, description: { type: "string" }, urgency: { type: "string" } }, required: ["type", "title", "description", "urgency"], additionalProperties: false } } }, required: ["items"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        for (const item of (parsed.items ?? [])) {
          await createRecommendation({ id: nanoid(), profileId: input.profileId, type: item.type, title: item.title, description: item.description, urgency: item.urgency });
        }
        return parsed.items ?? [];
      }),
  }),

  // ─── Notifications ───────────────────────────────────────────────────────────
  notifications: router({
    list: appUserProcedure
      .query(({ ctx }) => getNotificationsByUser(ctx.appUser.id)),

    markRead: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => markNotificationRead(input.id)),

    markAllRead: appUserProcedure
      .mutation(({ ctx }) => markAllNotificationsRead(ctx.appUser.id)),
  }),

  // ─── AI ─────────────────────────────────────────────────────────────────────
  ai: router({
    generateImage: appUserProcedure
      .input(z.object({
        prompt: z.string().min(3).max(500),
        originalImageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await generateImage({
          prompt: input.prompt,
          ...(input.originalImageUrl ? {
            originalImages: [{ url: input.originalImageUrl, mimeType: "image/jpeg" as const }]
          } : {}),
        });
        return { url: result.url ?? null };
      }),

    generatePostContent: appUserProcedure
      .input(z.object({
        platform: z.string(),
        contentType: z.string(),
        pillar: z.string().optional(),
        tone: z.string().optional(),
        companyName: z.string().optional(),
        industry: z.string().optional(),
        intelligenceSummary: z.string().optional(),
        strategyContext: z.string().optional(),
        additionalContext: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Feature gating: check AI usage limit
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role);
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frissítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
        }
        const now = new Date();
        const currentDateStr = now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `Te egy tapasztalt közösségi média tartalomkészítő vagy. KIZÁRÓLAG MAGYARUL írj. A mai dátum: ${currentDateStr}. Adj vissza JSON-t a következő mezőkkel: title (rövid, figyelemfelkeltő cím), content (teljes poszt szöveg a platformnak megfelelő stílusban, max 280 karakter Twitter/TikTok esetén, max 3000 LinkedIn esetén), hashtags (string tömb, max 8 hashtag), imagePrompt (angol nyelvű képgenerálási prompt, részletes, vizuálisan leíró).` },
            { role: "user", content: `Cég: ${input.companyName ?? "ismeretlen"}\nIparág: ${input.industry ?? "általános"}\nPlatform: ${input.platform}\nTartalom típusa: ${input.contentType}\nTartalmi pillér: ${input.pillar ?? "általános"}\nHang/Tone: ${input.tone ?? "professzionális, barátságos"}\n${input.intelligenceSummary ? `Cég összefoglaló: ${input.intelligenceSummary}` : ""}\n${input.strategyContext ? `Stratégiai kontextus: ${input.strategyContext}` : ""}\n${input.additionalContext ? `Kiegészítő instrukciók: ${input.additionalContext}` : ""}\n\nGenerálj egy ${input.platform} posztot.` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "post_content", strict: true, schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, imagePrompt: { type: "string" } }, required: ["title", "content", "hashtags", "imagePrompt"], additionalProperties: false } } },
        });
        const raw = response.choices[0]?.message?.content ?? "{}";
        // Record AI usage
        await recordAiUsage(ctx.appUser.id, "content", ctx.appUser.role);
        return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      }),
  }),

  // ─── Daily Tasks („Mi a dolgom ma?”) ──────────────────────────────────────────────
  dailyTasks: router({
    generate: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const dailyTasksUsageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role);
        if (!dailyTasksUsageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${dailyTasksUsageCheck.used}/${dailyTasksUsageCheck.limit} ebben a hónapban). Frissítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: dailyTasksUsageCheck.used, limit: dailyTasksUsageCheck.limit, plan: dailyTasksUsageCheck.plan } });
        }

        // Gather context: strategy version, leads, drafts
        const strategy = await getActiveStrategyVersion(input.profileId);
        const { getDb } = await import("./db");
        const { leads: leadsTable, contentPosts: postsTable } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const rawDb = await getDb();
        const newLeads = rawDb ? await rawDb.select().from(leadsTable)
          .where(and(eq(leadsTable.profileId, input.profileId), eq(leadsTable.status, "new")))
          .limit(5) : [];
        const draftPosts = rawDb ? await rawDb.select().from(postsTable)
          .where(and(eq(postsTable.profileId, input.profileId), eq(postsTable.status, "draft")))
          .limit(5) : [];

        const contextParts = [
          strategy ? `Aktív stratégia: ${strategy.title}.` : "Nincs aktív stratégia.",
          newLeads.length > 0 ? `${newLeads.length} új lead vár feldolgozásra.` : "Nincs új lead.",
          draftPosts.length > 0 ? `${draftPosts.length} piszkozat tartalom vár jóváhagyásra.` : "Nincs piszkozat tartalom.",
        ];

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Te egy marketing asszisztens vagy. A vállalkozás kontextusa alapján adj 3-5 konkrét, rövid napi teendőt. Minden teendő legyen cselekvő igével kezdődő, max 10 szavas magyar mondat. Adj egy rövid motiváló üzenetet is.

FONTOS: Minden feladathoz adj meg egy actionType-ot és egy link URL-t az alábbi szabályok szerint:
- Ha a feladat stratégiával kapcsolatos: actionType="strategy", link="/strategia?autoGenerate=true"
- Ha a feladat tartalommal kapcsolatos (poszt, cikk, social): actionType="content", link="/tartalom-studio"
- Ha a feladat lead-del vagy értékesítéssel kapcsolatos: actionType="sales", link="/ertekesites"
- Ha a feladat kampánnyal kapcsolatos: actionType="campaign", link="/kampanyok"
- Ha a feladat intelligence/elemzéssel kapcsolatos: actionType="intelligence", link="/intelligencia"
- Egyéb esetben: actionType="other", link="/iranyitopult"

A link mező mindig ezek egyike legyen, ne találj ki más URL-t.`,
            },
            {
              role: "user",
              content: `Kontextus: ${contextParts.join(" ")}. Mai dátum: ${new Date().toLocaleDateString("hu-HU")}. Add meg a napi teendőket.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "daily_tasks",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        category: { type: "string", enum: ["tartalom", "lead", "stratégia", "kampány", "egyéb"] },
                        link: { type: "string" },
                        actionType: { type: "string", enum: ["strategy", "content", "sales", "campaign", "intelligence", "other"] },
                      },
                      required: ["text", "category", "link", "actionType"],
                      additionalProperties: false,
                    },
                  },
                  motivationalMessage: { type: "string" },
                },
                required: ["tasks", "motivationalMessage"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = response.choices[0]?.message?.content ?? "{}";
        await recordAiUsage(ctx.appUser.id, "daily_tasks", ctx.appUser.role);
        return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as {
          tasks: { text: string; category: string; link: string; actionType: string }[];
          motivationalMessage: string;
        };
      }),
  }),

  // ─── Social Media ─────────────────────────────────────────────────────────
  social: router({
    listConnections: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const { getDb } = await import("./db");
        const { socialConnections } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        return db.select().from(socialConnections)
          .where(eq(socialConnections.profileId, input.profileId));
      }),
    saveConnection: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: z.enum(["facebook", "instagram", "linkedin", "twitter"]),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        tokenExpiresAt: z.string().optional(),
        platformUserId: z.string().optional(),
        platformUsername: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const { getDb } = await import("./db");
        const { socialConnections } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const id = nanoid();
        await db.insert(socialConnections).values({
          id,
          profileId: input.profileId,
          platform: input.platform,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          tokenExpiresAt: input.tokenExpiresAt ?? null,
          platformUserId: input.platformUserId ?? null,
          platformUsername: input.platformUsername ?? null,
          isActive: true,
        });
        return { success: true };
      }),
    disconnect: appUserProcedure
      .input(z.object({ connectionId: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { socialConnections } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        await db.update(socialConnections).set({ isActive: false }).where(eq(socialConnections.id, input.connectionId));
        return { success: true };
      }),
    publishNow: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        connectionId: z.string(),
        text: z.string().min(1).max(3000),
        imageUrl: z.string().optional(),
        contentId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const { getDb } = await import("./db");
        const { socialConnections: scTable, scheduledPosts } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        const [conn] = await db.select().from(scTable).where(eq(scTable.id, input.connectionId)).limit(1);
        if (!conn || !conn.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Social fiók nem található vagy inaktív" });
        const { publishToLinkedIn } = await import("./socialPublisher");
        const { postId } = await publishToLinkedIn(conn.accessToken, conn.platformUserId ?? "", input.text, input.imageUrl);
        await db.insert(scheduledPosts).values({
          id: nanoid(),
          profileId: input.profileId,
          contentId: input.contentId ?? null,
          platform: conn.platform,
          text: input.text,
          imageUrl: input.imageUrl ?? null,
          scheduledAt: new Date(),
          status: "published",
          publishedAt: new Date(),
        });
        return { success: true, postId };
      }),
    schedulePost: appUserProcedure
      .input(z.object({
        profileId: z.string(),
        platform: z.enum(["facebook", "instagram", "linkedin", "twitter"]),
        text: z.string().min(1).max(3000),
        imageUrl: z.string().optional(),
        scheduledAt: z.string(),
        contentId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const { getDb } = await import("./db");
        const { scheduledPosts } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
        await db.insert(scheduledPosts).values({
          id: nanoid(),
          profileId: input.profileId,
          contentId: input.contentId ?? null,
          platform: input.platform,
          text: input.text,
          imageUrl: input.imageUrl ?? null,
          scheduledAt: new Date(input.scheduledAt),
          status: "pending",
        });
        return { success: true };
      }),
    listScheduled: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const { getDb } = await import("./db");
        const { scheduledPosts } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        return db.select().from(scheduledPosts)
          .where(eq(scheduledPosts.profileId, input.profileId))
          .orderBy(desc(scheduledPosts.scheduledAt))
          .limit(50);
      }),
    getLinkedInOAuthUrl: appUserProcedure
      .input(z.object({ profileId: z.string(), origin: z.string() }))
      .query(async ({ ctx, input }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        const clientId = process.env.LINKEDIN_CLIENT_ID ?? "";
        if (!clientId) {
          return { url: null, configured: false };
        }
        const state = Buffer.from(JSON.stringify({ profileId: input.profileId, origin: input.origin })).toString("base64url");
        const redirectUri = `${input.origin}/api/oauth/linkedin/callback`;
        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          scope: "openid profile email w_member_social",
        });
        return { url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`, configured: true };
      }),
    isLinkedInConfigured: publicProcedure
      .query(() => {
        return { configured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) };
      }),
  }),

  // ─── API Config (super_admin only) ──────────────────────────────────────────
  apiConfig: router({
    // Get current API config status (does not expose secrets)
    status: superAdminProcedure
      .query(() => {
        return {
          linkedInConfigured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
          linkedInClientId: process.env.LINKEDIN_CLIENT_ID ? process.env.LINKEDIN_CLIENT_ID.slice(0, 8) + "..." : null,
          resendConfigured: !!(process.env.RESEND_API_KEY),
        };
      }),
    // Set LinkedIn OAuth credentials at runtime (stored in process.env for current process)
    // Note: these are lost on server restart; use Secrets panel for permanent storage
    setLinkedInCredentials: superAdminProcedure
      .input(z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
      }))
      .mutation(({ input }) => {
        process.env.LINKEDIN_CLIENT_ID = input.clientId;
        process.env.LINKEDIN_CLIENT_SECRET = input.clientSecret;
        return { success: true };
      }),
  }),

  // ─── Projects (Super Admin Multi-Workspace) ─────────────────────────────────
  projects: router({
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
  }),

  // ─── SEO Audit ──────────────────────────────────────────────────────────────
  seo: router({
    runAudit: appUserProcedure
      .input(z.object({ profileId: z.string(), url: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const { nanoid } = await import("nanoid");
        const id = nanoid();
        // Insert pending record
        const { getDb } = await import("./db");
        const { seoAudits } = await import("../drizzle/schema");
        const db = await getDb();
        await db!.insert(seoAudits).values({ id, profileId: input.profileId, url: input.url, status: "running" });

        // Fetch the page HTML
        let html = "";
        let loadTime: number | null = null;
        let pageSize: number | null = null;
        let hasHttps = input.url.startsWith("https://");
        let hasSitemap = false;
        let hasRobotsTxt = false;
        try {
          const t0 = Date.now();
          const resp = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; G2A-SEO-Bot/1.0)" }, signal: AbortSignal.timeout(15000) });
          loadTime = Date.now() - t0;
          html = await resp.text();
          pageSize = Buffer.byteLength(html, "utf8");
        } catch { /* ignore fetch errors */ }

        // Check sitemap & robots.txt
        try {
          const base = new URL(input.url).origin;
          const [smResp, rbResp] = await Promise.allSettled([
            fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
            fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(5000) }),
          ]);
          hasSitemap = smResp.status === "fulfilled" && smResp.value.ok;
          hasRobotsTxt = rbResp.status === "fulfilled" && rbResp.value.ok;
        } catch { /* ignore */ }

        // Parse HTML with regex (no cheerio dependency)
        const getTag = (tag: string) => { const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i")); return m ? m[1].replace(/<[^>]+>/g, "").trim() : null; };
        const getMeta = (name: string) => { const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i")); return m ? m[1] : null; };
        const title = getTag("title");
        const description = getMeta("description");
        const ogTitle = getMeta("og:title");
        const ogDescription = getMeta("og:description");
        const ogImage = getMeta("og:image");
        const canonical = (() => { const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i); return m ? m[1] : null; })();
        const robots = getMeta("robots");
        const langAttr = (() => { const m = html.match(/<html[^>]+lang=["']([^"']*)["']/i); return m ? m[1] : null; })();
        const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
        const hasCharset = /<meta[^>]+charset/i.test(html);
        const hasFavicon = /<link[^>]+rel=["'](?:icon|shortcut icon)["']/i.test(html);
        const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
        const h1Texts = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 5);
        const h2Texts = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 8);
        const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
        const wordCount = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
        const internalLinks = (html.match(new RegExp(`href=["'](?:\/|${input.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})[^"']*["']`, "gi")) || []).length;
        const externalLinks = (html.match(/href=["']https?:\/\/[^"']*/gi) || []).length - internalLinks;
        const totalImages = (html.match(/<img[^>]*>/gi) || []).length;
        const imagesWithoutAlt = (html.match(/<img(?![^>]*alt=["'][^"']+["'])[^>]*>/gi) || []).length;

        // Build issues list
        const issues: Array<{ severity: "critical" | "warning" | "info"; category: string; title: string; description: string; recommendation: string }> = [];
        if (!title) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó title tag", description: "Az oldal nem rendelkezik title taggel.", recommendation: "Adj hozzá egy 50-60 karakter hosszú, kulcsszavakat tartalmazó title taget." });
        else if ((title?.length ?? 0) < 30) issues.push({ severity: "warning", category: "Meta", title: "Rövid title tag", description: `A title csak ${title?.length} karakter.`, recommendation: "Bővítsd 50-60 karakterre, és helyezd el a fő kulcsszót az elején." });
        else if ((title?.length ?? 0) > 60) issues.push({ severity: "warning", category: "Meta", title: "Hosszú title tag", description: `A title ${title?.length} karakter – a keresők csonkíthatják.`, recommendation: "Rövidítsd 60 karakterre." });
        if (!description) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó meta description", description: "Nincs meta description.", recommendation: "Írj 150-160 karakteres, cselekvésre ösztönző meta descriptiont." });
        else if ((description?.length ?? 0) > 160) issues.push({ severity: "warning", category: "Meta", title: "Hosszú meta description", description: `A description ${description?.length} karakter.`, recommendation: "Rövidítsd 160 karakterre." });
        if (h1Texts.length === 0) issues.push({ severity: "critical", category: "Tartalom", title: "Hiányzó H1 fejléc", description: "Az oldalon nincs H1 fejléc.", recommendation: "Adj hozzá pontosan egy H1 fejlécet, amely tartalmazza a fő kulcsszót." });
        else if (h1Texts.length > 1) issues.push({ severity: "warning", category: "Tartalom", title: "Több H1 fejléc", description: `Az oldalon ${h1Texts.length} H1 fejléc van.`, recommendation: "Csak egy H1 fejléc legyen oldalanként." });
        if (!hasHttps) issues.push({ severity: "critical", category: "Technikai", title: "HTTPS hiányzik", description: "Az oldal nem HTTPS-en fut.", recommendation: "Telepíts SSL tanúsítványt és irányítsd át a HTTP forgalmat HTTPS-re." });
        if (!hasSitemap) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó sitemap.xml", description: "Nem található sitemap.xml.", recommendation: "Hozz létre és tedd közzé a sitemap.xml fájlt, majd add hozzá a Google Search Console-hoz." });
        if (!hasRobotsTxt) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó robots.txt", description: "Nem található robots.txt.", recommendation: "Hozz létre robots.txt fájlt a crawlerek irányításához." });
        if (!hasViewport) issues.push({ severity: "critical", category: "Mobilbarát", title: "Hiányzó viewport meta tag", description: "Nincs viewport meta tag – az oldal nem mobilbarát.", recommendation: "Add hozzá: <meta name='viewport' content='width=device-width, initial-scale=1'>" });
        if (!hasStructuredData) issues.push({ severity: "info", category: "Strukturált adat", title: "Nincs strukturált adat (JSON-LD)", description: "Az oldal nem tartalmaz schema.org jelölést.", recommendation: "Adj hozzá Organization, WebSite vagy LocalBusiness JSON-LD strukturált adatot." });
        if (imagesWithoutAlt > 0) issues.push({ severity: "warning", category: "Akadálymentesség", title: `${imagesWithoutAlt} kép alt szöveg nélkül`, description: `${imagesWithoutAlt} képből hiányzik az alt attribútum.`, recommendation: "Minden képhez adj leíró alt szöveget a keresőoptimalizálás és akadálymentesség érdekében." });
        if (!canonical) issues.push({ severity: "info", category: "Meta", title: "Hiányzó canonical URL", description: "Nincs canonical link tag.", recommendation: "Add hozzá a canonical URL-t a duplikált tartalom elkerülése érdekében." });
        if (!langAttr) issues.push({ severity: "info", category: "Technikai", title: "Hiányzó lang attribútum", description: "A HTML tag nem tartalmaz lang attribútumot.", recommendation: "Add hozzá a lang attribútumot, pl. lang='hu'." });
        if (wordCount < 300) issues.push({ severity: "warning", category: "Tartalom", title: "Kevés szöveges tartalom", description: `Az oldal csak ~${wordCount} szót tartalmaz.`, recommendation: "Bővítsd a tartalmat legalább 500 szóra a jobb rangsorolás érdekében." });

        // Calculate score
        const criticalCount = issues.filter(i => i.severity === "critical").length;
        const warningCount = issues.filter(i => i.severity === "warning").length;
        const score = Math.max(0, Math.min(100, 100 - criticalCount * 15 - warningCount * 5));

        // AI insights
        const auditSummary = `URL: ${input.url}\nTitle: ${title ?? "N/A"}\nDescription: ${description ?? "N/A"}\nH1: ${h1Texts[0] ?? "N/A"}\nWordCount: ${wordCount}\nHTTPS: ${hasHttps}\nSitemap: ${hasSitemap}\nStructuredData: ${hasStructuredData}\nIssues: ${issues.map(i => `[${i.severity}] ${i.title}`).join("; ")}\nScore: ${score}/100`;
        let aiInsights = "";
        let aiRecommendations = "";
        try {
          const aiResp = await invokeLLM({ messages: [
            { role: "system" as const, content: "Te egy SEO szakértő vagy. Elemezd a weboldal SEO audit eredményeit és adj részletes, szakmai értékelést magyarul. Légy konkrét és cselekvésre ösztönző." },
            { role: "user" as const, content: `Elemezd ezt a SEO auditot és adj átfogó értékelést:\n\n${auditSummary}\n\nÍrj 3-4 bekezdéses elemzést a weboldal SEO állapotáról, erősségeiről és gyengeségeiről.` },
          ] });
          const rawInsights = aiResp.choices?.[0]?.message?.content;
          aiInsights = typeof rawInsights === "string" ? rawInsights : "";
          const aiRecResp = await invokeLLM({ messages: [
            { role: "system" as const, content: "Te egy SEO szakértő vagy. Adj konkrét, prioritizált cselekvési tervet a weboldal SEO javításához magyarul. Számozd a lépéseket fontossági sorrendben." },
            { role: "user" as const, content: `Az alábbi SEO audit alapján adj 5-7 konkrét, megvalósítható javaslatot prioritási sorrendben:\n\n${auditSummary}` },
          ] });
          const rawRec = aiRecResp.choices?.[0]?.message?.content;
          aiRecommendations = typeof rawRec === "string" ? rawRec : "";
        } catch { /* AI failure is non-fatal */ }

        const report = {
          meta: { title, titleLength: title?.length ?? 0, description, descriptionLength: description?.length ?? 0, canonical, robots, ogTitle, ogDescription, ogImage },
          headings: { h1Count: h1Texts.length, h1Texts, h2Count: h2Texts.length, h2Texts, h3Count },
          performance: { loadTime, pageSize, hasHttps, hasSitemap, hasRobotsTxt },
          content: { wordCount, internalLinks, externalLinks, imagesWithoutAlt, totalImages },
          technical: { hasStructuredData, hasViewport, hasCharset, hasFavicon, langAttribute: langAttr },
          issues,
          aiInsights,
          aiRecommendations,
        };

        const { eq: eqSeo } = await import("drizzle-orm");
        await db!.update(seoAudits).set({ status: "done", score, report }).where(eqSeo(seoAudits.id, id));
        return { id, score, report };
      }),

    getAudits: appUserProcedure
      .input(z.object({ profileId: z.string() }))
      .query(async ({ input }) => {
        const { getDb: getDb2 } = await import("./db");
        const { seoAudits } = await import("../drizzle/schema");
        const { eq: eqSeo2, desc: descSeo } = await import("drizzle-orm");
        const db2 = await getDb2();
        const rows = await db2!.select().from(seoAudits).where(eqSeo2(seoAudits.profileId, input.profileId)).orderBy(descSeo(seoAudits.createdAt)).limit(10);
        return rows;
      }),

    deleteAudit: appUserProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const { getDb: getDb3 } = await import("./db");
        const { seoAudits } = await import("../drizzle/schema");
        const { eq: eqSeo3 } = await import("drizzle-orm");
        const db3 = await getDb3();
        await db3!.delete(seoAudits).where(eqSeo3(seoAudits.id, input.id));
        return { ok: true };
      }),
  }),

  // ─── HeyGen Videókészítő ──────────────────────────────────────────────────────────────────────
  heygen: router({
    // Check if HeyGen is enabled (API key configured)
    isEnabled: appUserProcedure
      .query(async ({ ctx }) => {
        const { isHeygenEnabled } = await import("./_core/heygen");
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const hasAccess = ["pro", "agency"].includes(plan) || ctx.appUser.role === "super_admin";
        return { enabled: isHeygenEnabled(), hasAccess };
      }),

    // List available avatars
    listAvatars: appUserProcedure
      .query(async ({ ctx }) => {
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const hasAccess = ["pro", "agency"].includes(plan) || ctx.appUser.role === "super_admin";
        if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "A videókészítő csak Pro és Agency csomagban elérhető" });
        const { isHeygenEnabled, listAvatars } = await import("./_core/heygen");
        if (!isHeygenEnabled()) return { avatars: [] };
        const avatars = await listAvatars();
        return { avatars };
      }),

    // List available voices
    listVoices: appUserProcedure
      .input(z.object({ language: z.string().optional().default("hu") }))
      .query(async ({ ctx, input }) => {
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const hasAccess = ["pro", "agency"].includes(plan) || ctx.appUser.role === "super_admin";
        if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "A videókészítő csak Pro és Agency csomagban elérhető" });
        const { isHeygenEnabled, listVoices } = await import("./_core/heygen");
        if (!isHeygenEnabled()) return { voices: [] };
        const voices = await listVoices(input.language);
        return { voices };
      }),

    // Create a new video
    createVideo: appUserProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        script: z.string().min(10).max(5000),
        avatarId: z.string(),
        voiceId: z.string(),
        profileId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const hasAccess = ["pro", "agency"].includes(plan) || ctx.appUser.role === "super_admin";
        if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "A videókészítő csak Pro és Agency csomagban elérhető" });

        // Check monthly quota (5 videos/month for pro, unlimited for agency/super_admin)
        const { heygenVideos } = await import("../drizzle/schema");
        const { eq: eqHG, and: andHG, gte: gteHG } = await import("drizzle-orm");
        const { getDb: getDbHG } = await import("./db");
        const db = await getDbHG();
        if (plan === "pro") {
          const monthStart = new Date();
          monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
          const monthVideos = await db!.select().from(heygenVideos)
            .where(andHG(eqHG(heygenVideos.userId, ctx.appUser.id), gteHG(heygenVideos.createdAt, monthStart)));
          if (monthVideos.length >= 5) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Elérted a havi 5 videós keretet. Agency csomagra váltva korlátlan videót készíthetsz." });
          }
        }

        const { isHeygenEnabled, createVideo } = await import("./_core/heygen");
        const videoId = nanoid();
        const { getDb: getDbHG2 } = await import("./db");
        const db2 = await getDbHG2();

        if (!isHeygenEnabled()) {
          // Demo mode: save record without calling HeyGen
          await db2!.insert(heygenVideos).values({
            id: videoId,
            userId: ctx.appUser.id,
            profileId: input.profileId ?? null,
            heygenVideoId: null,
            title: input.title,
            script: input.script,
            avatarId: input.avatarId,
            voiceId: input.voiceId,
            status: "pending",
            videoUrl: null,
            thumbnailUrl: null,
          });
          return { id: videoId, status: "pending", demoMode: true };
        }

        const result = await createVideo({
          title: input.title,
          script: input.script,
          avatarId: input.avatarId,
          voiceId: input.voiceId,
        });

        await db2!.insert(heygenVideos).values({
          id: videoId,
          userId: ctx.appUser.id,
          profileId: input.profileId ?? null,
          heygenVideoId: result.videoId,
          title: input.title,
          script: input.script,
          avatarId: input.avatarId,
          voiceId: input.voiceId,
          status: "processing",
          videoUrl: null,
          thumbnailUrl: null,
        });

        return { id: videoId, heygenVideoId: result.videoId, status: "processing", demoMode: false };
      }),

    // Poll video status
    getStatus: appUserProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const { heygenVideos } = await import("../drizzle/schema");
        const { eq: eqHG } = await import("drizzle-orm");
        const { getDb: getDbHG3 } = await import("./db");
        const db = await getDbHG3();
        const rows = await db!.select().from(heygenVideos).where(eqHG(heygenVideos.id, input.id)).limit(1);
        if (!rows[0] || rows[0].userId !== ctx.appUser.id) throw new TRPCError({ code: "NOT_FOUND" });
        const video = rows[0];

        // If still processing and we have a heygenVideoId, poll the API
        if (video.status === "processing" && video.heygenVideoId) {
          const { isHeygenEnabled, getVideoStatus } = await import("./_core/heygen");
          if (isHeygenEnabled()) {
            try {
              const s = await getVideoStatus(video.heygenVideoId);
              if (s.status !== video.status || s.videoUrl) {
                await db!.update(heygenVideos).set({
                  status: s.status,
                  videoUrl: s.videoUrl ?? null,
                  thumbnailUrl: s.thumbnailUrl ?? null,
                  durationSeconds: s.durationSeconds ?? null,
                  errorMessage: s.error ?? null,
                }).where(eqHG(heygenVideos.id, input.id));
                return { ...video, ...s };
              }
            } catch { /* ignore polling errors */ }
          }
        }
        return video;
      }),

    // List user's videos
    list: appUserProcedure
      .query(async ({ ctx }) => {
        const { heygenVideos } = await import("../drizzle/schema");
        const { eq: eqHG, desc: descHG } = await import("drizzle-orm");
        const { getDb: getDbHG4 } = await import("./db");
        const db = await getDbHG4();
        const videos = await db!.select().from(heygenVideos)
          .where(eqHG(heygenVideos.userId, ctx.appUser.id))
          .orderBy(descHG(heygenVideos.createdAt))
          .limit(50);
        return { videos };
      }),

    // Monthly quota status
    quotaStatus: appUserProcedure
      .query(async ({ ctx }) => {
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        if (ctx.appUser.role === "super_admin" || plan === "agency") {
          return { used: 0, limit: -1, unlimited: true, remaining: Infinity, noAccess: false };
        }
        if (plan !== "pro") {
          return { used: 0, limit: 0, unlimited: false, remaining: 0, noAccess: true };
        }
        const { heygenVideos } = await import("../drizzle/schema");
        const { eq: eqHG, and: andHG, gte: gteHG } = await import("drizzle-orm");
        const { getDb: getDbHG5 } = await import("./db");
        const db = await getDbHG5();
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const monthVideos = await db!.select().from(heygenVideos)
          .where(andHG(eqHG(heygenVideos.userId, ctx.appUser.id), gteHG(heygenVideos.createdAt, monthStart)));
        const used = monthVideos.length;
        const limit = 5;
        return { used, limit, unlimited: false, remaining: Math.max(0, limit - used), noAccess: false };
      }),
  }),

  // ─── AI Usage Status ─────────────────────────────────────────────────────────────────────────────
  aiUsage: router({
    status: appUserProcedure
      .query(async ({ ctx }) => {
        // Super admins always have unlimited AI access
        if (ctx.appUser.role === "super_admin") {
          return { plan: "super_admin", used: 0, limit: -1, unlimited: true, remaining: Infinity };
        }
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const { AI_PLAN_LIMITS, getMonthlyAiUsageCount, getCurrentMonth } = await import("./authDb");
        const limit = AI_PLAN_LIMITS[plan] ?? 3;
        const used = limit === -1 ? 0 : await getMonthlyAiUsageCount(ctx.appUser.id, getCurrentMonth());
        return {
          plan,
          used,
          limit,
          unlimited: limit === -1,
          remaining: limit === -1 ? Infinity : Math.max(0, limit - used),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
