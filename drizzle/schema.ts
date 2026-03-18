import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Client Profiles ─────────────────────────────────────────────────────────

export const clientProfiles = mysqlTable("client_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  initials: varchar("initials", { length: 4 }).notNull(),
  color: varchar("color", { length: 100 }).notNull().default("oklch(0.6 0.2 255)"),
  website: varchar("website", { length: 500 }),
  industry: varchar("industry", { length: 255 }),
  description: text("description"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#3B82F6"),
  secondaryColor: varchar("secondaryColor", { length: 20 }).default("#10B981"),
  fontHeading: varchar("fontHeading", { length: 100 }).default("Sora"),
  fontBody: varchar("fontBody", { length: 100 }).default("Inter"),
  brandGuidelineUrl: varchar("brandGuidelineUrl", { length: 500 }),
  brandVoice: json("brandVoice").$type<{
    tone: string; style: string; avoid: string; keywords: string[];
  }>(),
  contentPillars: json("contentPillars").$type<Array<{
    id: string; name: string; description: string; active: boolean; percentage: number;
  }>>(),
  socialAccounts: json("socialAccounts").$type<Array<{
    platform: string; handle: string; connected: boolean; followers?: number; lastSync?: string;
  }>>(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClientProfile = typeof clientProfiles.$inferSelect;
export type InsertClientProfile = typeof clientProfiles.$inferInsert;

// ─── Leads ────────────────────────────────────────────────────────────────────

export const leads = mysqlTable("leads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  position: varchar("position", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  website: varchar("website", { length: 500 }),
  source: varchar("source", { length: 100 }).default("manual"),
  status: mysqlEnum("status", ["new", "researched", "email_draft", "approved", "sent", "replied", "meeting", "closed_won", "closed_lost"]).default("new").notNull(),
  score: int("score").default(0),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Outbound Emails ──────────────────────────────────────────────────────────

export const outboundEmails = mysqlTable("outbound_emails", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  leadId: varchar("leadId", { length: 64 }),
  to: varchar("to", { length: 320 }).notNull(),
  toName: varchar("toName", { length: 255 }),
  company: varchar("company", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["draft", "approved", "sent", "opened", "replied", "bounced"]).default("draft").notNull(),
  sentAt: timestamp("sentAt"),
  openedAt: timestamp("openedAt"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutboundEmail = typeof outboundEmails.$inferSelect;
export type InsertOutboundEmail = typeof outboundEmails.$inferInsert;

// ─── Inbound Emails ───────────────────────────────────────────────────────────

export const inboundEmails = mysqlTable("inbound_emails", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  from: varchar("from", { length: 320 }).notNull(),
  fromName: varchar("fromName", { length: 255 }),
  company: varchar("company", { length: 255 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  category: mysqlEnum("category", ["interested", "not_interested", "question", "meeting_request", "out_of_office", "unsubscribe", "other"]).default("other").notNull(),
  read: boolean("read").default(false).notNull(),
  relatedOutboundId: varchar("relatedOutboundId", { length: 64 }),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InboundEmail = typeof inboundEmails.$inferSelect;
export type InsertInboundEmail = typeof inboundEmails.$inferInsert;

// ─── Content Posts ────────────────────────────────────────────────────────────

export const contentPosts = mysqlTable("content_posts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "facebook", "instagram", "twitter", "tiktok"]).notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }),
  imagePrompt: text("imagePrompt"),
  hashtags: json("hashtags").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "approved", "scheduled", "published", "rejected"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  publishedAt: timestamp("publishedAt"),
  pillar: varchar("pillar", { length: 255 }),
  weekNumber: int("weekNumber"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentPost = typeof contentPosts.$inferSelect;
export type InsertContentPost = typeof contentPosts.$inferInsert;

// ─── Strategies ───────────────────────────────────────────────────────────────

export const strategies = mysqlTable("strategies", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  month: varchar("month", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["active", "draft", "archived"]).default("draft").notNull(),
  summary: text("summary"),
  goals: json("goals").$type<string[]>(),
  weeklyPlans: json("weeklyPlans").$type<Array<{
    week: number; focus: string; actions: string[]; cta: string;
  }>>(),
  kpis: json("kpis").$type<Array<{
    metric: string; target: string; current?: string;
  }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = typeof strategies.$inferInsert;

// ─── Email Integrations ───────────────────────────────────────────────────────

export const emailIntegrations = mysqlTable("email_integrations", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull().unique(),
  provider: mysqlEnum("provider", ["gmail", "outlook"]).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiry: timestamp("tokenExpiry"),
  connected: boolean("connected").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailIntegration = typeof emailIntegrations.$inferSelect;
export type InsertEmailIntegration = typeof emailIntegrations.$inferInsert;
