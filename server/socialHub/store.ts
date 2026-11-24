/**
 * A Social Hub-kapcsolat, a webhook-titok és a küldési napló tárolója (G2, 0026-os táblák és
 * a 0027-es titoktábla).
 *
 * Amit garantál:
 *   - claim: EGY tranzakció; poszt + Social Hub-ügyfél szerint egyedi napló-sor, amelyet csak
 *     az foglalhat le, akinek az `expected` állapota még érvényes (compare-and-set). A kulcs,
 *     a cél ügyfél és a pontos törzs ugyanebben a tranzakcióban tárolódik. A foglalás a zárolt
 *     sorok állapotán múlik, nem a beszúrás affectedRows-értékén (mysql2: FOUND_ROWS).
 *   - reclaim: compare-and-set a runTokenre, így két egyidejű ismétlésből egy fut.
 *   - finishSent: a runTokentől független (a késve érkező siker is rögzül), de csak a saját
 *     kísérlet napló-sorait írja.
 *   - finishUnsent: csak a saját runTokennel, és soha nem írja felül a már „sent” állapotot.
 *   - A webhook-titok a kapcsolattal együtt él: bontáskor és a cím cseréjekor ugyanabban a
 *     tranzakcióban törlődik. A titoktábla hiánya a kapcsolat kezelését nem akasztja meg.
 *   - Elérhetetlen adatbázisnál minden művelet dob (SocialHubStoreError), hogy ne legyen
 *     env-visszaesés vagy dupla küldés. A hibában nincs SQL, paraméter vagy eredeti ok.
 */
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { socialHubConnection, socialHubPostDeliveries, socialHubSendAttempts, socialHubWebhookSecret } from "../../drizzle/schema";
import { getDb } from "../db";

export type StoredConnection = {
  baseUrl: string;
  apiKeyEnc: string;
  apiKeyLast4: string;
  updatedAt: Date | null;
};

export type StoredWebhookSecret = { secretEnc: string; updatedAt: Date };

export type SendAttemptStatus = "sending" | "sent" | "uncertain" | "failed";
export type DeliveryStatus = SendAttemptStatus | "new";

export type SendAttempt = {
  id: string;
  profileId: string;
  socialHubClientId: string;
  /** A cím hash-e: más Social Hubnak a régi kulcs és törzs nem küldhető. */
  baseUrlHash: string;
  idempotencyKey: string;
  /** A pontos kimenő JSON; ismétléskor bitre ugyanez megy. */
  body: string;
  /** A törzs drafts[] sorrendjében. */
  postIds: string[];
  status: SendAttemptStatus;
  runToken: string;
  firstTriedAt: Date;
  lastTriedAt: Date;
};

export type PostDelivery = {
  postId: string;
  socialHubClientId: string;
  status: DeliveryStatus;
  attemptId: string | null;
  /** Az utolsó kísérlet tartalma. */
  contentHash: string | null;
  /** Az utolsó SIKERES küldés tartalma, azonosítója és ideje. */
  sentHash: string | null;
  socialHubPostId: string | null;
  sentAt: Date | null;
};

export type ClaimItem = {
  postId: string;
  contentHash: string;
  draft: unknown;
  expected: { status: DeliveryStatus; attemptId: string | null };
};

export type ClaimInput = Omit<SendAttempt, "body" | "postIds" | "status"> & {
  createdBy: string;
  items: ClaimItem[];
  buildBody: (drafts: unknown[]) => string;
};

