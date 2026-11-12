import { eq, ne, desc, and, or, gte, lte, inArray, isNull } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import mysql from "mysql2/promise";
import {
  clientProfiles, InsertClientProfile,
  leads, InsertLead,
  outboundEmails, InsertOutboundEmail,
  inboundEmails, InsertInboundEmail,
  contentPosts, InsertContentPost,
  strategies, InsertStrategy,
  emailIntegrations, InsertEmailIntegration,
  contentIdeas, InsertContentIdea,
  appUsers,
} from "../drizzle/schema";
import type { InboundEmail } from "../drizzle/schema";
import { encryptToken } from './_core/tokenCrypto';
import { SOCIAL_METRIC_PLATFORMS } from "./reports/connectors";

let _db: MySql2Database | null = null;
let _pool: mysql.Pool | null = null;
let _dbPromise: Promise<MySql2Database | null> | null = null;

/**
 * Lazily create the drizzle instance so local tooling can run without a DB.
 *
 * FONTOS: A TiDB Cloud Serverless KÖTELEZŐEN TLS-t igényel. A korábbi
 * `drizzle(process.env.DATABASE_URL)` forma NEM állított be SSL-t, ezért a
 * TiDB minden lekérdezést elutasított ("Connections using insecure transport
 * are prohibited"), amit a drizzle "Failed query: select ..." formában jelez.
 * Ezért ugyanazt az SSL-es mysql2 poolt használjuk, mint a migration script.
 */
export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;
  if (!_dbPromise) {
    _dbPromise = (async () => {
      try {
        const url = process.env.DATABASE_URL as string;
        const isTiDB = url.includes("tidbcloud.com");
        const pool = mysql.createPool({
          uri: url,
          ssl: isTiDB ? { rejectUnauthorized: true } : undefined,
          connectionLimit: 5,
          waitForConnections: true,
        });
        // Ellenőrizzük a kapcsolatot rögtön — így az SSL/auth hibák AZONNAL és
        // HANGOSAN megjelennek a logban, nem pedig elrejtve egy query mögött.
        await pool.query("SELECT 1");
        console.log(
          `[Database] ✓ Connected to ${isTiDB ? "TiDB Cloud (SSL enabled)" : "MySQL"}`,
        );
        _pool = pool;
        _db = drizzle(pool);
        return _db;
      } catch (error) {
        console.error(
          "[Database] ✗ Connection failed:",
          error instanceof Error ? error.message : error,
        );
        _dbPromise = null; // engedjük újrapróbálni a következő híváskor
        return null;
      }
    })();
  }
  return _dbPromise;
}

/**
 * A drizzle alatti mysql2 pool — ott kell, ahol egy dedikált kapcsolat számít
 * (pl. GET_LOCK / RELEASE_LOCK ugyanazon a kapcsolaton, lásd reportSyncScheduler).
 */
export async function getDbPool(): Promise<mysql.Pool | null> {
  const db = await getDb();
  return db ? _pool : null;
}

// ─── Client Profiles ─────────────────────────────────────────────────────────

export async function getAllProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientProfiles).orderBy(clientProfiles.createdAt);
}

export async function getProfilesByAppUser(appUserId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientProfiles).where(eq(clientProfiles.appUserId, appUserId)).orderBy(clientProfiles.createdAt);
}

/** Az aktív (client_profiles.active = true) profilok azonosítói — a napi riport-szinkronhoz. */
export async function listActiveProfileIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: clientProfiles.id }).from(clientProfiles)
    .where(eq(clientProfiles.active, true))
    .orderBy(clientProfiles.createdAt);
  return rows.map((r) => r.id);
}

/** A profilhoz kötött aktív felhasználók (app_users.profileId = profil, active = true) azonosítói. */
export async function listActiveProfileUserIds(profileId: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ id: appUsers.id }).from(appUsers)
    .where(and(eq(appUsers.profileId, profileId), eq(appUsers.active, true)));
  return rows.map((r) => r.id);
}

export async function getProfileById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientProfiles).where(eq(clientProfiles.id, id)).limit(1);
  return result[0];
}

export async function upsertProfile(profile: InsertClientProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Biztonsági háló: frissítéskor az azonosító és a tulajdonos (appUserId) soha nem
  // íródik felül, csak új profil létrehozásakor kerül be.
  const { id: _id, appUserId: _owner, ...updatable } = profile;
  await db.insert(clientProfiles).values(profile).onDuplicateKeyUpdate({ set: updatable });
  return getProfileById(profile.id);
}

/** MySQL „Duplicate entry” (ER_DUP_ENTRY, 1062) — a drizzle a mysql2-hibát `cause`-ba is csomagolhatja. */
export function isDuplicateEntryError(err: unknown): boolean {
  for (let e: any = err, depth = 0; e && depth < 5; e = e.cause, depth++) {
    if (e.code === "ER_DUP_ENTRY" || e.errno === 1062) return true;
  }
  return false;
}

/**
 * A Social Hub-párosítókulcs (external_ref) beállítása vagy törlése (null).
 * Ütközésnél (egyedi index) `{ ok: false, reason: "taken" }` — a másik profilt nem adjuk vissza.
 */
export async function setProfileExternalRef(
  profileId: string,
  externalRef: string | null,
): Promise<{ ok: true } | { ok: false; reason: "taken" }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Egy márka (profile_brands.social_hub_external_ref) sem használhatja ugyanezt,
  // különben ugyanaz a Social Hub-ügyfél két helyre szinkronizálna.
  if (externalRef && (await isSocialHubRefUsedByBrand(externalRef))) return { ok: false, reason: "taken" };
  try {
    await db.update(clientProfiles).set({ externalRef }).where(eq(clientProfiles.id, profileId));
  } catch (err) {
    if (isDuplicateEntryError(err)) return { ok: false, reason: "taken" };
    throw err;
  }
  return { ok: true };
}

