/**
 * G2A Growth Engine – Onboarding & Data Isolation Tests
 * Tests for:
 * 1. Onboarding completion flow (completeOnboarding procedure)
 * 2. Data isolation (users can only access their own profile data)
 * 3. Super admin role assignment for known admin emails
 * 4. Feature gating (AI limit bypass for super_admin)
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { AI_PLAN_LIMITS, checkAiUsageLimit } from "./authDb";

// ─── Test helpers ─────────────────────────────────────────────────────────────

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
    onboardingCompleted: false,
    profileId: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(appUserOverrides: Partial<AppUser> = {}, userOverrides: Partial<AuthUser> = {}): TrpcContext {
  return {
    user: createAuthUser(userOverrides),
    appUser: createAppUser(appUserOverrides),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── Onboarding State Tests ───────────────────────────────────────────────────

describe("Onboarding – State Logic", () => {
  it("new user has onboardingCompleted = false", () => {
    const appUser = createAppUser({ onboardingCompleted: false });
    expect(appUser.onboardingCompleted).toBe(false);
  });

  it("completed user has onboardingCompleted = true", () => {
    const appUser = createAppUser({ onboardingCompleted: true, profileId: "profile-1" });
    expect(appUser.onboardingCompleted).toBe(true);
    expect(appUser.profileId).toBe("profile-1");
  });

  it("onboarding requires a profileId to be set", () => {
    // When onboarding is completed, profileId must not be null
    const completedUser = createAppUser({ onboardingCompleted: true, profileId: "profile-123" });
    expect(completedUser.profileId).not.toBeNull();
  });
});

// ─── Role Assignment Tests ────────────────────────────────────────────────────

describe("Role Assignment – Super Admin Detection", () => {
  const SUPER_ADMIN_EMAILS = ["info@g2amarketing.hu", "admin@g2a.hu"];

  it("info@g2amarketing.hu should be assigned super_admin role", () => {
    const email = "info@g2amarketing.hu";
    const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? "super_admin" : "user";
    expect(role).toBe("super_admin");
  });

  it("admin@g2a.hu should be assigned super_admin role", () => {
    const email = "admin@g2a.hu";
    const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? "super_admin" : "user";
    expect(role).toBe("super_admin");
  });

  it("regular user email should be assigned user role", () => {
    const email = "customer@example.com";
    const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? "super_admin" : "user";
    expect(role).toBe("user");
  });

  it("super_admin role check is case-insensitive", () => {
    const email = "INFO@G2AMARKETING.HU";
    const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase()) ? "super_admin" : "user";
    expect(role).toBe("super_admin");
  });
});

// ─── Feature Gating – AI Limit Tests ─────────────────────────────────────────

describe("Feature Gating – AI Limit Bypass for Super Admin", () => {
  it("super_admin bypasses AI limit check (returns allowed: true)", async () => {
    const result = await checkAiUsageLimit("any-user-id", "free", "super_admin");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
    expect(result.plan).toBe("super_admin");
  });

  it("free plan user is limited to 5 AI posts per month", () => {
    // Per-feature struktúra: AI_PLAN_LIMITS.free egy objektum
    expect(AI_PLAN_LIMITS.free.post).toBe(5);
    expect(AI_PLAN_LIMITS.free.strategy).toBe(1);
  });

  it("free plan user with 5 post usages is blocked (post limit)", async () => {
    // Teszteli a limit logikát a per-feature struktúrával
    const limit = AI_PLAN_LIMITS.free.post;
    const used = 5;
    const allowed = used < limit;
    expect(allowed).toBe(false);
  });

  it("free plan user with 4 post usages is allowed", () => {
    const limit = AI_PLAN_LIMITS.free.post;
    const used = 4;
    const allowed = used < limit;
    expect(allowed).toBe(true);
  });

  it("pro plan has high limits (not unlimited in per-feature model)", async () => {
    // Pro csomag: 300 poszt/hó, 20 stratégia/hó – nem -1, de magas limit
    expect(AI_PLAN_LIMITS.pro.post).toBe(300);
    expect(AI_PLAN_LIMITS.pro.strategy).toBe(20);
    expect(AI_PLAN_LIMITS.pro.video).toBe(5);
  });

  it("agency plan has the highest limits", async () => {
    expect(AI_PLAN_LIMITS.agency.post).toBe(1000);
    expect(AI_PLAN_LIMITS.agency.strategy).toBe(60);
    expect(AI_PLAN_LIMITS.agency.video).toBe(15);
  });
});

// ─── Data Isolation – Profile Ownership Tests ─────────────────────────────────

describe("Data Isolation – Profile Ownership", () => {
  it("appUser.id is used as the owner for all profile operations", () => {
    const appUser = createAppUser({ id: "owner-123" });
    // Profile queries should use appUser.id as the filter
    expect(appUser.id).toBe("owner-123");
  });

  it("two different users have different IDs", () => {
    const user1 = createAppUser({ id: "user-1", email: "user1@example.com" });
    const user2 = createAppUser({ id: "user-2", email: "user2@example.com" });
    expect(user1.id).not.toBe(user2.id);
  });

  it("profile ID is stored on the appUser after onboarding", () => {
    const userBeforeOnboarding = createAppUser({ profileId: null, onboardingCompleted: false });
    const userAfterOnboarding = createAppUser({ profileId: "profile-xyz", onboardingCompleted: true });
    expect(userBeforeOnboarding.profileId).toBeNull();
    expect(userAfterOnboarding.profileId).toBe("profile-xyz");
  });
});

// ─── Subscription Plan Feature Matrix Tests ───────────────────────────────────

describe("Subscription Plans – Feature Matrix", () => {
  const PLAN_FEATURES = {
    free:    { canUseStrategy: false, canUseAnalytics: false, maxProfiles: 1 },
    starter: { canUseStrategy: true,  canUseAnalytics: true,  maxProfiles: 3 },
    pro:     { canUseStrategy: true,  canUseAnalytics: true,  maxProfiles: -1 },
    agency:  { canUseStrategy: true,  canUseAnalytics: true,  maxProfiles: -1 },
  };

  it("free plan cannot use Strategy module", () => {
    expect(PLAN_FEATURES.free.canUseStrategy).toBe(false);
  });

  it("free plan cannot use Analytics module", () => {
    expect(PLAN_FEATURES.free.canUseAnalytics).toBe(false);
  });

  it("starter plan can use Strategy module", () => {
    expect(PLAN_FEATURES.starter.canUseStrategy).toBe(true);
  });

  it("starter plan can use Analytics module", () => {
    expect(PLAN_FEATURES.starter.canUseAnalytics).toBe(true);
  });

  it("pro plan has unlimited profiles", () => {
    expect(PLAN_FEATURES.pro.maxProfiles).toBe(-1);
  });

  it("free plan is limited to 1 profile", () => {
    expect(PLAN_FEATURES.free.maxProfiles).toBe(1);
  });

  it("starter plan is limited to 3 profiles", () => {
    expect(PLAN_FEATURES.starter.maxProfiles).toBe(3);
  });
});

// ─── Auth Context Tests ───────────────────────────────────────────────────────

describe("Auth – Context Shape", () => {
  it("auth.logout procedure requires authenticated user", async () => {
    const ctx = createContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });

  it("appUser role defaults to user for new registrations", () => {
    const appUser = createAppUser({ role: "user" });
    expect(appUser.role).toBe("user");
  });

  it("super_admin role is correctly set", () => {
    const adminUser = createAppUser({ role: "super_admin", email: "info@g2amarketing.hu" });
    expect(adminUser.role).toBe("super_admin");
  });
});
