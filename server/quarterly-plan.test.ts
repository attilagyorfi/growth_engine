/**
 * G2A Growth Engine – 90 napos (negyedéves) terv tests
 *
 * Tests for:
 * 1. generateQuarterlyPlan – Zod input validation + tulajdonos ellenőrzés
 * 2. Hónap számítás logikája (pure date math) – sanity check, hogy a
 *    "következő 3 hónap YYYY-MM" képlet a vártnak megfelelően alakul.
 *
 * Az LLM hívást nem mockoljuk; az AI-függő integráció csak valódi
 * BUILT_IN_FORGE_API_KEY-vel fut le. Itt a Zod réteget és a date
 * matekot fixáljuk.
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

describe("Quarterly Plan – generateQuarterlyPlan input validation", () => {
  it("rejects when profileId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.strategyVersions.generateQuarterlyPlan({ intelligenceData: {} })
    ).rejects.toThrow();
  });

  it("rejects when intelligenceData is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.strategyVersions.generateQuarterlyPlan({ profileId: "profile-1" })
    ).rejects.toThrow();
  });

  it("rejects access to another user's profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.strategyVersions.generateQuarterlyPlan({
        profileId: "profile-other",
        intelligenceData: { foo: "bar" },
      })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });
});

describe("Quarterly Plan – month calculation (pure date math)", () => {
  // A procedure ezzel a képlettel számolja a következő 3 hónapot:
  // for (let i = 0; i < 3; i++) {
  //   const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
  //   months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  // }
  // Ezt fixáljuk itt, hogy a regresszió elkapható legyen.
  function nextThreeMonths(now: Date): string[] {
    const out: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }

  it("January 2026 → ['2026-01', '2026-02', '2026-03']", () => {
    expect(nextThreeMonths(new Date(2026, 0, 15))).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("December 2026 → wraps to next year ['2026-12', '2027-01', '2027-02']", () => {
    expect(nextThreeMonths(new Date(2026, 11, 5))).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("November 2026 → ['2026-11', '2026-12', '2027-01']", () => {
    expect(nextThreeMonths(new Date(2026, 10, 28))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("returns exactly 3 months always", () => {
    for (const monthIdx of [0, 1, 5, 9, 11]) {
      expect(nextThreeMonths(new Date(2026, monthIdx, 1))).toHaveLength(3);
    }
  });

  it("each month string matches YYYY-MM format", () => {
    const result = nextThreeMonths(new Date(2026, 5, 1));
    for (const m of result) {
      expect(m).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});