/**
 * Egy profil TELJES törlése kaszkáddal (GDPR „elfeledtetéshez való jog" +
 * adat-integritás). A korábbi verzió csak a clientProfiles sort törölte, így
 * ~35 kapcsolódó tábla adata árván maradt.
 *
 * Szabályok:
 *  - A profilhoz TARTOZÓ adatot töröljük (profileId = id).
 *  - Az assistant-üzenetek a threadeken keresztül kapcsolódnak (threadId).
 *  - A NEM-tulajdon hivatkozásokat NULLÁZZUK, nem töröljük:
 *      appUsers.profileId (a user „aktív profil" mutatója) — a usert megtartjuk,
 *      projects.profileId (ügynökségi projekt linkje) — a projektet megtartjuk.
 *  - Mindez egy tranzakcióban (all-or-nothing).
 */
// A profilhoz tartozó (profileId-vel rendelkező) táblák — mind törlődik a profillal.
// Exportált, hogy a teszt ellenőrizhesse: minden profileId-s tábla le van fedve.
export const PROFILE_OWNED_TABLES = [
  "leads", "outboundEmails", "inboundEmails", "contentPosts", "strategies",
  "emailIntegrations", "onboardingSessions", "onboardingAnswers", "uploadedBrandAssets",
  "companyIntelligence", "competitorProfiles", "targetPersonas", "strategyTasks",
  "contentCalendarItems", "contentFeedback", "socialTokens", "publishingLogs",
  "analyticsSnapshots", "aiMemories", "auditLogs", "strategyVersions", "campaigns",
  "campaignAssets", "recommendations", "appNotifications", "socialConnections",
  "scheduledPosts", "socialProfileCache", "seoAudits", "heygenVideos", "dataConnections",
  "reportMetrics", "reports", "reportSchedules", "teamInvites", "assistantThreads",
  "contentIdeas", "profileBrands",
] as const;

export async function deleteProfile(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const schema: any = await import("../drizzle/schema");
  const { eq, inArray } = await import("drizzle-orm");

  await db.transaction(async (tx: any) => {
    // 1) Assistant-üzenetek a profil threadjein keresztül (threadId, nem profileId).
    const threads = await tx.select({ id: schema.assistantThreads.id })
      .from(schema.assistantThreads)
      .where(eq(schema.assistantThreads.profileId, id));
    const threadIds = threads.map((t: any) => t.id);
    if (threadIds.length) {
      await tx.delete(schema.assistantMessages).where(inArray(schema.assistantMessages.threadId, threadIds));
    }

    // 2) Minden profil-tulajdonú tábla (profileId = id).
    for (const name of PROFILE_OWNED_TABLES) {
      const table = schema[name];
      if (table?.profileId) {
        await tx.delete(table).where(eq(table.profileId, id));
      }
    }

    // 3) Nem-tulajdon hivatkozások NULLÁZÁSA — a user/projekt megmarad.
    await tx.update(schema.appUsers).set({ profileId: null }).where(eq(schema.appUsers.profileId, id));
    await tx.update(schema.projects).set({ profileId: null }).where(eq(schema.projects.profileId, id));

    // 4) Végül maga a profil.
    await tx.delete(clientProfiles).where(eq(clientProfiles.id, id));
  });
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeadsByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).where(eq(leads.profileId, profileId)).orderBy(desc(leads.createdAt));
}

export async function getLeadById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(leads).values(lead);
  return getLeadById(lead.id);
}

export async function updateLead(id: string, updates: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leads).set(updates).where(eq(leads.id, id));
  return getLeadById(id);
}

export async function deleteLead(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(leads).where(eq(leads.id, id));
}

// ─── Outbound Emails ──────────────────────────────────────────────────────────

export async function getOutboundByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outboundEmails).where(eq(outboundEmails.profileId, profileId)).orderBy(desc(outboundEmails.createdAt));
}

export async function getOutboundById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(outboundEmails).where(eq(outboundEmails.id, id)).limit(1);
  return result[0];
}

export async function createOutbound(email: InsertOutboundEmail) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(outboundEmails).values(email);
  return getOutboundById(email.id);
}

export async function updateOutbound(id: string, updates: Partial<InsertOutboundEmail>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(outboundEmails).set(updates).where(eq(outboundEmails.id, id));
  return getOutboundById(id);
}

export async function deleteOutbound(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(outboundEmails).where(eq(outboundEmails.id, id));
}

// ─── Inbound Emails ───────────────────────────────────────────────────────────

export async function getInboundByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inboundEmails).where(eq(inboundEmails.profileId, profileId)).orderBy(desc(inboundEmails.receivedAt));
}

export async function createInbound(email: InsertInboundEmail) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(inboundEmails).values(email);
}

export async function getInboundById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inboundEmails).where(eq(inboundEmails.id, id)).limit(1);
  return result[0];
}

export async function markInboundRead(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(inboundEmails).set({ read: true }).where(eq(inboundEmails.id, id));
}

export async function updateInboundCategory(id: string, category: InboundEmail["category"]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(inboundEmails).set({ category }).where(eq(inboundEmails.id, id));
}

// ─── Content Posts ────────────────────────────────────────────────────────────

export async function getContentByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPosts).where(eq(contentPosts.profileId, profileId)).orderBy(desc(contentPosts.createdAt));
}

export async function getContentById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
  return result[0];
}

export async function createContent(post: InsertContentPost) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(contentPosts).values(post);
  return getContentById(post.id);
}

export async function updateContent(id: string, updates: Partial<InsertContentPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(contentPosts).set(updates).where(eq(contentPosts.id, id));
  return getContentById(id);
}

export async function deleteContent(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(contentPosts).where(eq(contentPosts.id, id));
}

// ─── Strategies ───────────────────────────────────────────────────────────────

export async function getStrategiesByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategies).where(eq(strategies.profileId, profileId)).orderBy(desc(strategies.createdAt));
}

export async function getStrategyById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
  return result[0];
}

export async function createStrategy(strategy: InsertStrategy) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(strategies).values(strategy);
  return getStrategyById(strategy.id);
}

export async function updateStrategy(id: string, updates: Partial<InsertStrategy>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(strategies).set(updates).where(eq(strategies.id, id));
  return getStrategyById(id);
}

// ─── Email Integrations ───────────────────────────────────────────────────────

