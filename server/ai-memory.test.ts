/**
 * G2A Growth Engine – AI Memory tRPC tests
 * Tests for:
 * 1. aiMemory.list – Zod input validation + tulajdonos ellenőrzés
 * 2. aiMemory.delete – NOT_FOUND, idegen profil blokkolás, érvénytelen ID
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

const VALID_TYPES = [
  "approved_pattern",
  "rejected_pattern",
  "style_preference",
  "cta_preference",
  "content_preference",
  "client_correction",
] as const;

describe("AI Memory – list", () => {
  it("returns an empty array when DB is unavailable for own profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    const result = await caller.aiMemory.list({ profileId: "profile-1" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("rejects access to another user's profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.aiMemory.list({ profileId: "profile-other" })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });

  it("rejects an invalid memoryType value via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – szándékosan érvénytelen érték
      caller.aiMemory.list({ profileId: "profile-1", memoryType: "made_up_type" })
    ).rejects.toThrow();
  });

  it("accepts all six valid memoryType values", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    for (const memoryType of VALID_TYPES) {
      const result = await caller.aiMemory.list({ profileId: "profile-1", memoryType });
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("super_admin bypasses profile ownership check", async () => {
    const caller = appRouter.createCaller(
      createContext({ role: "super_admin", profileId: null }),
    );
    const result = await caller.aiMemory.list({ profileId: "any-profile" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("AI Memory – delete", () => {
  it("returns NOT_FOUND when the memory does not exist", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.aiMemory.delete({ memoryId: 999999 })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("rejects when memoryId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.aiMemory.delete({})
    ).rejects.toThrow();
  });

  it("rejects negative or zero memoryId via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.aiMemory.delete({ memoryId: 0 })
    ).rejects.toThrow();
    await expect(
      caller.aiMemory.delete({ memoryId: -5 })
    ).rejects.toThrow();
  });

  it("rejects non-integer memoryId via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.aiMemory.delete({ memoryId: 3.14 })
    ).rejects.toThrow();
  });
});