export interface SocialHubStore {
  getConnection(): Promise<StoredConnection | null>;
  /** Ha a cím eltér az addig érvényestől (tárolt, ennek hiányában env), a webhook-titok törlődik. */
  saveConnection(input: {
    baseUrl: string; apiKeyEnc: string; apiKeyLast4: string; updatedBy: string; envBaseUrl?: string | null;
  }): Promise<void>;
  /** A webhook-titkot is törli. */
  deleteConnection(): Promise<void>;
  getWebhookSecret(): Promise<StoredWebhookSecret | null>;
  saveWebhookSecret(input: { secretEnc: string; updatedBy: string }): Promise<void>;
  deleteWebhookSecret(): Promise<void>;
  getDeliveries(socialHubClientId: string, postIds: string[]): Promise<PostDelivery[]>;
  getAttempts(ids: string[]): Promise<SendAttempt[]>;
  /** Csak a valóban lefoglalt posztokból készül kísérlet; ha egy sem, null. */
  claim(input: ClaimInput): Promise<SendAttempt | null>;
  reclaim(attemptId: string, oldRunToken: string, newRunToken: string, now: Date): Promise<boolean>;
  finishSent(attemptId: string, sent: { postId: string; socialHubPostId: string }[], now: Date): Promise<void>;
  finishUnsent(attemptId: string, runToken: string, status: "failed" | "uncertain", lastError: string, now: Date): Promise<void>;
}

/** A felhasználónak is kiírható, rögzített szövegű hiba; szándékosan nincs `cause`. */
export class SocialHubStoreError extends TRPCError {
  constructor(missingTable = false) {
    super({
      code: "PRECONDITION_FAILED",
      message: missingTable ? "A Social Hubba küldés még nem áll készen. Próbáld meg később." : "A Social Hub adatai most nem érhetők el. Próbáld újra.",
    });
    this.name = "SocialHubStoreError";
  }
}

/** A MySQL hibakódja (pl. ER_NO_SUCH_TABLE); a drizzle az eredeti hibát a `cause`-ba csomagolja. */
function mysqlErrorCode(err: unknown): string | null {
  let current = err as { code?: unknown; errno?: unknown; cause?: unknown } | null | undefined;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++, current = current.cause as typeof current) {
    if (current.errno === 1146) return "ER_NO_SUCH_TABLE";
    if (typeof current.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(current.code)) return current.code;
  }
  return null;
}

/** Minden művelet közös burkolója: naplóba csak a művelet neve és a hibakód kerül. */
export async function run<T>(operation: string, work: (db: MySql2Database) => Promise<T>, onMissingTable?: () => T): Promise<T> {
  let code: string | null;
  try {
    const db = await getDb();
    if (db) return await work(db);
    code = "nincs adatbázis";
  } catch (err) {
    code = mysqlErrorCode(err);
  }
  const missingTable = code === "ER_NO_SUCH_TABLE";
  if (missingTable && onMissingTable) return onMissingTable();
  console.error(`[socialHub] tárolóhiba (${operation}): ${code ?? "ismeretlen"}`);
  throw new SocialHubStoreError(missingTable);
}

const CONNECTION_ID = "default";
const SECRET_ID = "default";
const MAX_ERROR_LENGTH = 255;
/** A le nem zárt kísérlet állapotai. */
const OPEN_STATUSES: SendAttemptStatus[] = ["sending", "uncertain"];

const attempts = socialHubSendAttempts;
const deliveries = socialHubPostDeliveries;

/** Posztonként eltérő érték egyetlen UPDATE-ben. */
const casePostId = (values: { postId: string; value: string }[]): SQL<string> =>
  sql<string>`case ${deliveries.postId} ${sql.join(values.map((v) => sql`when ${v.postId} then ${v.value}`), sql` `)} end`;

export type Tx = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];

/** A hiányzó titoktábla (a 0027 előtti indulás) nem akasztja meg a kapcsolat mentését és bontását. */
async function removeSecret(tx: Tx): Promise<void> {
  try {
    await tx.delete(socialHubWebhookSecret).where(eq(socialHubWebhookSecret.id, SECRET_ID));
  } catch (err) {
    if (mysqlErrorCode(err) !== "ER_NO_SUCH_TABLE") throw err;
  }
}

function sameBaseUrl(a: string, b: string): boolean {
  const normalize = (value: string) => {
    try {
      return new URL(value.trim()).toString().replace(/\/+$/, "");
    } catch {
      return value;
    }
  };
  return normalize(a) === normalize(b);
}

