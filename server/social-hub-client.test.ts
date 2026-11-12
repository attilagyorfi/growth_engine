/**
 * G1 – Social Hub /api/v1 kliens és a metrikák leképezése.
 * Csak mockolt fetch, injektált sleep és hamis időzítő: nincs valódi hálózat és várakozás.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSocialHubClient,
  getSocialHubConfig,
  parseRetryAfter,
  splitDateRange,
  SocialHubError,
} from "./socialHub/client";
import { mapSocialHubMetrics, syncSocialMetrics, SOCIAL_HUB_PROVIDER_PLATFORM } from "./socialHub/metrics";

const API_KEY = "sh_live_SECRET-test-key-123";
const config = { baseUrl: "https://hub.example.test/api/v1", apiKey: API_KEY };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const metricsBody = (from: string, to: string, accounts: unknown[] = []) => ({
  client_id: "c-1", from, to, accounts, posts: [],
});

const clientsBody = {
  data: [
    { id: "c-1", name: "VIBA-TEAM", external_ref: "viba-team", accounts: [{ id: "a-1", platform: "facebook", name: "VIBA", status: "CONNECTED" }] },
    { id: "c-2", name: "Párosítatlan", external_ref: null, accounts: [] },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("getSocialHubConfig – fail-closed", () => {
  it("bármelyik env hiányában null, egyébként a záró perjel nélküli URL", () => {
    expect(getSocialHubConfig({})).toBeNull();
    expect(getSocialHubConfig({ SOCIAL_HUB_API_URL: "https://x/api/v1" })).toBeNull();
    expect(getSocialHubConfig({ SOCIAL_HUB_API_KEY: "k" })).toBeNull();
    expect(getSocialHubConfig({ SOCIAL_HUB_API_URL: " https://x/api/v1/ ", SOCIAL_HUB_API_KEY: " k " }))
      .toEqual({ baseUrl: "https://x/api/v1", apiKey: "k" });
  });
});

describe("splitDateRange – ≤92 napos darabok", () => {
  it("200 napos kérés → 3 darab, átfedés és hézag nélkül", () => {
    // 2026-01-01 + 199 nap = 2026-07-19 (200 nap, mindkét vég benne)
    const chunks = splitDateRange("2026-01-01", "2026-07-19");
    expect(chunks).toEqual([
      { from: "2026-01-01", to: "2026-04-02" },
      { from: "2026-04-03", to: "2026-07-03" },
      { from: "2026-07-04", to: "2026-07-19" },
    ]);
    const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;
    for (const c of chunks) expect(day(c.to) - day(c.from) + 1).toBeLessThanOrEqual(92);
    for (let i = 1; i < chunks.length; i++) expect(day(chunks[i].from)).toBe(day(chunks[i - 1].to) + 1);
    expect(chunks.reduce((n, c) => n + day(c.to) - day(c.from) + 1, 0)).toBe(200);
  });

  it("pontosan 92 nap egy darab; egy nap is egy darab; fordított tartomány hiba", () => {
    expect(splitDateRange("2026-01-01", "2026-04-02")).toHaveLength(1);
    expect(splitDateRange("2026-03-05", "2026-03-05")).toEqual([{ from: "2026-03-05", to: "2026-03-05" }]);
    expect(() => splitDateRange("2026-03-06", "2026-03-05")).toThrow();
  });

  it("200 napos metrics-lekérés 3 hívás, a fiókok napjai összefűzve", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url);
      const from = u.searchParams.get("from")!;
      const to = u.searchParams.get("to")!;
      return json(metricsBody(from, to, [{ social_account_id: "a-1", provider: "meta:facebook", days: [{ day: from, metrics: { reach: 1 } }] }]));
    });
    const client = createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch });
    const res = await client.getClientMetricsRange("c-1", "2026-01-01", "2026-07-19");
    const ranges = fetchMock.mock.calls.map(([url]) => {
      const u = new URL(url as string);
      expect(u.pathname).toBe("/api/v1/clients/c-1/metrics");
      return [u.searchParams.get("from"), u.searchParams.get("to")];
    });
    expect(ranges).toEqual([["2026-01-01", "2026-04-02"], ["2026-04-03", "2026-07-03"], ["2026-07-04", "2026-07-19"]]);
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0].days.map((d) => d.day)).toEqual(["2026-01-01", "2026-04-03", "2026-07-04"]);
  });
});

describe("HTTP: Bearer, újrapróbálás, időtúllépés", () => {
  it("GET /clients Authorization: Bearer fejléccel, a kulcs nincs az URL-ben", async () => {
    const fetchMock = vi.fn(async () => json(clientsBody));
    const clients = await createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch }).listClients();
    expect(clients.map((c) => c.external_ref)).toEqual(["viba-team", null]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hub.example.test/api/v1/clients");
    expect(url).not.toContain(API_KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${API_KEY}`);
    expect(init.method).toBe("GET");
  });

  it("429 → Retry-After szerint vár, aztán sikerül", async () => {
    const sleep = vi.fn(async () => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: {} }, 429, { "Retry-After": "3" }))
      .mockResolvedValueOnce(json(clientsBody));
    const client = createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch, sleep });
    await expect(client.listClients()).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("a Retry-After várakozás felső korlátos", async () => {
    const sleep = vi.fn(async () => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({}, 429, { "Retry-After": "3600" }))
      .mockResolvedValueOnce(json(clientsBody));
    await createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch, sleep, maxRetryDelayMs: 5000 }).listClients();
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("5xx-re korlátozott számú újrapróbálás, utána HTTP-hiba", async () => {
    const sleep = vi.fn(async () => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => json({}, 503));
    const client = createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch, sleep, maxRetries: 2 });
    const err = await client.listClients().catch((e) => e);
    expect(err).toBeInstanceOf(SocialHubError);
    expect(err).toMatchObject({ kind: "http", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404])("%i-re nincs újrapróbálás", async (status) => {
    const sleep = vi.fn(async () => {});
    const fetchMock = vi.fn(async () => json({}, status));
    const err = await createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch, sleep }).listClients().catch((e) => e);
    expect(err).toMatchObject({ kind: "http", status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("időtúllépéskor (AbortController) a hívás hibával megszakad", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const pending = createSocialHubClient(config, { fetch: fetchMock as unknown as typeof fetch, timeoutMs: 1000 })
      .listClients().catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await pending;
    expect(err).toBeInstanceOf(SocialHubError);
    expect(err.kind).toBe("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parseRetryAfter: másodperc, HTTP-dátum, ismeretlen", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter("holnap")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe("a kulcs soha nem kerül naplóba vagy hibaüzenetbe", () => {
  it("újrapróbálás, HTTP-hiba, hálózati hiba és sync-hiba után sem", async () => {
    const logs: string[] = [];
    const capture = (...args: unknown[]) => { logs.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join(" ")); };
    for (const m of ["log", "warn", "error", "info"] as const) vi.spyOn(console, m).mockImplementation(capture);
    const sleep = async () => {};

    const http = createSocialHubClient(config, { fetch: (async () => json({}, 500)) as unknown as typeof fetch, sleep });
    const httpErr = await http.listClients().catch((e) => e);
    // A hálózati hiba üzenete tartalmazza a kulcsot — nem szabad továbbadni.
    const network = createSocialHubClient(config, {
      fetch: (async () => { throw new TypeError(`fetch failed Authorization: Bearer ${API_KEY}`); }) as unknown as typeof fetch,
    });
    const networkErr = await network.listClients().catch((e) => e);
    const sync = await syncSocialMetrics(
      { profileId: "p-1", externalRef: "viba-team", from: "2026-10-01", to: "2026-10-31" },
      {
        config,
        createClient: (c) => createSocialHubClient(c, { fetch: (async () => json({}, 503)) as unknown as typeof fetch, sleep }),
        replaceRows: async () => ({ inserted: 0 }),
      },
    );

    expect(sync).toMatchObject({ status: "failed", reason: "error" });
    const surfaced = [httpErr.message, String(httpErr.stack), networkErr.message, JSON.stringify(sync), ...logs].join("\n");
    expect(logs.length).toBeGreaterThan(0);
    expect(surfaced).not.toContain(API_KEY);
    expect(surfaced).not.toContain("hub.example.test");
    expect(networkErr).toMatchObject({ kind: "network" });
  });
});

describe("mapSocialHubMetrics – provider-térkép és normalizált sorok", () => {
  it("a Social Hub providerjeit explicit térképpel képezi; ismeretlent és mock-ot kihagy, megszámolja", () => {
    const { rows, skippedAccounts } = mapSocialHubMetrics({
      accounts: [
        { social_account_id: "fb-1", provider: "meta:facebook", days: [{ day: "2026-10-01", metrics: { followers: 1200, reach: 340.5, label: "x", bad: Number.NaN, inf: Infinity, nested: { a: 1 }, nul: null } }] },
        { social_account_id: "ig-1", provider: "meta:instagram", days: [{ day: "2026-10-02", metrics: { impressions: 50 } }] },
        { social_account_id: "li-1", provider: "linkedin", days: [{ day: "2026-10-03", metrics: { engagement: 7 } }] },
        { social_account_id: "tt-1", provider: "meta:tiktok", days: [{ day: "2026-10-01", metrics: { reach: 1 } }] },
        { social_account_id: "mk-1", provider: "mock:facebook", days: [{ day: "2026-10-01", metrics: { reach: 1 } }] },
      ],
    });
    expect(skippedAccounts).toBe(2);
    expect(rows).toEqual([
      { platform: "facebook", date: new Date("2026-10-01T00:00:00Z"), metricKey: "followers", value: 1200, currency: null, dimension: { socialAccountId: "fb-1" } },
      { platform: "facebook", date: new Date("2026-10-01T00:00:00Z"), metricKey: "reach", value: 340.5, currency: null, dimension: { socialAccountId: "fb-1" } },
      { platform: "instagram", date: new Date("2026-10-02T00:00:00Z"), metricKey: "impressions", value: 50, currency: null, dimension: { socialAccountId: "ig-1" } },
      { platform: "linkedin", date: new Date("2026-10-03T00:00:00Z"), metricKey: "engagement", value: 7, currency: null, dimension: { socialAccountId: "li-1" } },
    ]);
    expect(SOCIAL_HUB_PROVIDER_PLATFORM["mock:facebook"]).toBeUndefined();
  });
});

describe("syncSocialMetrics – fail-closed és párosítás", () => {
  const replaceRows = vi.fn(async () => ({ inserted: 0 }));

  it("hiányzó konfigurációnál nincs hálózati hívás, ok-kód: not_configured", async () => {
    const createClient = vi.fn();
    const res = await syncSocialMetrics({ profileId: "p", externalRef: "viba-team", from: "2026-10-01", to: "2026-10-31" }, { config: null, createClient, replaceRows });
    expect(res).toEqual({ status: "skipped", reason: "not_configured" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("external_ref nélkül nincs hálózati hívás, ok-kód: no_external_ref", async () => {
    const fetchMock = vi.fn();
    for (const externalRef of [null, undefined, "  "]) {
      const res = await syncSocialMetrics({ profileId: "p", externalRef, from: "2026-10-01", to: "2026-10-31" }, {
        config, createClient: (c) => createSocialHubClient(c, { fetch: fetchMock as unknown as typeof fetch }), replaceRows,
      });
      expect(res).toEqual({ status: "skipped", reason: "no_external_ref" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nincs egyező external_ref a GET /clients-ben → nincs metrics-hívás, ok-kód: no_match", async () => {
    const fetchMock = vi.fn(async () => json(clientsBody));
    const res = await syncSocialMetrics({ profileId: "p", externalRef: "mas-ugyfel", from: "2026-10-01", to: "2026-10-31" }, {
      config, createClient: (c) => createSocialHubClient(c, { fetch: fetchMock as unknown as typeof fetch }), replaceRows,
    });
    expect(res).toEqual({ status: "skipped", reason: "no_match" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toMatch(/\/clients$/);
  });

  it("nem kért közösségi platform → not_requested, hívás nélkül", async () => {
    const createClient = vi.fn();
    const res = await syncSocialMetrics({ profileId: "p", externalRef: "viba-team", from: "2026-10-01", to: "2026-10-31", requested: false }, { config, createClient, replaceRows });
    expect(res).toEqual({ status: "skipped", reason: "not_requested" });
    expect(createClient).not.toHaveBeenCalled();
  });
});
