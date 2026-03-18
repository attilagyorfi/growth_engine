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
} from "./db";

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
