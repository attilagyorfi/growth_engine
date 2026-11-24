/**
 * G2 – a márkaprofil-szinkron adatbázisos tárolója (0028).
 * Valódi adatbázis nélkül: a valódi drizzle fut egy felvevő hamis mysql2-poolon, így a kiadott
 * SQL-t, a paramétereket és a tranzakciók határát ellenőrizzük (a valódi zárolást nem).
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/mysql-core";

const h = vi.hoisted(() => ({ calls: [] as { sql: string; params: any[] }[], on: (_sql: string, _params: any[]): any => undefined }));
vi.mock("mysql2/promise", () => {
  const query = async (q: any, params: any[] = []) => {
    const sql = typeof q === "string" ? q : q.sql;
    h.calls.push({ sql, params });
    if (/^(begin|commit|rollback|SELECT 1)/i.test(sql)) return [{}];
    return [h.on(sql, params) ?? (/^select/i.test(sql) ? [] : { affectedRows: 1 }), []];
  };
  const conn = { query, execute: query, release: () => {} };
  return { default: { createPool: () => ({ ...conn, getConnection: async () => conn }) } };
});

import { socialHubBrandProfiles } from "../drizzle/schema";
import { deleteProfile, getDb, PROFILE_OWNED_TABLES } from "./db";
import { getBrandStore } from "./socialHub/brandStore";
import { SocialHubStoreError } from "./socialHub/store";

const P = "p-a";
const find = (re: RegExp) => h.calls.filter((c) => re.test(c.sql));
const kinds = () => h.calls.map((c) => c.sql.split(" ")[0].toLowerCase());
const config = getTableConfig(socialHubBrandProfiles);
/** Egy sor az oszlopok sorrendjében, ahogy a pool adja. */
const rowOf = (over: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    profileId: P, requiredPhrases: ["a"], forbiddenPhrases: [], requestedRev: 3, syncedRev: 2, leaseToken: "tok", leaseUntilMs: 9_999, maybeSent: 0, ...over,
  };
  return config.columns.map((c) => base[c.name] ?? null);
};
const onRow = (over: Record<string, unknown> = {}) => { h.on = (sql) => (/^select/.test(sql) ? [rowOf(over)] : undefined); };
const store = () => getBrandStore()!;
const rules = { requiredPhrases: ["egy, kettő"], forbiddenPhrases: ["olcsó"], requiredDisclaimer: "Záradék" };
const target = { ref: "viba", urlHash: "hash", clientId: "c-1" };
const DB_CLOCK = /UTC_TIMESTAMP\(3\)/;

let logs: string[];
beforeEach(async () => {
  logs = []; h.on = () => undefined;
  vi.stubEnv("DATABASE_URL", "mysql://teszt@localhost/teszt");
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation((...x) => { logs.push(x.map(String).join(" ")); });
  await getDb();
  h.calls = [];
});
afterEach(() => {
  expect(logs.join("\n")).not.toMatch(/SZIVARGAS|insert into|Failed query/);
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});

describe("0028-as migráció", () => {
  const raw = readFileSync("drizzle/0028_social_hub_brand_profile.sql", "utf8").replace(/\r/g, "");
  const statements = raw.split("--> statement-breakpoint").map((s) => s.split("\n").filter((l) => !l.startsWith("--")).join("\n").trim());
  const lines = statements[0].slice(statements[0].indexOf("(\n") + 2, statements[0].lastIndexOf("\n)")).split("\n").map((l) => l.trim().replace(/,$/, ""));

  it("egyetlen CREATE TABLE IF NOT EXISTS, más utasítás és json/text alapérték nélkül", () => {
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^CREATE TABLE IF NOT EXISTS `social_hub_brand_profiles` \(\n[^;]*\n\);$/);
    expect(statements[0]).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|INDEX|REFERENCES|DEFAULT)\b/i);
    expect(lines.filter((l) => !l.startsWith("`"))).toEqual(["CONSTRAINT `social_hub_brand_profiles_profileId` PRIMARY KEY(`profileId`)"]);
  });

  it("egyezik a sémával, szerepel a naplóban és a profiltörlés kaszkádjában", () => {
    expect(config.columns.map((c) => `\`${c.name}\` ${c.getSQLType()}${c.notNull ? " NOT NULL" : " NULL"}`)).toEqual(lines.filter((l) => l.startsWith("`")));
    expect(config.columns.some((c) => c.hasDefault)).toBe(false);
    const { entries } = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    const at = entries.findIndex((e: any) => e.tag === "0028_social_hub_brand_profile");
    expect(entries[at]).toMatchObject({ idx: 19, breakpoints: true });
    expect(entries[at - 1].tag).toBe("0027_social_hub_webhook");
    expect(entries[at].when).toBeGreaterThan(entries[at - 1].when);
    expect(PROFILE_OWNED_TABLES).toContain("socialHubBrandProfiles");
  });
});

