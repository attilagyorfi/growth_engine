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
import { invokeLLM, parseLLMJson } from "../_core/llm";
import { assertProfileOwnership } from "../_core/ownership";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import {
  getContentByProfile, getContentById, createContent, updateContent, deleteContent,
  createNotification, createAiMemory,
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
    .mutation(async ({ input, ctx }) => {
      const post = await getContentById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "A poszt nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
      // AUDIT FIX: státusz-átmenet őrök. A UI korábban a generic update-en át
      // közvetlenül "scheduled"/"published"-re állíthatott, kikerülve a
      // jóváhagyási sorrendet (a schedulePost őre csak azon az egy úton védett).
      // Most bármelyik úton kikényszerítjük a helyes átmenetet.
      if (input.status && input.status !== post.status) {
        if (input.status === "scheduled" && post.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyott poszt ütemezhető." });
        }
        if (input.status === "published" && post.status !== "scheduled" && post.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyott vagy ütemezett poszt publikálható." });
        }
      }
      const { id, ...updates } = input;
      // Jóváhagyáskor a bírálót is rögzítjük (konzisztens az approvePost-tal).
      const reviewFields = (input.status === "approved" && post.status !== "approved")
        ? { reviewedBy: ctx.appUser.id, reviewedAt: new Date() }
        : {};
      return updateContent(id, { ...updates, ...reviewFields });
    }),

  delete: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const post = await getContentById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "A poszt nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
      return deleteContent(input.id);
    }),

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
      const parsed = parseLLMJson(raw);
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

      await recordAiUsage(ctx.appUser.id, "contentPlan", ctx.appUser.role, input.isOnboarding);
      return { created: created.length, posts: created };
    }),
  // ─── Approval Workflow ──────────────────────────────────────────────────────
  submitForReview: appUserProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { contentPosts, clientProfiles, appUsers } = await import("../../drizzle/schema");
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

      // Email értesítés a profil tulajdonosának (non-fatal — nem blokkolja a state változást)
      try {
        const [profile] = await db.select().from(clientProfiles).where(eq(clientProfiles.id, post.profileId)).limit(1);
        if (profile?.appUserId) {
          // AUDIT FIX (#5 bekötés): in-app értesítés is — eddig a createNotification
          // sehol nem hívódott, így a csengő/Értesítések oldal örökké üres volt.
          await createNotification({
            id: nanoid(),
            appUserId: profile.appUserId,
            profileId: post.profileId,
            type: "approval_ready",
            title: "Tartalom jóváhagyásra vár",
            body: `„${post.title}" (${post.platform}) jóváhagyásra vár.`,
            actionUrl: `/tartalom-studio?postId=${post.id}`,
          });
          const [owner] = await db.select().from(appUsers).where(eq(appUsers.id, profile.appUserId)).limit(1);
          if (owner?.email) {
            const { sendPostReviewNotificationEmail } = await import("../email");
            const appUrl = process.env.APP_URL || "https://g2a-growth-engine.manus.space";
            const reviewUrl = `${appUrl}/content-studio?postId=${post.id}`;
            const sent = await sendPostReviewNotificationEmail({
              to: owner.email,
              name: owner.name,
              postTitle: post.title,
              postPlatform: post.platform,
              postPreview: post.content,
              reviewUrl,
            });
            if (!sent) console.error(`[Approval Email] Failed for post ${post.id}`);
            else console.log(`[Approval Email] Sent to ${owner.email} for post ${post.id}`);
          }
        }
      } catch (err) {
        // Email küldés bármilyen hibája nem akadályozhatja meg a state változást
        console.error("[Approval Email] Unexpected error:", err);
      }

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
      // AUDIT FIX (#5 bekötés): AI-memória írás — eddig a createAiMemory sehol nem
      // hívódott, így a "az AI tanul a döntéseidből" ígéret üres volt. A jóváhagyott
      // minta most bekerül (a Beállítások → AI Memória listában látszik, és az
      // ajánlás-generátor ebből tanul).
      try {
        await createAiMemory({
          profileId: post.profileId,
          memoryType: "approved_pattern",
          content: (post.content ?? "").slice(0, 600),
          context: post.title ?? undefined,
          platform: post.platform ?? undefined,
          pillar: post.pillar ?? undefined,
        });
      } catch (err) { console.error("[AI Memory] approve write failed (non-fatal):", err); }
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
      // AUDIT FIX (#5 bekötés): AI-memória írás — az elutasított minta (+ indok) is
      // bekerül, hogy az AI legközelebb elkerülje.
      try {
        await createAiMemory({
          profileId: post.profileId,
          memoryType: "rejected_pattern",
          content: (input.reason ? `Elutasítás indoka: ${input.reason}\n` : "") + `Elutasított tartalom: ${(post.content ?? "").slice(0, 500)}`,
          context: post.title ?? undefined,
          platform: post.platform ?? undefined,
          pillar: post.pillar ?? undefined,
        });
      } catch (err) { console.error("[AI Memory] reject write failed (non-fatal):", err); }
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
      // AUDIT FIX: eddig előfeltétel nélkül publikált (akár draftból). Most csak
      // jóváhagyott vagy ütemezett posztot enged publikálni.
      if (post.status !== "scheduled" && post.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyott vagy ütemezett poszt jelölhető publikáltnak." });
      }
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
