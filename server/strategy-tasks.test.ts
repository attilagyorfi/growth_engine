/**
 * G2A Growth Engine – Strategy Tasks tRPC tests
 * Tests for:
 * 1. listTasks – Zod input validation + tulajdonos ellenőrzés
 * 2. updateTaskStatus – status enum, NOT_FOUND, idegen profil blokkolás
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

describe("Strategy Tasks – listTasks", () => {
  it("returns an empty array when DB is unavailable for own profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    const result = await caller.strategyVersions.listTasks({ profileId: "profile-1" });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("rejects access to another user's profile", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.strategyVersions.listTasks({ profileId: "profile-other" })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });

  it("rejects an invalid status value via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – szándékosan érvénytelen érték
      caller.strategyVersions.listTasks({ profileId: "profile-1", status: "archived" })
    ).rejects.toThrow();
  });

  it("rejects an invalid funnelStage value via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – szándékosan érvénytelen érték
      caller.strategyVersions.listTasks({ profileId: "profile-1", funnelStage: "tofu" })
    ).rejects.toThrow();
  });

  it("accepts all four valid funnelStage values", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    for (const funnelStage of ["awareness", "consideration", "decision", "retention"] as const) {
      const result = await caller.strategyVersions.listTasks({ profileId: "profile-1", funnelStage });
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("accepts all four valid status values", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    for (const status of ["todo", "in_progress", "done", "skipped"] as const) {
      const result = await caller.strategyVersions.listTasks({ profileId: "profile-1", status });
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("super_admin bypasses profile ownership check", async () => {
    const caller = appRouter.createCaller(
      createContext({ role: "super_admin", profileId: null }),
    );
    const result = await caller.strategyVersions.listTasks({ profileId: "any-profile" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Strategy Tasks – updateTaskStatus", () => {
  it("returns NOT_FOUND when the task does not exist", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.strategyVersions.updateTaskStatus({ taskId: "missing-task", status: "done" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("rejects an invalid status value via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – szándékosan érvénytelen érték
      caller.strategyVersions.updateTaskStatus({ taskId: "any", status: "archived" })
    ).rejects.toThrow();
  });

  it("rejects when taskId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.strategyVersions.updateTaskStatus({ status: "done" })
    ).rejects.toThrow();
  });
});
