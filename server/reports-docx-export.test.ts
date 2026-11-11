/**
 * G1 Word-export — reports.exportDocx jogosultság és hibautak (DB mockolva, nincs LLM).
 * Csak a riport saját ügyfelének jogosult felhasználója tölthesse le.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  profiles: {} as Record<string, any>,
  reports: [] as any[],
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(async (id: string) => fake.profiles[id]),
    // A valós helperhez hasonlóan profilra ÉS riportra is szűr.
    getReportById: vi.fn(async (profileId: string, reportId: string) =>
      fake.reports.find((r) => r.id === reportId && r.profileId === profileId) ?? null),
  };
});
vi.mock("./ai/reportSummary", () => ({ generateReportSummary: vi.fn(async () => "nem szabad hívni") }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { generateReportSummary } from "./ai/reportSummary";
import { DOCX_MIME_TYPE } from "./reports/docx";

const caller = (userId: string, profileId: string | null, role = "user") => appRouter.createCaller({
  appUser: {
    id: userId, email: `${userId}@example.hu`, name: userId, role, subscriptionPlan: "pro",
    onboardingCompleted: true, profileId, active: true,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

const reportA = {
  id: "report-a",
  profileId: "profile-a",
  title: "Kovács és Társa – riport 2026-10-01 → 2026-10-31",
  periodFrom: new Date("2026-10-01"),
  periodTo: new Date("2026-10-31"),
  status: "rendered",
  summaryData: {
    kpis: [{ key: "spend", label: "Költés", value: 150000, unit: "HUF" }],
    series: [],
    byPlatform: [{ platform: "google_ads", spend: 150000, conversions: 10 }],
  },
  aiSummary: "Stabil hónap.",
};
const reportB = { ...reportA, id: "report-b", profileId: "profile-b" };

beforeEach(() => {
  vi.clearAllMocks();
  fake.profiles = {
    "profile-a": { id: "profile-a", appUserId: "user-a", name: "Kovács és Társa" },
    "profile-b": { id: "profile-b", appUserId: "user-b", name: "Béla Bt." },
  };
  fake.reports = [reportA, reportB];
});

describe("reports.exportDocx – jogosultság", () => {
  it("a saját profil jogosult felhasználója PK-val kezdődő .docx-et kap", async () => {
    const res = await caller("user-a", "profile-a").reports.exportDocx({ profileId: "profile-a", reportId: "report-a" });
    expect(res.mimeType).toBe(DOCX_MIME_TYPE);
    expect(res.fileName).toBe("riport-kovacs-es-tarsa-2026-10-01-2026-10-31.docx");
    expect(Buffer.from(res.base64, "base64").subarray(0, 2).toString("latin1")).toBe("PK");
    expect(generateReportSummary).not.toHaveBeenCalled();
  });

  it("session-profil nélkül is a tulajdonos tölthet le (lassú ellenőrzési út)", async () => {
    const res = await caller("user-a", null).reports.exportDocx({ profileId: "profile-a", reportId: "report-a" });
    expect(res.base64.length).toBeGreaterThan(0);
  });

  it("idegen profil felhasználója FORBIDDEN hibát kap", async () => {
    await expect(caller("user-b", "profile-b").reports.exportDocx({ profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("más profilhoz tartozó reportId a saját profil alatt NOT_FOUND, fájl nélkül", async () => {
    await expect(caller("user-a", "profile-a").reports.exportDocx({ profileId: "profile-a", reportId: "report-b" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("nem létező reportId NOT_FOUND", async () => {
    await expect(caller("user-a", "profile-a").reports.exportDocx({ profileId: "profile-a", reportId: "nincs-ilyen" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reports.exportDocx – hiányos riport", () => {
  it.each(["pending", "rendering", "failed"])("%s állapotú riport BAD_REQUEST barátságos üzenettel", async (status) => {
    fake.reports = [{ ...reportA, status }];
    await expect(caller("user-a", "profile-a").reports.exportDocx({ profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("még nem készült el") });
  });

  it("summaryData nélküli riport BAD_REQUEST", async () => {
    fake.reports = [{ ...reportA, summaryData: null }];
    await expect(caller("user-a", "profile-a").reports.exportDocx({ profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("delivered állapotú riport letölthető; profil hiányában a riport címe az ügyfélnév", async () => {
    fake.reports = [{ ...reportA, status: "delivered" }];
    const res = await caller("super-admin", null, "super_admin").reports.exportDocx({ profileId: "profile-x", reportId: "report-a" })
      .catch((e) => e);
    // super_admin másik profil alatt sem kapja meg a profile-a riportját
    expect(res).toMatchObject({ code: "NOT_FOUND" });

    fake.profiles = {};
    fake.reports = [{ ...reportA, status: "delivered" }];
    const ok = await caller("super-admin", null, "super_admin").reports.exportDocx({ profileId: "profile-a", reportId: "report-a" });
    expect(ok.fileName).toBe("riport-kovacs-es-tarsa-riport-2026-10-01-2026-10-31-2026-10-01-2026-10-31.docx");
  });
});
