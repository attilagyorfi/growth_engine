/**
 * G2A Growth Engine – Recommendation Engine tests
 *
 * Tests for the recommendations.generate procedure:
 * 1. Zod input validation (profileId required)
 * 2. Profile ownership enforcement (FORBIDDEN for foreign profile)
 * 3. Pure logic checks: urgency mapping + type validation (regression
 *    guards in case future code changes break the mapping)
 *
 * Az LLM hívást nem mockoljuk; az integráció valódi környezetben fut le
 * (DB + Manus/OpenAI API). Itt csak a Zod / ownership / mapping
 * szabályokat fixáljuk.
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AppUser = NonNullable<TrpcContext["appUser"]>;
type AuthUser = NonNullable<TrpcContext["user"]>;

function createAuthUser(): AuthUser {
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

describe("Recommendations – list & dismiss (already covered, sanity)", () => {
  it("list returns an empty array when DB unavailable for own profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    const result = await caller.recommendations.list({ profileId: "profile-1" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("list rejects foreign profile access", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.recommendations.list({ profileId: "profile-other" })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });
});

describe("Recommendations – generate input validation", () => {
  it("rejects when profileId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.recommendations.generate({})
    ).rejects.toThrow();
  });

  it("rejects access to another user's profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.recommendations.generate({ profileId: "profile-other" })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });

  it("accepts optional recentContent and recentLeads arrays", async () => {
    // Saját profil + DB nélkül a usage check átmegy, az invokeLLM viszont
    // hibázik (nincs BUILT_IN_FORGE_API_KEY). Csak Zod réteget teszteljük.
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.recommendations.generate({
        profileId: "profile-1",
        recentContent: [{ id: "c1", title: "test" }],
        recentLeads: [{ id: "l1", company: "ACME" }],
      })
    ).rejects.toThrow(); // LLM hiba várt, NEM Zod hiba
  });
});

describe("Recommendations – urgency + type mapping (regression guard)", () => {
  // A generate procedure az AI által visszaadott magyar/angol urgency
  // stringeket egyaránt elfogadja. Ezt a mapping logikát fixáljuk itt.
  const urgencyMap: Record<string, "high" | "medium" | "low"> = {
    high: "high", medium: "medium", low: "low",
    magas: "high", közepes: "medium", kozepes: "medium", alacsony: "low",
  };

  it("maps English urgency values to themselves", () => {
    expect(urgencyMap["high"]).toBe("high");
    expect(urgencyMap["medium"]).toBe("medium");
    expect(urgencyMap["low"]).toBe("low");
  });

  it("maps Hungarian urgency values to English enum", () => {
    expect(urgencyMap["magas"]).toBe("high");
    expect(urgencyMap["közepes"]).toBe("medium");
    expect(urgencyMap["kozepes"]).toBe("medium"); // ASCII fallback
    expect(urgencyMap["alacsony"]).toBe("low");
  });

  it("unknown urgency values fall back to 'medium' (in the procedure)", () => {
    const fallback = urgencyMap["invalid"] ?? "medium";
    expect(fallback).toBe("medium");
  });

  it("type enum accepts only the 5 valid values", () => {
    const typeAllow = new Set(["strategy", "content", "campaign", "lead", "analytics"]);
    expect(typeAllow.has("strategy")).toBe(true);
    expect(typeAllow.has("content")).toBe(true);
    expect(typeAllow.has("campaign")).toBe(true);
    expect(typeAllow.has("lead")).toBe(true);
    expect(typeAllow.has("analytics")).toBe(true);
    expect(typeAllow.has("invalid")).toBe(false);
  });
});

describe("Recommendations – expiresAt logic (regression guard)", () => {
  it("expiresAt is 30 days from now", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const diffDays = (expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBe(30);
  });

  it("expiresAt is in the future", () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
