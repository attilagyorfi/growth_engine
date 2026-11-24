/**
 * A Social Hub-események feldolgozása (G2, 0027-es táblák) — egy esemény, egy tranzakció.
 *
 * Amit garantál:
 *   - csak a küldési naplóban szereplő poszt (socialHubPostId ÉS socialHubClientId) eseménye hat,
 *     a napló profilján belül; minden más nyom nélkül kimarad;
 *   - az eseményazonosító egyedi kulcs: az ismétlés nem hat, hibánál a jelölés is visszagördül;
 *   - a döntést megalapozó olvasások zárolók (FOR UPDATE), mert a TiDB sima SELECT-je a tranzakció
 *     kezdetének pillanatképét adná. Zárolási sorrend: napló-sor (elsődleges kulcsra, mert a
 *     socialHubPostId nem indexelt) → poszt → állapot → értesítés. A küldési kísérletet nem
 *     zároljuk: a finishSent kísérlet → napló sorrendben zárol;
 *   - a content_posts-ot csak a post.published írja.
 */
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  aiMemories, appNotifications, appUsers, contentPosts, socialHubMemoryMarks, socialHubPostDeliveries,
  socialHubPostStates, socialHubSendAttempts, socialHubWebhookEvents,
} from "../../drizzle/schema";
import { isDuplicateEntryError } from "../db";
import { hashDraftContent, outboundDraftSchema, truncate, type OutboundDraft } from "./drafts";
import {
  applyEvent, EMPTY_POST_STATE, SOCIAL_HUB_EVENT_STATUS, visibleState, type SocialHubEventType, type SocialHubPostStatus,
} from "./postState";
import { run, type Tx } from "./store";

export type SocialHubWebhookEvent = {
  id: string;
  type: SocialHubEventType;
  createdAtMs: number;
  socialHubPostId: string;
  socialHubClientId: string;
};

export const MAX_MEMORY_LENGTH = 500;
/** Ennyi korábbi sikeres küldés között keressük a küldéskori szöveget. */
const MAX_ATTEMPTS_CHECKED = 20;
const PLATFORMS = contentPosts.platform.enumValues;

const deliveries = socialHubPostDeliveries;
const attempts = socialHubSendAttempts;
const states = socialHubPostStates;
type Delivery = typeof deliveries.$inferSelect;

const NOTIFICATION: Partial<Record<SocialHubPostStatus, { title: string; body: (title: string) => string }>> = {
  changes_requested: {
    title: "Módosítást kértek a Social Hubban",
    body: (title) => `A „${title}” posztnál módosítást kértek. A részleteket a Social Hubban látod.`,
  },
  failed: {
    title: "Nem sikerült megjelentetni egy posztot",
    body: (title) => `A „${title}” poszt nem jelent meg. A részleteket a Social Hubban látod.`,
  },
};

const MEMORY = {
  approved: { memoryType: "approved_pattern", context: "Jóváhagyva a Social Hubban" },
  changes_requested: { memoryType: "rejected_pattern", context: "Módosítást kértek a Social Hubban" },
} as const;

export const postLink = (postId: string) => `/tartalom-studio?poszt=${encodeURIComponent(postId)}`;

/** A már feldolgozott esemény: a tranzakció visszagördül, de a kézbesítés sikeres. */
class DuplicateEvent extends Error {}

/** Az eseményhez tartozó napló-sor zárolva; null, ha nincs (vagy nem egyértelmű). */
async function lockDelivery(tx: Tx, event: SocialHubWebhookEvent): Promise<Delivery | null> {
  const found = await tx.select({ id: deliveries.id }).from(deliveries)
    .where(and(eq(deliveries.socialHubClientId, event.socialHubClientId), eq(deliveries.socialHubPostId, event.socialHubPostId)))
    .limit(2);
  if (found.length !== 1) return null;
  const [row] = await tx.select().from(deliveries).where(eq(deliveries.id, found[0].id)).for("update");
  return row && row.socialHubPostId === event.socialHubPostId && row.socialHubClientId === event.socialHubClientId ? row : null;
}

