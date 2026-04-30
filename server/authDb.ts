/**
 * G2A Growth Engine – Auth DB Helpers
 * Saját email+jelszó alapú autentikáció adatbázis segédfüggvényei
 */
import { eq, and, gt, count } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, passwordResetTokens, aiUsage } from "../drizzle/schema";
import type { AppUser, InsertAppUser } from "../drizzle/schema";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ─── App Users ────────────────────────────────────────────────────────────────

export async function createAppUser(data: InsertAppUser): Promise<AppUser | undefined> {
  const db = await requireDb();
  await db.insert(appUsers).values(data);
  const rows = await db.select().from(appUsers).where(eq(appUsers.id, data.id));
  return rows[0];
}

export async function getAppUserByEmail(email: string): Promise<AppUser | null> {
  const db = await requireDb();
  const rows = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase()));
  return rows[0] ?? null;
}

export async function getAppUserById(id: string): Promise<AppUser | null> {
  const db = await requireDb();
  const rows = await db.select().from(appUsers).where(eq(appUsers.id, id));
  return rows[0] ?? null;
}

export async function getAllAppUsers(): Promise<AppUser[]> {
  const db = await requireDb();
  return db.select().from(appUsers).orderBy(appUsers.createdAt);
}

export async function updateAppUser(id: string, data: Partial<Omit<AppUser, "id" | "createdAt">>): Promise<AppUser | null> {
  const db = await requireDb();
  await db.update(appUsers).set({ ...data, updatedAt: new Date() }).where(eq(appUsers.id, id));
  return getAppUserById(id);
}

export async function updateAppUserOnboarding(id: string, profileId: string): Promise<void> {
  const db = await requireDb();
  await db.update(appUsers).set({
    onboardingCompleted: true,
    profileId,
    updatedAt: new Date(),
  }).where(eq(appUsers.id, id));
}

export async function updateLastSignedIn(id: string): Promise<void> {
  const db = await requireDb();
  await db.update(appUsers).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(appUsers.id, id));
}

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(data: { id: string; userId: string; token: string; expiresAt: Date }) {
  const db = await requireDb();
  await db.insert(passwordResetTokens).values(data);
  return data;
}

export async function getValidResetToken(token: string) {
  const db = await requireDb();
  const rows = await db.select().from(passwordResetTokens).where(
    and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expiresAt, new Date()),
    )
  );
  return rows[0] ?? null;
}

// ─── OAuth Bridge ────────────────────────────────────────────────────────────

/**
 * Find or create an appUser record for a Manus OAuth user.
 * Called automatically in context.ts when app_token is missing but ctx.user exists.
 * The g2amarketing admin email gets super_admin role automatically.
 */
export async function getOrCreateAppUserFromOAuth(oauthUser: {
  email: string;
  name: string | null;
  openId: string;
}): Promise<AppUser | null> {
  const db = await requireDb();
  // Try to find by email first
  const existing = await getAppUserByEmail(oauthUser.email);
  if (existing) {
    // Update lastSignedIn
    await db.update(appUsers)
      .set({ lastSignedIn: new Date(), updatedAt: new Date() })
      .where(eq(appUsers.id, existing.id));
    return existing;
  }
  // Create a new appUser for this OAuth user
  const { nanoid } = await import("nanoid");
  const id = nanoid();
  const SUPER_ADMIN_EMAILS = ["info@g2amarketing.hu", "admin@g2a.hu"];
  const role = SUPER_ADMIN_EMAILS.includes(oauthUser.email.toLowerCase()) ? "super_admin" : "user";
  await db.insert(appUsers).values({
    id,
    email: oauthUser.email.toLowerCase(),
    passwordHash: "", // No password for OAuth users
    name: oauthUser.name,
    role,
    onboardingCompleted: false,
    profileId: null,
    active: true,
  });
  const rows = await db.select().from(appUsers).where(eq(appUsers.id, id));
  return rows[0] ?? null;
}

export async function markResetTokenUsed(id: string): Promise<void> {
  const db = await requireDb();
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
}

// ─── AI Usage Tracking – Per-Feature Quota System ────────────────────────────

/**
 * Feature categories for AI usage tracking.
 * Each feature has its own monthly limit per plan.
 *
 * Cost reference (HUF, Gemini 2.5 Flash pricing):
 *   text (strategy/post/campaign): ~1–8 Ft/call
 *   image (HD generation):         ~14.8 Ft/call
 *   video (HeyGen 1 min):          ~366 Ft/call
 */
export type AiFeature =
  | "strategy"       // Stratégia generálás
  | "contentPlan"    // Havi tartalom terv (30 poszt)
  | "post"           // Egyedi poszt generálás
  | "campaign"       // Kampány brief generálás
  | "intelligence"   // Company Intelligence generálás
  | "dailyTasks"     // Napi feladatok generálás
  | "seo"            // SEO audit AI elemzés
  | "image"          // Képgenerálás (HD)
  | "video"          // HeyGen videó generálás
  | "other";         // Egyéb AI hívás