export async function getEmailIntegration(profileId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailIntegrations).where(eq(emailIntegrations.profileId, profileId)).limit(1);
  return result[0];
}

export async function upsertEmailIntegration(integration: InsertEmailIntegration) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(emailIntegrations).values(integration).onDuplicateKeyUpdate({ set: integration });
  return getEmailIntegration(integration.profileId);
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

import {
  onboardingSessions, InsertOnboardingSession,
  onboardingAnswers, InsertOnboardingAnswer,
  uploadedBrandAssets, InsertUploadedBrandAsset,
  companyIntelligence, InsertCompanyIntelligence,
  competitorProfiles, InsertCompetitorProfile,
  targetPersonas, InsertTargetPersona,
  strategyTasks, InsertStrategyTask,
  contentCalendarItems, InsertContentCalendarItem,
  aiMemories, InsertAiMemory,
  auditLogs, InsertAuditLog,
} from "../drizzle/schema";

export async function getOnboardingSession(profileId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(onboardingSessions)
    .where(eq(onboardingSessions.profileId, profileId))
    .orderBy(onboardingSessions.createdAt)
    .limit(1);
  return result[0] ?? null;
}

export async function upsertOnboardingSession(session: InsertOnboardingSession) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(onboardingSessions).values(session).onDuplicateKeyUpdate({ set: { status: session.status, currentStep: session.currentStep, completedAt: session.completedAt } });
  const result = await db.select().from(onboardingSessions).where(eq(onboardingSessions.id, session.id)).limit(1);
  return result[0];
}

export async function saveOnboardingAnswers(answers: InsertOnboardingAnswer[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (const answer of answers) {
    await db.insert(onboardingAnswers).values(answer).onDuplicateKeyUpdate({ set: { fieldValue: answer.fieldValue, userConfirmed: answer.userConfirmed } });
  }
  return true;
}

export async function getOnboardingAnswers(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(onboardingAnswers).where(eq(onboardingAnswers.sessionId, sessionId));
}

// ─── Brand Assets ─────────────────────────────────────────────────────────────

export async function getBrandAssets(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uploadedBrandAssets).where(eq(uploadedBrandAssets.profileId, profileId));
}

export async function createBrandAsset(asset: InsertUploadedBrandAsset) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(uploadedBrandAssets).values(asset);
  const result = await db.select().from(uploadedBrandAssets).where(eq(uploadedBrandAssets.id, asset.id)).limit(1);
  return result[0];
}

export async function updateBrandAssetParsed(id: string, parsedContent: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(uploadedBrandAssets).set({ parsedContent, parsedAt: new Date() }).where(eq(uploadedBrandAssets.id, id));
}

export async function getBrandAssetById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(uploadedBrandAssets).where(eq(uploadedBrandAssets.id, id)).limit(1);
  return result[0];
}

export async function deleteBrandAsset(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(uploadedBrandAssets).where(eq(uploadedBrandAssets.id, id));
}

// ─── Company Intelligence ─────────────────────────────────────────────────────

export async function getCompanyIntelligence(profileId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companyIntelligence).where(eq(companyIntelligence.profileId, profileId)).limit(1);
  return result[0] ?? null;
}

export async function upsertCompanyIntelligence(data: InsertCompanyIntelligence) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(companyIntelligence).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  return getCompanyIntelligence(data.profileId);
}

// ─── Competitor Profiles ──────────────────────────────────────────────────────

export async function getCompetitors(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitorProfiles).where(eq(competitorProfiles.profileId, profileId));
}

export async function upsertCompetitor(data: InsertCompetitorProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(competitorProfiles).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const result = await db.select().from(competitorProfiles).where(eq(competitorProfiles.id, data.id)).limit(1);
  return result[0];
}

export async function deleteCompetitor(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(competitorProfiles).where(eq(competitorProfiles.id, id));
}

// ─── Target Personas ──────────────────────────────────────────────────────────

export async function getPersonas(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(targetPersonas).where(eq(targetPersonas.profileId, profileId));
}

export async function upsertPersona(data: InsertTargetPersona) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(targetPersonas).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const result = await db.select().from(targetPersonas).where(eq(targetPersonas.id, data.id)).limit(1);
  return result[0];
}

export async function deletePersona(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(targetPersonas).where(eq(targetPersonas.id, id));
}

// ─── Strategy Tasks ───────────────────────────────────────────────────────────

export type StrategyTaskStatus = "todo" | "in_progress" | "done" | "skipped";
export type StrategyTaskFunnelStage = "awareness" | "consideration" | "decision" | "retention";

export async function getStrategyTasks(
  profileId: string,
  opts: { strategyId?: string; status?: StrategyTaskStatus; funnelStage?: StrategyTaskFunnelStage } = {},
) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(strategyTasks.profileId, profileId)];
  if (opts.strategyId) filters.push(eq(strategyTasks.strategyId, opts.strategyId));
  if (opts.status) filters.push(eq(strategyTasks.status, opts.status));
  if (opts.funnelStage) filters.push(eq(strategyTasks.funnelStage, opts.funnelStage));
  return db.select().from(strategyTasks)
    .where(and(...filters))
    .orderBy(desc(strategyTasks.createdAt));
}

export async function upsertStrategyTask(data: InsertStrategyTask) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(strategyTasks).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const result = await db.select().from(strategyTasks).where(eq(strategyTasks.id, data.id)).limit(1);
  return result[0];
}

export async function getStrategyTaskById(taskId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(strategyTasks).where(eq(strategyTasks.id, taskId)).limit(1);
  return result[0] ?? null;
}

export async function updateStrategyTaskStatus(taskId: string, status: StrategyTaskStatus) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(strategyTasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(strategyTasks.id, taskId));
  const result = await db.select().from(strategyTasks).where(eq(strategyTasks.id, taskId)).limit(1);
  return result[0] ?? null;
}

// ─── Content Calendar Items ───────────────────────────────────────────────────

export async function getCalendarItemsByProfile(
  profileId: string,
  opts: { campaignTag?: string; from?: Date; to?: Date } = {},
) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(contentCalendarItems.profileId, profileId)];
  if (opts.campaignTag) filters.push(eq(contentCalendarItems.campaignTag, opts.campaignTag));
  return db.select().from(contentCalendarItems)
    .where(and(...filters))
    .orderBy(contentCalendarItems.scheduledAt);
}

