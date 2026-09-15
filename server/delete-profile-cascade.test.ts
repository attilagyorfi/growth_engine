/**
 * G2A Growth Engine – deleteProfile kaszkád lefedettség-teszt
 *
 * Nem DB-t tesztel (a runner DB nélkül fut), hanem azt a KRITIKUS invariánst,
 * hogy a profil-törlés kaszkádja MINDEN olyan táblát lefed, amelynek van
 * `profileId` oszlopa — kivéve a két NEM-tulajdon hivatkozást (appUsers,
 * projects), amelyeket nullázunk, nem törlünk.
 *
 * Ha valaki új, profileId-s táblát vesz fel a sémába, de kimarad a
 * kaszkádból, ez a teszt elbukik → nem marad csendben árva (GDPR-sértő) adat.
 */
import { describe, it, expect } from "vitest";
import * as schema from "../drizzle/schema";
import { PROFILE_OWNED_TABLES } from "./db";

// A profileId-t hivatkozásként (nem tulajdonként) tartalmazó táblák: ezeket
// NULLÁZZUK a törléskor, nem töröljük (a user/projekt megmarad).
const NULLED_REFERENCE_TABLES = ["appUsers", "projects"];

function tableExportsWithProfileId(): string[] {
  return Object.entries(schema)
    .filter(([, val]: [string, any]) => val && typeof val === "object" && val.profileId && val.profileId.name === "profileId")
    .map(([name]) => name);
}

describe("deleteProfile kaszkád – lefedettség", () => {
  it("minden profileId-s tábla vagy a kaszkádban, vagy a nullázott hivatkozások közt van", () => {
    const owned = new Set<string>(PROFILE_OWNED_TABLES as readonly string[]);
    const nulled = new Set(NULLED_REFERENCE_TABLES);
    const uncovered = tableExportsWithProfileId().filter((t) => !owned.has(t) && !nulled.has(t));
    expect(uncovered, `Lefedetlen profileId-s tábla(k) — vedd fel a deleteProfile kaszkádba vagy a nullázott hivatkozások közé: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("a kaszkád-lista minden eleme valós, létező tábla a sémában", () => {
    const missing = (PROFILE_OWNED_TABLES as readonly string[]).filter((name) => !(schema as any)[name]?.profileId);
    expect(missing, `Nem létező / profileId nélküli tábla a kaszkád-listában: ${missing.join(", ")}`).toEqual([]);
  });

  it("appUsers és projects NINCS a törlendő listában (őket nullázzuk, nem töröljük)", () => {
    for (const ref of NULLED_REFERENCE_TABLES) {
      expect(PROFILE_OWNED_TABLES as readonly string[]).not.toContain(ref);
    }
  });
});