/**
 * Per-feature monthly limits per plan.
 * -1 = unlimited (not used in new system – all plans have finite limits)
 *
 * Pricing logic:
 *   Ingyenes:  csak kipróbálásra, nagyon szűk limitek
 *   Starter:   kis vállalkozás, havi normál használat
 *   Pro:       aktív marketing csapat, intenzív használat
 *   Agency:    ügynökség, több ügyfél, nagy volumen
 */
export interface FeatureLimits {
  strategy: number;
  contentPlan: number;
  post: number;
  campaign: number;
  intelligence: number;
  dailyTasks: number;
  seo: number;
  image: number;
  video: number;
  other: number;
}

export const AI_PLAN_LIMITS: Record<string, FeatureLimits> = {
  free: {
    strategy: 1,
    contentPlan: 1,
    post: 5,
    campaign: 1,
    intelligence: 1,
    dailyTasks: 5,
    seo: 1,
    image: 0,
    video: 0,
    other: 3,
  },
  starter: {
    strategy: 5,
    contentPlan: 2,
    post: 50,
    campaign: 3,
    intelligence: 3,
    dailyTasks: 30,
    seo: 3,
    image: 5,
    video: 0,
    other: 20,
  },
  pro: {
    strategy: 20,
    contentPlan: 6,
    post: 300,
    campaign: 15,
    intelligence: 10,
    dailyTasks: 90,
    seo: 10,
    image: 30,
    video: 5,
    other: 100,
  },
  agency: {
    strategy: 60,
    contentPlan: 20,
    post: 1000,
    campaign: 50,
    intelligence: 30,
    dailyTasks: 300,
    seo: 30,
    image: 100,
    video: 15,
    other: 300,
  },
};

/** Legacy compatibility: total monthly limit (sum of all features) */
export const AI_PLAN_TOTAL_LIMITS: Record<string, number> = {
  free: 17,
  starter: 121,
  pro: 556,
  agency: 1808,
};

/** Returns the current month as 'YYYY-MM' */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Count AI usages for a user in the current month, optionally filtered by feature */
export async function getMonthlyAiUsageCount(
  appUserId: string,
  month?: string,
  feature?: AiFeature
): Promise<number> {
  const db = await requireDb();
  const m = month ?? getCurrentMonth();
  const conditions = [
    eq(aiUsage.appUserId, appUserId),
    eq(aiUsage.month, m),
  ];
  if (feature) {
    conditions.push(eq(aiUsage.action, feature));
  }
  const rows = await db
    .select({ count: count() })
    .from(aiUsage)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}

/** Get per-feature usage breakdown for the current month */
export async function getMonthlyUsageBreakdown(
  appUserId: string,
  month?: string
): Promise<Record<AiFeature, number>> {
  const db = await requireDb();
  const m = month ?? getCurrentMonth();
  const rows = await db
    .select({ action: aiUsage.action, count: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.appUserId, appUserId), eq(aiUsage.month, m)));

  const breakdown: Record<string, number> = {};
  for (const row of rows) {
    breakdown[row.action] = row.count;
  }

  const features: AiFeature[] = ["strategy", "contentPlan", "post", "campaign", "intelligence", "dailyTasks", "seo", "image", "video", "other"];
  const result = {} as Record<AiFeature, number>;
  for (const f of features) {
    result[f] = breakdown[f] ?? 0;
  }
  return result;
}

/** Record an AI usage event (skipped for super_admin and onboarding flow) */
export async function recordAiUsage(
  appUserId: string,
  action: string,
  role?: string,
  isOnboarding?: boolean
): Promise<void> {
  if (role === "super_admin") return;
  if (isOnboarding) return;
  const db = await requireDb();
  await db.insert(aiUsage).values({
    appUserId,
    action,
    month: getCurrentMonth(),
  });
}

/** Check if a user can perform an AI action for a specific feature */
export async function checkAiUsageLimit(
  appUserId: string,
  plan: string,
  role?: string,
  isOnboarding?: boolean,
  feature?: AiFeature
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  plan: string;
  warning: boolean; // true when >= 80% of limit used
}> {
  if (role === "super_admin") {
    return { allowed: true, used: 0, limit: -1, plan: "super_admin", warning: false };
  }
  if (isOnboarding) {
    return { allowed: true, used: 0, limit: -1, plan: `${plan}_onboarding`, warning: false };
  }

  const planLimits = AI_PLAN_LIMITS[plan] ?? AI_PLAN_LIMITS.free;
  const f = feature ?? "other";
  const limit = planLimits[f] ?? 0;

  if (limit === 0) {
    // Feature not available on this plan
    return { allowed: false, used: 0, limit: 0, plan, warning: false };
  }

  const used = await getMonthlyAiUsageCount(appUserId, undefined, f);
  const warning = used >= Math.floor(limit * 0.8);

  return {
    allowed: used < limit,
    used,
    limit,
    plan,
    warning,
  };
}