export async function bulkCreateCalendarItems(items: InsertContentCalendarItem[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (items.length === 0) return { count: 0 };
  await db.insert(contentCalendarItems).values(items);
  return { count: items.length };
}

// ─── AI Memories ──────────────────────────────────────────────────────────────

export type AiMemoryType =
  | "approved_pattern"
  | "rejected_pattern"
  | "style_preference"
  | "cta_preference"
  | "content_preference"
  | "client_correction";

export async function getAiMemories(profileId: string, opts: { memoryType?: AiMemoryType } = {}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(aiMemories.profileId, profileId)];
  if (opts.memoryType) filters.push(eq(aiMemories.memoryType, opts.memoryType));
  return db.select().from(aiMemories)
    .where(and(...filters))
    .orderBy(desc(aiMemories.createdAt));
}

export async function getAiMemoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(aiMemories).where(eq(aiMemories.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createAiMemory(data: InsertAiMemory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(aiMemories).values(data);
}

export async function deleteAiMemory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(aiMemories).where(eq(aiMemories.id, id));
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(profileId?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (profileId) {
    return db.select().from(auditLogs).where(eq(auditLogs.profileId, profileId))
      .orderBy(auditLogs.createdAt)
      .limit(limit);
  }
  return db.select().from(auditLogs).orderBy(auditLogs.createdAt).limit(limit);
}

// ─── Strategy Versions ────────────────────────────────────────────────────────
import {
  strategyVersions, InsertStrategyVersion,
  campaigns, InsertCampaign,
  campaignAssets, InsertCampaignAsset,
  recommendations, InsertRecommendation,
  appNotifications, InsertAppNotification,
} from "../drizzle/schema";

export async function getStrategyVersionsByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyVersions)
    .where(eq(strategyVersions.profileId, profileId))
    .orderBy(desc(strategyVersions.versionNumber));
}

export async function getActiveStrategyVersion(profileId: string) {
  const db = await getDb();
  if (!db) return undefined;
  // Determinisztikus: ha (régi adatban) több aktív verzió maradt, a legújabb nyer —
  // eddig a sorrend nélküli LIMIT 1 hol az egyiket, hol a másikat adta vissza.
  const result = await db.select().from(strategyVersions)
    .where(and(eq(strategyVersions.profileId, profileId), eq(strategyVersions.isActive, true)))
    .orderBy(desc(strategyVersions.versionNumber), desc(strategyVersions.createdAt))
    .limit(1);
  return result[0];
}

export async function upsertStrategyVersion(data: InsertStrategyVersion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Meglévő sornál az id és a tulajdonos profil (profileId) NEM írható felül.
  const { id: _id, profileId: _owner, ...updatable } = data;
  await db.transaction(async (tx) => {
    await tx.insert(strategyVersions).values(data).onDuplicateKeyUpdate({ set: updatable });
    // Profilonként egyetlen aktív verzió: az új aktív mellett a többi kikapcsol.
    // Eddig minden generálás újabb aktív verziót hozott létre a régiek mellé.
    if (data.isActive) {
      await tx.update(strategyVersions).set({ isActive: false })
        .where(and(eq(strategyVersions.profileId, data.profileId), ne(strategyVersions.id, data.id)));
    }
  });
  const result = await db.select().from(strategyVersions).where(eq(strategyVersions.id, data.id)).limit(1);
  return result[0];
}

/** Aktívvá teszi a verziót (a profil többi verzióját kikapcsolja). false, ha a verzió nem a profilé. */
export async function setActiveStrategyVersion(profileId: string, versionId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const owned = and(eq(strategyVersions.id, versionId), eq(strategyVersions.profileId, profileId));
  const [row] = await db.select({ id: strategyVersions.id }).from(strategyVersions).where(owned).limit(1);
  if (!row) return false;
  await db.transaction(async (tx) => {
    await tx.update(strategyVersions).set({ isActive: false }).where(eq(strategyVersions.profileId, profileId));
    await tx.update(strategyVersions).set({ isActive: true }).where(owned);
  });
  return true;
}

export async function getStrategyVersionById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(strategyVersions).where(eq(strategyVersions.id, id)).limit(1);
  return result[0];
}

export async function archiveStrategyVersion(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(strategyVersions).set({ archivedAt: new Date(), isActive: false }).where(eq(strategyVersions.id, id));
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function getCampaignsByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns)
    .where(eq(campaigns.profileId, profileId))
    .orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result[0];
}

export async function upsertCampaign(data: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(campaigns).values(data).onDuplicateKeyUpdate({ set: data });
  return getCampaignById(data.id);
}

export async function deleteCampaign(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ─── Campaign Assets ──────────────────────────────────────────────────────────

export async function getCampaignAssets(campaignId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaignAssets).where(eq(campaignAssets.campaignId, campaignId));
}

export async function upsertCampaignAsset(data: InsertCampaignAsset) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(campaignAssets).values(data).onDuplicateKeyUpdate({ set: data });
  const result = await db.select().from(campaignAssets).where(eq(campaignAssets.id, data.id)).limit(1);
  return result[0];
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function getRecommendationsByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recommendations)
    .where(and(eq(recommendations.profileId, profileId), eq(recommendations.isDismissed, false)))
    .orderBy(desc(recommendations.generatedAt))
    .limit(20);
}

export async function createRecommendation(data: InsertRecommendation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(recommendations).values(data);
}

export async function getRecommendationById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(recommendations).where(eq(recommendations.id, id)).limit(1);
  return result[0];
}

export async function dismissRecommendation(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(recommendations).set({ isDismissed: true }).where(eq(recommendations.id, id));
}

// ─── App Notifications ────────────────────────────────────────────────────────

export async function getNotificationsByUser(appUserId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appNotifications)
    .where(eq(appNotifications.appUserId, appUserId))
    .orderBy(desc(appNotifications.createdAt))
    .limit(50);
}

export async function createNotification(data: InsertAppNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(appNotifications).values(data);
}

