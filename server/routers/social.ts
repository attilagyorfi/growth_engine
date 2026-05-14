/**
 * G2A Growth Engine – Social media router
 *
 * Social fiók kapcsolatok kezelése (listConnections, saveConnection, disconnect),
 * publikálás (publishNow, schedulePost, listScheduled), LinkedIn OAuth URL
 * előállítás.
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor 2. körében.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { publicProcedure, appUserProcedure, router } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";

export const socialRouter = router({
  listConnections: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const { getDb } = await import("../db");
      const { socialConnections } = await import("../../drizzle/schema");
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
      const { getDb } = await import("../db");
      const { socialConnections } = await import("../../drizzle/schema");
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
      const { getDb } = await import("../db");
      const { socialConnections } = await import("../../drizzle/schema");
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
      const { getDb } = await import("../db");
      const { socialConnections: scTable, scheduledPosts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
      const [conn] = await db.select().from(scTable).where(eq(scTable.id, input.connectionId)).limit(1);
      if (!conn || !conn.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Social fiók nem található vagy inaktív" });
      const { publishToLinkedIn } = await import("../socialPublisher");
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
      const { getDb } = await import("../db");
      const { scheduledPosts } = await import("../../drizzle/schema");
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
      const { getDb } = await import("../db");
      const { scheduledPosts } = await import("../../drizzle/schema");
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
});