describe("sor csak létező profilhoz", () => {
  it("mentés és változásjelzés: egy tranzakció, a profilsor zárolásával, atomi növeléssel", async () => {
    h.on = (sql) => (/^select .*client_profiles/.test(sql) ? [[P]] : undefined);
    expect(await store().saveRules(P, rules)).toBe(true);
    expect(kinds()).toEqual(["begin", "select", "insert", "commit"]);
    expect(h.calls[1].sql).toMatch(/from `client_profiles` where .* for update$/);
    expect(h.calls[2].sql).toMatch(/on duplicate key update .*`requestedRev` = .*`requestedRev` \+ 1/);
    expect(h.calls[2].params).toEqual(expect.arrayContaining([JSON.stringify(["egy, kettő"]), JSON.stringify(["olcsó"]), "Záradék"]));
    h.calls = [];
    expect(await store().bumpRev(P)).toBe(true);
    const update = h.calls[2].sql.split("on duplicate key update")[1];
    expect(update).toContain("requestedRev");
    expect(update).not.toMatch(/requiredPhrases|forbiddenPhrases|requiredDisclaimer/);
  });

  it("törölt profilnál nincs beszúrás", async () => {
    expect(await store().saveRules(P, rules)).toBe(false);
    expect(await store().bumpRev(P)).toBe(false);
    expect(find(/^insert/)).toEqual([]);
  });

  it("a foglalás, a rögzítés és a lezárás soha nem szúr be", async () => {
    onRow();
    await store().acquire(P, "tok", 90_000);
    await store().begin(P, "tok", target, { sameTarget: true, minLeftMs: 1, leaseMs: 1 });
    for (const kind of ["sent", "empty", "skipped", "failed", "uncertain"] as const) {
      await store().finish(P, "tok", 3, { kind, hash: "h", code: "server", target: "t", holdMs: 1 } as any, 0);
    }
    expect(find(/^(insert|replace)/)).toEqual([]);
  });

  it("a profil törlése is a profilsort zárolja először, és a sort is törli", async () => {
    await deleteProfile(P);
    expect(h.calls[1].sql).toMatch(/^select .* from `client_profiles` .* for update$/);
    expect(find(/^delete from `social_hub_brand_profiles`/)).toHaveLength(1);
  });
});

