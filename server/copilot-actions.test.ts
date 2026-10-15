/**
 * Copilot: a megerősített / elvetett javaslat kimenetele bekerül a beszélgetésbe.
 * Élő teszt (2026-10-13): a már elmentett vázlatot a Copilot a következő kérdésnél
 * „megerősítésre várónak” mondta, mert a végrehajtás nyoma nem került az előzménybe.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({ inserted: [] as any[], thread: { id: "th1" } as any }));
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const db = {
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => (fake.thread ? [fake.thread] : []) }) }) }) }),
    insert: () => ({ values: async (v: any) => { fake.inserted.push(v); } }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
  return { ...actual, getDb: vi.fn(async () => db), createContent: vi.fn(async (c: any) => c) };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function caller() {
  return appRouter.createCaller({
    appUser: {
      id: "user-a", email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "pro",
      onboardingCompleted: true, profileId: "profile-a", active: true,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as unknown as TrpcContext);
}

beforeEach(() => {
  fake.inserted = [];
  fake.thread = { id: "th1" };
});

describe("Copilot — javaslat kimenetele a beszélgetésben", () => {
  it("megerősített vázlatmentés → „✓ Elmentettem…” üzenet a threadbe", async () => {
    const r = await caller().assistant.executeAction({
      profileId: "profile-a",
      action: { type: "draft_post", params: { platform: "linkedin", title: "Mérhető marketing", content: "Szöveg", hashtags: ["#KKV"] } },
    });
    expect(r.message).toMatch(/^Elmentettem vázlatként: „Mérhető marketing"/);
    const note = fake.inserted.find((v) => v.role === "assistant");
    expect(note).toMatchObject({ threadId: "th1", role: "assistant" });
    expect(note.content).toBe(`✓ ${r.message}`);
  });

  it("elvetett javaslat → „✗ Elvetetted…” üzenet, módosítás nélkül", async () => {
    await caller().assistant.dismissAction({ profileId: "profile-a", summary: "Vázlat mentése: „X\" — LinkedIn poszt" });
    expect(fake.inserted).toHaveLength(1);
    expect(fake.inserted[0].content).toMatch(/^✗ Elvetetted a javaslatot \(Vázlat mentése: „X" — LinkedIn poszt\) — nem történt módosítás\.$/);
  });

  it("ha nincs beszélgetés, a művelet akkor is sikeres (csak nincs mit naplózni)", async () => {
    fake.thread = null;
    const r = await caller().assistant.executeAction({
      profileId: "profile-a",
      action: { type: "draft_post", params: { platform: "facebook", content: "Szöveg" } },
    });
    expect(r.ok).toBe(true);
    expect(fake.inserted).toEqual([]);
  });

  it("sikertelen művelet (rossz platform) → hiba, és nem kerül „✓” a beszélgetésbe", async () => {
    await expect(caller().assistant.executeAction({
      profileId: "profile-a",
      action: { type: "draft_post", params: { platform: "myspace", content: "Szöveg" } },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fake.inserted).toEqual([]);
  });

  it("idegen profilra nem naplóz és nem hajt végre", async () => {
    await expect(caller().assistant.dismissAction({ profileId: "profile-b", summary: "x" })).rejects.toThrow();
    expect(fake.inserted).toEqual([]);
  });
});
