/**
 * G2A Growth Engine – időzítő: az ütemezett posztok tényleges közzététele
 *
 * Eddig a felület „ütemezett” státuszt adott a posztoknak (Tartalom Studio,
 * naptár, Copilot), de SEMMI nem tette közzé őket. Az időzítő percenként:
 *   1. megkeresi a lejárt időpontú „scheduled” posztokat,
 *   2. ATOMI feltételes UPDATE-tel lefoglalja (scheduled → approved) — így két
 *      párhuzamos futás (pl. deploy közbeni átfedés) sem posztolhat duplán,
 *   3. a profil aktív kapcsolatán keresztül közzéteszi, majd „published”,
 *   4. hibánál: átmeneti → visszaállítja „scheduled”-re (max. 3 próbálkozás),
 *      végleges → „approved” marad + értesítés a felhasználónak.
 * A 24 óránál régebben lejárt posztokat NEM teszi közzé utólag (elavult tartalom),
 * hanem visszateszi „approved”-ba és értesít, hogy ütemezze újra.
 */
import type { ContentPost, SocialConnection } from "../drizzle/schema";
import { PLATFORM_LABEL, classifyPublishError, composePostText, publishWithConnection } from "./publishing";
import { runExpiryCheck, type ExpiryDeps } from "./connectionExpiry";

export const SCHEDULER_INTERVAL_MS = 60_000;
/** A social kapcsolatok lejárati ellenőrzése óránként (az első rögtön az induló futásnál). */
export const EXPIRY_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;

export type DuePost = Pick<ContentPost, "id" | "profileId" | "title" | "platform" | "content" | "hashtags" | "imageUrl" | "scheduledAt">;

export type SchedulerDeps = {
  now(): Date;
  findDuePosts(now: Date, limit: number): Promise<DuePost[]>;
  /** Feltételes átállítás scheduled → approved; true, ha EZ a futás foglalta le. */
  claim(postId: string): Promise<boolean>;
  /** Visszaállítás scheduled-re (átmeneti hiba utáni újrapróbáláshoz). */
  requeue(postId: string): Promise<void>;
  findConnection(profileId: string, platform: string): Promise<SocialConnection | null>;
  publish(conn: SocialConnection, text: string, imageUrl: string | null): Promise<{ postId: string }>;
  markPublished(post: DuePost, platformPostId: string): Promise<void>;
  logFailure(post: DuePost, message: string): Promise<void>;
  /** Sikertelen próbálkozások száma az aktuális ütemezés (scheduledAt) óta. */
  countFailures(postId: string, since: Date): Promise<number>;
  notify(profileId: string, title: string, body: string): Promise<void>;
};

export type TickResult = { published: number; failed: number; retried: number; stale: number };

