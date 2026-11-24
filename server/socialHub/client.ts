/**
 * G2A Growth Engine – Social Hub /api/v1 kliens (G1, integrációs szerződés v1)
 *
 * A szerződés: docs/termekcsalad/SOCIAL_HUB_TERV.md „Integrációs szerződés (v1)”.
 * A válaszok alakja a Social Hub kódjából (apps/web/app/api/v1, packages/server):
 *   - GET /clients → { data: [{ id, name, external_ref, accounts: [{ id, platform, name, status }] }] }
 *     (listIntegrationClients)
 *   - GET /clients/{id}/metrics?from=&to= → { client_id, from, to,
 *       accounts: [{ social_account_id, provider, days: [{ day, metrics }] }],
 *       posts: [{ post_id, target_id, provider, captured_at, metrics }] }
 *     (getClientMetrics; a tartomány legfeljebb 92 nap, mindkét végét beleszámítva)
 *
 *   - POST /clients/{id}/drafts (Idempotency-Key) → 201 { data: [{ id, ... }] }
 *     (createApiDrafts; a köteg atomi, a válasz a vázlatok sorrendjében)
 *
 * Konfiguráció: server/socialHub/config.ts resolveSocialHubConfig (tárolt kapcsolat, ennek
 * hiányában env: SOCIAL_HUB_API_URL, SOCIAL_HUB_API_KEY; egyik sem → fail-closed).
 *
 * Biztonság: a kulcs CSAK az Authorization fejlécben szerepel. Naplóba és a hívónak
 * visszaadott hibába csak a végpont-sablon, a HTTP-státusz és rövid ok kerül —
 * soha a kulcs, a fejlécek vagy a teljes URL. Átirányítást nem követünk (a Bearer-fejléc
 * nem mehet más hosztra), a tárolt címet minden kérés előtt újraellenőrizzük (SSRF).
 */
import { z } from "zod";
import { assertSocialHubUrl, type SocialHubLookup } from "./urlGuard";

export type SocialHubConfig = {
  baseUrl: string;
  apiKey: string;
  /** "stored" esetén minden kérés előtt fut a cím (DNS is) ellenőrzése. */
  source?: "stored" | "env";
};

/** A feloldó belső lépése: env-ből olvasott konfiguráció; ha bármelyik érték hiányzik, null. */
export function getSocialHubConfig(env: Record<string, string | undefined> = process.env): SocialHubConfig | null {
  const baseUrl = (env.SOCIAL_HUB_API_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (env.SOCIAL_HUB_API_KEY ?? "").trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

// ─── Válaszalakok (tűrő olvasás: az ismeretlen mezőket figyelmen kívül hagyjuk) ─

const clientsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    external_ref: z.string().nullable(),
    accounts: z.array(z.object({
      id: z.string(),
      platform: z.string(),
      name: z.string(),
      status: z.string(),
    })).default([]),
  })),
});

const metricsResponseSchema = z.object({
  client_id: z.string(),
  from: z.string(),
  to: z.string(),
  accounts: z.array(z.object({
    social_account_id: z.string(),
    provider: z.string(),
    days: z.array(z.object({
      day: z.string(),
      metrics: z.record(z.string(), z.unknown()).nullable().transform((m) => m ?? {}),
    })),
  })),
  posts: z.array(z.object({
    post_id: z.string(),
    target_id: z.string(),
    provider: z.string(),
    captured_at: z.string(),
    metrics: z.record(z.string(), z.unknown()).nullable(),
  })).default([]),
});

const draftsResponseSchema = z.object({ data: z.array(z.object({ id: z.string().min(1).max(64) })) });

export type SocialHubClient = z.infer<typeof clientsResponseSchema>["data"][number];
export type SocialHubMetricsResponse = z.infer<typeof metricsResponseSchema>;

// ─── Hibák ───────────────────────────────────────────────────────────────────

export type SocialHubErrorKind = "timeout" | "http" | "network" | "invalid_response" | "blocked";

/** A hívónak és a naplónak szánt hiba: csak végpont-sablon, státusz és rövid ok. */
export class SocialHubError extends Error {
  constructor(
    readonly kind: SocialHubErrorKind,
    readonly endpoint: string,
    readonly status: number | null = null,
    /** A Social Hub hibakódja (pl. ACCOUNT_NOT_CONNECTED), csak POST-nál. */
    readonly code: string | null = null,
    /** Ugyanebben a hívásban volt korábbi 5xx: a kérés hatása nem zárható ki. */
    readonly ambiguous = false,
  ) {
    super(
      kind === "http" ? `Social Hub ${endpoint}: HTTP ${status}`
        : kind === "timeout" ? `Social Hub ${endpoint}: időtúllépés`
        : kind === "network" ? `Social Hub ${endpoint}: hálózati hiba`
        : kind === "blocked" ? `Social Hub ${endpoint}: nem engedélyezett cím`
        : `Social Hub ${endpoint}: érvénytelen válasz`,
    );
    this.name = "SocialHubError";
  }
}

