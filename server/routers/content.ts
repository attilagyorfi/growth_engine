/**
 * G2A Growth Engine – Content router
 *
 * Content posts CRUD, havi tartalomterv AI generálás, és approval workflow
 * (submitForReview, approvePost, rejectPost, schedulePost, markPublished,
 * bulkUpdateStatus).
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor során.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { appUserProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { assertProfileOwnership } from "../_core/ownership";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import {
  getContentByProfile, createContent, updateContent, deleteContent,
} from "../db";

export const contentRouter = router({
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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
      const { contentPosts } = await import("../../drizzle/schema");
      const { getDb } = await import("../db");
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

});