/**
 * Van-e már OLVASATLAN, azonos profilú, típusú és című értesítése a felhasználónak?
 * A napi riport-szinkron ezzel kerüli el, hogy ugyanarról a hibáról újra és újra
 * (pl. újraindulás után is) értesítsen. Csak olvas, séma nem kell hozzá.
 */
export async function hasUnreadNotification(
  appUserId: string,
  profileId: string,
  type: InsertAppNotification["type"],
  title: string,
) {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: appNotifications.id }).from(appNotifications)
    .where(and(
      eq(appNotifications.appUserId, appUserId),
      eq(appNotifications.profileId, profileId),
      eq(appNotifications.type, type),
      eq(appNotifications.title, title.slice(0, 255)),
      eq(appNotifications.isRead, false),
    ))
    .limit(1);
  return rows.length > 0;
}

export async function getNotificationById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appNotifications).where(eq(appNotifications.id, id)).limit(1);
  return result[0];
}

export async function markNotificationRead(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(appNotifications).set({ isRead: true }).where(eq(appNotifications.id, id));
}

export async function markAllNotificationsRead(appUserId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(appNotifications).set({ isRead: true }).where(eq(appNotifications.appUserId, appUserId));
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIPORTGENERÁTOR MODUL — 4 tábla helper (drizzle/schema.ts riport-tábláihoz)
// A getLeadsByProfile stílust követi: getDb() null-check + tömb-fallback.
// ═══════════════════════════════════════════════════════════════════════════════

// A `data_connections` + `report_metrics` + `reports` + `report_schedules` tábla
// oszlopaira és típusaira a schema.ts-ben deklarált export-okat használjuk.
// Egyetlen import-blokk a modul aljához (elkerüli a felül lévő importok bővítését).
import {
  dataConnections, type InsertDataConnection, type DataConnection,
  reportMetrics, type InsertReportMetric,
  profileBrands, type ProfileBrand,
  reports as reportsTable, type InsertReport,
  reportSchedules, type InsertReportSchedule,
} from "../drizzle/schema";

// ─── Profile Brands (alárkák) ───────────────────────────────────────────
// Az ügyfél EGY profil; a márka a profilon belüli címke. Minden helper a
// profileId-vel is szűr, így más profil márkájára nem lehet hivatkozni.

/** brandId → márka-szűrő; null = a márka nélküli (ill. összesített) sorok. */
function brandScope(
  column: typeof reportMetrics.brandId | typeof dataConnections.brandId | typeof reportsTable.brandId,
  brandId: string | null,
) {
  return brandId ? eq(column, brandId) : isNull(column);
}

export async function listProfileBrands(profileId: string): Promise<ProfileBrand[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(profileBrands).where(eq(profileBrands.profileId, profileId)).orderBy(profileBrands.name);
}

/** A márka, ha az adott profilé; más profil márkájánál null. */
export async function getProfileBrand(profileId: string, brandId: string): Promise<ProfileBrand | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(profileBrands).where(
    and(eq(profileBrands.id, brandId), eq(profileBrands.profileId, profileId)),
  ).limit(1);
  return rows[0] ?? null;
}

async function isSocialHubRefUsedByBrand(ref: string, exceptBrandId?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: profileBrands.id }).from(profileBrands).where(
    exceptBrandId
      ? and(eq(profileBrands.socialHubExternalRef, ref), ne(profileBrands.id, exceptBrandId))
      : eq(profileBrands.socialHubExternalRef, ref),
  ).limit(1);
  return rows.length > 0;
}

async function isSocialHubRefUsedByProfile(ref: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: clientProfiles.id }).from(clientProfiles)
    .where(eq(clientProfiles.externalRef, ref)).limit(1);
  return rows.length > 0;
}

export type BrandWriteResult =
  | { ok: true; brand: ProfileBrand }
  | { ok: false; reason: "name_taken" | "ref_taken" | "not_found" };

/** Név (profilon belül) és Social Hub-azonosító (márkák + profilok között) ütközése. */
export async function checkBrandConflicts(
  profileId: string,
  input: { name?: string; socialHubExternalRef?: string | null },
  exceptBrandId?: string,
): Promise<"name_taken" | "ref_taken" | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (input.name !== undefined) {
    const same = await db.select({ id: profileBrands.id }).from(profileBrands).where(
      and(eq(profileBrands.profileId, profileId), eq(profileBrands.name, input.name)),
    );
    if (same.some((b) => b.id !== exceptBrandId)) return "name_taken";
  }
  const ref = input.socialHubExternalRef;
  if (ref && ((await isSocialHubRefUsedByBrand(ref, exceptBrandId)) || (await isSocialHubRefUsedByProfile(ref)))) {
    return "ref_taken";
  }
  return null;
}

/** Az egyedi indexek versenyhelyzeti ütközése → melyik kulcs ütközött. */
function brandDuplicateReason(err: unknown): "name_taken" | "ref_taken" | null {
  if (!isDuplicateEntryError(err)) return null;
  const text = String((err as any)?.message ?? "") + String((err as any)?.cause?.message ?? "");
  return text.includes("external_ref") ? "ref_taken" : "name_taken";
}

export async function createProfileBrand(
  profileId: string,
  input: { name: string; socialHubExternalRef: string | null },
): Promise<BrandWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conflict = await checkBrandConflicts(profileId, input);
  if (conflict) return { ok: false, reason: conflict };
  const id = nanoid();
  try {
    await db.insert(profileBrands).values({ id, profileId, name: input.name, socialHubExternalRef: input.socialHubExternalRef });
  } catch (err) {
    const reason = brandDuplicateReason(err);
    if (reason) return { ok: false, reason };
    throw err;
  }
  const brand = await getProfileBrand(profileId, id);
  return brand ? { ok: true, brand } : { ok: false, reason: "not_found" };
}

