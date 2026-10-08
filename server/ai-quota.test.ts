/**
 * AI-keret szerveroldali kényszerítése — adatbázis nélkül (hamis drizzle-lánc).
 *
 * Lefedi: a kliens `isOnboarding` flagje csak a korlátos onboarding-keretig ér,
 * utána a normál havi keret dönt; az onboarding-hívások külön ("onboarding")
 * soron könyvelődnek; a SEO/kép darabkorlát; a napi cache (ingyenes napi teendők).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hamis DB: a count-lekérdezések sorban a `counts` tömbből kapják az eredményt,
// az insert-ek a `inserted` tömbbe kerülnek.
const fake = vi.hoisted(() => ({ counts: [] as number[], inserted: [] as any[] }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const db = {
    select: () => ({ from: () => ({ where: async () => [{ count: fake.counts.shift() ?? 0 }] }) }),
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
  };
  return { ...actual, getDb: vi.fn(async () => db) };
});

import {
  checkAiUsageLimit, recordAiUsage, ONBOARDING_ACTION, ONBOARDING_MONTHLY_ALLOWANCE,
  AI_PLAN_LIMITS, AI_PLAN_TOTAL_LIMITS,
} from "./authDb";
import { createDailyCache } from "./_core/dailyCache";

beforeEach(() => {
  fake.counts = [];
  fake.inserted = [];
});

describe("onboarding-keret (a kliens-flag már nem ad korlátlan AI-t)", () => {
  it("a kereten belül engedélyez, és onboarding-ként jelöli", async () => {
    fake.counts = [3]; // eddigi onboarding-hívások
    const r = await checkAiUsageLimit("u1", "free", "user", true);
    expect(r).toMatchObject({ allowed: true, onboarding: true, used: 3, limit: ONBOARDING_MONTHLY_ALLOWANCE });
  });

  it("elfogyott onboarding-keret → a normál havi keret dönt (betelt → tiltás)", async () => {
    fake.counts = [ONBOARDING_MONTHLY_ALLOWANCE, AI_PLAN_TOTAL_LIMITS.free];
    const r = await checkAiUsageLimit("u1", "free", "user", true);
    expect(r).toMatchObject({ allowed: false, onboarding: false, used: AI_PLAN_TOTAL_LIMITS.free });
  });

  it("elfogyott onboarding-keret, de van még havi keret → engedélyez, NEM onboarding-ként", async () => {
    fake.counts = [ONBOARDING_MONTHLY_ALLOWANCE, 2];
    const r = await checkAiUsageLimit("u1", "starter", "user", true);
    expect(r).toMatchObject({ allowed: true, onboarding: false, used: 2 });
  });

  it("recordAiUsage: onboarding-hívás az 'onboarding' sorra, a többi a saját funkciójára könyvelődik", async () => {
    await recordAiUsage("u1", "strategy", "user", true);
    await recordAiUsage("u1", "strategy", "user", false);
    expect(fake.inserted.map((r) => r.action)).toEqual([ONBOARDING_ACTION, "strategy"]);
  });

  it("super_admin: nincs számolás és könyvelés", async () => {
    const r = await checkAiUsageLimit("u1", "free", "super_admin", true);
    expect(r).toMatchObject({ allowed: true, onboarding: false, limit: -1 });
    await recordAiUsage("u1", "strategy", "super_admin", true);
    expect(fake.inserted).toEqual([]);
  });
});

describe("darabkorlátos funkciók (SEO audit, kép)", () => {
  it("SEO: a csomag havi darabszámánál tilt, a teljes kerettől függetlenül", async () => {
    fake.counts = [AI_PLAN_LIMITS.starter.seo]; // 3 SEO audit ebben a hónapban
    const r = await checkAiUsageLimit("u1", "starter", "user", false, "seo");
    expect(r).toMatchObject({ allowed: false, used: 3, limit: 3 });
  });

  it("SEO: darabszám alatt a teljes keret is kell", async () => {
    fake.counts = [1, 10];
    const r = await checkAiUsageLimit("u1", "starter", "user", false, "seo");
    expect(r).toMatchObject({ allowed: true, used: 10, limit: AI_PLAN_TOTAL_LIMITS.starter });
  });

  it("ingyenes csomagon a kép kemény tiltás (0)", async () => {
    const r = await checkAiUsageLimit("u1", "free", "user", false, "image");
    expect(r.allowed).toBe(false);
  });
});

describe("createDailyCache (napi teendők)", () => {
  const day1 = new Date("2026-10-07T10:00:00+02:00");
  const day2 = new Date("2026-10-08T00:30:00+02:00"); // budapesti éjfél után

  it("ugyanazon a napon egy generálás; force újragenerál; másnap új", async () => {
    const cache = createDailyCache<string>();
    const create = vi.fn(async () => `v${create.mock.calls.length}`);
    expect(await cache.getOrCreate("p1", create, { now: day1 })).toEqual({ value: "v1", fresh: true });
    expect(await cache.getOrCreate("p1", create, { now: day1 })).toEqual({ value: "v1", fresh: false });
    expect(cache.peek("p1", day1)).toBe("v1");
    expect(await cache.getOrCreate("p1", create, { now: day1, force: true })).toEqual({ value: "v2", fresh: true });
    expect(cache.peek("p1", day2)).toBeUndefined();
    expect((await cache.getOrCreate("p1", create, { now: day2 })).fresh).toBe(true);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("párhuzamos kérések egy hívást osztanak meg", async () => {
    const cache = createDailyCache<string>();
    let release!: (v: string) => void;
    const create = vi.fn(() => new Promise<string>((r) => { release = r; }));
    const a = cache.getOrCreate("p1", create, { now: day1 });
    const b = cache.getOrCreate("p1", create, { now: day1 });
    release("kész");
    expect(await a).toEqual({ value: "kész", fresh: true });
    expect(await b).toEqual({ value: "kész", fresh: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("hiba esetén nem tárol (a következő kérés újrapróbál)", async () => {
    const cache = createDailyCache<string>();
    await expect(cache.getOrCreate("p1", async () => { throw new Error("AI hiba"); }, { now: day1 })).rejects.toThrow("AI hiba");
    expect(cache.peek("p1", day1)).toBeUndefined();
    expect((await cache.getOrCreate("p1", async () => "ok", { now: day1 })).value).toBe("ok");
  });
});
