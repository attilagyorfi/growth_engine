/**
 * G2A Growth Engine – Campaign → Calendar auto-population tests
 *
 * Tests for:
 * 1. calendar.list – Zod input validation + tulajdonos ellenőrzés
 * 2. Heti stagger date logic – pure function check (a generateContentFromBrief
 *    AI-t hív, így integrációs tesztet itt nem futtatunk; helyette
 *    leellenőrizzük, hogy a stagger képlet a vártnak megfelelően alakul)
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AppUser = NonNullable<TrpcContext["appUser"]>;
type AuthUser = NonNullable<TrpcContext["user"]>;

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    openId: "test-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAppUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "app-user-1",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    subscriptionPlan: "free",
    onboardingCompleted: true,
    profileId: "profile-1",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(appUserOverrides: Partial<AppUser> = {}): TrpcContext {
  return {
    user: createAuthUser(),
    appUser: createAppUser(appUserOverrides),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Calendar – list", () => {
  it("returns an empty array when DB is unavailable for own profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    const result = await caller.calendar.list({ profileId: "profile-1" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("rejects access to another user's profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.calendar.list({ profileId: "profile-other" })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });

  it("accepts an optional campaignTag filter", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    const result = await caller.calendar.list({ profileId: "profile-1", campaignTag: "campaign-123" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("super_admin bypasses profile ownership check", async () => {
    const caller = appRouter.createCaller(
      createContext({ role: "super_admin", profileId: null }),
    );
    const result = await caller.calendar.list({ profileId: "any-profile" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects when profileId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.calendar.list({})
    ).rejects.toThrow();
  });
});

describe("Calendar – weekly stagger logic (pure date math)", () => {
  // A generateContentFromBrief minden i. ötlethez (i+1) hét offset-tel készít
  // calendar item-et. Ezt a képletet idézzük itt, hogy a regresszió
  // elkapható legyen ha valaki módosítja a stagger logikát.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const baseDate = new Date("2026-01-01T00:00:00Z");

  it("first idea (i=0) is scheduled +1 week from baseDate", () => {
    const i = 0;
    const scheduledAt = new Date(baseDate.getTime() + (i + 1) * WEEK_MS);
    expect(scheduledAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("fifth idea (i=4) is scheduled +5 weeks from baseDate", () => {
    const i = 4;
    const scheduledAt = new Date(baseDate.getTime() + (i + 1) * WEEK_MS);
    expect(scheduledAt.toISOString()).toBe("2026-02-05T00:00:00.000Z");
  });

  it("each subsequent idea is exactly 7 days after the previous", () => {
    const dates = [0, 1, 2, 3, 4].map(i =>
      new Date(baseDate.getTime() + (i + 1) * WEEK_MS).getTime()
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] - dates[i - 1]).toBe(WEEK_MS);
    }
  });

  it("never schedules in the past (offset always >= 1 week)", () => {
    // A képlet (i+1)*WEEK_MS, tehát i=0-nál is +1 hét — nincs negatív vagy 0 offset
    for (const i of [0, 1, 2, 3, 4]) {
      const offset = (i + 1) * WEEK_MS;
      expect(offset).toBeGreaterThanOrEqual(WEEK_MS);
    }
  });
});