const databaseStore: SocialHubStore = {
  // A migráció előtti indulásnál (nincs tábla) az env-kapcsolat él tovább.
  getConnection: () => run<StoredConnection | null>("getConnection", async (db) => {
    const [row] = await db.select().from(socialHubConnection).where(eq(socialHubConnection.id, CONNECTION_ID)).limit(1);
    return row ? { baseUrl: row.baseUrl, apiKeyEnc: row.apiKeyEnc, apiKeyLast4: row.apiKeyLast4, updatedAt: row.updatedAt } : null;
  }, () => null),

  saveConnection: ({ envBaseUrl, ...input }) => run("saveConnection", (db) => db.transaction(async (tx) => {
    const values = { ...input, updatedAt: new Date() };
    const [current] = await tx.select({ baseUrl: socialHubConnection.baseUrl }).from(socialHubConnection)
      .where(eq(socialHubConnection.id, CONNECTION_ID)).for("update");
    await tx.insert(socialHubConnection).values({ id: CONNECTION_ID, ...values }).onDuplicateKeyUpdate({ set: values });
    const previous = current?.baseUrl ?? envBaseUrl ?? null;
    if (previous === null || !sameBaseUrl(previous, input.baseUrl)) await removeSecret(tx);
  })),

  deleteConnection: () => run("deleteConnection", (db) => db.transaction(async (tx) => {
    await tx.delete(socialHubConnection).where(eq(socialHubConnection.id, CONNECTION_ID));
    await removeSecret(tx);
  })),

  getWebhookSecret: () => run<StoredWebhookSecret | null>("getWebhookSecret", async (db) => {
    const [row] = await db.select({ secretEnc: socialHubWebhookSecret.secretEnc, updatedAt: socialHubWebhookSecret.updatedAt })
      .from(socialHubWebhookSecret).where(eq(socialHubWebhookSecret.id, SECRET_ID)).limit(1);
    return row ?? null;
  }, () => null),

  saveWebhookSecret: (input) => run("saveWebhookSecret", async (db) => {
    const values = { ...input, updatedAt: new Date() };
    await db.insert(socialHubWebhookSecret).values({ id: SECRET_ID, ...values }).onDuplicateKeyUpdate({ set: values });
  }),

  deleteWebhookSecret: () => run("deleteWebhookSecret", (db) => db.transaction(removeSecret)),

  getDeliveries: (socialHubClientId, postIds) => run("getDeliveries", async (db) => {
    if (!postIds.length) return [];
    const rows = await db.select().from(deliveries)
      .where(and(eq(deliveries.socialHubClientId, socialHubClientId), inArray(deliveries.postId, postIds)));
    return rows.map(({ id: _id, profileId: _profileId, ...row }) => ({ ...row, status: row.status as DeliveryStatus }));
  }),

  getAttempts: (ids) => run("getAttempts", async (db) => {
    if (!ids.length) return [];
    const rows = await db.select().from(attempts).where(inArray(attempts.id, ids));
    return rows.map(({ lastError: _e, createdBy: _b, createdAt: _a, ...row }) => ({ ...row, status: row.status as SendAttemptStatus }));
  }),

  claim: ({ items, buildBody, createdBy, ...base }) => run("claim", (db) => db.transaction(async (tx) => {
    if (!items.length) return null;
    // Rendezett zárolási sorrend, hogy két átfedő küldés ne akassza meg egymást.
    const sorted = [...items].sort((a, b) => (a.postId < b.postId ? -1 : 1));
    const fresh = sorted.filter((i) => i.expected.status === "new");
    if (fresh.length) {
      // A „new” sor senkit nem blokkol: ha mégsem foglaljuk le, a poszt küldhető marad.
      await tx.insert(deliveries).ignore().values(fresh.map((i) => ({
        id: nanoid(), profileId: base.profileId, postId: i.postId, socialHubClientId: base.socialHubClientId, status: "new",
      })));
    }
    const rows = await tx
      .select({ id: deliveries.id, postId: deliveries.postId, status: deliveries.status, attemptId: deliveries.attemptId })
      .from(deliveries)
      .where(and(eq(deliveries.socialHubClientId, base.socialHubClientId), inArray(deliveries.postId, sorted.map((i) => i.postId))))
      .orderBy(asc(deliveries.postId))
      .for("update");
    const claimed = items.flatMap((item) => {
      const row = rows.find((r) => r.postId === item.postId);
      return row && row.status === item.expected.status && row.attemptId === item.expected.attemptId ? [{ ...item, rowId: row.id }] : [];
    });
    if (!claimed.length) return null;

    // A korábbi sikeres küldés adatai (sentHash, socialHubPostId, sentAt) megmaradnak.
    const [updated] = await tx.update(deliveries)
      .set({ status: "sending", attemptId: base.id, contentHash: casePostId(claimed.map((c) => ({ postId: c.postId, value: c.contentHash }))) })
      .where(or(...claimed.map((c) => and(
        eq(deliveries.id, c.rowId), eq(deliveries.status, c.expected.status), sql`${deliveries.attemptId} <=> ${c.expected.attemptId}`,
      ))));
    // Zárolt soroknál nem fordulhat elő; ha mégis, a tranzakció visszagördül.
    if (updated.affectedRows !== claimed.length) throw new Error("claim conflict");

    const attempt: SendAttempt = {
      ...base, status: "sending", postIds: claimed.map((c) => c.postId), body: buildBody(claimed.map((c) => c.draft)),
    };
    await tx.insert(attempts).values({ ...attempt, createdBy, createdAt: base.firstTriedAt });
    return attempt;
  })),

  reclaim: (attemptId, oldRunToken, newRunToken, now) => run("reclaim", async (db) => {
    const [updated] = await db.update(attempts)
      .set({ runToken: newRunToken, status: "sending", lastTriedAt: now })
      .where(and(eq(attempts.id, attemptId), eq(attempts.runToken, oldRunToken), inArray(attempts.status, OPEN_STATUSES)));
    return updated.affectedRows === 1;
  }),

  finishSent: (attemptId, sent, now) => run("finishSent", (db) => db.transaction(async (tx) => {
    const [attempt] = await tx.select({ socialHubClientId: attempts.socialHubClientId }).from(attempts)
      .where(eq(attempts.id, attemptId)).for("update");
    if (!attempt) throw new Error("attempt not found");
    await tx.update(attempts).set({ status: "sent", lastError: null }).where(eq(attempts.id, attemptId));
    // Közben újabb kísérlet is foglalhatta a posztot: annak a sorát (és tartalmát) nem írjuk át.
    await tx.update(deliveries)
      .set({
        status: "sent", sentHash: sql`${deliveries.contentHash}`, sentAt: now,
        socialHubPostId: casePostId(sent.map((s) => ({ postId: s.postId, value: s.socialHubPostId }))),
      })
      .where(and(
        eq(deliveries.socialHubClientId, attempt.socialHubClientId), inArray(deliveries.postId, sent.map((s) => s.postId)),
        eq(deliveries.attemptId, attemptId), ne(deliveries.status, "sent"),
      ));
  })),

  finishUnsent: (attemptId, runToken, status, lastError, _now) => run("finishUnsent", (db) => db.transaction(async (tx) => {
    const own = and(eq(attempts.id, attemptId), eq(attempts.runToken, runToken), inArray(attempts.status, OPEN_STATUSES));
    const [attempt] = await tx.select({ socialHubClientId: attempts.socialHubClientId, postIds: attempts.postIds }).from(attempts)
      .where(own).for("update");
    if (!attempt) return; // közben más vette át, vagy már lezárult
    await tx.update(attempts).set({ status, lastError: lastError.slice(0, MAX_ERROR_LENGTH) }).where(own);
    await tx.update(deliveries).set({ status }).where(and(
      eq(deliveries.socialHubClientId, attempt.socialHubClientId), inArray(deliveries.postId, attempt.postIds),
      eq(deliveries.attemptId, attemptId), ne(deliveries.status, "sent"),
    ));
  })),
};

/** Az adatbázisos tároló; DATABASE_URL nélkül null. */
export function getSocialHubStore(): SocialHubStore | null {
  return process.env.DATABASE_URL ? databaseStore : null;
}
