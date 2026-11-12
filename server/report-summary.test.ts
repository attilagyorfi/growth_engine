/**
 * G1 AI-narratíva — számellenőrzés, prompt-tartalom, újrapróbálás, tartalékágak,
 * mintaadat-jelzés és a reports.generate bekötése. Az invokeLLM és a DB mockolva:
 * nincs valódi LLM-, Google/Meta- vagy Social Hub-hívás.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  demo: false,
  responses: [] as Array<string | Error>,
  metrics: {} as Record<string, any[]>,
  posts: {} as Record<string, number | null>,
  connections: [] as any[],
  reports: new Map<string, any>(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => {
    const next = fake.responses.shift();
    if (next instanceof Error) throw next;
    return { choices: [{ message: { role: "assistant", content: next ?? "" } }] };
  }),
}));

vi.mock("./reports/connectors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reports/connectors")>();
  return { ...actual, isDemoData: () => fake.demo };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProfileById: vi.fn(async (id: string) => ({ id, appUserId: "user-a", name: "Kovács és Társa", industry: "építőipar", brandVoice: { tone: "barátságos-szakmai" } })),
    createReport: vi.fn(async (input: any) => { const r = { id: "report-1", ...input }; fake.reports.set(r.id, r); return r; }),
    updateReport: vi.fn(async (id: string, patch: any) => { const r = { ...fake.reports.get(id), ...patch }; fake.reports.set(id, r); return r; }),
    getMetricsByProfile: vi.fn(async (_p: string, from: string, to: string) => fake.metrics[`${from}|${to}`] ?? []),
    countProfilePostsInPeriod: vi.fn(async (_p: string, from: string, to: string) => fake.posts[`${from}|${to}`] ?? null),
    listDataConnections: vi.fn(async () => fake.connections),
  };
});

import { invokeLLM } from "./_core/llm";
import { getMetricsByProfile, countProfilePostsInPeriod } from "./db";
import { extractNumbers, findUnverifiedNumbers } from "./ai/numberCheck";
import {
  buildReportSummaryPrompt,
  generateReportSummary,
  DEMO_SUMMARY_NOTICE,
  SUMMARY_TECHNICAL_ERROR_TEXT,
  SUMMARY_UNAVAILABLE_TEXT,
  type ReportSummaryData,
} from "./ai/reportSummary";
import { analyzeReportPeriod } from "./ai/reportSignals";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { ClientProfile } from "../drizzle/schema";

const profile = {
  id: "profile-a",
  name: "Kovács és Társa",
  industry: "építőipar",
  brandVoice: { tone: "barátságos-szakmai", avoid: ["szleng"] },
} as unknown as ClientProfile;

function dailyRows(platform: string, metricKey: string, total: number, from: string, days: number) {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => ({
    platform,
    date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
    metricKey,
    value: total / days,
  }));
}

/** Okt. vs. szept. 1 – okt. 31: Google Ads kattintás 1000 → 600, a költés 0-ra esett. */
function sampleSummary(): ReportSummaryData {
  const signals = analyzeReportPeriod({
    from: "2026-10-01",
    to: "2026-10-31",
    currentRows: [
      ...dailyRows("google_ads", "clicks", 600, "2026-10-01", 31),
      ...dailyRows("google_ads", "spend", 0, "2026-10-01", 31),
      ...dailyRows("ga4", "sessions", 1500, "2026-10-01", 31),
    ],
    previousRows: [
      ...dailyRows("google_ads", "clicks", 1000, "2026-08-31", 31),
      ...dailyRows("google_ads", "spend", 150_000, "2026-08-31", 31),
      ...dailyRows("ga4", "sessions", 1500, "2026-08-31", 31),
    ],
    posts: { current: 4, previous: 9 },
  });
  return {
    kpis: [
      { key: "spend", label: "Költés", value: 0, prevValue: 150_000, unit: "HUF" },
      { key: "clicks", label: "Kattintás", value: 600, prevValue: 1000 },
      { key: "conversions", label: "Konverzió", value: 12, prevValue: 12 },
    ],
    byPlatform: [{ platform: "google_ads", spend: 0, conversions: 12 }],
    social: [{ platform: "facebook", metrics: [{ key: "reach", value: 12_345 }, { key: "engagement", value: 678 }] }],
    signals,
  };
}

