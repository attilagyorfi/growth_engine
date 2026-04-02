/**
 * G2A Growth Engine – Auth DB Helpers
 * Saját email+jelszó alapú autentikáció adatbázis segédfüggvényei
 */
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "./db";
import { appUsers, passwordResetTokens } from "../drizzle/schema";
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