/** Posztonként és állapotonként felhasználónként egy olvasatlan értesítés. */
async function notifyUsers(tx: Tx, profileId: string, post: { id: string; title: string }, status: SocialHubPostStatus, now: Date) {
  const text = NOTIFICATION[status];
  if (!text) return;
  const users = await tx.select({ id: appUsers.id }).from(appUsers)
    .where(and(eq(appUsers.profileId, profileId), eq(appUsers.active, true)));
  if (!users.length) return;
  const actionUrl = postLink(post.id);
  const unread = await tx.select({ appUserId: appNotifications.appUserId }).from(appNotifications)
    .where(and(
      inArray(appNotifications.appUserId, users.map((u) => u.id)), eq(appNotifications.profileId, profileId),
      eq(appNotifications.type, "system"), eq(appNotifications.title, text.title),
      eq(appNotifications.actionUrl, actionUrl), eq(appNotifications.isRead, false),
    )).for("update");
  const fresh = users.filter((u) => !unread.some((n) => n.appUserId === u.id));
  if (!fresh.length) return;
  await tx.insert(appNotifications).values(fresh.map((u) => ({
    id: nanoid(), appUserId: u.id, profileId, type: "system" as const, title: text.title, body: text.body(post.title), actionUrl, createdAt: now,
  })));
}

type SentDraft = { draft: OutboundDraft; platform: string };

/** A küldéskori vázlat a tárolt törzsből, a sentHash-sel igazolva; null, ha nem azonosítható. */
export function matchSentDraft(attempt: { body: string; postIds: string[] }, postId: string, sentHash: string): SentDraft | null {
  let drafts: unknown;
  try {
    drafts = (JSON.parse(attempt.body) as { drafts?: unknown } | null)?.drafts;
  } catch {
    return null;
  }
  if (!Array.isArray(drafts) || !Array.isArray(attempt.postIds) || drafts.length !== attempt.postIds.length) return null;
  const draft = outboundDraftSchema.safeParse(drafts[attempt.postIds.indexOf(postId)]);
  if (!draft.success) return null;
  // A poszt platformja azóta változhatott, ezért az egyezőt keressük.
  const platform = PLATFORMS.find((p) => hashDraftContent(draft.data, p) === sentHash);
  return platform ? { draft: draft.data, platform } : null;
}

/** A küldéskori vázlat; csak sikeres kísérletből, soha nem a poszt mostani tartalmából. */
async function findSentDraft(tx: Tx, delivery: Delivery): Promise<SentDraft | null> {
  if (!delivery.sentHash) return null;
  const candidates = await tx.select({ id: attempts.id }).from(attempts)
    .where(and(
      eq(attempts.profileId, delivery.profileId), eq(attempts.socialHubClientId, delivery.socialHubClientId),
      eq(attempts.status, "sent"), sql`json_contains(${attempts.postIds}, json_quote(${delivery.postId}))`,
    ))
    .orderBy(desc(attempts.lastTriedAt)).limit(MAX_ATTEMPTS_CHECKED);
  // Egyenként, mert egy törzs akár 1 MB is lehet.
  for (const { id } of candidates) {
    const [attempt] = await tx.select({ body: attempts.body, postIds: attempts.postIds }).from(attempts).where(eq(attempts.id, id));
    const match = attempt ? matchSentDraft(attempt, delivery.postId, delivery.sentHash) : null;
    if (match) return match;
  }
  return null;
}

async function rememberDecision(tx: Tx, delivery: Delivery, decision: keyof typeof MEMORY, now: Date) {
  const sent = await findSentDraft(tx, delivery);
  if (!sent) return;
  const { profileId, postId } = delivery;
  try {
    await tx.insert(socialHubMemoryMarks).values({ id: nanoid(), profileId, postId, decision, createdAt: now });
  } catch (err) {
    if (isDuplicateEntryError(err)) return;
    throw err;
  }
  await tx.insert(aiMemories).values({
    profileId, ...MEMORY[decision], content: truncate(sent.draft.text.trim(), MAX_MEMORY_LENGTH),
    platform: sent.platform, pillar: sent.draft.pillar ?? null, createdAt: now,
  });
}

