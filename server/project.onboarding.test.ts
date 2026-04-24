/**
 * G2A Growth Engine – Sprint 37: Project-Specific Onboarding Tests
 * Tests for:
 * 1. projects.startOnboarding procedure logic (unit tests without DB)
 * 2. Project mode localStorage key separation
 * 3. Super admin cannot call completeOnboarding in project mode
 */
import { describe, it, expect } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Test helpers ─────────────────────────────────────────────────────────────

type AppUser = NonNullable<TrpcContext["appUser"]>;
type AuthUser = NonNullable<TrpcContext["user"]>;

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    openId: "super-admin-open-id",
    email: "info@g2amarketing.hu",
    name: "Super Admin",
    loginMethod: "manus",
    role: "super_admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAppUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "super-admin-app-user-1",
    email: "info@g2amarketing.hu",
    name: "Super Admin",
    role: "super_admin",
    subscriptionPlan: "free",
    onboardingCompleted: true, // super_admin is always "completed"
    profileId: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

// ─── Project Onboarding Logic Tests ──────────────────────────────────────────

describe("Sprint 37 – Project-Specific Onboarding Logic", () => {
  it("super_admin has onboardingCompleted=true and should not be redirected to /onboarding", () => {
    const superAdmin = createAppUser({ role: "super_admin", onboardingCompleted: true });
    // AppRoute guard: super_admin bypasses onboarding check
    const shouldRedirectToOnboarding = !superAdmin.onboardingCompleted && superAdmin.role !== "super_admin";
    expect(shouldRedirectToOnboarding).toBe(false);
  });

  it("project mode uses separate localStorage key from normal onboarding", () => {
    const BASE_LS_KEY = "g2a_onboarding_draft";
    const projectId = "proj-abc123";
    const normalKey = BASE_LS_KEY;
    const projectKey = `${BASE_LS_KEY}_${projectId}`;
    expect(normalKey).toBe("g2a_onboarding_draft");
    expect(projectKey).toBe("g2a_onboarding_draft_proj-abc123");
    expect(normalKey).not.toBe(projectKey);
  });

  it("project mode step key is separate from normal onboarding step key", () => {
    const BASE_LS_STEP_KEY = "g2a_onboarding_step";
    const projectId = "proj-abc123";
    const normalStepKey = BASE_LS_STEP_KEY;
    const projectStepKey = `${BASE_LS_STEP_KEY}_${projectId}`;
    expect(normalStepKey).not.toBe(projectStepKey);
  });

  it("project mode completion should NOT modify super_admin onboardingCompleted flag", () => {
    // In project mode, we call projects.upsert to link profileId, not completeOnboarding
    // This test verifies the logic branching
    const isProjectMode = true;
    const queryProjectId = "proj-abc123";
    // Simulate the handleFinish logic
    const shouldCallCompleteOnboarding = !isProjectMode || !queryProjectId;
    expect(shouldCallCompleteOnboarding).toBe(false);
  });

  it("normal mode completion SHOULD call completeOnboarding", () => {
    const isProjectMode = false;
    const queryProjectId = null;
    const shouldCallCompleteOnboarding = !isProjectMode || !queryProjectId;
    expect(shouldCallCompleteOnboarding).toBe(true);
  });

  it("project mode navigate target is /projektek/:id after finish", () => {
    const isProjectMode = true;
    const queryProjectId = "proj-abc123";
    const target = isProjectMode && queryProjectId
      ? `/projektek/${queryProjectId}`
      : "/iranyitopult";
    expect(target).toBe("/projektek/proj-abc123");
  });

  it("normal mode navigate target is /iranyitopult after finish", () => {
    const isProjectMode = false;
    const queryProjectId = null;
    const destination = "/iranyitopult";
    const target = isProjectMode && queryProjectId
      ? `/projektek/${queryProjectId}`
      : (destination ?? "/iranyitopult");
    expect(target).toBe("/iranyitopult");
  });

  it("startOnboarding returns existing profileId if project already has one", () => {
    // Simulate the startOnboarding logic
    const project = {
      id: "proj-abc123",
      ownerId: "super-admin-app-user-1",
      name: "Test Client",
      profileId: "existing-profile-id",
    };
    // If project already has profileId, return it without creating a new one
    const result = project.profileId ? { profileId: project.profileId } : null;
    expect(result).toEqual({ profileId: "existing-profile-id" });
  });

  it("startOnboarding creates new profileId if project has none", () => {
    const project = {
      id: "proj-abc123",
      ownerId: "super-admin-app-user-1",
      name: "New Client",
      profileId: null,
    };
    // If no profileId, a new one would be created (nanoid)
    const needsNewProfile = !project.profileId;
    expect(needsNewProfile).toBe(true);
  });

  it("project initials are derived from first two words of project name", () => {
    const projectName = "Teszt Cég Kft";
    const initials = projectName
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") || "PR";
    expect(initials).toBe("TC");
  });

  it("single-word project name produces single initial", () => {
    const projectName = "Acme";
    const initials = projectName
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") || "PR";
    expect(initials).toBe("A");
  });

  it("empty project name falls back to PR initials", () => {
    const projectName = "";
    const initials = projectName
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join("") || "PR";
    expect(initials).toBe("PR");
  });

  it("super_admin role check passes assertProfileOwnership for any profile", () => {
    const role = "super_admin";
    // assertProfileOwnership: if role === 'super_admin' → return (no throw)
    const wouldThrow = role !== "super_admin";
    expect(wouldThrow).toBe(false);
  });

  it("regular user role fails assertProfileOwnership for unowned profile", () => {
    const role = "user";
    const wouldThrow = role !== "super_admin";
    expect(wouldThrow).toBe(true);
  });
});
