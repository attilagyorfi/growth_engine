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
  appUserId: varchar("appUserId", { length: 64 }),
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

// ─── Onboarding Sessions ──────────────────────────────────────────────────────

export const onboardingSessions = mysqlTable("onboarding_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["in_progress", "completed", "abandoned"]).default("in_progress").notNull(),
  currentStep: int("currentStep").default(1).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type InsertOnboardingSession = typeof onboardingSessions.$inferInsert;

// ─── Onboarding Answers ───────────────────────────────────────────────────────

export const onboardingAnswers = mysqlTable("onboarding_answers", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  step: int("step").notNull(),
  fieldKey: varchar("fieldKey", { length: 255 }).notNull(),
  fieldValue: text("fieldValue"),
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  userConfirmed: boolean("userConfirmed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OnboardingAnswer = typeof onboardingAnswers.$inferSelect;
export type InsertOnboardingAnswer = typeof onboardingAnswers.$inferInsert;

// ─── Uploaded Brand Assets ────────────────────────────────────────────────────

export const uploadedBrandAssets = mysqlTable("uploaded_brand_assets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileType: varchar("fileType", { length: 100 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  assetType: mysqlEnum("assetType", ["brand_guide", "visual_identity", "sales_material", "strategy", "buyer_persona", "faq", "other"]).default("other").notNull(),
  parsedContent: text("parsedContent"),
  parsedAt: timestamp("parsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UploadedBrandAsset = typeof uploadedBrandAssets.$inferSelect;
export type InsertUploadedBrandAsset = typeof uploadedBrandAssets.$inferInsert;

// ─── Company Intelligence ─────────────────────────────────────────────────────

export const companyIntelligence = mysqlTable("company_intelligence", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull().unique(),
  companySummary: text("companySummary"),
  brandDna: json("brandDna").$type<{
    coreValues: string[];
    personality: string[];
    differentiators: string[];
    brandPromise: string;
  }>(),
  offerMap: json("offerMap").$type<Array<{
    name: string;
    description: string;
    targetAudience: string;
    priceRange?: string;
    usp: string;
  }>>(),
  audienceMap: json("audienceMap").$type<Array<{
    segment: string;
    description: string;
    painPoints: string[];
    goals: string[];
    channels: string[];
  }>>(),
  competitorSnapshot: json("competitorSnapshot").$type<Array<{
    name: string;
    website?: string;
    strengths: string[];
    weaknesses: string[];
    positioning: string;
  }>>(),
  platformPriorities: json("platformPriorities").$type<Array<{
    platform: string;
    priority: number;
    rationale: string;
  }>>(),
  successGoals: json("successGoals").$type<{
    thirtyDay: string[];
    ninetyDay: string[];
    oneYear: string[];
  }>(),
  complianceConstraints: json("complianceConstraints").$type<string[]>(),
  aiWritingRules: json("aiWritingRules").$type<{
    doList: string[];
    dontList: string[];
    toneGuidelines: string;
    examplePhrases: string[];
  }>(),
  visualRules: json("visualRules").$type<{
    colorUsage: string;
    imageStyle: string;
    avoidList: string[];
  }>(),
  websiteAnalysis: json("websiteAnalysis").$type<{
    services: string[];
    keyMessages: string[];
    toneOfVoice: string;
    targetAudience: string;
    ctas: string[];
    competitorCandidates: string[];
  }>(),
  generatedAt: timestamp("generatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyIntelligence = typeof companyIntelligence.$inferSelect;
export type InsertCompanyIntelligence = typeof companyIntelligence.$inferInsert;

// ─── Competitor Profiles ──────────────────────────────────────────────────────

export const competitorProfiles = mysqlTable("competitor_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  website: varchar("website", { length: 500 }),
  positioning: text("positioning"),
  strengths: json("strengths").$type<string[]>(),
  weaknesses: json("weaknesses").$type<string[]>(),
  contentStrategy: text("contentStrategy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompetitorProfile = typeof competitorProfiles.$inferSelect;
export type InsertCompetitorProfile = typeof competitorProfiles.$inferInsert;

// ─── Target Personas ──────────────────────────────────────────────────────────

export const targetPersonas = mysqlTable("target_personas", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }),
  age: varchar("age", { length: 50 }),
  industry: varchar("industry", { length: 255 }),
  painPoints: json("painPoints").$type<string[]>(),
  goals: json("goals").$type<string[]>(),
  preferredChannels: json("preferredChannels").$type<string[]>(),
  buyingTriggers: json("buyingTriggers").$type<string[]>(),
  objections: json("objections").$type<string[]>(),
  messagingApproach: text("messagingApproach"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TargetPersona = typeof targetPersonas.$inferSelect;
export type InsertTargetPersona = typeof targetPersonas.$inferInsert;

// ─── Strategy Tasks ───────────────────────────────────────────────────────────

export const strategyTasks = mysqlTable("strategy_tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  strategyId: varchar("strategyId", { length: 64 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  platform: varchar("platform", { length: 100 }),
  format: varchar("format", { length: 100 }),
  funnelStage: mysqlEnum("funnelStage", ["awareness", "consideration", "decision", "retention"]).default("awareness").notNull(),
  weekNumber: int("weekNumber"),
  dueDate: timestamp("dueDate"),
  status: mysqlEnum("status", ["todo", "in_progress", "done", "skipped"]).default("todo").notNull(),
  assignedTo: varchar("assignedTo", { length: 255 }),
  contentPostId: varchar("contentPostId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StrategyTask = typeof strategyTasks.$inferSelect;
export type InsertStrategyTask = typeof strategyTasks.$inferInsert;

// ─── Content Calendar Items ───────────────────────────────────────────────────

export const contentCalendarItems = mysqlTable("content_calendar_items", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  contentPostId: varchar("contentPostId", { length: 64 }),
  strategyTaskId: varchar("strategyTaskId", { length: 64 }),
  title: varchar("title", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 100 }).notNull(),
  format: varchar("format", { length: 100 }),
  funnelStage: varchar("funnelStage", { length: 50 }),
  pillar: varchar("pillar", { length: 255 }),
  campaignTag: varchar("campaignTag", { length: 255 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["planned", "draft", "approved", "scheduled", "published", "cancelled"]).default("planned").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentCalendarItem = typeof contentCalendarItems.$inferSelect;
export type InsertContentCalendarItem = typeof contentCalendarItems.$inferInsert;

// ─── Content Feedback ─────────────────────────────────────────────────────────

export const contentFeedback = mysqlTable("content_feedback", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  contentPostId: varchar("contentPostId", { length: 64 }).notNull(),
  action: mysqlEnum("action", ["approved", "rejected", "edited", "requested_changes"]).notNull(),
  reason: text("reason"),
  editedFields: json("editedFields").$type<string[]>(),
  reviewerId: varchar("reviewerId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContentFeedback = typeof contentFeedback.$inferSelect;
export type InsertContentFeedback = typeof contentFeedback.$inferInsert;

// ─── Social Tokens ────────────────────────────────────────────────────────────

export const socialTokens = mysqlTable("social_tokens", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  platform: mysqlEnum("platform", ["linkedin", "facebook", "instagram", "twitter", "tiktok"]).notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiry: timestamp("tokenExpiry"),
  platformUserId: varchar("platformUserId", { length: 255 }),
  platformUsername: varchar("platformUsername", { length: 255 }),
  pageId: varchar("pageId", { length: 255 }),
  connected: boolean("connected").default(false).notNull(),
  scopes: json("scopes").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialToken = typeof socialTokens.$inferSelect;
export type InsertSocialToken = typeof socialTokens.$inferInsert;

// ─── Publishing Logs ──────────────────────────────────────────────────────────

export const publishingLogs = mysqlTable("publishing_logs", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  contentPostId: varchar("contentPostId", { length: 64 }).notNull(),
  platform: varchar("platform", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("pending").notNull(),
  platformPostId: varchar("platformPostId", { length: 255 }),
  platformPostUrl: varchar("platformPostUrl", { length: 1000 }),
  errorMessage: text("errorMessage"),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PublishingLog = typeof publishingLogs.$inferSelect;
export type InsertPublishingLog = typeof publishingLogs.$inferInsert;

// ─── Analytics Snapshots ──────────────────────────────────────────────────────

export const analyticsSnapshots = mysqlTable("analytics_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  contentPostId: varchar("contentPostId", { length: 64 }),
  platform: varchar("platform", { length: 100 }),
  metric: varchar("metric", { length: 255 }).notNull(),
  value: int("value").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;
export type InsertAnalyticsSnapshot = typeof analyticsSnapshots.$inferInsert;

// ─── AI Memories ──────────────────────────────────────────────────────────────

export const aiMemories = mysqlTable("ai_memories", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  memoryType: mysqlEnum("memoryType", ["approved_pattern", "rejected_pattern", "style_preference", "cta_preference", "content_preference", "client_correction"]).notNull(),
  context: varchar("context", { length: 255 }),
  content: text("content").notNull(),
  platform: varchar("platform", { length: 100 }),
  pillar: varchar("pillar", { length: 255 }),
  weight: int("weight").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiMemory = typeof aiMemories.$inferSelect;
export type InsertAiMemory = typeof aiMemories.$inferInsert;

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  profileId: varchar("profileId", { length: 64 }),
  userId: varchar("userId", { length: 64 }),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 255 }).notNull(),
  objectType: varchar("objectType", { length: 100 }).notNull(),
  objectId: varchar("objectId", { length: 64 }),
  objectTitle: varchar("objectTitle", { length: 500 }),
  changes: json("changes").$type<Record<string, { before: unknown; after: unknown }>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── App Users (saját auth, email+jelszó) ─────────────────────────────────────
export const appUsers = mysqlTable("app_users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["super_admin", "user"]).default("user").notNull(),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  profileId: varchar("profileId", { length: 64 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "starter", "pro", "agency"]).default("free").notNull(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  companyName: varchar("companyName", { length: 255 }),
  notes: text("notes"),
});
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = typeof appUsers.$inferInsert;

// ─── Password Reset Tokens ────────────────────────────────────────────────────
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ─── Strategy Versions ────────────────────────────────────────────────────────

export const strategyVersions = mysqlTable("strategy_versions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  versionNumber: int("versionNumber").notNull().default(1),
  title: varchar("title", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  quarterlyGoals: json("quarterlyGoals").$type<{
    q1?: string[]; q2?: string[]; q3?: string[]; q4?: string[];
  }>(),
  monthlyPriorities: json("monthlyPriorities").$type<Array<{
    month: string;
    priorities: string[];
    kpis: Array<{ label: string; target: string; current?: string }>;
  }>>(),
  weeklySprints: json("weeklySprints").$type<Array<{
    weekStart: string;
    tasks: Array<{ id: string; title: string; channel: string; status: string; assignee?: string }>;
  }>>(),
  executiveSummary: text("executiveSummary"),
  channelStrategy: json("channelStrategy").$type<Array<{
    channel: string; priority: number; rationale: string; tactics: string[];
  }>>(),
  campaignPriorities: json("campaignPriorities").$type<string[]>(),
  quickWins: json("quickWins").$type<Array<{
    title: string; description: string; impact: string; effort: string;
  }>>(),
  nextActions: json("nextActions").$type<Array<{
    title: string; description: string; urgency: "high" | "medium" | "low"; dueDate?: string;
  }>>(),
  archivedAt: timestamp("archivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StrategyVersion = typeof strategyVersions.$inferSelect;
export type InsertStrategyVersion = typeof strategyVersions.$inferInsert;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = mysqlTable("campaigns", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  strategyVersionId: varchar("strategyVersionId", { length: 64 }),
  title: varchar("title", { length: 255 }).notNull(),
  objective: text("objective"),
  targetAudience: text("targetAudience"),
  channels: json("channels").$type<string[]>(),
  budget: varchar("budget", { length: 64 }),
  startDate: varchar("startDate", { length: 20 }),
  endDate: varchar("endDate", { length: 20 }),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed", "archived"]).default("draft").notNull(),
  brief: json("brief").$type<{
    hook: string;
    mainMessage: string;
    cta: string;
    contentIdeas: Array<{ title: string; format: string; platform: string }>;
    kpis: Array<{ label: string; target: string }>;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Campaign Assets ──────────────────────────────────────────────────────────

export const campaignAssets = mysqlTable("campaign_assets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["copy", "image", "video", "email", "ad", "other"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  fileUrl: text("fileUrl"),
  platform: varchar("platform", { length: 64 }),
  status: mysqlEnum("status", ["draft", "review", "approved", "published"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CampaignAsset = typeof campaignAssets.$inferSelect;
export type InsertCampaignAsset = typeof campaignAssets.$inferInsert;

// ─── AI Recommendations ───────────────────────────────────────────────────────

export const recommendations = mysqlTable("recommendations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["strategy", "content", "campaign", "lead", "analytics"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  urgency: mysqlEnum("urgency", ["high", "medium", "low"]).default("medium").notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  isRead: boolean("isRead").default(false).notNull(),
  isDismissed: boolean("isDismissed").default(false).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});
export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

// ─── AI Usage Tracking ───────────────────────────────────────────────────────
export const aiUsage = mysqlTable("ai_usage", {
  id: int("id").autoincrement().primaryKey(),
  appUserId: varchar("appUserId", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(), // 'intelligence' | 'strategy' | 'content' | 'image'
  month: varchar("month", { length: 7 }).notNull(), // 'YYYY-MM'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiUsage = typeof aiUsage.$inferSelect;
export type InsertAiUsage = typeof aiUsage.$inferInsert;

// ─── In-App Notifications ─────────────────────────────────────────────────────

export const appNotifications = mysqlTable("app_notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  appUserId: varchar("appUserId", { length: 64 }).notNull(),
  profileId: varchar("profileId", { length: 64 }),
  type: mysqlEnum("type", [
    "approval_ready", "new_lead", "reply_received",
    "campaign_deadline", "strategy_update", "system"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  isRead: boolean("isRead").default(false).notNull(),
  actionUrl: varchar("actionUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AppNotification = typeof appNotifications.$inferSelect;
export type InsertAppNotification = typeof appNotifications.$inferInsert;

// ─── Social Connections ───────────────────────────────────────────────────────
export const socialConnections = mysqlTable("social_connections", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "linkedin", "twitter"]).notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: varchar("tokenExpiresAt", { length: 32 }),
  platformUserId: varchar("platformUserId", { length: 255 }),
  platformUsername: varchar("platformUsername", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SocialConnection = typeof socialConnections.$inferSelect;
export type InsertSocialConnection = typeof socialConnections.$inferInsert;

// ─── Scheduled Posts ──────────────────────────────────────────────────────────
export const scheduledPosts = mysqlTable("scheduled_posts", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: varchar("profileId", { length: 64 }).notNull(),
  contentId: varchar("contentId", { length: 64 }),
  platform: mysqlEnum("platform", ["facebook", "instagram", "linkedin", "twitter"]).notNull(),
  text: text("text").notNull(),
  imageUrl: text("imageUrl"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["pending", "published", "failed"]).default("pending").notNull(),
  publishedAt: timestamp("publishedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;
