/**
 * A márkaprofil új mezőinek és a szinkron állapotának tárolója (G2, 0028-as tábla).
 *
 * Amit garantál:
 *   - sort csak létező profilhoz hoz létre: a profilsor zárolásával, ugyanabban a tranzakcióban
 *     (a deleteProfile is ezt zárolja először). Minden más írás feltételes UPDATE, így a törölt
 *     profil sora nem jön létre újra;
 *   - profilonként egy bérlet (egyedi token + lejárat), amely több példány között is véd. A
 *     foglalás nem az affectedRows-on (mysql2: FOUND_ROWS), hanem a visszaolvasott tokenen múlik.
 *     A lejárat az ADATBÁZIS órájával, ezredmásodpercben számolódik;
 *   - begin: a cél és a „kísérlet indult” jelzés a küldés ELŐTT, a bérletet és a párosítást
 *     ellenőrző feltételes UPDATE-ben rögzül, a bérlet ugyanitt megújul;
 *   - finish: csak az élő, saját bérlettel ír. A bérletet csak akkor engedi el, ha közben nem
 *     jött újabb változás, így mentés nem vész el.
 */
import { and, eq, gt, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { clientProfiles, socialHubBrandProfiles } from "../../drizzle/schema";
import type { BrandRules } from "./brandProfile";
import { run, type Tx } from "./store";

export type BrandRow = typeof socialHubBrandProfiles.$inferSelect;
export type BrandTarget = { ref: string; urlHash: string; clientId: string };

export type BrandOutcome =
  | { kind: "sent"; hash: string }
  /** Nincs mit küldeni (üres, és ehhez a célhoz még nem ment semmi). */
  | { kind: "empty" }
  /** Közben megszűnt a párosítás vagy a kapcsolat: nem hiba, a változás függőben marad. */
  | { kind: "skipped" }
  /** Biztosan nem ment át. `restore`: a kísérlet előtti állapot, ha a begin már lefutott. */
  | { kind: "failed"; code: string; target: string; restore?: Pick<BrandRow, "maybeSent" | "sentHash"> }
  /** Nem tudjuk, átment-e: a bérlet még `holdMs` ideig él, hogy a késve beérő kérés ne előzzön. */
  | { kind: "uncertain"; code: string; target: string; holdMs: number };

export interface BrandStore {
  /** null, ha nincs sor. Hiányzó táblánál `missingTable`. */
  read(profileId: string): Promise<{ row: BrandRow | null; nowMs: number; missingTable: boolean }>;
  /** false, ha a profil nem létezik. A mentés egyben új változás is (requestedRev). */
  saveRules(profileId: string, rules: BrandRules): Promise<boolean>;
  bumpRev(profileId: string): Promise<boolean>;
  /** A bérlet, ha szabad és van küldendő változás; különben null. */
  acquire(profileId: string, token: string, leaseMs: number): Promise<BrandRow | null>;
  /** `sameTarget`: a legutóbbi küldés is ide ment; különben a régi siker ideje is törlődik. */
  begin(profileId: string, token: string, target: BrandTarget, opts: { sameTarget: boolean; minLeftMs: number; leaseMs: number }): Promise<boolean>;
  /** Ha közben nőtt a requestedRev és `renewMs` > 0, a bérlet megmarad, és az új sort adja vissza. */
  finish(profileId: string, token: string, rev: number, outcome: BrandOutcome, renewMs: number): Promise<BrandRow | null>;
}

const t = socialHubBrandProfiles;
/** Az adatbázis órája (epoch ms); az UTC miatt az óraátállítás sem zavarja. */
const dbNow: SQL<number> = sql<number>`(TIMESTAMPDIFF(MICROSECOND, '1970-01-01 00:00:00', UTC_TIMESTAMP(3)) DIV 1000)`;
const dbNowPlus = (ms: number) => sql<number>`(${dbNow} + ${ms})`;

async function upsertForProfile(tx: Tx, profileId: string, rules: BrandRules | null): Promise<boolean> {
  const [profile] = await tx.select({ id: clientProfiles.id }).from(clientProfiles).where(eq(clientProfiles.id, profileId)).for("update");
  if (!profile) return false;
  const values = rules ?? { requiredPhrases: [], forbiddenPhrases: [], requiredDisclaimer: null };
  await tx.insert(t).values({ profileId, ...values, requestedRev: 1, syncedRev: 0, maybeSent: false })
    .onDuplicateKeyUpdate({ set: { ...(rules ?? {}), requestedRev: sql`${t.requestedRev} + 1` } });
  return true;
}

const databaseStore: BrandStore = {
  read: (profileId) => run<Awaited<ReturnType<BrandStore["read"]>>>("brandRead", async (db) => {
    const [row] = await db.select({ row: t, nowMs: dbNow }).from(t).where(eq(t.profileId, profileId)).limit(1);
    return { row: row?.row ?? null, nowMs: Number(row?.nowMs ?? 0), missingTable: false };
  }, () => ({ row: null, nowMs: 0, missingTable: true })),

  saveRules: (profileId, rules) => run("brandSaveRules", (db) => db.transaction((tx) => upsertForProfile(tx, profileId, rules))),

  bumpRev: (profileId) => run("brandBumpRev", (db) => db.transaction((tx) => upsertForProfile(tx, profileId, null))),

  acquire: (profileId, token, leaseMs) => run("brandAcquire", async (db) => {
    await db.update(t).set({ leaseToken: token, leaseUntilMs: dbNowPlus(leaseMs) })
      .where(and(eq(t.profileId, profileId), gt(t.requestedRev, t.syncedRev), or(isNull(t.leaseUntilMs), lte(t.leaseUntilMs, dbNow))));
    const [row] = await db.select().from(t).where(and(eq(t.profileId, profileId), eq(t.leaseToken, token))).limit(1);
    return row ?? null;
  }),

  begin: (profileId, token, target, { sameTarget, minLeftMs, leaseMs }) => run("brandBegin", async (db) => {
    const [updated] = await db.update(t)
      .set({
        sentHash: null, maybeSent: true, ...(sameTarget ? {} : { sentAtMs: null }),
        targetRef: target.ref, targetUrlHash: target.urlHash, targetClientId: target.clientId,
        leaseUntilMs: dbNowPlus(leaseMs),
      })
      .where(and(
        eq(t.profileId, profileId), eq(t.leaseToken, token), gt(t.leaseUntilMs, dbNowPlus(minLeftMs)),
        sql`exists (select 1 from ${clientProfiles} where ${clientProfiles.id} = ${profileId} and ${clientProfiles.externalRef} = ${target.ref})`,
      ));
    return updated.affectedRows === 1;
  }),

  finish: (profileId, token, rev, outcome, renewMs) => run("brandFinish", (db) => db.transaction(async (tx) => {
    const own = and(eq(t.profileId, profileId), eq(t.leaseToken, token), gt(t.leaseUntilMs, dbNow));
    const [row] = await tx.select().from(t).where(own).for("update");
    if (!row) return null; // lejárt, más vette át, vagy törölték a profilt
    const again = renewMs > 0 && row.requestedRev > rev && (outcome.kind === "sent" || outcome.kind === "empty" || outcome.kind === "failed");
    const set: Partial<Record<keyof BrandRow, unknown>> = again
      ? { leaseUntilMs: dbNowPlus(renewMs) }
      : { leaseToken: null, leaseUntilMs: outcome.kind === "uncertain" ? dbNowPlus(outcome.holdMs) : null };
    if (outcome.kind === "sent") Object.assign(set, { sentHash: outcome.hash, sentAtMs: dbNow, maybeSent: true });
    if (outcome.kind === "sent" || outcome.kind === "empty") {
      Object.assign(set, { syncedRev: rev, lastErrorCode: null, lastErrorAtMs: null, lastErrorTarget: null });
    }
    if (outcome.kind === "failed" || outcome.kind === "uncertain") {
      Object.assign(set, { lastErrorCode: outcome.code, lastErrorAtMs: dbNow, lastErrorTarget: outcome.target });
    }
    if (outcome.kind === "failed" && outcome.restore) Object.assign(set, outcome.restore);
    await tx.update(t).set(set as any).where(own);
    if (!again) return null;
    const [next] = await tx.select().from(t).where(own);
    return next ?? null;
  })),
};

/** Az adatbázisos tároló; DATABASE_URL nélkül null. */
export function getBrandStore(): BrandStore | null {
  return process.env.DATABASE_URL ? databaseStore : null;
}