export async function updateProfileBrand(
  profileId: string,
  brandId: string,
  patch: { name?: string; socialHubExternalRef?: string | null },
): Promise<BrandWriteResult> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (!(await getProfileBrand(profileId, brandId))) return { ok: false, reason: "not_found" };
  const conflict = await checkBrandConflicts(profileId, patch, brandId);
  if (conflict) return { ok: false, reason: conflict };
  try {
    await db.update(profileBrands).set(patch).where(
      and(eq(profileBrands.id, brandId), eq(profileBrands.profileId, profileId)),
    );
  } catch (err) {
    const reason = brandDuplicateReason(err);
    if (reason) return { ok: false, reason };
    throw err;
  }
  const brand = await getProfileBrand(profileId, brandId);
  return brand ? { ok: true, brand } : { ok: false, reason: "not_found" };
}

/**
 * Márka törlése. Ha kapcsolat van hozzárendelve: `has_connections` (előbb le kell
 * venni róla). Különben egy tranzakcióban törlődnek a márka report_metrics sorai
 * és maga a márka — a már elkészült riportok megmaradnak (a címükben a márka neve).
 */
export async function deleteProfileBrand(
  profileId: string,
  brandId: string,
  dbOverride?: Pick<MySql2Database, "transaction">,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "has_connections" }> {
  const db = dbOverride ?? (await getDb());
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const brand = await tx.select({ id: profileBrands.id }).from(profileBrands).where(
      and(eq(profileBrands.id, brandId), eq(profileBrands.profileId, profileId)),
    ).limit(1);
    if (!brand[0]) return { ok: false as const, reason: "not_found" as const };
    const conns = await tx.select({ id: dataConnections.id }).from(dataConnections).where(
      and(eq(dataConnections.profileId, profileId), eq(dataConnections.brandId, brandId)),
    ).limit(1);
    if (conns.length) return { ok: false as const, reason: "has_connections" as const };
    await tx.delete(reportMetrics).where(and(eq(reportMetrics.profileId, profileId), eq(reportMetrics.brandId, brandId)));
    await tx.delete(profileBrands).where(and(eq(profileBrands.id, brandId), eq(profileBrands.profileId, profileId)));
    return { ok: true as const };
  });
}

export type ConnectionBrandPlan =
  | { action: "none" }
  | { action: "relabel" | "delete"; platform: DataConnection["platform"]; fromBrandId: string | null; toBrandId: string | null };

/**
 * Mi legyen a kapcsolat eddigi (profil + platform + régi márka) metrikasoraival,
 * ha a kapcsolat márkát vált? A report_metrics-ben nincs kapcsolat-oszlop, ezért:
 *  - ha a régi címkén nincs másik ugyanilyen platformú kapcsolat → a sorok
 *    átcímkéződnek az új márkára (az előzmény megmarad);
 *  - ha van → nem választhatók szét, ezért törlődnek (a következő szinkron
 *    mindkét csoportot újraírja).
 * Így régi címkével semmi nem marad bent, az összesítés nem számol kétszer.
 */
export function planConnectionBrandChange(
  connections: Pick<DataConnection, "id" | "platform" | "brandId">[],
  connectionId: string,
  newBrandId: string | null,
): ConnectionBrandPlan {
  const conn = connections.find((c) => c.id === connectionId);
  if (!conn) return { action: "none" };
  const fromBrandId = conn.brandId ?? null;
  if (fromBrandId === newBrandId) return { action: "none" };
  const sharesOldLabel = connections.some(
    (c) => c.id !== conn.id && c.platform === conn.platform && (c.brandId ?? null) === fromBrandId,
  );
  return { action: sharesOldLabel ? "delete" : "relabel", platform: conn.platform, fromBrandId, toBrandId: newBrandId };
}

/**
 * A kapcsolat márkájának beállítása (null = nincs márka). A meglévő metrikasorok
 * ugyanabban a tranzakcióban átcímkéződnek vagy törlődnek (planConnectionBrandChange).
 * A brandId profilhoz tartozását a hívó (router) ellenőrzi.
 */
export async function setDataConnectionBrand(
  profileId: string,
  connectionId: string,
  brandId: string | null,
  dbOverride?: Pick<MySql2Database, "transaction">,
): Promise<{ ok: true; plan: ConnectionBrandPlan } | { ok: false; reason: "not_found" }> {
  const db = dbOverride ?? (await getDb());
  if (!db) throw new Error("DB not available");
  return db.transaction(async (tx) => {
    const conns = await tx.select({ id: dataConnections.id, platform: dataConnections.platform, brandId: dataConnections.brandId })
      .from(dataConnections).where(eq(dataConnections.profileId, profileId));
    if (!conns.some((c) => c.id === connectionId)) return { ok: false as const, reason: "not_found" as const };
    const plan = planConnectionBrandChange(conns, connectionId, brandId);
    if (plan.action === "none") return { ok: true as const, plan };
    await tx.update(dataConnections).set({ brandId }).where(
      and(eq(dataConnections.id, connectionId), eq(dataConnections.profileId, profileId)),
    );
    const scope = and(
      eq(reportMetrics.profileId, profileId),
      eq(reportMetrics.platform, plan.platform),
      brandScope(reportMetrics.brandId, plan.fromBrandId),
    );
    if (plan.action === "relabel") {
      await tx.update(reportMetrics).set({ brandId: plan.toBrandId }).where(scope);
    } else {
      await tx.delete(reportMetrics).where(scope);
    }
    return { ok: true as const, plan };
  });
}

// ─── Data Connections ───────────────────────────────────────────────────

export async function listDataConnections(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataConnections).where(eq(dataConnections.profileId, profileId));
}

