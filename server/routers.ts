import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, appUserProcedure, superAdminProcedure, router } from "./_core/trpc";
import { appAuthRouter } from "./routers/appAuth";
import { generateImage } from "./_core/imageGeneration";
import { sendEmail, verifyEmailConfig, type EmailConfig } from "./emailSender";
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
        const prompt = `Te egy marketing elemő vagy. Elemezd a következő weboldalt: ${input.url}. Az URL és domain név alapján határozott, tényközlő stílusban írj le mindent a vállalkozásról. TILOS feltételes megfogalmazást használni (pl. "valószínűleg", "feltehetőleg", "lehet", "talán", "közelíthetőleg"). Írj leíró tényeket, ne feltételezéseket. MINDEN szöveges választ KIZÁRÓLAG MAGYARUL adj meg. Adj vissza kizárólag érvényes JSON-t:
{
  "companyName": "a cég neve a domain alapján (pl. 'MM Ernöki Kft.' ha a domain mmernoki.hu)",
  "industry": "az iparág neve magyarul (pl. 'Mérnöki szolgáltatások', 'IT és szoftverfejlesztés', 'Marketing és reklm', stb.)",
  "services": ["fő szolgáltatások/termékek listája magyarul, határozott tényközlő stílusban"],
  "keyMessages": ["fő marketing üzenetek listája magyarul"],
  "toneOfVoice": "a kommunikációs stílus leírása magyarul",
  "targetAudience": "a célcsoport leírása magyarul, határozott tényközlő stílusban",
  "ctas": ["cselekvésre szólítások listája magyarul"],
  "competitorCandidates": ["versenytársak típusai vagy nevei magyarul"],
  "companySummary": "2-3 mondatos összefoglaló a cégről magyarul, határozott, tényközlő stílusban - soha ne használj feltételes szófordulátokat"
}`;
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy marketing elemző vagy, aki strukturált adatokat nyér ki weboldal leírásokból. MINDIG érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
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
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        // Feature gating: check AI usage limit
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free");
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frissítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
        }
        const context = JSON.stringify({
          company: input.profileData,
          websiteAnalysis: input.websiteAnalysis,
          onboardingAnswers: input.onboardingAnswers,
        });
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Te egy tapasztalt marketing stratéga vagy. Átfogó vállalati intelligencia profilt készítesz a megadott adatok alapján. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg – ez kötelező." },
            { role: "user", content: `Készíts teljes vállalati intelligencia profilt erről a vállalkozásról (MINDEN szöveg magyarul legyen):\n${context}\n\nAdj vissza JSON-t a következő mezőkkel: companySummary (cég összefoglalója magyarul), brandDna (coreValues[] - alapértékek magyarul, personality[] - márka személyisége magyarul, differentiators[] - megkülönböztető tényezők magyarul, brandPromise - márkaígéret magyarul), offerMap (tömb: {name, description, targetAudience, usp} - mind magyarul), audienceMap (tömb: {segment, description, painPoints[], goals[], channels[]} - mind magyarul), competitorSnapshot (tömb: {name, strengths[], weaknesses[], positioning} - mind magyarul), platformPriorities (tömb: {platform, priority 1-5, rationale} - rationale magyarul), successGoals ({thirtyDay[], ninetyDay[], oneYear[]} - mind magyarul), aiWritingRules ({doList[], dontList[], toneGuidelines, examplePhrases[]} - mind magyarul)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "company_intelligence", strict: true, schema: { type: "object", properties: { companySummary: { type: "string" }, brandDna: { type: "object", properties: { coreValues: { type: "array", items: { type: "string" } }, personality: { type: "array", items: { type: "string" } }, differentiators: { type: "array", items: { type: "string" } }, brandPromise: { type: "string" } }, required: ["coreValues", "personality", "differentiators", "brandPromise"], additionalProperties: false }, offerMap: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, targetAudience: { type: "string" }, usp: { type: "string" } }, required: ["name", "description", "targetAudience", "usp"], additionalProperties: false } }, audienceMap: { type: "array", items: { type: "object", properties: { segment: { type: "string" }, description: { type: "string" }, painPoints: { type: "array", items: { type: "string" } }, goals: { type: "array", items: { type: "string" } }, channels: { type: "array", items: { type: "string" } } }, required: ["segment", "description", "painPoints", "goals", "channels"], additionalProperties: false } }, competitorSnapshot: { type: "array", items: { type: "object", properties: { name: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, positioning: { type: "string" } }, required: ["name", "strengths", "weaknesses", "positioning"], additionalProperties: false } }, platformPriorities: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, priority: { type: "number" }, rationale: { type: "string" } }, required: ["platform", "priority", "rationale"], additionalProperties: false } }, successGoals: { type: "object", properties: { thirtyDay: { type: "array", items: { type: "string" } }, ninetyDay: { type: "array", items: { type: "string" } }, oneYear: { type: "array", items: { type: "string" } } }, required: ["thirtyDay", "ninetyDay", "oneYear"], additionalProperties: false }, aiWritingRules: { type: "object", properties: { doList: { type: "array", items: { type: "string" } }, dontList: { type: "array", items: { type: "string" } }, toneGuidelines: { type: "string" }, examplePhrases: { type: "array", items: { type: "string" } } }, required: ["doList", "dontList", "toneGuidelines", "examplePhrases"], additionalProperties: false } }, required: ["companySummary", "brandDna", "offerMap", "audienceMap", "competitorSnapshot", "platformPriorities", "successGoals", "aiWritingRules"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        // Record AI usage
        await recordAiUsage(ctx.appUser.id, "intelligence");
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
      }))
      .mutation(async ({ input, ctx }) => {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
        // Feature gating: check AI usage limit
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free");
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frítsítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
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
        // Record AI usage
        await recordAiUsage(ctx.appUser.id, "strategy");
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
        const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free");
        if (!usageCheck.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frítsítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
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
        await recordAiUsage(ctx.appUser.id, "content");
        return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      }),
  }),

  // ─── AI Usage Status ─────────────────────────────────────────────────────────
  aiUsage: router({
    status: appUserProcedure
      .query(async ({ ctx }) => {
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
