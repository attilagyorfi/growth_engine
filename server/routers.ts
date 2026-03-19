import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateImage } from "./_core/imageGeneration";
import { sendEmail, verifyEmailConfig, type EmailConfig } from "./emailSender";
import { nanoid } from "nanoid";
import {
  getAllProfiles, getProfileById, upsertProfile, deleteProfile,
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
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,

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
    list: publicProcedure.query(() => getAllProfiles()),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => getProfileById(input.id)),

    upsert: publicProcedure
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
      .mutation(({ input }) => {
        const id = input.id ?? nanoid();
        return upsertProfile({ ...input, id });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteProfile(input.id)),
  }),

  // ─── Leads ──────────────────────────────────────────────────────────────────
  leads: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getLeadsByProfile(input.profileId)),

    create: publicProcedure
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
      .mutation(({ input }) => createLead({ ...input, id: nanoid(), status: "new" })),

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteLead(input.id)),
  }),

  // ─── Outbound Emails ────────────────────────────────────────────────────────
  outbound: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getOutboundByProfile(input.profileId)),

    create: publicProcedure
      .input(z.object({
        profileId: z.string(),
        leadId: z.string().optional(),
        to: z.string().email(),
        toName: z.string().optional(),
        company: z.string().optional(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(({ input }) => createOutbound({ ...input, id: nanoid(), status: "draft" })),

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteOutbound(input.id)),
  }),

  // ─── Inbound Emails ─────────────────────────────────────────────────────────
  inbound: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getInboundByProfile(input.profileId)),

    create: publicProcedure
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
      .mutation(({ input }) => createInbound({ ...input, id: nanoid() })),

    markRead: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => markInboundRead(input.id)),

    updateCategory: publicProcedure
      .input(z.object({
        id: z.string(),
        category: z.enum(["interested", "not_interested", "question", "meeting_request", "out_of_office", "unsubscribe", "other"]),
      }))
      .mutation(({ input }) => updateInboundCategory(input.id, input.category)),
  }),

  // ─── Content Posts ──────────────────────────────────────────────────────────
  content: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getContentByProfile(input.profileId)),

    create: publicProcedure
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
      .mutation(({ input }) => createContent({ ...input, id: nanoid(), status: "draft" })),

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteContent(input.id)),
  }),

  // ─── Strategies ─────────────────────────────────────────────────────────────
  strategies: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getStrategiesByProfile(input.profileId)),

    create: publicProcedure
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
      .mutation(({ input }) => createStrategy({ ...input, id: nanoid(), status: "draft" })),

    update: publicProcedure
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
    get: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getEmailIntegration(input.profileId)),

    upsert: publicProcedure
      .input(z.object({
        profileId: z.string(),
        provider: z.enum(["gmail", "outlook"]),
        email: z.string().email(),
        connected: z.boolean().optional(),
      }))
      .mutation(({ input }) => upsertEmailIntegration({ ...input, connected: input.connected ?? false })),
  }),

  // ─── Email Sending ────────────────────────────────────────────────────────────
  emailSend: router({
    send: publicProcedure
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

    verify: publicProcedure
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
    getSession: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getOnboardingSession(input.profileId)),

    upsertSession: publicProcedure
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

    saveAnswers: publicProcedure
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

    getAnswers: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ input }) => getOnboardingAnswers(input.sessionId)),

    scrapeWebsite: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const prompt = `You are a marketing analyst. Analyze the website at ${input.url} and extract the following information in JSON format:
{
  "services": ["list of main services/products"],
  "keyMessages": ["list of key marketing messages"],
  "toneOfVoice": "description of the tone of voice",
  "targetAudience": "description of the target audience",
  "ctas": ["list of calls to action found"],
  "competitorCandidates": ["list of likely competitor types or names if mentioned"],
  "companySummary": "2-3 sentence summary of the company"
}
Based on the URL and domain name, make educated inferences about the business. Return only valid JSON.`;
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a marketing analyst that extracts structured data from website descriptions. Always return valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_schema", json_schema: { name: "website_analysis", strict: true, schema: { type: "object", properties: { services: { type: "array", items: { type: "string" } }, keyMessages: { type: "array", items: { type: "string" } }, toneOfVoice: { type: "string" }, targetAudience: { type: "string" }, ctas: { type: "array", items: { type: "string" } }, competitorCandidates: { type: "array", items: { type: "string" } }, companySummary: { type: "string" } }, required: ["services", "keyMessages", "toneOfVoice", "targetAudience", "ctas", "competitorCandidates", "companySummary"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    uploadAsset: publicProcedure
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
        // Parse content with LLM asynchronously
        invokeLLM({
          messages: [
            { role: "system", content: "You are a brand analyst. Extract key brand information from the uploaded document and return a structured summary." },
            { role: "user", content: `Parse this ${input.assetType} document (${input.fileName}) and extract: brand values, tone of voice, key messages, target audience, visual guidelines, and any other relevant marketing information. Return as a structured text summary.` },
          ],
        }).then(async (res) => {
          const parsed = res.choices[0]?.message?.content;
          if (parsed && asset?.id) {
            await updateBrandAssetParsed(asset.id, typeof parsed === "string" ? parsed : JSON.stringify(parsed));
          }
        }).catch(console.error);
        return asset;
      }),

    getBrandAssets: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getBrandAssets(input.profileId)),

    deleteBrandAsset: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => deleteBrandAsset(input.id)),
  }),

  // ─── Company Intelligence ────────────────────────────────────────────────────
  intelligence: router({
    get: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getCompanyIntelligence(input.profileId)),

    generate: publicProcedure
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
      .mutation(async ({ input }) => {
        const context = JSON.stringify({
          company: input.profileData,
          websiteAnalysis: input.websiteAnalysis,
          onboardingAnswers: input.onboardingAnswers,
        });
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a senior marketing strategist. Generate a comprehensive company intelligence profile based on the provided data. Return valid JSON only." },
            { role: "user", content: `Generate a complete company intelligence profile for this business:\n${context}\n\nReturn JSON with: companySummary, brandDna (coreValues[], personality[], differentiators[], brandPromise), offerMap (array of {name, description, targetAudience, usp}), audienceMap (array of {segment, description, painPoints[], goals[], channels[]}), competitorSnapshot (array of {name, strengths[], weaknesses[], positioning}), platformPriorities (array of {platform, priority 1-5, rationale}), successGoals ({thirtyDay[], ninetyDay[], oneYear[]}), aiWritingRules ({doList[], dontList[], toneGuidelines, examplePhrases[]})` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "company_intelligence", strict: true, schema: { type: "object", properties: { companySummary: { type: "string" }, brandDna: { type: "object", properties: { coreValues: { type: "array", items: { type: "string" } }, personality: { type: "array", items: { type: "string" } }, differentiators: { type: "array", items: { type: "string" } }, brandPromise: { type: "string" } }, required: ["coreValues", "personality", "differentiators", "brandPromise"], additionalProperties: false }, offerMap: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, targetAudience: { type: "string" }, usp: { type: "string" } }, required: ["name", "description", "targetAudience", "usp"], additionalProperties: false } }, audienceMap: { type: "array", items: { type: "object", properties: { segment: { type: "string" }, description: { type: "string" }, painPoints: { type: "array", items: { type: "string" } }, goals: { type: "array", items: { type: "string" } }, channels: { type: "array", items: { type: "string" } } }, required: ["segment", "description", "painPoints", "goals", "channels"], additionalProperties: false } }, competitorSnapshot: { type: "array", items: { type: "object", properties: { name: { type: "string" }, strengths: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, positioning: { type: "string" } }, required: ["name", "strengths", "weaknesses", "positioning"], additionalProperties: false } }, platformPriorities: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, priority: { type: "number" }, rationale: { type: "string" } }, required: ["platform", "priority", "rationale"], additionalProperties: false } }, successGoals: { type: "object", properties: { thirtyDay: { type: "array", items: { type: "string" } }, ninetyDay: { type: "array", items: { type: "string" } }, oneYear: { type: "array", items: { type: "string" } } }, required: ["thirtyDay", "ninetyDay", "oneYear"], additionalProperties: false }, aiWritingRules: { type: "object", properties: { doList: { type: "array", items: { type: "string" } }, dontList: { type: "array", items: { type: "string" } }, toneGuidelines: { type: "string" }, examplePhrases: { type: "array", items: { type: "string" } } }, required: ["doList", "dontList", "toneGuidelines", "examplePhrases"], additionalProperties: false } }, required: ["companySummary", "brandDna", "offerMap", "audienceMap", "competitorSnapshot", "platformPriorities", "successGoals", "aiWritingRules"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return upsertCompanyIntelligence({
          id: nanoid(),
          profileId: input.profileId,
          ...parsed,
          generatedAt: new Date(),
        });
      }),

    generateWowMoment: publicProcedure
      .input(z.object({
        profileId: z.string(),
        intelligenceData: z.any(),
      }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a senior marketing strategist. Generate actionable insights and quick wins for a business. Return valid JSON only." },
            { role: "user", content: `Based on this company intelligence data:\n${JSON.stringify(input.intelligenceData)}\n\nGenerate the WOW moment output with: companySummary (2-3 sentences), topStrengths (exactly 3 strings), topRisks (exactly 3 strings), ninetyDayStrategyOutline (3-4 sentences), contentPillars (exactly 5 objects with {name, description, percentage}), contentIdeas (exactly 10 objects with {title, platform, format, pillar}), quickWins (exactly 3 objects with {title, description, impact: high/medium/low, effort: high/medium/low})` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "wow_moment", strict: true, schema: { type: "object", properties: { companySummary: { type: "string" }, topStrengths: { type: "array", items: { type: "string" } }, topRisks: { type: "array", items: { type: "string" } }, ninetyDayStrategyOutline: { type: "string" }, contentPillars: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, percentage: { type: "number" } }, required: ["name", "description", "percentage"], additionalProperties: false } }, contentIdeas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, platform: { type: "string" }, format: { type: "string" }, pillar: { type: "string" } }, required: ["title", "platform", "format", "pillar"], additionalProperties: false } }, quickWins: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, impact: { type: "string" }, effort: { type: "string" } }, required: ["title", "description", "impact", "effort"], additionalProperties: false } } }, required: ["companySummary", "topStrengths", "topRisks", "ninetyDayStrategyOutline", "contentPillars", "contentIdeas", "quickWins"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    upsert: publicProcedure
      .input(z.object({ profileId: z.string(), data: z.any() }))
      .mutation(({ input }) => upsertCompanyIntelligence({ id: nanoid(), profileId: input.profileId, ...input.data })),

    getCompetitors: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getCompetitors(input.profileId)),

    getPersonas: publicProcedure
      .input(z.object({ profileId: z.string() }))
      .query(({ input }) => getPersonas(input.profileId)),
  }),

  // ─── AI Writing Engine ───────────────────────────────────────────────────────
  aiWrite: router({
    generateEmailDraft: publicProcedure
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
            { role: "system", content: `You are an expert B2B sales email copywriter. Write personalized, concise outbound emails that get responses. ${brandContext}` },
            { role: "user", content: `Write a cold outreach email to ${input.leadData.contact} at ${input.leadData.company} (industry: ${input.leadData.industry ?? "unknown"}).\nGoal: ${input.emailGoal ?? "introduce our services and get a meeting"}.\n${input.previousContext ? `Context: ${input.previousContext}` : ""}\n\nReturn JSON with: subject (string), body (string, 3-4 paragraphs max), previewText (string, 1 sentence)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "email_draft", strict: true, schema: { type: "object", properties: { subject: { type: "string" }, body: { type: "string" }, previewText: { type: "string" } }, required: ["subject", "body", "previewText"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),

    generateSocialPost: publicProcedure
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
          linkedin: "Professional tone, 150-300 words, include 3-5 relevant hashtags, end with a question or CTA",
          facebook: "Conversational, 100-200 words, engaging hook, 2-3 hashtags",
          instagram: "Visual-first, 80-150 words, 5-10 hashtags, emoji use encouraged",
          twitter: "Concise, max 280 characters, 1-2 hashtags, punchy",
          tiktok: "Trendy, casual, 50-100 words caption, 3-5 trending hashtags",
        };
        const brandContext = input.brandVoice
          ? `Brand voice: ${input.brandVoice.tone ?? "professional"}, Style: ${input.brandVoice.style ?? "direct"}`
          : "";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: `You are a social media content expert. Create engaging posts optimized for each platform. ${brandContext}` },
            { role: "user", content: `Create a ${input.platform} post about: "${input.topic}" for the content pillar: "${input.pillar}".\nTarget audience: ${input.targetAudience ?? "business professionals"}.\nFormat: ${input.format ?? "standard post"}.\nCTA: ${input.cta ?? "engage with the content"}.\nPlatform guidelines: ${platformGuide[input.platform]}.\n\nReturn JSON with: caption (string), hashtags (array of strings), visualBrief (string describing ideal image/video), ctaText (string)` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "social_post", strict: true, schema: { type: "object", properties: { caption: { type: "string" }, hashtags: { type: "array", items: { type: "string" } }, visualBrief: { type: "string" }, ctaText: { type: "string" } }, required: ["caption", "hashtags", "visualBrief", "ctaText"], additionalProperties: false } } },
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      }),
  }),

  // ─── Audit Logs ──────────────────────────────────────────────────────────────
  auditLog: router({
    list: publicProcedure
      .input(z.object({ profileId: z.string().optional(), limit: z.number().optional() }))
      .query(({ input }) => getAuditLogs(input.profileId, input.limit ?? 50)),

    create: publicProcedure
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

  // ─── AI ─────────────────────────────────────────────────────────────────────
  ai: router({
    generateImage: publicProcedure
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
  }),
});

export type AppRouter = typeof appRouter;
