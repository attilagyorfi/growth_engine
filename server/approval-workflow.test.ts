/**
 * G2A Growth Engine – Approval Workflow tests
 * Tests for the review status transition + email notification trigger.
 *
 * Note: these tests run without a real DB. The submitForReview procedure
 * returns INTERNAL_SERVER_ERROR when getDb() returns null, so we can't
 * exercise the happy path here. The unit tests cover Zod validation and
 * the DB-unavailable error path. Email send itself is a separate helper
 * (sendPostReviewNotificationEmail) wrapped in a try/catch so any send
 * failure cannot regress the review state transition.
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { sendPostReviewNotificationEmail } from "./email";
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

describe("Approval Workflow – submitForReview", () => {
  it("rejects when postId is missing via Zod", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      // @ts-expect-error – hiányzó kötelező mező
      caller.content.submitForReview({})
    ).rejects.toThrow();
  });

  it("returns 500 when DB is unavailable (current test environment)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.content.submitForReview({ postId: "any-post-id" })
    ).rejects.toThrowError(/Adatbázis nem elérhető|INTERNAL_SERVER_ERROR/i);
  });

  it("rejects empty postId via Zod (still must be a string)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      // @ts-expect-error – szándékosan érvénytelen érték
      caller.content.submitForReview({ postId: 123 })
    ).rejects.toThrow();
  });
});

describe("Approval Workflow – sendPostReviewNotificationEmail helper", () => {
  it("is exported as a function with the expected signature", () => {
    expect(typeof sendPostReviewNotificationEmail).toBe("function");
    // 1 paraméter (egy objektum)
    expect(sendPostReviewNotificationEmail.length).toBe(1);
  });

  // Megj.: az actual Resend hívást nem teszteljük itt (külső szolgáltatás).
  // A submitForReview try/catch-ben hívja, így bármilyen Resend hiba
  // logolódik de nem dobódik tovább — nem regresszálhatja a state változást.
});