async function applyInTransaction(tx: Tx, event: SocialHubWebhookEvent): Promise<"processed" | "ignored"> {
  const delivery = await lockDelivery(tx, event);
  if (!delivery) return "ignored";
  const { profileId, postId } = delivery;
  const [post] = await tx.select({ id: contentPosts.id, title: contentPosts.title, status: contentPosts.status }).from(contentPosts)
    .where(and(eq(contentPosts.id, postId), eq(contentPosts.profileId, profileId))).for("update");
  if (!post) return "ignored";

  const now = new Date();
  try {
    await tx.insert(socialHubWebhookEvents).values({
      eventId: event.id, profileId, socialHubPostId: event.socialHubPostId, type: event.type, processedAt: now,
    });
  } catch (err) {
    throw isDuplicateEntryError(err) ? new DuplicateEvent() : err;
  }

  const status = SOCIAL_HUB_EVENT_STATUS[event.type];
  const [stored] = await tx.select().from(states).where(eq(states.socialHubPostId, event.socialHubPostId)).for("update");
  const { record, applied } = applyEvent(stored ?? EMPTY_POST_STATE, { status, atMs: event.createdAtMs });
  const values = {
    latestStatus: record.latestStatus, latestAtMs: record.latestAtMs, failedAtMs: record.failedAtMs, publishedAtMs: record.publishedAtMs,
    profileId, postId, socialHubClientId: delivery.socialHubClientId, updatedAt: now,
  };
  if (stored) await tx.update(states).set(values).where(eq(states.socialHubPostId, event.socialHubPostId));
  else await tx.insert(states).values({ socialHubPostId: event.socialHubPostId, ...values });

  // A megjelent poszt így a régi ütemező sorából is kikerül; a meglévő publishedAt megmarad.
  if (status === "published" && post.status !== "published") {
    await tx.update(contentPosts).set({ status: "published", publishedAt: new Date(event.createdAtMs) })
      .where(and(eq(contentPosts.id, postId), eq(contentPosts.profileId, profileId), ne(contentPosts.status, "published")));
  }
  if (applied) await notifyUsers(tx, profileId, post, status, now);
  // A döntés a sorrend miatt elavult eseménynél is tanulság.
  if (status === "approved" || status === "changes_requested") await rememberDecision(tx, delivery, status, now);
  return "processed";
}

/** Hibánál minden visszagördül és SocialHubStoreError megy tovább (SQL és paraméter nélkül). */
export function processWebhookEvent(event: SocialHubWebhookEvent): Promise<"processed" | "ignored" | "duplicate"> {
  return run("webhook", async (db) => {
    try {
      return await db.transaction((tx) => applyInTransaction(tx, event));
    } catch (err) {
      if (err instanceof DuplicateEvent) return "duplicate";
      throw err;
    }
  });
}

/** A profil posztjainak Social Hub-állapota: posztonként a legutóbb sikeresen küldött változaté. */
export function listPostStates(profileId: string): Promise<{ postId: string; status: SocialHubPostStatus; at: Date }[]> {
  return run("listPostStates", async (db) => {
    const sent = await db.select({ id: deliveries.id, postId: deliveries.postId, socialHubPostId: deliveries.socialHubPostId, sentAt: deliveries.sentAt })
      .from(deliveries).where(and(eq(deliveries.profileId, profileId), isNotNull(deliveries.socialHubPostId)));
    if (!sent.length) return [];
    const rows = await db.select().from(states).where(eq(states.profileId, profileId));
    const newest = new Map<string, (typeof sent)[number]>();
    for (const row of sent) {
      const other = newest.get(row.postId);
      const diff = (row.sentAt?.getTime() ?? 0) - (other?.sentAt?.getTime() ?? 0);
      if (!other || diff > 0 || (diff === 0 && row.id > other.id)) newest.set(row.postId, row);
    }
    return Array.from(newest.values()).flatMap((row) => {
      const record = rows.find((s) => s.socialHubPostId === row.socialHubPostId && s.postId === row.postId);
      const state = record ? visibleState(record) : null;
      return state ? [{ postId: row.postId, status: state.status, at: new Date(state.atMs) }] : [];
    });
  }, () => []);
}
