/**
 * G2A Growth Engine – App Auth Router
 * Saját email+jelszó alapú autentikáció tRPC routerei
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { router, publicProcedure, protectedProcedure, appUserProcedure, superAdminProcedure } from "../_core/trpc";
import { sendPasswordResetEmail } from "../email";
import {
  createAppUser, getAppUserByEmail, getAppUserById,
  updateAppUser, updateLastSignedIn, updateAppUserOnboarding,
  createPasswordResetToken, getValidResetToken, markResetTokenUsed,
  getAllAppUsers,
} from "../authDb";
import { getProfilesByAppUser } from "../db";
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
      subscriptionPlan: z.enum(["free", "starter", "pro"]).optional().default("free"),
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
        subscriptionPlan: input.subscriptionPlan ?? "free",
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
      // 1. Ha az appUser már be van töltve a context-ben (OAuth bridge vagy app_token),
      //    közvetlenül visszaadjuk – ez kezeli az OAuth-on bejelentkezett felhasználókat is.
      if (ctx.appUser && ctx.appUser.active) {
        const u = ctx.appUser;
        return { id: u.id, email: u.email, name: u.name, role: u.role, onboardingCompleted: u.onboardingCompleted, profileId: u.profileId, subscriptionPlan: u.subscriptionPlan };
      }
      // 2. Fallback: közvetlen cookie ellenőrzés (ha a context nem töltötte be)
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) return null;
      const payload = await verifyAppToken(match[1]);
      if (!payload) return null;
      const user = await getAppUserById(payload.userId);
      if (!user || !user.active) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role, onboardingCompleted: user.onboardingCompleted, profileId: user.profileId, subscriptionPlan: user.subscriptionPlan };
    }),

  // ─── Saját profil frissítése (normál felhasználó) ─────────────────────────
  updateSelf: publicProcedure
    .input(z.object({
      name: z.string().min(1, "A név nem lehet üres").max(100).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_token=([^;]+)/);
      if (!match) throw new TRPCError({ code: "UNAUTHORIZED" });
      const payload = await verifyAppToken(match[1]);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });
      const updated = await updateAppUser(payload.userId, { name: input.name ?? null });
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Frissítés sikertelen" });
      return { success: true, name: updated.name };
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
      // Send password reset email via Resend
      // Use APP_URL env if set, otherwise derive from request Origin header (works in all environments)
      const appUrl = process.env.APP_URL || "https://g2a-growth-engine.manus.space";
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      const emailSent = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });
      if (!emailSent) {
        console.error(`[Password Reset] Email sending failed for ${input.email}`);
      } else {
        console.log(`[Password Reset] Email sent to ${input.email}`);
      }
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
  // ─── Admin: Felhasználók listája ──────────────────────────────────────────────────
  adminListUsers: superAdminProcedure
    .query(async () => {
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

  // ─── Admin: Felhasználó frissítése ──────────────────────────────────────────────────
  adminUpdateUser: superAdminProcedure
    .input(z.object({
      userId: z.string(),
      name: z.string().optional(),
      active: z.boolean().optional(),
      role: z.enum(["super_admin", "user"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      return updateAppUser(userId, data);
    }),

  // ─── Admin: CRM – Ügyfelek listája (csak nem-szenzitív adatok) ────────────────
  adminGetCRMClients: superAdminProcedure
    .query(async () => {
      const users = await getAllAppUsers();
      // Fetch profile data (website) for each user
      const usersWithProfiles = await Promise.all(
        users
          .filter(u => u.role !== "super_admin")
          .map(async (u) => {
            let website: string | null = null;
            let companyNameFromProfile: string | null = null;
            if (u.id) {
              const profiles = await getProfilesByAppUser(u.id);
              if (profiles.length > 0) {
                website = profiles[0].website ?? null;
                companyNameFromProfile = profiles[0].name ?? null;
              }
            }
            return {
              id: u.id,
              email: u.email,
              name: u.name,
              companyName: u.companyName ?? companyNameFromProfile ?? null,
              contactPerson: u.contactPerson ?? null,
              phone: u.phone ?? null,
              website,
              subscriptionPlan: u.subscriptionPlan,
              active: u.active,
              onboardingCompleted: u.onboardingCompleted,
              profileId: u.profileId ?? null,
              notes: u.notes ?? null,
              createdAt: u.createdAt,
              lastSignedIn: u.lastSignedIn ?? null,
            };
          })
      );
      return usersWithProfiles;
    }),

  // ─── Admin: CRM – Ügyfél frissítése (csak CRM mezők) ────────────────────────
  adminUpdateCRMClient: superAdminProcedure
    .input(z.object({
      userId: z.string(),
      companyName: z.string().optional(),
      contactPerson: z.string().optional(),
      phone: z.string().optional(),
      subscriptionPlan: z.enum(["free", "starter", "pro", "agency"]).optional(),
      notes: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      return updateAppUser(userId, data);
    }),

  // ─── Admin: Jelszó reset ─────────────────────────────────────────────────────
  adminResetPassword: superAdminProcedure
    .input(z.object({
      userId: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await updateAppUser(input.userId, { passwordHash });
      return { success: true };
    }),
});
