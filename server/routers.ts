import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, appUserProcedure, superAdminProcedure, router } from "./_core/trpc";
import { appAuthRouter } from "./routers/appAuth";
import { onboardingRouter } from "./routers/onboarding";
import { contentRouter } from "./routers/content";
import { heygenRouter } from "./routers/heygen";
import { strategyVersionsRouter } from "./routers/strategyVersions";
import { socialRouter } from "./routers/social";
import { projectsRouter } from "./routers/projects";
import { seoRouter } from "./routers/seo";
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
  getStrategyTasks, upsertStrategyTask, getStrategyTaskById, updateStrategyTaskStatus,
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
import Stripe from "stripe";
import {
  getProjectsByOwner, getProjectById, upsertProject, setActiveProject, deleteProject, getActiveProjectByOwner,
  archiveProject, restoreProject, getArchivedProjectsByOwner,
  getSocialProfileCache, upsertSocialProfileCache, getSocialProfilesByProfile,
} from "./projectsDb";

// Profile ownership helper moved to ./_core/ownership for cross-router reuse
import { assertProfileOwnership } from "./_core/ownership";

// ─── Stripe client (singleton) ───────────────────────────────────────────────────────────────────────────────────────
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" })
  : null;

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
  content: contentRouter,

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
  onboarding: onboardingRouter,

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
  strategyVersions: strategyVersionsRouter,

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
            { role: "system", content: `Te egy tapasztalt közösségi média tartalomkészítő vagy. KIZÁRÓLAG MAGYARUL írj. A mai dátum: ${currentDateStr}. Adj vissza JSON-t a következő mezőkkel: title (rövid, figyelemfelkeltő cím), content (teljes poszt szöveg a platformnak megfelelő stílusban, max 280 karakter Twitter/TikTok esetén, max 3000 LinkedIn esetén), hashtags (string tömb, max 8 hashtag), imagePrompt (angol nyelvű képgenerálási prompt, részletes, vizuálisan leíró), visualBrief (vizuális brief: mit ábrázoljon a kép/videó, milyen stílusban, milyen elemekkel – magyarul), ctaText (cselekvésre szólítás szövege a poszthoz – rövid, konkrét, magyarul).` },
            { role: "user", content: `Cég: ${input.companyName ?? "ismeretlen"}\nIparág: ${input.industry ?? "általános"}\nPlatform: ${input.platform}\nTartalom típusa: ${input.contentType}\nTartalmi pillér: ${input.pillar ?? "általános"}\nHang/Tone: ${input.tone ?? "professzionális, barátságos"}\n${input.intelligenceSummary ? `Cég összefoglaló: ${input.intelligenceSummary}` : ""}\n${input.strategyContext ? `Stratégiai kontextus: ${input.strategyContext}` : ""}\n${input.additionalContext ? `Kiegészítő instrukciók: ${input.additionalContext}` : ""}\n\nGenerálj egy ${input.platform} posztot.` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "post_content", strict: true, schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, imagePrompt: { type: "string" }, visualBrief: { type: "string" }, ctaText: { type: "string" } }, required: ["title", "content", "hashtags", "imagePrompt", "visualBrief", "ctaText"], additionalProperties: false } } },
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
  social: socialRouter,

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
  projects: projectsRouter,

  // ─── SEO Audit ──────────────────────────────────────────────────────────────
  seo: seoRouter,

  // ─── HeyGen Videókészítő ──────────────────────────────────────────────────────────────────────
  heygen: heygenRouter,

  // ─── AI Usage Status ─────────────────────────────────────────────────────────────────────────────
  aiUsage: router({
    status: appUserProcedure
      .query(async ({ ctx }) => {
        // Super admins always have unlimited AI access
        if (ctx.appUser.role === "super_admin") {
          return {
            plan: "super_admin",
            used: 0,
            limit: -1,
            unlimited: true,
            remaining: Infinity,
            warning: false,
            breakdown: null as null,
            featureLimits: null as null,
          };
        }
        const plan = ctx.appUser.subscriptionPlan ?? "free";
        const {
          AI_PLAN_TOTAL_LIMITS,
          AI_PLAN_LIMITS,
          getMonthlyAiUsageCount,
          getMonthlyUsageBreakdown,
          getCurrentMonth,
        } = await import("./authDb");
        const totalLimit = AI_PLAN_TOTAL_LIMITS[plan] ?? 17;
        const used = await getMonthlyAiUsageCount(ctx.appUser.id, getCurrentMonth());
        const breakdown = await getMonthlyUsageBreakdown(ctx.appUser.id, getCurrentMonth());
        const featureLimits = AI_PLAN_LIMITS[plan] ?? AI_PLAN_LIMITS.free;
        const warning = used >= Math.floor(totalLimit * 0.8);
        return {
          plan,
          used,
          limit: totalLimit,
          unlimited: false,
          remaining: Math.max(0, totalLimit - used),
          warning,
          breakdown,
          featureLimits,
        };
      }),
  }),

  // ─── Stripe ───────────────────────────────────────────────────────────────────────────────────────
  stripe: router({
    createCheckout: appUserProcedure
      .input(z.object({
        planId: z.enum(["starter", "pro", "agency"]),
        billing: z.enum(["monthly", "yearly"]).default("monthly"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!stripeClient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe nincs konfigurálva" });
        const { PLAN_DETAILS } = await import("./stripe/products");
        const plan = PLAN_DETAILS[input.planId];
        const amount = input.billing === "yearly" ? plan.yearlyPriceHuf : plan.monthlyPriceHuf;
        const origin = ctx.req.headers.origin as string || "https://g2a-growth-engine.manus.space";
        const session = await stripeClient.checkout.sessions.create({
          mode: input.billing === "yearly" ? "payment" : "subscription",
          allow_promotion_codes: true,
          customer_email: ctx.appUser.email,
          client_reference_id: ctx.appUser.id,
          metadata: {
            user_id: ctx.appUser.id,
            plan_id: input.planId,
            billing: input.billing,
            customer_email: ctx.appUser.email,
            customer_name: ctx.appUser.name ?? "",
          },
          line_items: [{
            price_data: {
              currency: "huf",
              unit_amount: amount,
              product_data: { name: plan.name, description: plan.description },
              ...(input.billing === "monthly" ? { recurring: { interval: "month" } } : {}),
            },
            quantity: 1,
          }],
          success_url: `${origin}/beallitasok?tab=billing&checkout=success`,
          cancel_url: `${origin}/beallitasok?tab=billing&checkout=cancelled`,
        });
        return { url: session.url };
      }),

    getPortalUrl: appUserProcedure
      .mutation(async ({ ctx }) => {
        if (!stripeClient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe nincs konfigurálva" });
        if (!ctx.appUser.stripeCustomerId) throw new TRPCError({ code: "NOT_FOUND", message: "Nincs Stripe előfizetés" });
        const origin = ctx.req.headers.origin as string || "https://g2a-growth-engine.manus.space";
        const session = await stripeClient.billingPortal.sessions.create({
          customer: ctx.appUser.stripeCustomerId,
          return_url: `${origin}/beallitasok?tab=billing`,
        });
        return { url: session.url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
