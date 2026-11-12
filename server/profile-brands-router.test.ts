/**
 * G1 – márkák (alárkák) router-szinten: jogosultság, márkás és összesített riport
 * (brandId, cím, .docx/PDF, narratíva-prompt), márka nélküli regresszió és a
 * Social Hub márkánkénti szinkronja mockolt klienssel (valódi kulcs nélkül).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(),
    getProfileBrand: vi.fn(),
    listProfileBrands: vi.fn(async () => []),
    createProfileBrand: vi.fn(),
    updateProfileBrand: vi.fn(),
    deleteProfileBrand: vi.fn(),
    setDataConnectionBrand: vi.fn(async () => ({ ok: true, plan: { action: "none" } })),
    listDataConnections: vi.fn(async () => []),
    getMetricsByProfile: vi.fn(async () => []),
    countProfilePostsInPeriod: vi.fn(async () => 0),
    createReport: vi.fn(async (input: any) => ({ ...input, id: "r-1" })),
    updateReport: vi.fn(async (id: string, patch: any) => ({ id, ...patch })),
    listReports: vi.fn(async () => []),
    getReportById: vi.fn(),
  };
});
vi.mock("./ai/reportSummary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ai/reportSummary")>();
  return { ...actual, generateReportSummary: vi.fn(async () => "Összefoglaló.") };
});

import * as db from "./db";
import { generateReportSummary, buildReportSummaryPrompt } from "./ai/reportSummary";
import { appRouter } from "./routers";
import { BRAND_HAS_CONNECTIONS_MESSAGE, BRAND_NAME_TAKEN_MESSAGE } from "./routers/brands";
import { EXTERNAL_REF_TAKEN_MESSAGE } from "./socialHub/externalRef";
import { loadExportableReport, reportTitle } from "./routers/reports";
import { buildReportDocx } from "./reports/docx";
import { buildReportPdfWithLayout } from "./reports/pdf";
import { syncSocialMetrics } from "./socialHub/metrics";
import { syncProfileMetrics, type SyncProfileDeps } from "./reports/syncProfile";
import type { TrpcContext } from "./_core/context";
import { inflateRawSync } from "node:zlib";

const appUser = {
  id: "user-a", email: "a@example.com", name: "A", role: "user", subscriptionPlan: "free",
  onboardingCompleted: true, profileId: "profile-a", active: true, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
} as NonNullable<TrpcContext["appUser"]>;
const caller = () => appRouter.createCaller({ appUser, req: {} as any, res: {} as any } as unknown as TrpcContext);

const PROFILES: Record<string, any> = {
  "profile-a": { id: "profile-a", appUserId: "user-a", name: "Ste-Ba", industry: null, brandVoice: null },
  "profile-b": { id: "profile-b", appUserId: "user-b", name: "Idegen", industry: null, brandVoice: null },
};
const NISSAN = { id: "brand-nissan", profileId: "profile-a", name: "Nissan", socialHubExternalRef: null };
const FOREIGN_BRAND = "brand-of-profile-b";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getProfileById).mockImplementation(async (id: string) => PROFILES[id]);
  // A márka csak a saját profilja alatt található meg (a db-helper profileId + brandId párral szűr).
  vi.mocked(db.getProfileBrand).mockImplementation(async (profileId: string, brandId: string) =>
    (profileId === "profile-a" && brandId === NISSAN.id ? NISSAN : null) as any);
});

describe("jogosultság", () => {
  it("idegen profil márkáit nem lehet listázni, létrehozni, módosítani, törölni (FORBIDDEN)", async () => {
    const c = caller();
    await expect(c.brands.list({ profileId: "profile-b" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.brands.create({ profileId: "profile-b", name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.brands.update({ profileId: "profile-b", brandId: FOREIGN_BRAND, name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.brands.delete({ profileId: "profile-b", brandId: FOREIGN_BRAND })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.reports.connections.setBrand({ profileId: "profile-b", connectionId: "c", brandId: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.createProfileBrand).not.toHaveBeenCalled();
    expect(db.deleteProfileBrand).not.toHaveBeenCalled();
    expect(db.setDataConnectionBrand).not.toHaveBeenCalled();
  });

  it("saját profilon más profil márkájára hivatkozni NOT_FOUND (generálás, lista, kapcsolat, módosítás)", async () => {
    const c = caller();
    await expect(c.reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31", brandId: FOREIGN_BRAND }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(c.reports.list({ profileId: "profile-a", brandId: FOREIGN_BRAND })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(c.reports.connections.setBrand({ profileId: "profile-a", connectionId: "c-1", brandId: FOREIGN_BRAND }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(c.brands.update({ profileId: "profile-a", brandId: FOREIGN_BRAND, name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.createReport).not.toHaveBeenCalled();
    expect(db.setDataConnectionBrand).not.toHaveBeenCalled();
    expect(db.updateProfileBrand).not.toHaveBeenCalled();
  });

  it("a kapcsolat márkához rendelése és a márkaszűrős lista a saját márkával megy", async () => {
    await caller().reports.connections.setBrand({ profileId: "profile-a", connectionId: "c-1", brandId: NISSAN.id });
    expect(db.setDataConnectionBrand).toHaveBeenCalledWith("profile-a", "c-1", NISSAN.id);
    await caller().reports.list({ profileId: "profile-a", brandId: NISSAN.id });
    expect(db.listReports).toHaveBeenLastCalledWith("profile-a", NISSAN.id);
    await caller().reports.list({ profileId: "profile-a", brandId: null });
    expect(db.listReports).toHaveBeenLastCalledWith("profile-a", null);
    await caller().reports.list({ profileId: "profile-a" });
    expect(db.listReports).toHaveBeenLastCalledWith("profile-a");
  });
});

describe("márkák kezelése – hibák tegező üzenettel", () => {
  it("törlés hozzárendelt kapcsolatnál: CONFLICT", async () => {
    vi.mocked(db.deleteProfileBrand).mockResolvedValueOnce({ ok: false, reason: "has_connections" });
    const err = await caller().brands.delete({ profileId: "profile-a", brandId: NISSAN.id }).catch((e) => e);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe(BRAND_HAS_CONNECTIONS_MESSAGE);
    expect(err.message).toMatch(/Előbb vedd le a márkát a kapcsolatokról/);
  });

  it("Social Hub-azonosító: a profiléval azonos validáció, ütközésnél CONFLICT; foglalt név: CONFLICT", async () => {
    await expect(caller().brands.create({ profileId: "profile-a", name: "Chery", socialHubExternalRef: "rossz azonosító" }))
      .rejects.toThrow(/csak kisbetű, szám és kötőjel/);
    vi.mocked(db.createProfileBrand).mockResolvedValueOnce({ ok: false, reason: "ref_taken" });
    const taken = await caller().brands.create({ profileId: "profile-a", name: "Chery", socialHubExternalRef: " STEBA-Chery " }).catch((e) => e);
    expect(db.createProfileBrand).toHaveBeenLastCalledWith("profile-a", { name: "Chery", socialHubExternalRef: "steba-chery" });
    expect(taken).toMatchObject({ code: "CONFLICT", message: EXTERNAL_REF_TAKEN_MESSAGE });
    vi.mocked(db.createProfileBrand).mockResolvedValueOnce({ ok: false, reason: "name_taken" });
    await expect(caller().brands.create({ profileId: "profile-a", name: "Nissan" })).rejects.toMatchObject({ code: "CONFLICT", message: BRAND_NAME_TAKEN_MESSAGE });
    await expect(caller().brands.create({ profileId: "profile-a", name: "   " })).rejects.toThrow(/Adj nevet a márkának/);
  });
});

describe("riport generálása", () => {
  it("márkára: tárolja a brandId-t, a cím és a narratíva bemenete a márka nevét viseli, csak a márka sorai", async () => {
    vi.mocked(db.listDataConnections).mockResolvedValueOnce([
      { platform: "google_ads", brandId: NISSAN.id, connected: true, lastSyncError: "hiba" },
      { platform: "ga4", brandId: "brand-chery", connected: true, lastSyncError: "hiba" },
    ] as any);
    await caller().reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31", brandId: NISSAN.id });
    expect(db.createReport).toHaveBeenCalledWith(expect.objectContaining({
      brandId: NISSAN.id,
      title: "Ste-Ba – Nissan – riport 2026-10-01 → 2026-10-31",
    }));
    expect(db.getMetricsByProfile).toHaveBeenCalledWith("profile-a", "2026-10-01", "2026-10-31", NISSAN.id);
    const { summaryData } = vi.mocked(generateReportSummary).mock.calls[0][0] as any;
    expect(summaryData.brand).toEqual({ id: NISSAN.id, name: "Nissan" });
    // Csak a márka kapcsolatának szinkronhibája kerül a jelek közé (a Chery GA4-é nem).
    const syncErrors = JSON.stringify(summaryData.signals).match(/"platform":"(\w+)","period":"current","kind":"sync_error"/g) ?? [];
    expect(syncErrors.join()).toContain("google_ads");
    expect(syncErrors.join()).not.toContain("ga4");
  });

  it("összesítve (regresszió): a mostani cím, brandId nélkül, márkaszűrő nélküli lekérdezés", async () => {
    await caller().reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31" });
    const input = vi.mocked(db.createReport).mock.calls[0][0] as any;
    expect(input.title).toBe("Ste-Ba – riport 2026-10-01 → 2026-10-31");
    expect(input.title).toBe(reportTitle("Ste-Ba", null, "2026-10-01", "2026-10-31"));
    expect("brandId" in input).toBe(false);
    expect(db.getMetricsByProfile).toHaveBeenCalledWith("profile-a", "2026-10-01", "2026-10-31");
    expect(vi.mocked(db.getMetricsByProfile).mock.calls.every((c) => c.length === 3)).toBe(true);
    const { summaryData } = vi.mocked(generateReportSummary).mock.calls[0][0] as any;
    expect("brand" in summaryData).toBe(false);
  });

  it("a narratíva promptja márkánál megnevezi a márkát, összesítettnél nem", () => {
    const base = { kpis: [{ key: "clicks", label: "Kattintás", value: 10 }] };
    const branded = buildReportSummaryPrompt(PROFILES["profile-a"], { ...base, brand: { id: NISSAN.id, name: "Nissan" } });
    const text = branded.messages.map((m: any) => String(m.content)).join("\n");
    expect(text).toContain("Márka: Nissan");
    const plain = buildReportSummaryPrompt(PROFILES["profile-a"], base).messages.map((m: any) => String(m.content)).join("\n");
    expect(plain).not.toContain("Márka:");
  });
});

function docxText(buf: Buffer): string {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < buf.readUInt16LE(eocd + 10); n++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === "word/document.xml") {
      const off = buf.readUInt32LE(p + 42);
      const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const data = buf.subarray(start, start + buf.readUInt32LE(p + 20));
      const xml = (buf.readUInt16LE(p + 10) === 0 ? data : inflateRawSync(data)).toString("utf8");
      return (xml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("\n");
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return "";
}

describe("letöltés (.docx / PDF)", () => {
  const stored = (summaryExtra: object) => ({
    id: "r-1", profileId: "profile-a", title: "cím", status: "rendered", aiSummary: "Szöveg.",
    periodFrom: "2026-10-01", periodTo: "2026-10-31",
    summaryData: { kpis: [{ key: "clicks", label: "Kattintás", value: 10 }], byPlatform: [], social: [], ...summaryExtra },
  });

  it("márkás riportnál a fejlécben és a fájlban is ott a márka neve", async () => {
    vi.mocked(db.getReportById).mockResolvedValue(stored({ brand: { id: NISSAN.id, name: "Nissan" } }) as any);
    const content = await loadExportableReport(appUser, { profileId: "profile-a", reportId: "r-1" });
    expect(content.clientName).toBe("Ste-Ba – Nissan");
    expect(docxText(await buildReportDocx(content))).toContain("Ste-Ba – Nissan");
    const { layout } = await buildReportPdfWithLayout(content);
    expect(layout.lines.map((l) => l.text).join(" ")).toContain("Nissan");
    const file = await caller().reports.exportDocx({ profileId: "profile-a", reportId: "r-1" });
    expect(file.fileName).toMatch(/nissan/);
  });

  it("összesített / márka előtti riportnál változatlan az ügyfélnév (regresszió)", async () => {
    vi.mocked(db.getReportById).mockResolvedValue(stored({}) as any);
    const content = await loadExportableReport(appUser, { profileId: "profile-a", reportId: "r-1" });
    expect(content.clientName).toBe("Ste-Ba");
  });
});

describe("Social Hub márkánként (mockolt kliens, kulcs nélkül)", () => {
  const config = { baseUrl: "https://social-hub.invalid", apiKey: "teszt" } as any;
  const client = {
    listClients: vi.fn(async () => [{ id: "sh-1", external_ref: "steba-nissan" }, { id: "sh-0", external_ref: "steba" }]),
    getClientMetricsRange: vi.fn(async () => ({
      accounts: [{ provider: "meta:facebook", social_account_id: "fb", days: [{ day: "2026-10-05", metrics: { reach: 7 } }] }],
    })),
  } as any;

  it("a márka azonosítójával húz, és a sorokat a márkával címkézi", async () => {
    const replaceRows = vi.fn(async (_p: string, _f: string, _t: string, rows: unknown[]) => ({ inserted: rows.length }));
    const res = await syncSocialMetrics(
      { profileId: "profile-a", externalRef: "steba-nissan", from: "2026-10-01", to: "2026-10-31", brandId: NISSAN.id },
      { config, createClient: () => client, replaceRows },
    );
    expect(res).toMatchObject({ status: "synced", inserted: 1 });
    expect(client.getClientMetricsRange).toHaveBeenCalledWith("sh-1", "2026-10-01", "2026-10-31");
    expect(replaceRows.mock.calls[0][4]).toBe(NISSAN.id);
  });

  it("syncProfileMetrics: profil NULL-lal + Social Hub-azonosítós márkánként külön; márka nélkül változatlan kimenet", async () => {
    const syncSocial = vi.fn(async () => ({ status: "synced" as const, inserted: 2, skippedAccounts: 0 }));
    const deps: SyncProfileDeps = {
      listConnections: async () => [],
      fetchMetrics: async () => [],
      replaceRows: async () => ({ inserted: 0 }),
      getProfile: async () => ({ externalRef: "steba" }),
      syncSocial,
      listBrands: async () => [{ id: NISSAN.id, socialHubExternalRef: "steba-nissan" }, { id: "brand-chery", socialHubExternalRef: null }],
    };
    const res = await syncProfileMetrics("profile-a", "2026-10-01", "2026-10-31", undefined, deps);
    expect(syncSocial).toHaveBeenCalledTimes(2);
    expect((syncSocial.mock.calls[0] as any[])[0]).not.toHaveProperty("brandId");
    expect((syncSocial.mock.calls[1] as any[])[0]).toMatchObject({ externalRef: "steba-nissan", brandId: NISSAN.id });
    expect(res.inserted).toBe(4);
    expect(res.brandSocial).toEqual([{ brandId: NISSAN.id, social: { status: "synced", inserted: 2, skippedAccounts: 0 } }]);

    // Márka nélküli profil: pontosan a márkák előtti eredmény (nincs brandSocial kulcs).
    syncSocial.mockClear();
    const plain = await syncProfileMetrics("profile-a", "2026-10-01", "2026-10-31", undefined, { ...deps, listBrands: async () => [] });
    expect(syncSocial).toHaveBeenCalledTimes(1);
    expect(plain).toEqual({ platforms: [], inserted: 2, social: { status: "synced", inserted: 2, skippedAccounts: 0 }, errors: [] });
  });
});
