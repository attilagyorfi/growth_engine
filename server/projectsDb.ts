import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { projects, socialProfileCache } from "../drizzle/schema";
import type { InsertProject, InsertSocialProfileCache } from "../drizzle/schema";

export async function getProjectsByOwner(ownerId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.ownerId, ownerId));
}

export async function getProjectById(id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveProjectByOwner(ownerId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projects)
    .where(and(eq(projects.ownerId, ownerId), eq(projects.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(projects).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const rows = await db.select().from(projects).where(eq(projects.id, data.id)).limit(1);
  return rows[0]!;
}

export async function setActiveProject(ownerId: string, projectId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(projects).set({ isActive: false }).where(eq(projects.ownerId, ownerId));
  await db.update(projects).set({ isActive: true }).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));
}

export async function deleteProject(id: string, ownerId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
}

// ─── Social Profile Cache ─────────────────────────────────────────────────────

export async function getSocialProfileCache(profileId: string, platform: string, url: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(socialProfileCache)
    .where(and(
      eq(socialProfileCache.profileId, profileId),
      eq(socialProfileCache.platform, platform),
      eq(socialProfileCache.url, url)
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSocialProfileCache(data: InsertSocialProfileCache) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(socialProfileCache).values(data).onDuplicateKeyUpdate({ set: { ...data, scrapedAt: new Date() } });
  const rows = await db.select().from(socialProfileCache).where(eq(socialProfileCache.id, data.id)).limit(1);
  return rows[0]!;
}

export async function getSocialProfilesByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialProfileCache).where(eq(socialProfileCache.profileId, profileId));
}