export async function runSchedulerTick(deps: SchedulerDeps): Promise<TickResult> {
  const now = deps.now();
  const result: TickResult = { published: 0, failed: 0, retried: 0, stale: 0 };
  const due = await deps.findDuePosts(now, BATCH_SIZE);
  const staleByProfile = new Map<string, string[]>();

  for (const post of due) {
    const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : now;

    // Elavult (24 óránál régebben lejárt) → nem posztoljuk utólag.
    if (now.getTime() - scheduledAt.getTime() > STALE_AFTER_MS) {
      if (await deps.claim(post.id)) {
        result.stale++;
        const list = staleByProfile.get(post.profileId) ?? [];
        list.push(post.title);
        staleByProfile.set(post.profileId, list);
      }
      continue;
    }

    if (!(await deps.claim(post.id))) continue; // egy másik futás már viszi

    const label = PLATFORM_LABEL[post.platform] ?? post.platform;
    const conn = await deps.findConnection(post.profileId, post.platform);
    if (!conn) {
      const message = `Nincs csatlakoztatott ${label}-fiók. Csatlakoztasd a Beállítások → Integrációk alatt, majd ütemezd újra a posztot.`;
      await deps.logFailure(post, message);
      await deps.notify(post.profileId, `Nem sikerült közzétenni: „${post.title}”`, message);
      result.failed++;
      continue;
    }

    try {
      const { postId } = await deps.publish(conn, composePostText(post.content, post.hashtags), post.imageUrl ?? null);
      await deps.markPublished(post, postId);
      result.published++;
    } catch (err) {
      const { message, permanent } = classifyPublishError(post.platform, err);
      const attempts = (await deps.countFailures(post.id, scheduledAt)) + 1;
      await deps.logFailure(post, message);
      if (!permanent && attempts < MAX_ATTEMPTS) {
        await deps.requeue(post.id);
        result.retried++;
      } else {
        await deps.notify(post.profileId, `Nem sikerült közzétenni: „${post.title}”`,
          `${message}${permanent ? "" : ` (${attempts} próbálkozás után)`} A poszt a „Jóváhagyva” állapotba került — javítás után ütemezd újra.`);
        result.failed++;
      }
    }
  }

  for (const [profileId, titles] of Array.from(staleByProfile.entries())) {
    const shown = titles.slice(0, 5).map((t) => `„${t}”`).join(", ");
    await deps.notify(profileId, `${titles.length} ütemezett poszt időpontja lejárt`,
      `Ezek több mint 24 órája esedékesek voltak, ezért nem tettük közzé őket utólag: ${shown}${titles.length > 5 ? " …" : ""}. A „Jóváhagyva” oszlopban megtalálod őket — ütemezd újra, ha még aktuálisak.`);
  }
  return result;
}

// ─── Adatbázis-kötés + indítás ────────────────────────────────────────────

async function createDbDeps(): Promise<SchedulerDeps | null> {
  const { getDb, getProfileById } = await import("./db");
  const db = await getDb();
  if (!db) return null;
  const { contentPosts, socialConnections, publishingLogs, appNotifications } = await import("../drizzle/schema");
  const { and, eq, lte, gte, desc, count } = await import("drizzle-orm");
  const { nanoid } = await import("nanoid");

  const setStatus = async (postId: string, from: "scheduled" | "approved", to: "scheduled" | "approved") => {
    const [res] = await db.update(contentPosts).set({ status: to })
      .where(and(eq(contentPosts.id, postId), eq(contentPosts.status, from)));
    return (res as { affectedRows?: number }).affectedRows === 1;
  };

  return {
    now: () => new Date(),
    async findDuePosts(now, limit) {
      return db.select({
        id: contentPosts.id, profileId: contentPosts.profileId, title: contentPosts.title, platform: contentPosts.platform,
        content: contentPosts.content, hashtags: contentPosts.hashtags, imageUrl: contentPosts.imageUrl, scheduledAt: contentPosts.scheduledAt,
      }).from(contentPosts)
        .where(and(eq(contentPosts.status, "scheduled"), lte(contentPosts.scheduledAt, now)))
        .orderBy(contentPosts.scheduledAt)
        .limit(limit);
    },
    claim: (postId) => setStatus(postId, "scheduled", "approved"),
    async requeue(postId) { await setStatus(postId, "approved", "scheduled"); },
    async findConnection(profileId, platform) {
      const [conn] = await db.select().from(socialConnections)
        .where(and(eq(socialConnections.profileId, profileId), eq(socialConnections.platform, platform as SocialConnection["platform"]), eq(socialConnections.isActive, true)))
        .orderBy(desc(socialConnections.createdAt), desc(socialConnections.id)) // = social.listConnections sorrendje
        .limit(1);
      return conn ?? null;
    },
    publish: (conn, text, imageUrl) => publishWithConnection(conn, text, imageUrl),
    async markPublished(post, platformPostId) {
      const publishedAt = new Date();
      await db.update(contentPosts).set({ status: "published", publishedAt }).where(eq(contentPosts.id, post.id));
      await db.insert(publishingLogs).values({
        profileId: post.profileId, contentPostId: post.id, platform: post.platform,
        status: "success", platformPostId: platformPostId || null, publishedAt,
      });
    },
    async logFailure(post, message) {
      await db.insert(publishingLogs).values({
        profileId: post.profileId, contentPostId: post.id, platform: post.platform, status: "failed", errorMessage: message,
      });
    },
    async countFailures(postId, since) {
      const [row] = await db.select({ n: count() }).from(publishingLogs)
        .where(and(eq(publishingLogs.contentPostId, postId), eq(publishingLogs.status, "failed"), gte(publishingLogs.createdAt, since)));
      return Number(row?.n ?? 0);
    },
    async notify(profileId, title, body) {
      const profile = await getProfileById(profileId);
      if (!profile?.appUserId) return;
      await db.insert(appNotifications).values({
        id: nanoid(), appUserId: profile.appUserId, profileId, type: "system", title: title.slice(0, 255), body, actionUrl: "/tartalom-studio",
      });
    },
  };
}

