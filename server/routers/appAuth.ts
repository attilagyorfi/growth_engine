/**
 * G2A Growth Engine – App Auth Router
 * Saját email+jelszó alapú autentikáció tRPC routerei
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { router, publicProcedure, protectedProcedure, appUserProcedure } from "../_core/trpc";
import {
  createAppUser, getAppUserByEmail, getAppUserById,
  updateAppUser, updateLastSignedIn, updateAppUserOnboarding,
  createPasswordResetToken, getValidResetToken, markResetTokenUsed,
  getAllAppUsers,
} from "../authDb";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env";

const SUPER_ADMIN_EMAIL = "admin@g2a.hu"; // G2A super admin email
const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret);
const TOKEN_EXPIRY = "30d";

async function signToken(userId: string, role: string) {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyAppToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; role: string };
  } catch {
    return null;
  }
}

export const appAuthRouter = router({
  // ─── Regisztráció ────────────────────────────────────────────────────────────
  register: publicProcedure
    .input(z.object({
      email: z.string().email("Érvénytelen email cím"),
      password: z.string().min(8, "A jelszó legalább 8 karakter legyen"),
      name: z.string().min(1, "Add meg a neved").optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getAppUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ez az email cím már regisztrált" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const id = nanoid();
      const role = input.email.toLowerCase() === SUPER_ADMIN_EMAIL ? "super_admin" : "user";
      const user = await createAppUser({
        id,
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name ?? null,
        role,
        onboardingCompleted: false,
        profileId: null,
        active: true,
      });
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Regisztráció sikertelen" });
      const token = await signToken(user.id, user.role);
      ctx.res.setHeader("Set-Cookie", `app_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`);
      return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, onboardingCompleted: user.onboardingCompleted } };
    }),

  // ─── Bejelentkezés ───────────────────────────────────────────────────────────
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await getAppUserByEmail(input.email);
      if (!user || !user.active) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Hibás email cím vagy jelszó" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Hibás email cím vagy jelszó" });
      }
      await updateLastSignedIn(user.id);
      const token = await signToken(user.id, user.role);
      ctx.res.setHeader("Set-Cookie", `app_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax`);
      return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, onboardingCompleted: user.onboardingCompleted, profileId: user.profileId } };
    }),

  // ─── Kijelentkezés ───────────────────────────────────────────────────────────
  logout: publicProcedure
    .mutation(({ ctx }) => {
      ctx.res.setHeader("Set-Cookie", "app_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
      return { success: true };
    }),

  // ─── Aktuális felhasználó ────────────────────────────────────────────────────
  me: publicProcedure
    .query(async ({ ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) return null;
      const payload = await verifyAppToken(match[1]);
      if (!payload) return null;
      const user = await getAppUserById(payload.userId);
      if (!user || !user.active) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role, onboardingCompleted: user.onboardingCompleted, profileId: user.profileId };
    }),

  // ─── Onboarding befejezése ───────────────────────────────────────────────────
  completeOnboarding: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // ctx.appUser is guaranteed by appUserProcedure (works for both app_token and OAuth bridge)
      await updateAppUserOnboarding(ctx.appUser.id, input.profileId);
      return { success: true };
    }),

  // ─── Elfelejtett jelszó ──────────────────────────────────────────────────────
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getAppUserByEmail(input.email);
      // Always return success to prevent email enumeration
      if (!user) return { success: true };
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await createPasswordResetToken({ id: nanoid(), userId: user.id, token, expiresAt });
      // In production, send email. For now, log the token.
      console.log(`[Password Reset] Token for ${input.email}: ${token}`);
      return { success: true };
    }),

  // ─── Jelszó visszaállítása ───────────────────────────────────────────────────
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(8, "A jelszó legalább 8 karakter legyen"),
    }))
    .mutation(async ({ input }) => {
      const resetToken = await getValidResetToken(input.token);
      if (!resetToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Érvénytelen vagy lejárt token" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateAppUser(resetToken.userId, { passwordHash });
      await markResetTokenUsed(resetToken.id);
      return { success: true };
    }),

  // ─── Admin: Felhasználók listája ─────────────────────────────────────────────
  adminListUsers: publicProcedure
    .query(async ({ ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAppToken(match[1]);
      if (!payload || payload.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Csak adminok férhetnek hozzá" });
      }
      const users = await getAllAppUsers();
      return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        onboardingCompleted: u.onboardingCompleted,
        active: u.active,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
      }));
    }),

  // ─── Admin: Felhasználó frissítése ───────────────────────────────────────────
  adminUpdateUser: publicProcedure
    .input(z.object({
      userId: z.string(),
      name: z.string().optional(),
      active: z.boolean().optional(),
      role: z.enum(["super_admin", "user"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAppToken(match[1]);
      if (!payload || payload.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { userId, ...data } = input;
      return updateAppUser(userId, data);
    }),

  // ─── Admin: Jelszó reset ─────────────────────────────────────────────────────
  adminResetPassword: publicProcedure
    .input(z.object({
      userId: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAppToken(match[1]);
      if (!payload || payload.role !== "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateAppUser(input.userId, { passwordHash });
      return { success: true };
    }),
});
