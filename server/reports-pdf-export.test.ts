/**
 * G1 PDF-export — reports.exportPdf jogosultság és hibautak (DB mockolva, nincs LLM).
 * Ugyanaz a közös előkészítés (loadExportableReport), mint az exportDocx-nél,
 * ezért a két export hibái egyeznek — ezt párhuzamosan is ellenőrizzük.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";

const fake = vi.hoisted(() => ({
  profiles: {} as Record<string, any>,
  reports: [] as any[],
  brokenFont: false,
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
// Hiányzó betű szimulálása: a getter tesztenként kapcsolható.
vi.mock("./reports/fonts/embedded", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reports/fonts/embedded")>();
  return {
    get DEJAVU_SANS_REGULAR_BASE64() { return fake.brokenFont ? "" : actual.DEJAVU_SANS_REGULAR_BASE64; },
    get DEJAVU_SANS_BOLD_BASE64() { return actual.DEJAVU_SANS_BOLD_BASE64; },
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { generateReportSummary } from "./ai/reportSummary";
import { PDF_MIME_TYPE } from "./reports/pdf";
import { REPORT_NOT_READY_MESSAGE } from "./routers/reports";

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
  aiSummary: "Stabil hónap, őszi űrlapkampánnyal.",
};
const reportB = { ...reportA, id: "report-b", profileId: "profile-b" };

beforeEach(() => {
  vi.clearAllMocks();
  fake.brokenFont = false;
  fake.profiles = {
    "profile-a": { id: "profile-a", appUserId: "user-a", name: "Kovács és Társa" },
    "profile-b": { id: "profile-b", appUserId: "user-b", name: "Béla Bt." },
  };
  fake.reports = [reportA, reportB];
});

const exportPdf = (userId: string, sessionProfile: string | null, input: { profileId: string; reportId: string }, role = "user") =>
  caller(userId, sessionProfile, role).reports.exportPdf(input);

describe("reports.exportPdf – jogosultság", () => {
  it("a saját profil jogosult felhasználója érvényes .pdf-et kap", async () => {
    const res = await exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "report-a" });
    expect(res.mimeType).toBe(PDF_MIME_TYPE);
    expect(res.mimeType).toBe("application/pdf");
    expect(res.fileName).toBe("riport-kovacs-es-tarsa-2026-10-01-2026-10-31.pdf");
    const buf = Buffer.from(res.base64, "base64");
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(buf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain("Kovács és Társa");
    expect(generateReportSummary).not.toHaveBeenCalled();
  });

  it("session-profil nélkül is a tulajdonos tölthet le (lassú ellenőrzési út)", async () => {
    const res = await exportPdf("user-a", null, { profileId: "profile-a", reportId: "report-a" });
    expect(res.base64.length).toBeGreaterThan(0);
  });

  it("idegen profil felhasználója FORBIDDEN hibát kap", async () => {
    await expect(exportPdf("user-b", "profile-b", { profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("más profilhoz tartozó reportId a saját profil alatt NOT_FOUND", async () => {
    await expect(exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "report-b" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("nem létező reportId NOT_FOUND", async () => {
    await expect(exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "nincs-ilyen" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("super_admin bármely profil riportját letöltheti, de csak a saját profilja alatt", async () => {
    await expect(exportPdf("super-admin", null, { profileId: "profile-x", reportId: "report-a" }, "super_admin"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    const ok = await exportPdf("super-admin", null, { profileId: "profile-b", reportId: "report-b" }, "super_admin");
    expect(ok.fileName).toBe("riport-bela-bt-2026-10-01-2026-10-31.pdf");
  });
});

describe("reports.exportPdf – hiányos riport", () => {
  it.each(["pending", "rendering", "failed"])("%s állapotú riport BAD_REQUEST ugyanazzal az üzenettel", async (status) => {
    fake.reports = [{ ...reportA, status }];
    await expect(exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: REPORT_NOT_READY_MESSAGE });
  });

  it("summaryData nélküli riport BAD_REQUEST", async () => {
    fake.reports = [{ ...reportA, summaryData: null }];
    await expect(exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "BAD_REQUEST", message: REPORT_NOT_READY_MESSAGE });
  });

  it("delivered állapotú riport letölthető; profil hiányában a riport címe az ügyfélnév", async () => {
    fake.profiles = {};
    fake.reports = [{ ...reportA, status: "delivered" }];
    const ok = await exportPdf("super-admin", null, { profileId: "profile-a", reportId: "report-a" }, "super_admin");
    expect(ok.fileName).toBe("riport-kovacs-es-tarsa-riport-2026-10-01-2026-10-31-2026-10-01-2026-10-31.pdf");
  });
});

describe("reports.exportPdf – hiányzó betű", () => {
  // Az üzenetet a globális sanitizeErrors (server/_core/trpc.ts) egységes, rövid
  // magyar szövegre cseréli; a felületen a Reports.tsx saját tegező toastja jelenik meg.
  it("INTERNAL_SERVER_ERROR, és a szerver egyértelmű magyar hibát naplóz", async () => {
    fake.brokenFont = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(exportPdf("user-a", "profile-a", { profileId: "profile-a", reportId: "report-a" }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("próbáld újra") });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("[reports.exportPdf] PDF-készítés sikertelen"),
      expect.objectContaining({ message: expect.stringContaining("Hiányzik vagy sérült a beágyazott betűkészlet") }),
    );
    log.mockRestore();
  });
});

describe("exportDocx és exportPdf – közös előkészítés, azonos hibautak", () => {
  const cases: { name: string; setup: () => void; user: [string, string | null, string?]; input: { profileId: string; reportId: string } }[] = [
    { name: "idegen profil", setup: () => {}, user: ["user-b", "profile-b"], input: { profileId: "profile-a", reportId: "report-a" } },
    { name: "más profil riportja", setup: () => {}, user: ["user-a", "profile-a"], input: { profileId: "profile-a", reportId: "report-b" } },
    { name: "nem elkészült riport", setup: () => { fake.reports = [{ ...reportA, status: "rendering" }]; }, user: ["user-a", "profile-a"], input: { profileId: "profile-a", reportId: "report-a" } },
  ];

  it.each(cases)("$name: a két export ugyanazt a hibát adja", async ({ setup, user, input }) => {
    setup();
    const c = caller(user[0], user[1], user[2]);
    const docxErr = await c.reports.exportDocx(input).catch((e) => e);
    const pdfErr = await c.reports.exportPdf(input).catch((e) => e);
    expect(pdfErr.code).toBeDefined();
    expect({ code: pdfErr.code, message: pdfErr.message }).toEqual({ code: docxErr.code, message: docxErr.message });
  });

  it("sikeres esetben a fájlnév csak a kiterjesztésben tér el", async () => {
    const c = caller("user-a", "profile-a");
    const docx = await c.reports.exportDocx({ profileId: "profile-a", reportId: "report-a" });
    const pdf = await c.reports.exportPdf({ profileId: "profile-a", reportId: "report-a" });
    expect(pdf.fileName.replace(/\.pdf$/, "")).toBe(docx.fileName.replace(/\.docx$/, ""));
  });
});
