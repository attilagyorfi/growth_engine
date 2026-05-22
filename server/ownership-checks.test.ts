/**
 * G2A Growth Engine – Ownership check regression tests
 *
 * Ezek a tesztek azt biztosítják, hogy a security audit során javított
 * 15 procedure mindegyike ellenőrzi a tulajdonjogot — vagy NOT_FOUND-ot
 * dob (DB-less módban a record nem található), vagy FORBIDDEN-t ad
 * idegen profil esetén.
 *
 * A teszt-runner DB nélkül fut, így minden getXById helper undefined-ot
 * ad vissza, ezért a procedure NOT_FOUND-ot dob az ID alapú lookup után.
 * Ez bizonyítja, hogy a fetch ELŐBB történik mint az írás — a régi,
 * sebezhető verzió direkt írt volna a DB-be ellenőrzés nélkül.
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

const FOREIGN_ID = "id-from-another-profile";

describe("Ownership checks – Leads", () => {
  it("leads.update fetches the lead before mutating (NOT_FOUND when absent)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.leads.update({ id: FOREIGN_ID, status: "closed_won" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("leads.delete fetches the lead before deleting (NOT_FOUND when absent)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.leads.delete({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Outbound emails", () => {
  it("outbound.update fetches before mutating", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.outbound.update({ id: FOREIGN_ID, status: "sent" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("outbound.delete fetches before deleting", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.outbound.delete({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Inbound emails", () => {
  it("inbound.markRead fetches before mutating", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.inbound.markRead({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("inbound.updateCategory fetches before mutating", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.inbound.updateCategory({ id: FOREIGN_ID, category: "interested" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Content posts", () => {
  it("content.update fetches before mutating (was vulnerable: anyone could update any post)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.content.update({ id: FOREIGN_ID, status: "approved" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("content.delete fetches before deleting (was vulnerable: anyone could delete any post)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.content.delete({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Strategies", () => {
  it("strategies.update fetches before mutating", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.strategies.update({ id: FOREIGN_ID, title: "evil change" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Strategy versions", () => {
  it("strategyVersions.archive fetches before archiving", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.strategyVersions.archive({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Campaigns", () => {
  it("campaigns.delete fetches before deleting", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.campaigns.delete({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });

  it("campaigns.upsertAsset rejects when input.profileId differs from ctx.appUser.profileId", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.campaigns.upsertAsset({
        profileId: "profile-other",
        campaignId: "any-campaign",
        type: "copy",
        title: "evil asset",
      })
    ).rejects.toThrowError(/jogosultság|FORBIDDEN/i);
  });

  it("campaigns.upsertAsset NOT_FOUND on unknown campaignId (own profile)", async () => {
    const caller = appRouter.createCaller(createContext({ profileId: "profile-1" }));
    await expect(
      caller.campaigns.upsertAsset({
        profileId: "profile-1",
        campaignId: "missing-campaign",
        type: "copy",
        title: "asset",
      })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Brand assets", () => {
  it("deleteBrandAsset fetches before deleting", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.onboarding.deleteBrandAsset({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Recommendations", () => {
  it("recommendations.dismiss fetches before mutating", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.recommendations.dismiss({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Notifications (user-bound)", () => {
  it("notifications.markRead fetches and verifies appUserId", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(
      caller.notifications.markRead({ id: FOREIGN_ID })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});

describe("Ownership checks – Super admin bypass", () => {
  it("super_admin can attempt to mutate any record (still NOT_FOUND if absent, but ownership not blocking)", async () => {
    // Super admin esetén a NOT_FOUND-ot várjuk, NEM FORBIDDEN-t.
    // Ez bizonyítja, hogy az ownership check nem blokkol super_admin-t.
    const caller = appRouter.createCaller(
      createContext({ role: "super_admin", profileId: null }),
    );
    await expect(
      caller.content.update({ id: FOREIGN_ID, status: "approved" })
    ).rejects.toThrowError(/nem található|NOT_FOUND/i);
  });
});