// ─── Időszak darabolása ──────────────────────────────────────────────────────

/** A Social Hub parseMetricsRange-e szerinti felső korlát (napok, mindkét végét beleszámítva). */
export const MAX_METRICS_RANGE_DAYS = 92;
const DAY_MS = 86_400_000;

function parseDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Érvénytelen dátum: ${value}`);
  const t = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== value) throw new Error(`Érvénytelen dátum: ${value}`);
  return t;
}

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * [from, to] (YYYY-MM-DD, inkluzív) felbontása legfeljebb `maxDays` napos,
 * egymást nem átfedő, hézag nélküli darabokra, időrendben.
 */
export function splitDateRange(from: string, to: string, maxDays = MAX_METRICS_RANGE_DAYS): { from: string; to: string }[] {
  const start = parseDay(from);
  const end = parseDay(to);
  if (start > end) throw new Error("A kezdőnap nem lehet a zárónap után.");
  const chunks: { from: string; to: string }[] = [];
  for (let cur = start; cur <= end; cur += maxDays * DAY_MS) {
    chunks.push({ from: isoDay(cur), to: isoDay(Math.min(cur + (maxDays - 1) * DAY_MS, end)) });
  }
  return chunks;
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

export type SocialHubClientOptions = {
  fetch?: typeof fetch;
  /** Várakozás az újrapróbálás előtt — teszt injektálja, hogy ne kelljen valódi időt várni. */
  sleep?: (ms: number) => Promise<void>;
  /** Egy kérés időkorlátja (ms). */
  timeoutMs?: number;
  /** Újrapróbálások száma 429/5xx esetén (az első kérésen felül). */
  maxRetries?: number;
  /** Egy várakozás felső korlátja (ms), a Retry-After-re is. */
  maxRetryDelayMs?: number;
  /** DNS-feloldás a tárolt cím ellenőrzéséhez — teszt injektálja. */
  lookup?: SocialHubLookup;
  /** Az összes kérés közös határideje (epoch ms); ezen túl nincs várakozás és újrapróbálás. */
  deadlineAt?: number;
};

const DEFAULTS = { timeoutMs: 15_000, maxRetries: 2, maxRetryDelayMs: 10_000 };
const BASE_BACKOFF_MS = 500;
/** Határidős hívásnál ennyi időnek kell maradnia egy újrapróbálásra a várakozás után. */
const MIN_RETRY_WINDOW_MS = 5_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

/** A Social Hub hibakódja a hibatörzsből ({ error: { code } }); csak biztonságos alakú kód. */
async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } | null; code?: unknown } | null;
    const code = body?.error?.code ?? body?.code;
    return typeof code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** Retry-After (másodperc vagy HTTP-dátum) → ms; ismeretlennél null. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/** Az external_ref-fel párosított Social Hub-ügyfél (metrika-szinkron és küldés közös logikája). */
export function findClientByExternalRef(clients: SocialHubClient[], externalRef: string | null | undefined): SocialHubClient | undefined {
  const ref = externalRef?.trim();
  return ref ? clients.find((c) => c.external_ref === ref) : undefined;
}

export function createSocialHubClient(config: SocialHubConfig, options: SocialHubClientOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULTS.maxRetryDelayMs;

  const remainingMs = () => (options.deadlineAt === undefined ? Infinity : options.deadlineAt - Date.now());

  /** `endpoint` a naplózható sablon (pl. "/clients/{id}/metrics"); `path` a valódi útvonal. */
  async function requestJson(
    endpoint: string,
    path: string,
    post?: { idempotencyKey: string; body: string },
  ): Promise<unknown> {
    let ambiguous = false;
    for (let attempt = 0; ; attempt++) {
      if (config.source === "stored") {
        try {
          await assertSocialHubUrl(config.baseUrl, { lookup: options.lookup });
        } catch {
          throw new SocialHubError("blocked", endpoint, null, null, ambiguous);
        }
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs, remainingMs())));
      let delay = 0;
      try {
        let res: Response;
        try {
          res = await doFetch(`${config.baseUrl}${path}`, {
            method: post ? "POST" : "GET",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              Accept: "application/json",
              ...(post ? { "Content-Type": "application/json", "Idempotency-Key": post.idempotencyKey } : {}),
            },
            ...(post ? { body: post.body } : {}),
            // 3xx = hiba: a Bearer-fejléc nem mehet más hosztra.
            redirect: "manual",
            signal: controller.signal,
          });
        } catch {
          // Az eredeti hibát szándékosan nem adjuk tovább: a kérés adatait tartalmazhatja.
          throw new SocialHubError(controller.signal.aborted ? "timeout" : "network", endpoint, null, null, ambiguous);
        }
        if (res.ok) {
          try {
            return await res.json();
          } catch {
            throw new SocialHubError(controller.signal.aborted ? "timeout" : "invalid_response", endpoint, res.status, null, ambiguous);
          }
        }
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        delay = Math.min(retryAfter ?? BASE_BACKOFF_MS * 2 ** attempt, maxRetryDelayMs);
        const retry = isRetryable(res.status) && attempt < maxRetries && remainingMs() > delay + MIN_RETRY_WINDOW_MS;
        if (!retry) {
          throw new SocialHubError("http", endpoint, res.status, post ? await readErrorCode(res) : null, ambiguous);
        }
        if (res.status >= 500) ambiguous = true;
        console.warn(`[socialHub] ${endpoint}: HTTP ${res.status}, újrapróbálás ${attempt + 1}/${maxRetries} (${delay} ms múlva)`);
      } finally {
        clearTimeout(timer);
      }
      await sleep(delay);
    }
  }

  const getJson = (endpoint: string, path: string) => requestJson(endpoint, path);

  async function listClients(): Promise<SocialHubClient[]> {
    const parsed = clientsResponseSchema.safeParse(await getJson("/clients", "/clients"));
    if (!parsed.success) throw new SocialHubError("invalid_response", "/clients");
    return parsed.data.data;
  }

  /** Egyetlen, legfeljebb 92 napos tartomány metrikái. */
  async function getClientMetrics(clientId: string, from: string, to: string): Promise<SocialHubMetricsResponse> {
    const endpoint = "/clients/{id}/metrics";
    const query = new URLSearchParams({ from, to }).toString();
    const raw = await getJson(endpoint, `/clients/${encodeURIComponent(clientId)}/metrics?${query}`);
    const parsed = metricsResponseSchema.safeParse(raw);
    if (!parsed.success) throw new SocialHubError("invalid_response", endpoint);
    return parsed.data;
  }

  /**
   * Tetszőleges hosszú tartomány: ≤92 napos darabokban kéri le, majd fiókonként
   * összefűzi a napokat (a darabok nem fedik át egymást, így nincs ismétlődő nap).
   */
  async function getClientMetricsRange(clientId: string, from: string, to: string): Promise<SocialHubMetricsResponse> {
    const merged: SocialHubMetricsResponse = { client_id: clientId, from, to, accounts: [], posts: [] };
    const byAccount = new Map<string, SocialHubMetricsResponse["accounts"][number]>();
    for (const chunk of splitDateRange(from, to)) {
      const part = await getClientMetrics(clientId, chunk.from, chunk.to);
      for (const account of part.accounts) {
        const existing = byAccount.get(account.social_account_id);
        if (existing) existing.days.push(...account.days);
        else {
          const copy = { ...account, days: [...account.days] };
          byAccount.set(account.social_account_id, copy);
          merged.accounts.push(copy);
        }
      }
      merged.posts.push(...part.posts);
    }
    return merged;
  }

  /**
   * Vázlatok feltöltése. A `body` a tárolt, pontos kimenő JSON (ismétléskor is ugyanaz).
   * Siker: a létrejött posztok azonosítói a vázlatok sorrendjében; minden más SocialHubError.
   */
  async function createDrafts(clientId: string, idempotencyKey: string, body: string, expectedCount: number): Promise<string[]> {
    const endpoint = "/clients/{id}/drafts";
    const raw = await requestJson(endpoint, `/clients/${encodeURIComponent(clientId)}/drafts`, { idempotencyKey, body });
    const parsed = draftsResponseSchema.safeParse(raw);
    const ids = parsed.success ? parsed.data.data.map((d) => d.id) : [];
    if (ids.length !== expectedCount || new Set(ids).size !== ids.length) {
      throw new SocialHubError("invalid_response", endpoint);
    }
    return ids;
  }

  return { listClients, getClientMetrics, getClientMetricsRange, createDrafts };
}

export type SocialHubApi = ReturnType<typeof createSocialHubClient>;