async function createExpiryDeps(): Promise<ExpiryDeps | null> {
  const { getDb, getProfileById } = await import("./db");
  const db = await getDb();
  if (!db) return null;
  const { socialConnections, appNotifications } = await import("../drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  const { nanoid } = await import("nanoid");
  return {
    now: () => new Date(),
    listActiveConnections: () => db.select({
      id: socialConnections.id, profileId: socialConnections.profileId, platform: socialConnections.platform,
      platformUsername: socialConnections.platformUsername, tokenExpiresAt: socialConnections.tokenExpiresAt,
    }).from(socialConnections).where(eq(socialConnections.isActive, true)),
    async hasNotification(profileId, title) {
      const rows = await db.select({ id: appNotifications.id }).from(appNotifications)
        .where(and(eq(appNotifications.profileId, profileId), eq(appNotifications.title, title.slice(0, 255))))
        .limit(1);
      return rows.length > 0;
    },
    async notify(profileId, title, body) {
      const profile = await getProfileById(profileId);
      if (!profile?.appUserId) return;
      await db.insert(appNotifications).values({
        id: nanoid(), appUserId: profile.appUserId, profileId, type: "system", title: title.slice(0, 255), body, actionUrl: "/beallitasok?tab=integrations",
      });
    },
  };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastExpiryCheck = 0;

/** Egy futás az élő adatbázison (átfedés-védelemmel); óránként a kapcsolatok lejáratát is nézi. */
export async function runSchedulerOnce(): Promise<TickResult | null> {
  if (running) return null;
  running = true;
  try {
    const deps = await createDbDeps();
    if (!deps) return null;
    const result = await runSchedulerTick(deps);
    if (result.published || result.failed || result.retried || result.stale) {
      console.log(`[Scheduler] közzétéve: ${result.published}, sikertelen: ${result.failed}, újrapróbál: ${result.retried}, lejárt: ${result.stale}`);
    }
    if (Date.now() - lastExpiryCheck >= EXPIRY_CHECK_INTERVAL_MS) {
      lastExpiryCheck = Date.now();
      try {
        const expiryDeps = await createExpiryDeps();
        const expiry = expiryDeps ? await runExpiryCheck(expiryDeps) : null;
        if (expiry?.notified) console.log(`[Scheduler] lejárati figyelmeztetés: ${expiry.notified}`);
      } catch (err) {
        console.error("[Scheduler] A lejárat-ellenőrzés hibára futott:", err);
      }
    }
    return result;
  } catch (err) {
    console.error("[Scheduler] Hiba a futás közben:", err);
    return null;
  } finally {
    running = false;
  }
}

/** Indítás a szerverrel együtt (production-ben alapból be; SCHEDULER_ENABLED=false kikapcsolja). */
export function startScheduler(opts: { enabled: boolean }) {
  if (!opts.enabled || timer) return;
  console.log("[Scheduler] Elindult — percenként ellenőrzi az ütemezett posztokat.");
  setTimeout(() => { void runSchedulerOnce(); }, 30_000);
  timer = setInterval(() => { void runSchedulerOnce(); }, SCHEDULER_INTERVAL_MS);
  timer.unref?.();
}