const userPrompt = (callIndex = 0) => {
  const msgs = (vi.mocked(invokeLLM).mock.calls[callIndex][0] as any).messages as Array<{ role: string; content: string }>;
  return msgs.map((m) => m.content).join("\n\n");
};

beforeEach(() => {
  vi.clearAllMocks();
  fake.demo = false;
  fake.responses = [];
  fake.metrics = {};
  fake.posts = {};
  fake.connections = [];
  fake.reports.clear();
});

// ─── Számellenőrzés ──────────────────────────────────────────────────────────

describe("numberCheck", () => {
  const allowed = [150_000, 1234.56, -40, 12_345, 31, 2026, 10, 1];

  it("magyar formátumok: szóköz/pont ezres tagolás, tizedesvessző, kerekítés, %", () => {
    expect(findUnverifiedNumbers("A költés 150 000 Ft volt.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("A költés 150 000 Ft volt.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("A költés 150.000 Ft volt.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("Átlagosan 1 234,56 Ft, kerekítve 1 235 Ft vagy 1 234,6 Ft.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("A kattintások 40%-kal estek, −40 %.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("Kb. 12,3 ezer elérés.", allowed)).toEqual([]);
  });

  it("az időszak dátumai, azok részei és a napszám elfogadott", () => {
    expect(findUnverifiedNumbers("A 2026. 10. 01. – 2026. 10. 31. közötti 31 napban.", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("Időszak: 2026-10-01 – 2026-10-31.", allowed)).toEqual([]);
  });

  it("a felsorolás sorszámai nem számítanak, más kis egész igen", () => {
    expect(findUnverifiedNumbers("1. Mi ment jól\n2) Figyelendő\n## 3. Javaslat\n**4.** Zárás", allowed)).toEqual([]);
    expect(findUnverifiedNumbers("Javaslom, hogy 3 új hirdetést indíts.", allowed)).toEqual(["3"]);
  });

  it("kitalált számot jelez; betű utáni számjegy (GA4) nem szám", () => {
    expect(findUnverifiedNumbers("A GA4 szerint 987 654 munkamenet volt.", allowed)).toEqual(["987 654"]);
    expect(extractNumbers("GA4")).toEqual([]);
  });
});

// ─── Prompt ──────────────────────────────────────────────────────────────────

describe("buildReportSummaryPrompt", () => {
  it("benne az előző időszak, csatorna-összevetés, közösségi szakasz, kontextus-jelek és a megjelölt változások okkal", () => {
    const { messages } = buildReportSummaryPrompt(profile, sampleSummary());
    const text = messages.map((m) => m.content).join("\n");
    expect(text).toContain("Előző, azonos hosszú időszak: 2026-08-31 – 2026-09-30");
    expect(text).toMatch(/Kattintás: 600 \(előző időszak: 1\s?000, változás: -40%\)/);
    expect(text).toContain("Közösségi média (Social Hub)");
    expect(text).toMatch(/Facebook: .*Elérés 12\s345/);
    expect(text).toContain("nem futott fizetett kampány");
    expect(text).toContain("Ütemezett/publikált posztok a Growth Engine-ben: 4 (előző időszak: 9)");
    expect(text).toMatch(/Google Ads · Kattintás: 1\s?000 → 600 \(-40%.*Lehetséges ok: nem futott fizetett kampány/);
  });

  it("kimondja, hogy csak a megjelölt okokból magyarázhat, ok híján az ok nem ismert; a brand voice benne van", () => {
    const { messages } = buildReportSummaryPrompt(profile, sampleSummary());
    const text = messages.map((m) => m.content).join("\n");
    expect(text).toContain("CSAK a „Megjelölt nagy változások” listában megadott lehetséges okkal magyarázd");
    expect(text).toContain("írd ki egyértelműen, hogy az ok nem ismert");
    expect(text).toContain('"tone":"barátságos-szakmai"');
  });

  it("ha egyik időszakban sincs poszt, nincs „0 poszt” állítás", () => {
    const data = sampleSummary();
    data.signals!.context.posts = { current: 0, previous: 0 };
    const text = buildReportSummaryPrompt(profile, data).messages.map((m) => m.content).join("\n");
    expect(text).not.toContain("posztok");
  });

  it("ha az előző időszakban volt poszt, most 0, a posztszám az összevetéssel együtt szerepel", () => {
    const data = sampleSummary();
    data.signals!.context.posts = { current: 0, previous: 5 };
    const text = buildReportSummaryPrompt(profile, data).messages.map((m) => m.content).join("\n");
    expect(text).toContain("Ütemezett/publikált posztok a Growth Engine-ben: 0 (előző időszak: 5)");
  });

  it("az engedett számok között ott a bemenet minden értéke, a dátumrészek és a napszám", () => {
    const { allowedNumbers } = buildReportSummaryPrompt(profile, sampleSummary());
    for (const n of [600, 1000, -40, 150_000, 12_345, 678, 31, 2026, 8, 30, 4, 9]) expect(allowedNumbers).toContain(n);
  });
});

// ─── generateReportSummary ───────────────────────────────────────────────────

describe("generateReportSummary", () => {
  const VALID = "A kattintások 1s?000-ről 600-ra estek (−40%), mert nem futott fizetett kampány. A Facebook elérése 12 345 volt.";

  it("helyes számoknál egy hívás, a szöveg változatlanul megy ki", async () => {
    fake.responses = [VALID];
    const out = await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(out).toBe(VALID);
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("kitalált számnál pontosan egy újrapróbálás szigorító megjegyzéssel", async () => {
    fake.responses = ["A konverziók 87%-kal nőttek.", VALID];
    const out = await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(out).toBe(VALID);
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(userPrompt(0)).not.toContain("FIGYELEM");
    expect(userPrompt(1)).toContain("FIGYELEM");
    expect(userPrompt(1)).toContain("87");
    expect(userPrompt(1)).toContain("KIZÁRÓLAG a fenti adatokban szereplő számokat");
  });

  it("ha a második válasz is hibás, a mostani tartalékszöveg megy ki", async () => {
    fake.responses = ["A konverziók 87%-kal nőttek.", "Még mindig 55 új ügyfél."];
    const out = await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(out).toBe(SUMMARY_UNAVAILABLE_TEXT);
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("ha a második válasz üres, a tartalékszöveg megy ki", async () => {
    fake.responses = ["Kitalált 777 szám.", "   "];
    expect(await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" })).toBe(SUMMARY_UNAVAILABLE_TEXT);
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("LLM-kivételnél a technikai tartalékszöveg", async () => {
    fake.responses = [new Error("401 invalid_api_key")];
    expect(await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" })).toBe(SUMMARY_TECHNICAL_ERROR_TEXT);
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("mintaadatnál a szöveg elején a rövid jelzés; élő adatnál nincs", async () => {
    fake.demo = true;
    fake.responses = [VALID];
    const demoOut = await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(demoOut.startsWith(DEMO_SUMMARY_NOTICE)).toBe(true);
    expect(demoOut).toContain(VALID);

    fake.demo = false;
    fake.responses = [VALID];
    const liveOut = await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(liveOut).not.toContain(DEMO_SUMMARY_NOTICE);
  });

  it("a számellenőrzés a jelzés hozzáfűzése előtt fut (a jelzés nem okoz újrapróbálást), tartaléknál is ott a jelzés", async () => {
    fake.demo = true;
    fake.responses = [VALID];
    await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" });
    expect(invokeLLM).toHaveBeenCalledTimes(1);

    fake.responses = [new Error("hálózat")];
    expect(await generateReportSummary({ profile, summaryData: sampleSummary(), appUserId: "u" }))
      .toBe(`${DEMO_SUMMARY_NOTICE}\n\n${SUMMARY_TECHNICAL_ERROR_TEXT}`);
  });
});

// ─── reports.generate bekötés ────────────────────────────────────────────────

const caller = () => appRouter.createCaller({
  appUser: {
    id: "user-a", email: "a@example.hu", name: "A", role: "user", subscriptionPlan: "pro",
    onboardingCompleted: true, profileId: "profile-a", active: true,
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {}, cookie: () => {} },
} as unknown as TrpcContext);

describe("reports.generate – AI-narratíva bemenete", () => {
  beforeEach(() => {
    fake.metrics["2026-10-01|2026-10-31"] = [
      ...dailyRows("google_ads", "clicks", 600, "2026-10-01", 31),
      ...dailyRows("google_ads", "spend", 0, "2026-10-01", 31),
      ...dailyRows("facebook", "reach", 6000, "2026-10-01", 31),
    ];
    fake.metrics["2026-08-31|2026-09-30"] = [
      ...dailyRows("google_ads", "clicks", 1000, "2026-08-31", 31),
      ...dailyRows("google_ads", "spend", 150_000, "2026-08-31", 31),
      ...dailyRows("facebook", "reach", 10_000, "2026-08-31", 31),
    ];
    fake.posts["2026-10-01|2026-10-31"] = 4;
    fake.posts["2026-08-31|2026-09-30"] = 9;
  });

  it("lekéri az előző azonos hosszú időszakot, és az összevetés, a social és a jelek a promptba és a summaryData-ba kerülnek", async () => {
    fake.responses = ["A kattintások 1s?000-ről 600-ra csökkentek."];
    const report = await caller().reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31" });

    expect(getMetricsByProfile).toHaveBeenCalledWith("profile-a", "2026-08-31", "2026-09-30");
    expect(countProfilePostsInPeriod).toHaveBeenCalledWith("profile-a", "2026-08-31", "2026-09-30");
    const prompt = userPrompt(0);
    expect(prompt).toContain("Előző, azonos hosszú időszak: 2026-08-31 – 2026-09-30");
    expect(prompt).toContain("Megjelölt nagy változások");
    expect(prompt).toMatch(/Google Ads · Kattintás: .*Lehetséges ok: nem futott fizetett kampány/);
    expect(prompt).toMatch(/Facebook · Elérés: .*Lehetséges ok: kevesebb poszt/);
    expect(prompt).toContain("Közösségi média (Social Hub)");
    expect(prompt).toContain('"tone":"barátságos-szakmai"');

    const sd = report.summaryData as any;
    expect(sd.kpis.find((k: any) => k.key === "clicks")).toMatchObject({ value: 600, prevValue: 1000 });
    expect(sd.byPlatform[0]).toMatchObject({ platform: "google_ads", spend: 0, prevSpend: 150_000 });
    expect(sd.social[0].platform).toBe("facebook");
    expect(sd.signals.channels.find((c: any) => c.platform === "facebook").previous.metrics.reach).toBe(10_000);
    expect(report.aiSummary).toBe("A kattintások 1s?000-ről 600-ra csökkentek.");
  });

  it("összevetésnél az üres előző időszak hiányzó adatként kerül a promptba, változásjelölés nélkül", async () => {
    fake.metrics["2026-08-31|2026-09-30"] = [];
    fake.responses = ["Rövid összefoglaló."];
    await caller().reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31" });
    const prompt = userPrompt(0);
    expect(prompt).toContain("Hiányzó adat: Google Ads – az előző időszakban nincs mért adat.");
    expect(prompt).toContain("Nincs a küszöböt meghaladó változás.");
  });

  it("compareToPrevious=false: nincs előző időszaki lekérés és nincs összevetés a promptban", async () => {
    fake.responses = ["Rövid összefoglaló."];
    const report = await caller().reports.generate({ profileId: "profile-a", from: "2026-10-01", to: "2026-10-31", compareToPrevious: false });

    expect(getMetricsByProfile).toHaveBeenCalledTimes(1);
    expect(countProfilePostsInPeriod).toHaveBeenCalledTimes(1);
    const prompt = userPrompt(0);
    expect(prompt).not.toContain("Előző, azonos hosszú időszak");
    expect(prompt).not.toContain("Megjelölt nagy változások");
    expect(prompt).not.toContain("előző időszak:");
    expect(prompt).not.toContain("az előző időszakban");
    expect(prompt).not.toContain("Lehetséges ok");
    expect(prompt).toContain("nincs összevetés az előző időszakkal");
    const sd = report.summaryData as any;
    expect(sd.kpis[0].prevValue).toBeUndefined();
    expect(sd.signals.previousPeriod).toBeNull();
  });
});
