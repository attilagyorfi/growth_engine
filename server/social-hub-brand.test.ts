/**
 * G2 – márkaprofil-szinkron a Social Hubba: leképezés, PUT, sorrendvédelem, végpontok.
 * Memóriabeli tároló, mock HTTP és mock DNS; valódi Social Hub, kulcs vagy adatbázis nincs.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-000000";
  return { profiles: {} as Record<string, any>, store: null as any, upsertError: null as any, order: [] as string[] };
});
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async (host: string) => [{ address: host.startsWith("belso") ? "10.0.0.5" : "93.184.216.34" }]) }));
vi.mock("./db", async (orig) => ({
  ...(await orig<typeof import("./db")>()),
  getDb: async () => null,
  getProfileById: async (id: string) => h.profiles[id],
  upsertProfile: async (p: any) => {
    if (h.upsertError) throw h.upsertError;
    h.order.push("mentés");
    h.profiles[p.id] = { externalRef: null, ...h.profiles[p.id], ...p };
    return h.profiles[p.id];
  },
}));
vi.mock("./socialHub/brandStore", async (orig) => ({ ...(await orig<typeof import("./socialHub/brandStore")>()), getBrandStore: () => h.store }));

import { appRouter } from "./routers";
import { BRAND_LIMITS, BrandRulesError, buildBrandProfile, EMPTY_BRAND_RULES, normalizeBrandRules } from "./socialHub/brandProfile";
import type { BrandOutcome, BrandRow, BrandStore } from "./socialHub/brandStore";
import {
  getBrandSyncStatus, LEASE_MS, LIST_BUDGET_MS, PUT_BUDGET_MS, SAVE_WAIT_MS, syncBrandAfterSave, syncBrandNow, syncBrandProfile,
  syncErrorCode, UNCERTAIN_HOLD_MS, type BrandSyncDeps,
} from "./socialHub/brandSync";
import { createSocialHubClient, SocialHubError, type SocialHubClientOptions } from "./socialHub/client";
import { lookup as dnsLookup } from "node:dns/promises";

const KEY = "sh_live_TITKOS-teszt-kulcs-9876";
const BASE = "https://hub.example.test/api/v1";
const CLIENT = "00000000-0000-4000-8000-000000000001";
const CLIENT2 = "00000000-0000-4000-8000-000000000002";
const P = "p-a";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

// ─── Memóriabeli tároló (az adatbázisos szabályaival) ────────────────────────

function memoryStore() {
  const rows = new Map<string, BrandRow>();
  const ensure = (id: string): BrandRow | null => {
    if (!h.profiles[id]) return null;
    if (!rows.has(id)) {
      rows.set(id, {
        profileId: id, requiredPhrases: [], forbiddenPhrases: [], requiredDisclaimer: null, requestedRev: 0, syncedRev: 0,
        leaseToken: null, leaseUntilMs: null, targetRef: null, targetUrlHash: null, targetClientId: null, maybeSent: false,
        sentHash: null, sentAtMs: null, lastErrorCode: null, lastErrorAtMs: null, lastErrorTarget: null,
      });
    }
    return rows.get(id)!;
  };
  const own = (id: string, token: string) => {
    const r = rows.get(id);
    return r && r.leaseToken === token && (r.leaseUntilMs ?? 0) > Date.now() ? r : null;
  };
  const store: BrandStore = {
    read: async (id) => ({ row: rows.has(id) ? { ...rows.get(id)! } : null, nowMs: Date.now(), missingTable: false }),
    saveRules: async (id, rules) => { const r = ensure(id); if (!r) return false; Object.assign(r, rules); r.requestedRev++; return true; },
    bumpRev: async (id) => { const r = ensure(id); if (!r) return false; h.order.push("rev"); r.requestedRev++; return true; },
    acquire: async (id, token, leaseMs) => {
      const r = rows.get(id);
      if (!r || r.requestedRev <= r.syncedRev || (r.leaseUntilMs !== null && r.leaseUntilMs > Date.now())) return null;
      Object.assign(r, { leaseToken: token, leaseUntilMs: Date.now() + leaseMs });
      return { ...r };
    },
    begin: async (id, token, target, opts) => {
      const r = own(id, token);
      if (!r || r.leaseUntilMs! <= Date.now() + opts.minLeftMs || h.profiles[id]?.externalRef !== target.ref) return false;
      Object.assign(r, {
        sentHash: null, maybeSent: true, targetRef: target.ref, targetUrlHash: target.urlHash, targetClientId: target.clientId,
        leaseUntilMs: Date.now() + opts.leaseMs, ...(opts.sameTarget ? {} : { sentAtMs: null }),
      });
      return true;
    },
    finish: async (id, token, rev, o: BrandOutcome, renewMs) => {
      const r = own(id, token);
      if (!r) return null;
      const again = renewMs > 0 && r.requestedRev > rev && ["sent", "empty", "failed"].includes(o.kind);
      if (again) r.leaseUntilMs = Date.now() + renewMs;
      else Object.assign(r, { leaseToken: null, leaseUntilMs: o.kind === "uncertain" ? Date.now() + o.holdMs : null });
      if (o.kind === "sent") Object.assign(r, { sentHash: o.hash, sentAtMs: Date.now(), maybeSent: true });
      if (o.kind === "sent" || o.kind === "empty") Object.assign(r, { syncedRev: rev, lastErrorCode: null, lastErrorAtMs: null, lastErrorTarget: null });
      if (o.kind === "failed" || o.kind === "uncertain") Object.assign(r, { lastErrorCode: o.code, lastErrorAtMs: Date.now(), lastErrorTarget: o.target });
      if (o.kind === "failed" && o.restore) Object.assign(r, o.restore);
      return again ? { ...r } : null;
    },
  };
  return { rows, store };
}

// ─── Közös környezet ─────────────────────────────────────────────────────────

type Req = { method: string; path: string; body: any; headers: Record<string, string> };
let reqs: Req[];
let putReply: (body: any, n: number) => Response | Promise<Response>;
let clients: () => Response | Promise<Response>;
let mem: ReturnType<typeof memoryStore>;
let logs: string[];
let baseUrl: string;

const fetchMock = vi.fn(async (url: any, init: any) => {
  const path = new URL(url).pathname.replace("/api/v1", "");
  const body = init.body ? JSON.parse(init.body) : null;
  reqs.push({ method: init.method, path, body, headers: init.headers });
  if (init.method === "GET") return clients();
  return putReply(body, puts().length);
});
const puts = () => reqs.filter((r) => r.method === "PUT");
const okPut = () => json({ client_id: CLIENT, synced_source: "growth_engine", synced_at: "2026-11-24T10:00:00Z" });
const clientList = (id = CLIENT, ref = "viba") => json({ data: [{ id, name: "VIBA", external_ref: ref, accounts: [] }] });
const deps = (over: BrandSyncDeps = {}): BrandSyncDeps => ({
  store: mem.store,
  resolve: async () => ({ status: "ok", source: "env", config: { baseUrl, apiKey: KEY, source: "env" } }),
  createClient: (c, o: SocialHubClientOptions) => createSocialHubClient(c, { ...o, fetch: fetchMock as any, sleep: async () => {} }),
  ...over,
});
const sync = (over: BrandSyncDeps = {}) => syncBrandProfile(P, { bump: true }, deps(over));
const status = (over: BrandSyncDeps = {}) => getBrandSyncStatus(P, deps(over));
const row = () => mem.rows.get(P)!;
const voice = (tone: string) => ({ tone, style: "", avoid: "", keywords: [] });
const setTone = (tone: string) => { h.profiles[P] = { ...h.profiles[P], brandVoice: voice(tone) }; };
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const unhandled: unknown[] = [];
const onUnhandled = (err: unknown) => { unhandled.push(err); };

beforeEach(() => {
  reqs = []; logs = []; h.order = []; h.upsertError = null; baseUrl = BASE;
  fetchMock.mockClear();
  mem = memoryStore(); h.store = mem.store;
  h.profiles = { [P]: { id: P, appUserId: "u-a", externalRef: "viba", brandVoice: voice("Barátságos"), contentPillars: [] } };
  putReply = okPut; clients = () => clientList();
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation((...x) => { logs.push(x.map(String).join(" ")); });
  vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("SOCIAL_HUB_API_URL", BASE); vi.stubEnv("SOCIAL_HUB_API_KEY", KEY);
  vi.stubGlobal("fetch", fetchMock);
  process.on("unhandledRejection", onUnhandled);
});
afterEach(() => {
  expect(logs.join("\n")).not.toMatch(/TITKOS|Bearer|hub\.example/);
  expect(JSON.stringify(Array.from(mem.rows.values()))).not.toMatch(/TITKOS|Bearer|hub\.example/);
  process.off("unhandledRejection", onUnhandled);
  expect(unhandled).toEqual([]);
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

// ─── Leképezés ───────────────────────────────────────────────────────────────

const pillar = (name: string, over: object = {}) => ({ id: name, name, description: "", active: true, percentage: 10, ...over });

describe("leképezés", () => {
  it("a törzs pontosan az öt mező; a keywords és az avoid csak a hangnem szövegébe kerül", () => {
    const { body, warnings, empty } = buildBrandProfile({
      brandVoice: { tone: "Szakmai", style: "Rövid", avoid: "olcsó, akció", keywords: ["prémium", "garancia, szerviz"] },
      contentPillars: [pillar("Edukáció", { description: "Tippek" }), pillar("Régi", { active: false })],
    }, EMPTY_BRAND_RULES);
    expect(Object.keys(body).sort()).toEqual(["forbidden_phrases", "pillars", "required_disclaimer", "required_phrases", "voice"]);
    expect(body).toEqual({
      voice: "Hangnem: Szakmai\nStílus: Rövid\nKerülendő: olcsó, akció\nJavasolt kulcsszavak: prémium, garancia, szerviz",
      required_phrases: [], forbidden_phrases: [], required_disclaimer: null,
      pillars: [{ name: "Edukáció", description: "Tippek" }],
    });
    expect(warnings).toEqual([]);
    expect(empty).toBe(false);
  });

  it("a listák és a záradék csak az új mezőkből jönnek, a vesszős kifejezés egyben marad", () => {
    const { body } = buildBrandProfile({ brandVoice: { tone: "", style: "", avoid: "tilos", keywords: ["kell"] } },
      { requiredPhrases: ["egy, kettő"], forbiddenPhrases: ["olcsó, gyors"], requiredDisclaimer: "A, B; C\r\nD" });
    expect(body).toMatchObject({ required_phrases: ["egy, kettő"], forbidden_phrases: ["olcsó, gyors"], required_disclaimer: "A, B; C\nD" });
  });

  it("hiányos vagy hiányzó brandVoice és pillér nem hiba; üresnél empty", () => {
    for (const p of [{}, { brandVoice: null, contentPillars: null }, { brandVoice: {} as any, contentPillars: [null, {}] as any }, { brandVoice: { keywords: "x" } as any }]) {
      const m = buildBrandProfile(p, EMPTY_BRAND_RULES);
      expect(m.empty).toBe(true);
      expect(m.body).toEqual({ voice: null, required_phrases: [], forbidden_phrases: [], required_disclaimer: null, pillars: [] });
    }
    expect(buildBrandProfile({ brandVoice: { tone: "Nyugodt" } as any }, EMPTY_BRAND_RULES).body.voice).toBe("Hangnem: Nyugodt");
  });

  it("minden korlátot betart, és minden rövidítésről, kihagyásról szól", () => {
    const longName = "n".repeat(130);
    const { body, warnings } = buildBrandProfile({
      brandVoice: { tone: "é".repeat(1990) + "😀".repeat(10), style: "", avoid: "", keywords: [] },
      contentPillars: [
        pillar(longName + "A", { description: "d".repeat(1001) }), pillar(longName + "B"), pillar("  "),
        pillar("Azonos"), pillar("azonos"), ...Array.from({ length: 22 }, (_, i) => pillar(`P${i}`)),
      ],
    }, { requiredPhrases: ["x".repeat(201), "jó", "JÓ"], forbiddenPhrases: Array.from({ length: 101 }, (_, i) => `f${i}`), requiredDisclaimer: "z".repeat(1001) });
    expect(body.voice!.length).toBeLessThanOrEqual(BRAND_LIMITS.voice);
    expect(body.voice).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(body.pillars).toHaveLength(20);
    expect(new Set(body.pillars.map((p) => p.name.toLocaleLowerCase())).size).toBe(20);
    expect(body.pillars[0]).toEqual({ name: "n".repeat(120), description: "d".repeat(1000) });
    expect(body.required_phrases).toEqual(["jó"]);
    expect(body.forbidden_phrases).toHaveLength(100);
    expect(body.required_disclaimer).toBeNull();
    const text = warnings.join("\n");
    for (const part of ["hangnem leírása túl hosszú", "pillér neve túl hosszú", "pillér leírása túl hosszú", "név nélküli", "neve azonos",
      "Legfeljebb 20 pillér", "Kötelező kifejezések:", "Tiltott kifejezések:", "záradék túl hosszú"]) expect(text).toContain(part);
    expect(warnings.filter((w) => w.startsWith("Legfeljebb 20"))).toHaveLength(4);
  });
});

describe("az új mezők ellenőrzése", () => {
  const rules = (over: object) => normalizeBrandRules({ ...EMPTY_BRAND_RULES, ...over });
  it("tisztít: szélső szóköz, üres sor, ismétlődés; a vessző marad", () => {
    expect(rules({ requiredPhrases: [" G2A ", "", "g2a", "egy, kettő\r\n"], requiredDisclaimer: " A\r\nB " }))
      .toEqual({ requiredPhrases: ["G2A", "egy, kettő"], forbiddenPhrases: [], requiredDisclaimer: "A\nB" });
  });
  it("a korlátot túllépő adat magyar hiba, nem vágás", () => {
    expect(() => rules({ requiredPhrases: ["x".repeat(201)] })).toThrow(/túl hosszú/);
    expect(() => rules({ forbiddenPhrases: Array.from({ length: 101 }, (_, i) => `f${i}`) })).toThrow(/legfeljebb 100/);
    expect(() => rules({ requiredDisclaimer: "z".repeat(1001) })).toThrow(/záradék túl hosszú/);
    expect(() => rules({ requiredPhrases: ["egy\nkettő"] })).toThrow(/csak egy sor/);
    expect(() => rules({ requiredPhrases: ["egy\r\nkettő"] })).toThrow(BrandRulesError);
    expect(rules({ requiredPhrases: ["x".repeat(200)], requiredDisclaimer: "z".repeat(1000) }).requiredPhrases[0]).toHaveLength(200);
  });
  it("elutasítja, ha egy tiltott kifejezés (kisbetűsítve, részszövegként) kötelezőben vagy záradékban szerepel", () => {
    expect(() => rules({ requiredPhrases: ["Olcsóbb nálunk"], forbiddenPhrases: ["OLCSÓ"] })).toThrow(/minden poszt megállna/);
    expect(() => rules({ requiredDisclaimer: "Ez egy Reklám.", forbiddenPhrases: ["reklám"] })).toThrow(/záradékban/);
    expect(rules({ requiredPhrases: ["ár"], forbiddenPhrases: ["áruló"] }).forbiddenPhrases).toEqual(["áruló"]);
  });
});

// ─── Kliens ──────────────────────────────────────────────────────────────────

describe("putBrandProfile", () => {
  const client = (over: SocialHubClientOptions = {}, source: "stored" | "env" = "env", base = BASE) =>
    createSocialHubClient({ baseUrl: base, apiKey: KEY, source }, { fetch: fetchMock as any, sleep: async () => {}, ...over });

  it("helyes módszer, útvonal, törzs; Idempotency-Key nélkül, átirányítás kézzel", async () => {
    await client().putBrandProfile(CLIENT, '{"voice":null}');
    expect(reqs).toEqual([{ method: "PUT", path: `/clients/${CLIENT}/brand-profile`, body: { voice: null },
      headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json", "Content-Type": "application/json" } }]);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });

  it("átirányítás, eltérő ügyfél, rossz válasz: hiba; a hibában nincs kulcs, cím", async () => {
    const error = async (reply: Response) => {
      putReply = () => reply;
      const err: any = await client().putBrandProfile(CLIENT, "{}").catch((e) => e);
      expect(err).toBeInstanceOf(SocialHubError);
      expect(`${err.stack}${JSON.stringify(err)}`).not.toMatch(/TITKOS|hub\.example|00000000/);
      return err;
    };
    expect(await error(new Response(null, { status: 302, headers: { location: "https://mas.test" } }))).toMatchObject({ kind: "http", status: 302 });
    expect(await error(json({ client_id: CLIENT2 }))).toMatchObject({ kind: "invalid_response", endpoint: "/clients/{id}/brand-profile" });
    expect(await error(json({}))).toMatchObject({ kind: "invalid_response" });
    expect(await error(json({ error: { code: "VALIDATION", message: "x" } }, 400))).toMatchObject({ status: 400, code: "VALIDATION", ambiguous: false });
  });

  it("tárolt címnél fut az SSRF-ellenőrzés", async () => {
    await expect(client({}, "stored", "https://belso.test/api/v1").putBrandProfile(CLIENT, "{}")).rejects.toMatchObject({ kind: "blocked" });
    expect(reqs).toEqual([]);
    expect(dnsLookup).toHaveBeenCalled();
  });

  it("429/5xx: korlátozott újrapróbálás, határidő után nem; 5xx utáni 4xx bizonytalan", async () => {
    putReply = () => json({}, 503);
    await expect(client().putBrandProfile(CLIENT, "{}")).rejects.toMatchObject({ status: 503, ambiguous: true });
    expect(puts()).toHaveLength(3);
    reqs = [];
    await expect(client({ deadlineAt: Date.now() + 3_000 }).putBrandProfile(CLIENT, "{}")).rejects.toMatchObject({ status: 503 });
    expect(puts()).toHaveLength(1);
    reqs = [];
    putReply = (_b, n) => (n === 1 ? json({}, 429) : okPut());
    await client().putBrandProfile(CLIENT, "{}");
    expect(puts()).toHaveLength(2);
    reqs = [];
    putReply = (_b, n) => json({}, n === 1 ? 500 : 404);
    await expect(client().putBrandProfile(CLIENT, "{}")).rejects.toMatchObject({ status: 404, ambiguous: true });
    reqs = [];
    await expect(client({ deadlineAt: Date.now() - 1 }).putBrandProfile(CLIENT, "{}")).rejects.toMatchObject({ kind: "timeout" });
    expect(reqs).toEqual([]);
  });
});

// ─── Szinkron ────────────────────────────────────────────────────────────────

describe("szinkron", () => {
  it("a teljes állapot megy, a siker rögzül; az állapotlekérdezés nem hív Social Hubot", async () => {
    await mem.store.saveRules(P, { requiredPhrases: ["G2A"], forbiddenPhrases: ["olcsó"], requiredDisclaimer: "Reklám" });
    expect((await status()).pending).toBe(true);
    expect(await sync()).toEqual({ status: "sent" });
    expect(puts().map((p) => p.body)).toEqual([{ voice: "Hangnem: Barátságos", required_phrases: ["G2A"], forbidden_phrases: ["olcsó"], required_disclaimer: "Reklám", pillars: [] }]);
    const calls = reqs.length;
    expect(await status()).toMatchObject({ state: "ok", pending: false, running: false, lastError: null, lastSyncedAt: expect.any(Date), rules: { requiredPhrases: ["G2A"] } });
    setTone("Komoly");
    expect((await status()).pending).toBe(true);
    expect(reqs.length).toBe(calls);
    expect(row()).toMatchObject({ requestedRev: 2, syncedRev: 2, leaseToken: null, leaseUntilMs: null, targetRef: "viba", targetClientId: CLIENT });
  });

  it("párosítás vagy kapcsolat nélkül, olvashatatlan kapcsolatnál: nincs kérés és sor, rövid állapot", async () => {
    h.profiles[P].externalRef = null;
    expect(await sync()).toEqual({ status: "not_paired" });
    expect((await status()).state).toBe("not_paired");
    h.profiles[P].externalRef = "viba";
    for (const [resolved, state] of [["not_configured", "not_configured"], ["error", "connection_error"]] as const) {
      const over: BrandSyncDeps = { resolve: async () => ({ status: resolved }) };
      expect(await sync(over)).toEqual({ status: state });
      expect((await status(over)).state).toBe(state);
      expect((await syncBrandNow(P, deps(over))).ok).toBe(false);
    }
    expect(await syncBrandProfile(P, { bump: true }, deps({ store: null }))).toEqual({ status: "unavailable" });
    expect(reqs).toEqual([]);
    expect(mem.rows.size).toBe(0);
  });

  it("alárkára nem megy: csak a profil azonosítóját keresi, a márkákat nem is olvassa", async () => {
    clients = () => json({ data: [
      { id: CLIENT2, name: "Alárka", external_ref: "viba-alarka", accounts: [] }, { id: CLIENT, name: "VIBA", external_ref: "viba", accounts: [] },
    ] });
    await sync();
    expect(puts().map((p) => p.path)).toEqual([`/clients/${CLIENT}/brand-profile`]);
    expect(readFileSync("server/socialHub/brandSync.ts", "utf8")).not.toMatch(/listProfileBrands|profileBrands|socialHubExternalRef/);
  });

  it("nincs ilyen ügyfél vagy a lista nem jön le: nincs PUT, biztos hiba", async () => {
    clients = () => clientList(CLIENT, "mas");
    expect(await sync()).toEqual({ status: "failed", code: "no_match" });
    clients = () => json({}, 500);
    expect(await sync()).toEqual({ status: "failed", code: "server" });
    expect(puts()).toEqual([]);
    expect(row()).toMatchObject({ maybeSent: false, leaseUntilMs: null, lastErrorCode: "server" });
    expect((await status()).lastError?.message).toBe("A Social Hubban hiba történt.");
  });

  it("üres profil: soha nem küldöttnél nincs kérés; sikeres vagy bizonytalan küldés után a törlés elmegy", async () => {
    h.profiles[P].brandVoice = null;
    expect(await sync()).toEqual({ status: "empty" });
    expect(reqs).toEqual([]);
    expect(await status()).toMatchObject({ pending: false, lastSyncedAt: null });

    setTone("Van");
    await sync();
    h.profiles[P].brandVoice = null;
    expect((await status()).pending).toBe(true);
    expect(await sync()).toEqual({ status: "sent" });
    expect(puts().at(-1)!.body).toEqual({ voice: null, required_phrases: [], forbidden_phrases: [], required_disclaimer: null, pillars: [] });

    mem.rows.clear(); reqs = [];
    vi.useFakeTimers();
    setTone("Van");
    putReply = () => { throw new Error("hálózat"); };
    expect(await sync()).toEqual({ status: "uncertain", code: "unreachable" });
    h.profiles[P].brandVoice = null; putReply = okPut;
    vi.advanceTimersByTime(UNCERTAIN_HOLD_MS + 1);
    expect(await sync()).toEqual({ status: "sent" });
  });

  it("a cél és a kísérlet a PUT ELŐTT rögzül; összeomlás után is bizonytalan marad", async () => {
    let seen: BrandRow | null = null;
    putReply = () => { seen = { ...row() }; return okPut(); };
    await sync({ store: { ...mem.store, finish: async () => { throw new Error("összeomlás"); } } }).catch(() => {});
    expect(seen).toMatchObject({ maybeSent: true, sentHash: null, targetRef: "viba", targetClientId: CLIENT, targetUrlHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(row().maybeSent).toBe(true);
    expect((await status()).pending).toBe(true);
  });

  it("párosítás-, ügyfél- vagy kapcsolatváltás után a régi siker nem számít", async () => {
    await sync();
    expect((await status()).lastSyncedAt).not.toBeNull();
    h.profiles[P].externalRef = "uj";
    expect(await status()).toMatchObject({ pending: true, lastSyncedAt: null });
    h.profiles[P].externalRef = "viba"; baseUrl = "https://hub.example.test/masik/v1";
    expect(await status()).toMatchObject({ pending: true, lastSyncedAt: null });
    // Üres profil az új párosításra nem megy ki.
    baseUrl = BASE; h.profiles[P].externalRef = "uj"; h.profiles[P].brandVoice = null; reqs = [];
    expect(await sync()).toEqual({ status: "empty" });
    expect(reqs).toEqual([]);
    // Ugyanaz az azonosító, de közben másik Social Hub-ügyfél: üres állapot oda sem megy.
    h.profiles[P].externalRef = "viba"; clients = () => clientList(CLIENT2);
    expect(await sync()).toEqual({ status: "empty" });
    expect(puts()).toEqual([]);
  });

  it("400/401/404 biztos hiba: a korábbi siker és hash megmarad, azonnal újrapróbálható", async () => {
    await sync();
    const before = { ...row() };
    for (const [code, expected] of [[400, "rejected"], [401, "auth"], [404, "not_found"]] as const) {
      putReply = () => json({ error: { code: "VALIDATION", message: KEY } }, code);
      expect(await sync()).toEqual({ status: "failed", code: expected });
      expect(row()).toMatchObject({ sentHash: before.sentHash, maybeSent: true, leaseUntilMs: null, lastErrorCode: expected });
    }
    mem.rows.clear();
    expect(await sync()).toEqual({ status: "failed", code: "not_found" });
    expect(row().maybeSent).toBe(false);
    putReply = (_b, n) => json({}, n % 2 ? 500 : 404); reqs = [];
    expect(await sync()).toEqual({ status: "uncertain", code: "not_found" });
    expect(row().maybeSent).toBe(true);
  });

  it.each([
    ["hálózati hiba", () => { throw new Error(`fetch failed ${BASE} ${KEY}`); }, "unreachable"],
    ["5xx", () => json({}, 502), "server"],
    ["más ügyfél a válaszban", () => json({ client_id: CLIENT2 }), "invalid_response"],
  ])("bizonytalan (%s): a következő PUT kivárja a védelmi időt", async (_n, reply, code) => {
    vi.useFakeTimers();
    putReply = reply as any;
    expect(await sync()).toEqual({ status: "uncertain", code });
    expect(await status()).toMatchObject({ pending: true, running: true, lastError: { message: expect.any(String) } });
    putReply = okPut;
    const n = puts().length;
    setTone("Újabb");
    expect(await sync()).toEqual({ status: "busy" });
    expect((await syncBrandNow(P, deps())).message).toContain("egy perc");
    vi.advanceTimersByTime(UNCERTAIN_HOLD_MS - 1_000);
    expect(await sync()).toEqual({ status: "busy" });
    expect(puts()).toHaveLength(n);
    vi.advanceTimersByTime(1_001);
    expect(await sync()).toEqual({ status: "sent" });
    expect(puts().at(-1)!.body.voice).toBe("Hangnem: Újabb");
    expect((await status()).pending).toBe(false);
  });
});

describe("sorrend", () => {
  it("átfedő mentések: egyszerre egy PUT, az utolsó a legújabb teljes állapot, mentés nem vész el", async () => {
    let active = 0; let max = 0;
    const gates = [deferred<void>(), deferred<void>()];
    putReply = async (_b, n) => { max = Math.max(max, ++active); await gates[n - 1]?.promise; active--; return okPut(); };
    const first = sync();
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    setTone("B");
    expect(await sync()).toEqual({ status: "busy" });
    gates[0].resolve();
    await vi.waitFor(() => expect(puts()).toHaveLength(2));
    setTone("C");
    await mem.store.saveRules(P, { requiredPhrases: ["új"], forbiddenPhrases: [], requiredDisclaimer: null });
    expect(await syncBrandProfile(P, { bump: false }, deps())).toEqual({ status: "busy" });
    gates[1].resolve();
    expect(await first).toEqual({ status: "sent" });
    expect(max).toBe(1);
    expect(puts().map((p) => [p.body.voice, p.body.required_phrases])).toEqual([["Hangnem: Barátságos", []], ["Hangnem: B", []], ["Hangnem: C", ["új"]]]);
    expect(row()).toMatchObject({ requestedRev: 3, syncedRev: 3, leaseUntilMs: null });
    expect((await status()).pending).toBe(false);
  });

  it("korlátozott számú kör; ami utána marad, függőben látszik, és a bérlet szabad", async () => {
    putReply = () => { setTone(`v${puts().length}`); row().requestedRev++; return okPut(); };
    expect(await sync()).toEqual({ status: "sent" });
    expect(puts()).toHaveLength(3);
    expect(row()).toMatchObject({ leaseToken: null, leaseUntilMs: null });
    expect((await status()).pending).toBe(true);
  });

  it("lejárt bérletű futó nem küld és nem ír állapotot; régebbi állapot nem megy ki újabb után", async () => {
    vi.useFakeTimers();
    const gate = deferred<Response>();
    clients = () => gate.promise;
    const stale = sync();
    await vi.waitFor(() => expect(reqs).toHaveLength(1));
    vi.setSystemTime(Date.now() + LEASE_MS + 1);
    clients = () => clientList();
    setTone("Új");
    expect(await sync()).toEqual({ status: "sent" });
    const after = { ...row() };
    gate.resolve(clientList());
    expect(await stale).toEqual({ status: "lost" });
    expect(puts().map((p) => p.body.voice)).toEqual(["Hangnem: Új"]);
    expect(row()).toEqual(after);
  });

  it("a küldés közben lejárt bérletű futó sem ír; a változás függőben marad", async () => {
    vi.useFakeTimers();
    putReply = () => { vi.setSystemTime(Date.now() + LEASE_MS + 1); return okPut(); };
    await sync();
    expect(row()).toMatchObject({ sentHash: null, syncedRev: 0, maybeSent: true });
    expect((await status()).pending).toBe(true);
  });

  it("késve visszaérő rögzítés vagy közben megváltozott párosítás után nincs PUT", async () => {
    vi.useFakeTimers();
    const slow: BrandStore = { ...mem.store, begin: async (...a) => { const ok = await mem.store.begin(...a); vi.setSystemTime(Date.now() + 6_000); return ok; } };
    expect(await sync({ store: slow })).toMatchObject({ status: "failed" });
    expect(row()).toMatchObject({ maybeSent: false, leaseUntilMs: null });
    const changed: BrandStore = { ...mem.store, begin: async (...a) => { h.profiles[P].externalRef = "mas"; return mem.store.begin(...a); } };
    expect(await sync({ store: changed })).toEqual({ status: "lost" });
    expect(puts()).toEqual([]);
    expect(row().leaseUntilMs).toBeNull();
  });

  it("a bérlet hosszabb a kérés teljes határidejénél", () => {
    expect(LEASE_MS).toBeGreaterThan(LIST_BUDGET_MS + PUT_BUDGET_MS + 30_000);
  });

  it("törölt profil: sem a változásjelzés, sem a lezárás nem hoz létre sort", async () => {
    putReply = () => { delete h.profiles[P]; mem.rows.delete(P); return okPut(); };
    await sync();
    expect(mem.rows.size).toBe(0);
    expect(await sync()).toEqual({ status: "deleted" });
    expect(await mem.store.bumpRev(P)).toBe(false);
    expect(mem.rows.size).toBe(0);
  });
});

it("a hibakód rögzített szó, nem a hiba szövege", () => {
  expect(syncErrorCode(new Error(KEY))).toBe("unknown");
  expect(syncErrorCode(new SocialHubError("blocked", "/x"))).toBe("blocked");
  expect(syncErrorCode(new SocialHubError("http", "/x", 302))).toBe("redirect");
  expect(syncErrorCode(new SocialHubError("http", "/x", 429))).toBe("rate_limited");
});

// ─── Végpontok ───────────────────────────────────────────────────────────────

const caller = (over: object = {}) => appRouter.createCaller({
  appUser: { id: "u-a", role: "user", profileId: P, active: true, onboardingCompleted: true, subscriptionPlan: "free", ...over },
  req: { protocol: "https", headers: {} }, res: { clearCookie: () => {}, cookie: () => {} },
} as any);
const base = { id: P, name: "VIBA", initials: "V" };
const rulesInput = { profileId: P, requiredPhrases: ["G2A"], forbiddenPhrases: ["olcsó"], requiredDisclaimer: null };

describe("brandRules végpontok", () => {
  it("alapból üres; a tulajdonos és a rendszergazda írhatja, utána szinkronizál", async () => {
    expect((await caller().socialHub.brandRules.get({ profileId: P })).rules).toEqual(EMPTY_BRAND_RULES);
    for (const who of [caller(), caller({ id: "u-x", role: "super_admin", profileId: null })]) {
      reqs = [];
      expect(await who.socialHub.brandRules.save(rulesInput)).toEqual({ requiredPhrases: ["G2A"], forbiddenPhrases: ["olcsó"], requiredDisclaimer: null });
      expect(puts()[0].body).toMatchObject({ required_phrases: ["G2A"], forbidden_phrases: ["olcsó"] });
      expect(await who.socialHub.brandRules.sync({ profileId: P })).toEqual({ ok: true, message: expect.any(String) });
    }
    const res = await caller().socialHub.brandRules.get({ profileId: P });
    expect(res).toMatchObject({ state: "ok", pending: false });
    expect(JSON.stringify(res)).not.toMatch(/TITKOS|Bearer|hub\.example/);
  });

  it("idegen profilra mind FORBIDDEN, üres azonosító hibás, nem létezőnél nem jön létre sor", async () => {
    const other = caller({ id: "u-b", profileId: "p-b" });
    const { get, save, sync: run } = other.socialHub.brandRules;
    await expect(get({ profileId: P })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(save(rulesInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(run({ profileId: P })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = caller({ role: "super_admin" });
    await expect(admin.socialHub.brandRules.save({ ...rulesInput, profileId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.socialHub.brandRules.save({ ...rulesInput, profileId: "nincs" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mem.rows.size).toBe(0);
    expect(reqs).toEqual([]);
  });

  it("hibás adat: magyar hiba, semmi nem íródik; tárolóhiba: rövid hiba, részletek nélkül", async () => {
    await expect(caller().socialHub.brandRules.save({ ...rulesInput, requiredPhrases: ["Olcsóbb"] })).rejects.toThrow(/minden poszt megállna/);
    expect(mem.rows.size).toBe(0);
    h.store = { ...mem.store, saveRules: async () => { throw new Error("insert into SZIVARGAS"); }, read: async () => { throw new Error("SZIVARGAS"); } };
    const err: any = await caller().socialHub.brandRules.save(rulesInput).catch((e) => e);
    expect(err.message).toBe("A szabályokat most nem sikerült menteni. Próbáld újra.");
    expect(`${err.stack}`).not.toContain("SZIVARGAS");
    expect((await caller().socialHub.brandRules.get({ profileId: P })).state).toBe("unavailable");
    h.store = { ...mem.store, read: async () => ({ row: null, nowMs: 0, missingTable: true }) };
    expect((await caller().socialHub.brandRules.get({ profileId: P })).state).toBe("unavailable");
  });

  it("a szabályok mentése hibás szinkronnál is sikeres", async () => {
    putReply = () => json({}, 400);
    await expect(caller().socialHub.brandRules.save(rulesInput)).resolves.toMatchObject({ requiredPhrases: ["G2A"] });
    expect(row().requiredPhrases).toEqual(["G2A"]);
    expect((await caller().socialHub.brandRules.get({ profileId: P })).lastError?.message).toBe("A Social Hub nem fogadta el a márkaprofilt.");
  });
});

describe("profiles.upsert", () => {
  const brandVoice = voice("Komoly");
  const contentPillars = [pillar("Edukáció")];

  it("csak brandVoice vagy contentPillars bemenetnél indul, mindig a mentés után", async () => {
    await caller().profiles.upsert({ ...base, primaryColor: "#000000" });
    expect(reqs).toEqual([]);
    expect(h.order).toEqual(["mentés"]);
    h.order = [];
    await caller().profiles.upsert({ ...base, brandVoice });
    expect(h.order).toEqual(["mentés", "rev"]);
    expect(puts().at(-1)!.body.voice).toBe("Hangnem: Komoly");
    await caller().profiles.upsert({ ...base, contentPillars });
    expect(puts().at(-1)!.body.pillars).toEqual([{ name: "Edukáció", description: null }]);
    expect(puts()).toHaveLength(2);
  });

  it("új profil ágán is fut (párosítás híján némán kimarad); sikertelen mentésnél nem indul", async () => {
    await caller().profiles.upsert({ name: "Új", initials: "U", brandVoice });
    expect(h.order).toEqual(["mentés"]);
    expect(reqs).toEqual([]);
    h.profiles["p-uj"] = undefined;
    h.store = { ...mem.store, bumpRev: async (id: string) => { h.order.push(`rev:${id}`); return false; } };
    const db = await import("./db");
    const spy = vi.spyOn(db, "upsertProfile").mockImplementation(async (p: any) => (h.profiles[p.id] = { ...p, externalRef: "viba" }));
    await caller().profiles.upsert({ id: "p-uj", name: "Új", initials: "U", contentPillars });
    expect(h.order).toContain("rev:p-uj");
    spy.mockRestore();
    h.store = mem.store; h.order = []; h.upsertError = new Error("mentési hiba");
    await expect(caller().profiles.upsert({ ...base, brandVoice })).rejects.toThrow();
    expect(h.order).toEqual([]);
  });

  it.each([
    ["400", () => { putReply = () => json({}, 400); }],
    ["hálózati hiba", () => { putReply = () => { throw new Error(KEY); }; }],
    ["tárolóhiba", () => { h.store = { ...mem.store, bumpRev: async () => { throw new Error("SQL"); } }; }],
    ["hiányzó tábla", () => { h.store = { ...mem.store, bumpRev: async () => { throw new Error("1146"); }, read: async () => ({ row: null, nowMs: 0, missingTable: true }) }; }],
    ["lezárási hiba", () => { h.store = { ...mem.store, finish: async () => { throw new Error("SQL"); } }; }],
    ["nincs kapcsolat", () => { vi.stubEnv("SOCIAL_HUB_API_KEY", ""); }],
  ])("%s: a mentés sikeres", async (_n, arrange) => {
    arrange();
    await expect(caller().profiles.upsert({ ...base, brandVoice })).resolves.toMatchObject({ id: P, brandVoice });
  });

  it.each([
    ["HTTP", () => { clients = () => new Promise<Response>(() => {}); }],
    ["tároló", () => { h.store = { ...mem.store, bumpRev: () => new Promise<boolean>(() => {}) }; }],
  ])("elakadt %s: a mentés legfeljebb kb. 2 másodpercet vár", async (_n, arrange) => {
    vi.useFakeTimers();
    arrange();
    let done = false;
    const save = caller().profiles.upsert({ ...base, brandVoice }).then((r) => { done = true; return r; });
    await vi.advanceTimersByTimeAsync(SAVE_WAIT_MS - 50);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(true);
    await expect(save).resolves.toMatchObject({ brandVoice });
  });

  it("a háttérben később elbukó szinkron sem kezeletlen hiba", async () => {
    vi.useFakeTimers();
    let fail!: (e: Error) => void;
    const store: BrandStore = { ...mem.store, bumpRev: () => new Promise((_r, reject) => { fail = reject; }) };
    const wait = syncBrandAfterSave(P, {}, deps({ store }));
    await vi.advanceTimersByTimeAsync(SAVE_WAIT_MS + 1);
    await wait;
    fail(new Error("késői hiba"));
    await vi.advanceTimersByTimeAsync(1);
    expect(logs.join()).toContain("megszakadt");
  });
});
