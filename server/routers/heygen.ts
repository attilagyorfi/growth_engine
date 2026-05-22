/**
 * G2A Growth Engine – HeyGen video router
 *
 * Avatar/voice listák, videó létrehozás, polling, lista, kvóta státusz.
 * Plan gate: Pro és Agency csomag (plus super_admin).
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor során.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { appUserProcedure, router } from "../_core/trpc";

export const heygenRouter = router({
  // Check if HeyGen is enabled (API key configured)
  isEnabled: appUserProcedure
    .query(async ({ ctx }) => {
      const { isHeygenEnabled } = await import("../_core/heygen");
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
      const { isHeygenEnabled, listAvatars } = await import("../_core/heygen");
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
      const { isHeygenEnabled, listVoices } = await import("../_core/heygen");
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
      const { heygenVideos } = await import("../../drizzle/schema");
      const { eq: eqHG, and: andHG, gte: gteHG } = await import("drizzle-orm");
      const { getDb: getDbHG } = await import("../db");
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

      const { isHeygenEnabled, createVideo } = await import("../_core/heygen");
      const videoId = nanoid();
      const { getDb: getDbHG2 } = await import("../db");
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
      const { heygenVideos } = await import("../../drizzle/schema");
      const { eq: eqHG } = await import("drizzle-orm");
      const { getDb: getDbHG3 } = await import("../db");
      const db = await getDbHG3();
      const rows = await db!.select().from(heygenVideos).where(eqHG(heygenVideos.id, input.id)).limit(1);
      if (!rows[0] || rows[0].userId !== ctx.appUser.id) throw new TRPCError({ code: "NOT_FOUND" });
      const video = rows[0];

      // If still processing and we have a heygenVideoId, poll the API
      if (video.status === "processing" && video.heygenVideoId) {
        const { isHeygenEnabled, getVideoStatus } = await import("../_core/heygen");
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
      const { heygenVideos } = await import("../../drizzle/schema");
      const { eq: eqHG, desc: descHG } = await import("drizzle-orm");
      const { getDb: getDbHG4 } = await import("../db");
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
      const { heygenVideos } = await import("../../drizzle/schema");
      const { eq: eqHG, and: andHG, gte: gteHG } = await import("drizzle-orm");
      const { getDb: getDbHG5 } = await import("../db");
      const db = await getDbHG5();
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthVideos = await db!.select().from(heygenVideos)
        .where(andHG(eqHG(heygenVideos.userId, ctx.appUser.id), gteHG(heygenVideos.createdAt, monthStart)));
      const used = monthVideos.length;
      const limit = 5;
      return { used, limit, unlimited: false, remaining: Math.max(0, limit - used), noAccess: false };
    }),
});