describe("bérlet", () => {
  it("foglalás: csak szabad vagy lejárt bérletnél és küldendő változásnál; a visszaolvasott token dönt", async () => {
    expect(await store().acquire(P, "tok", 90_000)).toBeNull(); // affectedRows 1, de a token nem a mienk
    const [update] = find(/^update/);
    expect(update.sql).toMatch(/`requestedRev` > .*`syncedRev`.*`leaseUntilMs` is null or .*`leaseUntilMs` <= /);
    expect(update.sql).toMatch(DB_CLOCK);
    expect(update.params).toEqual(["tok", 90_000, P]);
    expect(find(/^select/)[0].sql).toMatch(/`leaseToken` = \?/);
    onRow();
    expect(await store().acquire(P, "tok", 90_000)).toMatchObject({ profileId: P, requestedRev: 3, requiredPhrases: ["a"], maybeSent: false });
  });

  it("rögzítés: egy feltételes UPDATE (bérlet, hátralévő idő, párosítás), benne a cél és a kísérlet ténye", async () => {
    expect(await store().begin(P, "tok", target, { sameTarget: false, minLeftMs: 30_000, leaseMs: 90_000 })).toBe(true);
    expect(h.calls).toHaveLength(1);
    const [set, where] = h.calls[0].sql.split(" where ");
    for (const c of ["targetRef", "targetUrlHash", "targetClientId", "maybeSent", "sentHash", "sentAtMs", "leaseUntilMs"]) expect(set).toContain(`\`${c}\` = `);
    expect(h.calls[0].sql).toMatch(/`leaseToken` = \? and .*`leaseUntilMs` > .*exists \(select 1 from `client_profiles` where .*`external_ref` = \?\)/);
    expect(where).toMatch(DB_CLOCK);
    expect(h.calls[0].params).toEqual(expect.arrayContaining(["viba", "hash", "c-1", true, "tok", 30_000, 90_000]));
    h.calls = [];
    h.on = () => ({ affectedRows: 0 });
    expect(await store().begin(P, "tok", target, { sameTarget: true, minLeftMs: 1, leaseMs: 1 })).toBe(false);
    expect(h.calls[0].sql).not.toContain("sentAtMs");
  });

  it("lezárás: zárolt, élő saját bérlettel; másé vagy lejárt → nincs írás", async () => {
    expect(await store().finish(P, "tok", 3, { kind: "sent", hash: "h" }, 90_000)).toBeNull();
    expect(kinds()).toEqual(["begin", "select", "commit"]);
    expect(h.calls[1].sql).toMatch(/`leaseToken` = \? and .*`leaseUntilMs` > .* for update$/);
    expect(h.calls[1].sql).toMatch(DB_CLOCK);
  });

  it("siker: elengedi a bérletet, de ha közben nőtt a változásszám, megtartja és az új sort adja", async () => {
    onRow({ requestedRev: 3 });
    expect(await store().finish(P, "tok", 3, { kind: "sent", hash: "h1" }, 90_000)).toBeNull();
    const [released] = find(/^update/);
    expect(released.sql).toMatch(/`syncedRev` = \?.*`leaseToken` = \?, `leaseUntilMs` = \?/);
    expect(released.params).toEqual(expect.arrayContaining([3, "h1", null]));
    h.calls = [];
    onRow({ requestedRev: 4 });
    expect(await store().finish(P, "tok", 3, { kind: "sent", hash: "h1" }, 90_000)).toMatchObject({ requestedRev: 4 });
    expect(find(/^update/)[0].sql.split(" where ")[0]).not.toContain("leaseToken");
    h.calls = [];
    expect(await store().finish(P, "tok", 3, { kind: "sent", hash: "h1" }, 0)).toBeNull(); // elfogytak a körök
    expect(find(/^update/)[0].sql).toContain("`leaseToken` = ?");
  });

  it("biztos hiba visszaállítja a korábbi állapotot; bizonytalannál a bérlet még él, és nincs új kör", async () => {
    onRow({ requestedRev: 9 });
    await store().finish(P, "tok", 3, { kind: "failed", code: "auth", target: "t", restore: { maybeSent: false, sentHash: "régi" } }, 0);
    expect(find(/^update/)[0].params).toEqual(expect.arrayContaining(["auth", "t", false, "régi"]));
    expect(find(/^update/)[0].sql.split(" where ")[0]).not.toContain("syncedRev");
    h.calls = [];
    expect(await store().finish(P, "tok", 3, { kind: "uncertain", code: "server", target: "t", holdMs: 60_000 }, 90_000)).toBeNull();
    const [held] = find(/^update/);
    expect(held.sql).toMatch(/`leaseToken` = \?, `leaseUntilMs` = \(.*UTC_TIMESTAMP\(3\).* \+ \?\)/);
    expect(held.params).toEqual(expect.arrayContaining([60_000, "server"]));
    expect(held.sql.split(" where ")[0]).not.toMatch(/syncedRev|sentHash|maybeSent/);
  });
});

describe("elérhetőség", () => {
  const leaky = (code: string, errno: number) => Object.assign(new Error(`${code}: insert into x values ('SZIVARGAS')`), { code, errno });
  const ops: [string, () => Promise<unknown>][] = [
    ["saveRules", () => store().saveRules(P, rules)], ["bumpRev", () => store().bumpRev(P)], ["acquire", () => store().acquire(P, "t", 1)],
    ["begin", () => store().begin(P, "t", target, { sameTarget: true, minLeftMs: 1, leaseMs: 1 })],
    ["finish", () => store().finish(P, "t", 1, { kind: "empty" }, 0)],
  ];

  it("olvasás: sor az adatbázis órájával; hiányzó táblánál missingTable", async () => {
    h.on = (sql) => (/^select/.test(sql) ? [[...rowOf(), "1234"]] : undefined);
    expect(await store().read(P)).toMatchObject({ row: { profileId: P, requiredPhrases: ["a"] }, nowMs: 1234, missingTable: false });
    h.on = () => { throw leaky("ER_NO_SUCH_TABLE", 1146); };
    expect(await store().read(P)).toEqual({ row: null, nowMs: 0, missingTable: true });
    h.on = () => { throw leaky("ER_LOCK_DEADLOCK", 1213); };
    await expect(store().read(P)).rejects.toBeInstanceOf(SocialHubStoreError);
  });

  it.each(ops)("%s: hiányzó táblánál és SQL-hibánál dob, részletek nélkül", async (_n, work) => {
    for (const [code, errno] of [["ER_NO_SUCH_TABLE", 1146], ["ER_LOCK_DEADLOCK", 1213]] as const) {
      h.on = () => { throw leaky(code, errno); };
      const err: any = await work().catch((e) => e);
      expect(err).toBeInstanceOf(SocialHubStoreError);
      expect(`${err.stack}${JSON.stringify(err)}`).not.toMatch(/SZIVARGAS|insert into/);
    }
  });

  it("DATABASE_URL nélkül nincs tároló", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(getBrandStore()).toBeNull();
  });
});
