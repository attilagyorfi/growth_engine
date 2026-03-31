import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users, InsertUser,
  clientProfiles, InsertClientProfile,
  leads, InsertLead,
  outboundEmails, InsertOutboundEmail,
  inboundEmails, InsertInboundEmail,
  contentPosts, InsertContentPost,
  strategies, InsertStrategy,
  emailIntegrations, InsertEmailIntegration,
} from "../drizzle/schema";
import type { InboundEmail } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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

export async function getProfileById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientProfiles).where(eq(clientProfiles.id, id)).limit(1);
  return result[0];
}

export async function upsertProfile(profile: InsertClientProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(clientProfiles).values(profile).onDuplicateKeyUpdate({ set: profile });
  return getProfileById(profile.id);
}

export async function deleteProfile(id: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(clientProfiles).where(eq(clientProfiles.id, id));
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
  contentFeedback, InsertContentFeedback,
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

export async function getStrategyTasks(profileId: string, strategyId?: string) {
  const db = await getDb();
  if (!db) return [];
  if (strategyId) {
    return db.select().from(strategyTasks)
      .where(eq(strategyTasks.strategyId, strategyId));
  }
  return db.select().from(strategyTasks).where(eq(strategyTasks.profileId, profileId));
}

export async function upsertStrategyTask(data: InsertStrategyTask) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(strategyTasks).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
  const result = await db.select().from(strategyTasks).where(eq(strategyTasks.id, data.id)).limit(1);
  return result[0];
}

// ─── AI Memories ──────────────────────────────────────────────────────────────

export async function getAiMemories(profileId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiMemories).where(eq(aiMemories.profileId, profileId));
}

export async function createAiMemory(data: InsertAiMemory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(aiMemories).values(data);
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
  const result = await db.select().from(strategyVersions)
    .where(and(eq(strategyVersions.profileId, profileId), eq(strategyVersions.isActive, true)))
    .limit(1);
  return result[0];
}

export async function upsertStrategyVersion(data: InsertStrategyVersion) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(strategyVersions).values(data).onDuplicateKeyUpdate({ set: data });
  const result = await db.select().from(strategyVersions).where(eq(strategyVersions.id, data.id)).limit(1);
  return result[0];
}

export async function setActiveStrategyVersion(profileId: string, versionId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Deactivate all versions for this profile
  await db.update(strategyVersions).set({ isActive: false }).where(eq(strategyVersions.profileId, profileId));
  // Activate the selected version
  await db.update(strategyVersions).set({ isActive: true }).where(eq(strategyVersions.id, versionId));
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
