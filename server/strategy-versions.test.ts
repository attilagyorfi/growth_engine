/**
 * Stratégia-verziók: tulajdon-ellenőrzés (IDOR) a verzió szintjén.
 * A DB-függvények mockolva — a router döntéseit teszteljük.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getStrategyVersionById: vi.fn(),
    upsertStrategyVersion: vi.fn(async (d: any) => d),
    setActiveStrategyVersion: vi.fn(),
    upsertStrategyTask: vi.fn(async (t: any) => t),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

const mocked = db as unknown as {
  getStrategyVersionById: ReturnType<typeof vi.fn>;
  upsertStrategyVersion: ReturnType<typeof vi.fn>;
  setActiveStrategyVersion: ReturnType<typeof vi.fn>;
  upsertStrategyTask: ReturnType<typeof vi.fn>;
};

function caller() {
  const ctx = {
    user: null,
    appUser: {
      id: "user-a", email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "free",
      onboardingCompleted: true, profileId: "profile-a", active: true,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

const foreignVersion = { id: "sv-b", profileId: "profile-b", title: "B stratégiája" };
const ownVersion = { id: "sv-a", profileId: "profile-a", title: "A stratégiája" };

beforeEach(() => vi.clearAllMocks());

describe("strategyVersions.upsert", () => {
  it("idegen profil verziójának id-jával NEM írható felül (NOT_FOUND, nincs írás)", async () => {
    mocked.getStrategyVersionById.mockResolvedValue(foreignVersion);
    await expect(caller().strategyVersions.upsert({ id: "sv-b", profileId: "profile-a", title: "átvett" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocked.upsertStrategyVersion).not.toHaveBeenCalled();
  });

  it("a saját verzió szerkeszthető", async () => {
    mocked.getStrategyVersionById.mockResolvedValue(ownVersion);
    await caller().strategyVersions.upsert({ id: "sv-a", profileId: "profile-a", title: "új cím" });
    expect(mocked.upsertStrategyVersion).toHaveBeenCalledWith(expect.objectContaining({ id: "sv-a", profileId: "profile-a" }));
  });

  it("új verzió (nem létező id) létrehozható", async () => {
    mocked.getStrategyVersionById.mockResolvedValue(undefined);
    await caller().strategyVersions.upsert({ id: "sv-new", profileId: "profile-a", title: "friss" });
    expect(mocked.upsertStrategyVersion).toHaveBeenCalledTimes(1);
  });
});

describe("strategyVersions.setActive", () => {
  it("idegen verzió nem aktiválható (NOT_FOUND)", async () => {
    mocked.setActiveStrategyVersion.mockResolvedValue(false);
    await expect(caller().strategyVersions.setActive({ profileId: "profile-a", versionId: "sv-b" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocked.setActiveStrategyVersion).toHaveBeenCalledWith("profile-a", "sv-b");
  });

  it("saját verzió aktiválása", async () => {
    mocked.setActiveStrategyVersion.mockResolvedValue(true);
    await expect(caller().strategyVersions.setActive({ profileId: "profile-a", versionId: "sv-a" })).resolves.toEqual({ ok: true });
  });

  it("idegen profilra eleve nincs jogosultság", async () => {
    await expect(caller().strategyVersions.setActive({ profileId: "profile-b", versionId: "sv-b" })).rejects.toThrow();
    expect(mocked.setActiveStrategyVersion).not.toHaveBeenCalled();
  });
});

describe("strategyVersions.generateTasks", () => {
  it("idegen stratégia-verzióhoz nem hoz létre feladatot", async () => {
    mocked.getStrategyVersionById.mockResolvedValue(foreignVersion);
    await expect(caller().strategyVersions.generateTasks({
      profileId: "profile-a", strategyVersionId: "sv-b", quickWins: [{ title: "x" }],
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocked.upsertStrategyTask).not.toHaveBeenCalled();
  });

  it("saját verzióhoz létrehozza a feladatokat", async () => {
    mocked.getStrategyVersionById.mockResolvedValue(ownVersion);
    const r = await caller().strategyVersions.generateTasks({
      profileId: "profile-a", strategyVersionId: "sv-a", quickWins: [{ title: "Gyors" }], nextActions: [{ title: "Következő" }],
    });
    expect(r.count).toBe(2);
  });
});