export async function upsertDataConnection(input: Omit<InsertDataConnection, "id"> & { connected?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  // ONE-per-profile-platform-account: ha már van ilyen, frissítjük a tokeneket.
  const existing = await db.select().from(dataConnections).where(
    and(
      eq(dataConnections.profileId, input.profileId),
      eq(dataConnections.platform, input.platform),
      eq(dataConnections.externalAccountId, input.externalAccountId),
    ),
  ).limit(1);
  const id = existing[0]?.id ?? nanoid();
  // A tokeneket titkosítva tároljuk (at rest). A decrypt a felhasználás
  // helyén történik (jelenleg a mock connector nem olvassa; a jövőbeli valós
  // adapter a decryptToken-nel fejti vissza).
  const values = {
    ...input, id, connected: input.connected ?? true,
    accessToken: encryptToken(input.accessToken ?? null),
    refreshToken: encryptToken(input.refreshToken ?? null),
  };
  if (existing[0]) {
    await db.update(dataConnections).set(values).where(eq(dataConnections.id, id));
  } else {
    await db.insert(dataConnections).values(values);
  }
  const rows = await db.select().from(dataConnections).where(eq(dataConnections.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteDataConnection(profileId: string, connectionId: string) {
  const db = await getDb();
  if (!db) return { ok: false };
  await db.delete(dataConnections).where(
    and(eq(dataConnections.id, connectionId), eq(dataConnections.profileId, profileId)),
  );
  return { ok: true };
}

// ─── Report Metrics ─────────────────────────────────────────────────────

/**
 * Egy kapcsolat-platform (google_ads, ga4, search_console, meta_ads) sorainak
 * cseréje egy időszakra, tranzakcióban: előbb törli a profil adott platformjának
 * sorait [from, to]-ban (inkluzív), utána ~500-as batch-ekben beszúrja az újakat.
 * Így az ismételt (kézi vagy napi) szinkron ugyanarra az időszakra nem duplikál.
 *
 * FONTOS: a report_metrics-ben nincs kapcsolat-oszlop, ezért a hívó a platform
 * ÖSSZES kapcsolatának sorait egyben adja át (lásd server/reports/syncProfile.ts),
 * különben a második kapcsolat cseréje törölné az első sorait. A közösségi
 * platformok sorait nem érinti (azokat a replaceSocialReportMetrics cseréli).
 *
 * Márkák (0025): a csere profil + platform + brandId + időszak hatókörű, a sorok
 * a `brandId`-t kapják (null = márka nélküli). Más márka és a márka nélküli sorok
 * érintetlenek, ezért a hívó márkánként is csoportosít.
 */
export async function replaceReportMetrics(
  profileId: string,
  platform: DataConnection["platform"],
  from: string,
  to: string,
  rows: Array<Omit<InsertReportMetric, "id" | "profileId" | "createdAt" | "brandId">>,
  dbOverride?: Pick<MySql2Database, "transaction">,
  brandId: string | null = null,
) {
  if ((SOCIAL_METRIC_PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error(`replaceReportMetrics: közösségi platform (${platform}) nem cserélhető itt`);
  }
  if (rows.some((r) => r.platform !== platform)) {
    throw new Error(`replaceReportMetrics: minden sornak ${platform} platformúnak kell lennie`);
  }
  const db = dbOverride ?? (await getDb());
  if (!db) throw new Error("Adatbázis nem elérhető");
  const values = rows.map((r) => ({ ...r, id: nanoid(), profileId, brandId }));
  await db.transaction(async (tx) => {
    await tx.delete(reportMetrics).where(
      and(
        eq(reportMetrics.profileId, profileId),
        eq(reportMetrics.platform, platform),
        brandScope(reportMetrics.brandId, brandId),
        gte(reportMetrics.date, new Date(from)),
        lte(reportMetrics.date, new Date(to)),
      ),
    );
    // ~500 sor / batch a TiDB packet-limit alatt.
    for (let i = 0; i < values.length; i += 500) {
      await tx.insert(reportMetrics).values(values.slice(i, i + 500));
    }
  });
  return { inserted: values.length };
}

/**
 * Napi bontású metrikák egy időszakra (from/to inkluzív). A dátum-oszlop
 * a drizzle-oldalon `date` (nem timestamp), a szűrést string-formában
 * végezzük (YYYY-MM-DD), mert a MySQL a `date` oszlopot lexikografikusan
 * hasonlítja össze.
 */
/**
 * A Social Hubból jött közösségi sorok cseréje egy időszakra, tranzakcióban:
 * előbb törli a profil facebook/instagram/linkedin sorait [from, to]-ban
 * (inkluzív), utána beszúrja az újakat. Így az ismételt szinkron ugyanarra az
 * időszakra nem duplikál. A mock-platformok sorait nem érinti.
 * Márkák (0025): csak az adott brandId (null = márka nélküli) sorait cseréli.
 */
export async function replaceSocialReportMetrics(
  profileId: string,
  from: string,
  to: string,
  rows: Array<Omit<InsertReportMetric, "id" | "profileId" | "createdAt" | "brandId">>,
  dbOverride?: Pick<MySql2Database, "transaction">,
  brandId: string | null = null,
) {
  const db = dbOverride ?? (await getDb());
  if (!db) throw new Error("Adatbázis nem elérhető");
  const values = rows.map((r) => ({ ...r, id: nanoid(), profileId, brandId }));
  await db.transaction(async (tx) => {
    await tx.delete(reportMetrics).where(
      and(
        eq(reportMetrics.profileId, profileId),
        inArray(reportMetrics.platform, [...SOCIAL_METRIC_PLATFORMS]),
        brandScope(reportMetrics.brandId, brandId),
        gte(reportMetrics.date, new Date(from)),
        lte(reportMetrics.date, new Date(to)),
      ),
    );
    // ~500 sor / batch a TiDB packet-limit alatt.
    for (let i = 0; i < values.length; i += 500) {
      await tx.insert(reportMetrics).values(values.slice(i, i + 500));
    }
  });
  return { inserted: values.length };
}

/**
 * `brandId` megadásakor csak az adott márka sorai; nélküle (összesítve) a profil
 * összes sora, márkától függetlenül — a márkák előtti viselkedés.
 */
export async function getMetricsByProfile(profileId: string, from: string, to: string, brandId?: string | null) {
  const db = await getDb();
  if (!db) return [];
  // A drizzle `date` oszlopa Date objektumot vár a where clause-ban.
  // A `from`/`to` YYYY-MM-DD stringet a hívó adja, itt Date-re konvertáljuk.
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return db.select().from(reportMetrics).where(
    and(
      eq(reportMetrics.profileId, profileId),
      gte(reportMetrics.date, fromDate),
      lte(reportMetrics.date, toDate),
      ...(brandId ? [eq(reportMetrics.brandId, brandId)] : []),
    ),
  );
}

/**
 * A profil ütemezett/publikált posztjainak száma a [from, to] napokban (az AI-narratíva
 * kontextus-jele). Publikált posztnál a publikálás, egyébként az ütemezés napja számít.
 * null, ha nincs adatbázis (a jel ilyenkor „nem ismert”).
 */
export async function countProfilePostsInPeriod(profileId: string, from: string, to: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T23:59:59.999Z`);
  const rows = await db.select({ id: contentPosts.id }).from(contentPosts).where(
    and(
      eq(contentPosts.profileId, profileId),
      inArray(contentPosts.status, ["scheduled", "published"]),
      or(
        and(gte(contentPosts.publishedAt, start), lte(contentPosts.publishedAt, end)),
        and(isNull(contentPosts.publishedAt), gte(contentPosts.scheduledAt, start), lte(contentPosts.scheduledAt, end)),
      ),
    ),
  );
  return rows.length;
}

// ─── Reports ────────────────────────────────────────────────────────────

export async function createReport(input: Omit<InsertReport, "id"> & { id?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Adatbázis nem elérhető");
  const id = input.id ?? nanoid();
  await db.insert(reportsTable).values({ ...input, id });
  const rows = await db.select().from(reportsTable).where(eq(reportsTable.id, id)).limit(1);
  return rows[0]!;
}

export async function updateReport(
  reportId: string,
  patch: Partial<Omit<InsertReport, "id" | "profileId" | "createdAt">>,
) {
  const db = await getDb();
  if (!db) return null;
  await db.update(reportsTable).set(patch).where(eq(reportsTable.id, reportId));
  const rows = await db.select().from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
  return rows[0] ?? null;
}

/**
 * `brandId`: undefined = minden riport; null = csak az összesítettek;
 * string = csak az adott márkára készültek.
 */
export async function listReports(profileId: string, brandId?: string | null) {
  const db = await getDb();
  if (!db) return [];
  const brandFilter = brandId === undefined ? [] : [brandScope(reportsTable.brandId, brandId)];
  return db.select().from(reportsTable)
    .where(and(eq(reportsTable.profileId, profileId), ...brandFilter))
    .orderBy(desc(reportsTable.createdAt))
    .limit(50);
}

export async function getReportById(profileId: string, reportId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(reportsTable).where(
    and(eq(reportsTable.id, reportId), eq(reportsTable.profileId, profileId)),
  ).limit(1);
  return rows[0] ?? null;
}

// ─── Report Schedules ───────────────────────────────────────────────────

export async function upsertReportSchedule(input: Omit<InsertReportSchedule, "id">) {
  const db = await getDb();
  if (!db) return null;
  // egy profile-hoz egyetlen schedule (unique constraint a profileId-n)
  const existing = await db.select().from(reportSchedules)
    .where(eq(reportSchedules.profileId, input.profileId)).limit(1);
  const id = existing[0]?.id ?? nanoid();
  const values = { ...input, id };
  if (existing[0]) {
    await db.update(reportSchedules).set(values).where(eq(reportSchedules.id, id));
  } else {
    await db.insert(reportSchedules).values(values);
  }
  const rows = await db.select().from(reportSchedules).where(eq(reportSchedules.id, id)).limit(1);
  return rows[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM INVITE helperek (2026-08 — audit "Team invite flow")
// ═══════════════════════════════════════════════════════════════════════════════
import {
  teamInvites, type InsertTeamInvite, type TeamInvite,
} from "../drizzle/schema";

// A profile összes meghívója (legújabb elöl). A UI a pending listához hívja,
// de a revoked/accepted rekordokat is visszaadjuk audit-célból (a router szűr).
export async function getTeamInvitesByProfile(profileId: string): Promise<TeamInvite[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamInvites)
    .where(eq(teamInvites.profileId, profileId))
    .orderBy(desc(teamInvites.createdAt))
    .limit(100);
}

export async function getTeamInviteById(id: string): Promise<TeamInvite | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teamInvites).where(eq(teamInvites.id, id)).limit(1);
  return rows[0];
}

// A jövőbeni accept-flow ehhez a tokenhez keresi majd a meghívót.
export async function getTeamInviteByToken(token: string): Promise<TeamInvite | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teamInvites).where(eq(teamInvites.token, token)).limit(1);
  return rows[0];
}

// Ugyanarra a (profile, email) párra ne lehessen két aktív (pending) meghívó —
// a router ezzel dedupol, mielőtt új invite-ot hozna létre.
export async function getPendingInviteByProfileEmail(profileId: string, email: string): Promise<TeamInvite | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teamInvites)
    .where(and(
      eq(teamInvites.profileId, profileId),
      eq(teamInvites.email, email),
      eq(teamInvites.status, "pending"),
    )).limit(1);
  return rows[0];
}

export async function createTeamInvite(input: InsertTeamInvite): Promise<TeamInvite | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(teamInvites).values(input);
  const rows = await db.select().from(teamInvites).where(eq(teamInvites.id, input.id!)).limit(1);
  return rows[0] ?? null;
}

// Meghívó visszavonása — csak pending → revoked átmenet engedélyezett a routerben.
export async function updateTeamInviteStatus(id: string, status: TeamInvite["status"]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(teamInvites).set({ status }).where(eq(teamInvites.id, id));
}

// ─── Ötletbank (#11) ──────────────────────────────────────────────────────────
export async function getIdeasByProfile(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentIdeas).where(eq(contentIdeas.profileId, profileId)).orderBy(desc(contentIdeas.createdAt));
}
export async function getIdeaById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(contentIdeas).where(eq(contentIdeas.id, id)).limit(1);
  return r[0];
}
export async function createIdea(idea: InsertContentIdea) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(contentIdeas).values(idea);
  return getIdeaById(idea.id);
}
export async function createIdeas(ideas: InsertContentIdea[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (ideas.length) await db.insert(contentIdeas).values(ideas);
  return ideas.length;
}
export async function updateIdea(id: string, updates: Partial<InsertContentIdea>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(contentIdeas).set(updates).where(eq(contentIdeas.id, id));
  return getIdeaById(id);
}
export async function deleteIdea(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(contentIdeas).where(eq(contentIdeas.id, id));
}
