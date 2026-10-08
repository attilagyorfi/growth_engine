/**
 * Regressziós teszt: profiles.upsert IDOR (2026-10 audit).
 *
 * Korábban bárki, aki ismert egy profil-azonosítót, a profil mentésével
 * magához rendelhette azt (az appUserId felülíródott). A teszt az adatbázis-
 * réteget mockolja: a getProfileById egy létező profilt ad vissza, az
 * upsertProfile egy kémfüggvény, így ellenőrizhető, hogy mi íródna ki.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(),
    upsertProfile: vi.fn(async (p: any) => p),
  };
});

import * as db from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AppUser = NonNullable<TrpcContext["appUser"]>;

function ctxFor(overrides: Partial<AppUser>): TrpcContext {
  const appUser = {
    id: "user-a",
    email: "a@example.com",
    name: "A",
    role: "user",
    subscriptionPlan: "free",
    onboardingCompleted: true,
    profileId: "profile-a",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AppUser;
  return {
    user: null as any,
    appUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const base = { name: "Profil", initials: "PR" };
const getProfileById = vi.mocked(db.getProfileById);
const upsertProfile = vi.mocked(db.upsertProfile);

describe("profiles.upsert — tulajdonos-védelem", () => {
  beforeEach(() => {
    getProfileById.mockReset();
    upsertProfile.mockClear();
  });

  it("idegen profil mentése FORBIDDEN, és semmi nem íródik ki", async () => {
    getProfileById.mockResolvedValue({ id: "profile-b", appUserId: "user-b" } as any);
    const caller = appRouter.createCaller(ctxFor({ id: "user-a", profileId: "profile-a" }));
    await expect(caller.profiles.upsert({ ...base, id: "profile-b" })).rejects.toThrowError(/jogosultsága|FORBIDDEN/i);
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("saját profil mentésekor a tulajdonos változatlan marad", async () => {
    getProfileById.mockResolvedValue({ id: "profile-a", appUserId: "user-a" } as any);
    const caller = appRouter.createCaller(ctxFor({ id: "user-a", profileId: "profile-a" }));
    await caller.profiles.upsert({ ...base, id: "profile-a" });
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "profile-a", appUserId: "user-a" }));
  });

  it("super_admin szerkesztésekor az ügyfél marad a tulajdonos", async () => {
    getProfileById.mockResolvedValue({ id: "profile-c", appUserId: "client-c" } as any);
    const caller = appRouter.createCaller(ctxFor({ id: "admin-1", role: "super_admin", profileId: null }));
    await caller.profiles.upsert({ ...base, id: "profile-c" });
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "profile-c", appUserId: "client-c" }));
  });

  it("új profil (azonosító nélkül) a létrehozóhoz kerül", async () => {
    const caller = appRouter.createCaller(ctxFor({ id: "user-a" }));
    await caller.profiles.upsert({ ...base });
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ appUserId: "user-a" }));
    expect(getProfileById).not.toHaveBeenCalled();
  });
});
