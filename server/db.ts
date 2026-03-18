import { eq, desc } from "drizzle-orm";
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
