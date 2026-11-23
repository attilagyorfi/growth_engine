/**
 * G2 – Social Hub-kapcsolat feloldása, SSRF-védelem és vázlatküldés.
 * Memóriabeli tároló, mock HTTP és mock DNS; valódi Social Hub, kulcs vagy adatbázis nincs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => { process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-000000"; });
const h = vi.hoisted(() => ({ store: null as any, posts: [] as any[] }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async (host: string) => [{ address: host.startsWith("belso") ? "10.0.0.5" : "93.184.216.34" }]) }));
vi.mock("./socialHub/store", () => ({ getSocialHubStore: () => h.store }));
vi.mock("./db", async (orig) => ({
  ...(await orig<typeof import("./db")>()),
  getProfileById: vi.fn(async (id: string) => (id === "p-a" ? { id, name: "VIBA", appUserId: "u-a", externalRef: "viba" } : { id, name: "Más", appUserId: "u-b", externalRef: "mas" })),
  listProfileBrands: vi.fn(async () => []),
  getProfileBrand: vi.fn(async () => null),
  getContentByProfile: vi.fn(async (pid: string) => h.posts.filter((p) => p.profileId === pid)),
}));

import { appRouter } from "./routers";
import { createSocialHubClient } from "./socialHub/client";
import { encryptApiKey, resolveSocialHubConfig } from "./socialHub/config";
import { buildPostContent, chunkDrafts, isInBudapestMonth, IDEMPOTENCY_KEY_PATTERN } from "./socialHub/drafts";
import { repeatAttempt, sendPosts, previewSend, REPEAT_WINDOW_MS } from "./socialHub/send";
import { assertSocialHubUrl } from "./socialHub/urlGuard";

const KEY = "sh_live_TITKOS-teszt-kulcs-9876";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CLIENT = uuid(1);
const REFS = [{ id: "profile", name: "VIBA", externalRef: "viba" }];
const post = (id: string, over: object = {}) => ({
  id, profileId: "p-a", title: id, platform: "linkedin", content: `Szöveg ${id}`, hashtags: [], imageUrl: null,
  status: "approved", scheduledAt: new Date("2026-12-01T08:00:00Z"), pillar: null, ...over,
}) as any;

function memoryStore() {
  const d = new Map<string, any>(); const a = new Map<string, any>(); let conn: any = null;
  const key = (c: string, p: string) => `${c}|${p}`;
  return {
    d, a,
    getConnection: async () => conn, saveConnection: async (c: any) => { conn = { ...c, updatedAt: null }; }, deleteConnection: async () => { conn = null; },
    getDeliveries: async (c: string, ids: string[]) => ids.flatMap((p) => (d.has(key(c, p)) ? [{ ...d.get(key(c, p)) }] : [])),
    getAttempts: async (ids: string[]) => ids.flatMap((i) => (a.has(i) ? [{ ...a.get(i) }] : [])),
    claim: async ({ items, buildBody, createdBy: _c, ...rest }: any) => {
      const ok = items.filter((i: any) => {
        const cur = d.get(key(rest.socialHubClientId, i.postId)) ?? { status: "new", attemptId: null };
        return cur.status === i.expected.status && cur.attemptId === i.expected.attemptId;
      });
      if (!ok.length) return null;
      for (const i of ok) d.set(key(rest.socialHubClientId, i.postId), {
        sentHash: null, socialHubPostId: null, sentAt: null, ...d.get(key(rest.socialHubClientId, i.postId)),
        postId: i.postId, socialHubClientId: rest.socialHubClientId, status: "sending", attemptId: rest.id, contentHash: i.contentHash,
      });
      const attempt = { ...rest, status: "sending", postIds: ok.map((i: any) => i.postId), body: buildBody(ok.map((i: any) => i.draft)) };
      a.set(rest.id, attempt);
      return { ...attempt };
    },
    reclaim: async (id: string, old: string, next: string, now: Date) => {
      const at = a.get(id); if (at.runToken !== old) return false;
      Object.assign(at, { runToken: next, status: "sending", lastTriedAt: now }); return true;
    },
    finishSent: async (id: string, sent: any[], now: Date) => {
      a.get(id).status = "sent";
      for (const s of sent) { const x = d.get(key(a.get(id).socialHubClientId, s.postId)); Object.assign(x, { status: "sent", sentHash: x.contentHash, socialHubPostId: s.socialHubPostId, sentAt: now }); }
    },
    finishUnsent: async (id: string, _t: string, status: string) => {
      a.get(id).status = status;
      for (const x of Array.from(d.values())) if (x.attemptId === id && x.status !== "sent") x.status = status;
    },
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Reply = (body: any, n: number) => Response | Promise<Response>;
const okReply: Reply = (body, n) => json({ data: body.drafts.map((_: unknown, i: number) => ({ id: uuid(n * 1000 + i) })) }, 201);

function setup(reply: Reply = okReply) {
  const store = memoryStore();
  const calls: { key: string; body: string; url: string; init: any }[] = [];
  const accounts = [{ id: uuid(10), platform: "linkedin", name: "LI", status: "CONNECTED" }, { id: uuid(11), platform: "facebook", name: "FB", status: "EXPIRED" }];
  const clients = [{ id: CLIENT, name: "VIBA SH", external_ref: "viba", accounts }, { id: uuid(2), name: "Idegen", external_ref: "mas", accounts: [] }];
  const fetchMock = vi.fn(async (url: string, init: any) => {
    if (init.method === "GET") return json({ data: clients });
    const call = { key: init.headers["Idempotency-Key"], body: init.body, url, init };
    calls.push(call);
    return reply(JSON.parse(init.body), calls.length);
  });
  const state = { now: Date.parse("2026-11-23T10:00:00Z") };
  const deps = {
    store: store as any, now: () => state.now,
    resolve: async () => ({ status: "ok" as const, source: "env" as const, config: { baseUrl: "https://hub.example.test/api/v1", apiKey: KEY } }),
    createClient: (c: any) => createSocialHubClient(c, { fetch: fetchMock as any, sleep: async () => {} }),
  };
  const send = (posts: any[], over: object = {}) => sendPosts({
    profileId: "p-a", userId: "u-a", posts, refs: REFS, targetId: "profile", expectedClientId: CLIENT,
    accountChoices: {}, confirmResendIds: [], confirmUncertainIds: [], ...over,
  }, deps);
  return { store, calls, fetchMock, deps, send, state, accounts };
}
const outcomes = (r: { results: { outcome: string }[] }) => r.results.map((x) => x.outcome);

let logs: string[];
beforeEach(() => {
  logs = []; h.store = null; h.posts = [];
  for (const m of ["error", "warn"] as const) vi.spyOn(console, m).mockImplementation((...x) => { logs.push(x.map(String).join(" ")); });
});
afterEach(() => {
  expect(logs.join("\n")).not.toContain(KEY);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe("feloldás és SSRF", () => {
  const env = { SOCIAL_HUB_API_URL: "https://env.test/v1", SOCIAL_HUB_API_KEY: "env-key" };
  it("tárolt > env > fail-closed; olvashatatlan kulcs vagy olvasási hiba: nincs env-visszaesés", async () => {
    const enc = encryptApiKey(KEY)!;
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(await resolveSocialHubConfig({ getConnection: async () => ({ baseUrl: "https://a.test", apiKeyEnc: enc }), env }))
      .toMatchObject({ source: "stored", config: { apiKey: KEY } });
    expect(await resolveSocialHubConfig({ getConnection: async () => null, env })).toMatchObject({ source: "env" });
    expect(await resolveSocialHubConfig({ getConnection: async () => null, env: {} })).toEqual({ status: "not_configured" });
    for (const apiKeyEnc of ["enc:v1:x:y:z", "nyers"]) {
      expect(await resolveSocialHubConfig({ getConnection: async () => ({ baseUrl: "https://a.test", apiKeyEnc }), env })).toEqual({ status: "error" });
    }
    expect(await resolveSocialHubConfig({ getConnection: async () => { throw new Error("db"); }, env })).toEqual({ status: "error" });
  });

  it.each(["http://hub.test", "https://u:p@hub.test", "https://127.0.0.1", "https://10.1.2.3", "https://172.16.0.1", "https://192.168.1.1",
    "https://169.254.169.254", "https://[::1]", "https://[::ffff:127.0.0.1]", "https://localhost", "https://belso.test", "http://localhost"])("elutasítva: %s", async (url) => {
    await expect(assertSocialHubUrl(url, { env: {} })).rejects.toThrow();
  });
  it("nyilvános https jó; a localhost csak fejlesztésben", async () => {
    expect(await assertSocialHubUrl("https://hub.test/api/v1/")).toBe("https://hub.test/api/v1");
    expect(await assertSocialHubUrl("http://localhost:3000", { env: { NODE_ENV: "development" } })).toBe("http://localhost:3000");
  });
  it("tárolt címre menő kérés előtt is fut (nincs HTTP), és a 3xx hiba", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => new Response(null, { status: 302, headers: { location: "https://mas.test" } }));
    const blocked = createSocialHubClient({ baseUrl: "https://belso.test", apiKey: KEY, source: "stored" }, { fetch: fetchMock as any });
    await expect(blocked.listClients()).rejects.toMatchObject({ kind: "blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
    const redirected = createSocialHubClient({ baseUrl: "https://hub.test", apiKey: KEY, source: "stored" }, { fetch: fetchMock as any });
    await expect(redirected.listClients()).rejects.toMatchObject({ kind: "http", status: 302 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });
});

describe("router: jogosultság és kulcsvédelem", () => {
  const caller = (role: string | null, profileId = "p-a") => appRouter.createCaller({
    appUser: role ? { id: "u-a", role, profileId } : null, req: {}, res: {},
  } as any);
  it("kapcsolatot csak rendszergazda kezel; a kulcs nem jön vissza; bontás", async () => {
    h.store = memoryStore();
    for (const run of [(c: any) => c.get(), (c: any) => c.check(), (c: any) => c.disconnect(), (c: any) => c.save({ baseUrl: "https://hub.test", apiKey: KEY })]) {
      await expect(run(caller("user").socialHub.connection)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    const admin = caller("super_admin").socialHub.connection;
    await expect(admin.save({ baseUrl: "https://belso.test", apiKey: KEY })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.save({ baseUrl: "https://uj.test" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const answers = [await admin.save({ baseUrl: "https://hub.test/v1", apiKey: KEY }), await admin.get()];
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    answers.push((await admin.check()) as any);
    expect(JSON.stringify(answers)).not.toContain(KEY);
    expect(answers[1]).toMatchObject({ source: "stored", keyLast4: "9876" });
    expect((await h.store.getConnection()).apiKeyEnc).toMatch(/^enc:v1:/);
    await admin.disconnect();
    expect(await h.store.getConnection()).toBeNull();
  });
  it("be nem jelentkezett, idegen profil, idegen poszt és márka: hiba, HTTP nélkül", async () => {
    h.store = memoryStore();
    h.posts = [post("x"), post("y", { profileId: "p-b" })];
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const base = { profileId: "p-a", postIds: ["x"], targetId: "profile", expectedClientId: CLIENT };
    await expect(caller(null).socialHub.send(base)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller("user").socialHub.send({ ...base, profileId: "p-b", postIds: ["y"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("user").socialHub.send({ ...base, postIds: ["x", "y"] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller("user").socialHub.send({ ...base, targetId: "brand-b" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("tároló nélkül (nincs migráció) a küldés és a mentés nem érhető el", async () => {
    expect(await caller("user").socialHub.available()).toEqual({ available: false });
    await expect(caller("super_admin").socialHub.connection.save({ baseUrl: "https://hub.test", apiKey: KEY })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });
});

describe("küldés", () => {
  it("csak a szerződés mezői mennek, a kulcs formátuma jó, a törzs a hívás előtt tárolt", async () => {
    const t = setup((body, n) => {
      const [attempt] = Array.from(t.store.a.values());
      expect(attempt).toMatchObject({ idempotencyKey: t.calls[0].key, body: t.calls[0].body, socialHubClientId: CLIENT });
      return okReply(body, n);
    });
    const r = await t.send([post("a", { pillar: "x".repeat(200), imageUrl: "https://cdn.test/a.jpg" }), post("b", { imageUrl: "http://cdn.test/b.jpg" })]);
    expect(outcomes(r)).toEqual(["sent", "sent"]);
    expect(t.calls[0].key).toMatch(IDEMPOTENCY_KEY_PATTERN);
    expect(t.calls[0].url).toBe(`https://hub.example.test/api/v1/clients/${CLIENT}/drafts`);
    expect(JSON.parse(t.calls[0].body)).toEqual({ drafts: [
      { text: "Szöveg a", suggested_at: "2026-12-01T08:00:00.000Z", media_urls: ["https://cdn.test/a.jpg"], pillar: "x".repeat(100), source: "growth_engine", targets: [{ social_account_id: uuid(10) }] },
      { text: "Szöveg b", suggested_at: "2026-12-01T08:00:00.000Z", source: "growth_engine", targets: [{ social_account_id: uuid(10) }] },
    ] });
  });

  it("120 poszt 50/50/20; az 1 MB bájtkorlát is darabol", async () => {
    const t = setup();
    const r = await t.send(Array.from({ length: 120 }, (_, i) => post(`p${i}`)));
    expect(t.calls.map((c) => JSON.parse(c.body).drafts.length)).toEqual([50, 50, 20]);
    expect(new Set(t.calls.map((c) => c.key)).size).toBe(3);
    expect(outcomes(r).every((o) => o === "sent")).toBe(true);
    const big = chunkDrafts(Array.from({ length: 10 }, () => ({ draft: { text: "ő".repeat(60_000) } })));
    expect(big.length).toBeGreaterThan(1);
    for (const c of big) expect(Buffer.byteLength(JSON.stringify({ drafts: c.map((x) => x.draft) }))).toBeLessThanOrEqual(1_000_000);
  });

  it("időkeret: az el nem indult darab jelezve, és folytatható", async () => {
    const t = setup((body, n) => { t.state.now += 40_000; return okReply(body, n); });
    const posts = Array.from({ length: 60 }, (_, i) => post(`p${i}`));
    const r = await t.send(posts);
    expect(r.results.filter((x) => x.outcome === "not_started")).toHaveLength(10);
    const next = await t.send(posts);
    expect(next.results.filter((x) => x.outcome === "sent")).toHaveLength(10);
  });

  it.each<[string, Reply]>([
    ["hálózati hiba", () => { throw new Error("reset"); }],
    ["kimerült 5xx", () => json({}, 503)],
    ["olvashatatlan 2xx", () => new Response("<html>", { status: 201 })],
    ["hiányos 2xx", () => json({ data: [] }, 201)],
    ["409", () => json({ error: { code: "IDEMPOTENCY_IN_PROGRESS" } }, 409)],
  ])("bizonytalan (%s): új kulccsal nem megy, ismétléskor ugyanaz a kulcs és törzs, szerkesztés után is", async (_n, bad) => {
    let broken = true;
    const t = setup((b, n) => (broken ? bad(b, n) : okReply(b, n)));
    const [first] = (await t.send([post("a")])).results;
    expect(first.outcome).toBe("uncertain");
    broken = false;
    const before = t.calls.length;
    const edited = post("a", { content: "Átírva" });
    expect(outcomes(await t.send([edited], { confirmResendIds: ["a"], confirmUncertainIds: ["a"] }))).toEqual(["skipped"]);
    expect(t.calls).toHaveLength(before);
    const r = await repeatAttempt({ profileId: "p-a", attemptId: first.attemptId!, refs: REFS }, t.deps);
    expect(outcomes(r)).toEqual(["sent"]);
    expect(new Set(t.calls.map((c) => c.key + c.body)).size).toBe(1);
    expect(t.store.d.size).toBe(1);
    await expect(repeatAttempt({ profileId: "p-b", attemptId: first.attemptId!, refs: REFS }, t.deps)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("beragadt kísérlet és 24 órás ablak: csak külön megerősítéssel, új kulccsal", async () => {
    let broken = true;
    const t = setup((b, n) => { if (broken) throw new Error("x"); return okReply(b, n); });
    const [first] = (await t.send([post("a")])).results;
    Array.from(t.store.a.values())[0].status = "sending";
    const preview = () => previewSend({ posts: [post("a")], refs: REFS }, t.deps).then((p) => p.items[0].state);
    expect(await preview()).toBe("in_progress");
    t.state.now += 120_000;
    expect(await preview()).toBe("uncertain");
    t.state.now += REPEAT_WINDOW_MS;
    broken = false;
    await expect(repeatAttempt({ profileId: "p-a", attemptId: first.attemptId!, refs: REFS }, t.deps)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(outcomes(await t.send([post("a")]))).toEqual(["skipped"]);
    expect(outcomes(await t.send([post("a")], { confirmUncertainIds: ["a"] }))).toEqual(["sent"]);
    expect(t.calls[t.calls.length - 1].key).not.toBe(t.calls[0].key);
  });

  it("párhuzamosság: két egyidejű küldésből és két ismétlésből egy indít HTTP-hívást", async () => {
    let broken = true;
    const t = setup((b, n) => { if (broken) throw new Error("x"); return okReply(b, n); });
    const both = await Promise.all([t.send([post("a")]), t.send([post("a")])]);
    expect(both.flatMap(outcomes).sort()).toEqual(["skipped", "uncertain"]);
    expect(t.calls).toHaveLength(1);
    broken = false;
    const attemptId = Array.from(t.store.a.keys())[0];
    const repeats = await Promise.allSettled([1, 2].map(() => repeatAttempt({ profileId: "p-a", attemptId, refs: REFS }, t.deps)));
    expect(repeats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(t.calls).toHaveLength(2);
  });

  it("duplikáció: változatlan kimarad, változott csak megerősítéssel", async () => {
    const t = setup();
    await t.send([post("a")]);
    expect(Array.from(t.store.d.values())[0]).toMatchObject({ status: "sent", socialHubPostId: uuid(1000), sentHash: expect.any(String), sentAt: expect.any(Date) });
    expect(outcomes(await t.send([post("a")], { confirmResendIds: ["a"] }))).toEqual(["skipped"]);
    const changed = post("a", { content: "Új" });
    expect(outcomes(await t.send([changed]))).toEqual(["skipped"]);
    expect(outcomes(await t.send([changed], { confirmResendIds: ["a"] }))).toEqual(["sent"]);
  });

  it("részleges hiba: 429 után azonos kulcs; elbukott darab mellett a többi megmarad, a végleges 4xx újraküldhető", async () => {
    const t = setup((b, n) => (n === 1 ? json({}, 429) : n === 3 ? json({ error: { code: "ACCOUNT_NOT_CONNECTED" } }, 422) : okReply(b, n)));
    const posts = Array.from({ length: 120 }, (_, i) => post(`p${i}`));
    const r = await t.send(posts);
    expect(t.calls[0].key).toBe(t.calls[1].key);
    expect(outcomes(r).filter((o) => o === "sent")).toHaveLength(70);
    expect(outcomes(r).filter((o) => o === "failed")).toHaveLength(50);
    expect(outcomes(await t.send(posts)).filter((o) => o === "sent")).toHaveLength(50);
  });

  it("kimaradók okkal, fiókválasztás, idegen fiók tiltva, megváltozott párosítás", async () => {
    const t = setup();
    const posts = [post("a"), post("pub", { status: "published" }), post("rej", { status: "rejected" }), post("fb", { platform: "facebook" }),
      post("ures", { content: " " }), post("sch", { status: "scheduled" })];
    const p = await previewSend({ posts, refs: REFS }, t.deps);
    expect(p.items.map((i) => i.state)).toEqual(["ready", "published", "rejected", "no_account", "invalid", "ready"]);
    expect(p.items[5].alsoScheduled).toBe(true);
    expect(JSON.stringify(p)).not.toContain("Idegen");
    expect((await previewSend({ posts, refs: [] }, t.deps)).items[0].state).toBe("no_pairing");
    t.accounts.push({ id: uuid(12), platform: "linkedin", name: "LI 2", status: "CONNECTED" });
    expect((await previewSend({ posts, refs: REFS }, t.deps)).items[0].state).toBe("choose_account");
    expect(outcomes(await t.send([post("a")], { accountChoices: { linkedin: uuid(12) } }))).toEqual(["sent"]);
    await expect(t.send([post("b")], { accountChoices: { linkedin: uuid(11) } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(t.send([post("b")], { expectedClientId: uuid(2) })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(t.calls).toHaveLength(1);
  });

  it("hónap Europe/Budapest szerint; a hash tartalomfüggő", () => {
    expect(isInBudapestMonth(new Date("2026-11-30T23:30:00Z"), "2026-12")).toBe(true);
    expect(isInBudapestMonth(new Date("2026-12-31T23:30:00Z"), "2026-12")).toBe(false);
    const hash = (o: object) => { const c = buildPostContent(post("a", o)); return c.ok && c.hash; };
    expect(hash({})).toBe(hash({ status: "draft", title: "más" }));
    expect(hash({})).not.toBe(hash({ hashtags: ["uj"] }));
  });
});

describe("JWT_SECRET nélkül", () => {
  it("a kulcs nem menthető", async () => {
    vi.resetModules();
    vi.doMock("./_core/env", () => ({ ENV: { cookieSecret: "" } }));
    const mod = await import("./socialHub/config");
    expect(mod.encryptApiKey(KEY)).toBeNull();
    vi.doUnmock("./_core/env");
  });
});
