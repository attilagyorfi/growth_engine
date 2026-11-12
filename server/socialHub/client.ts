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
 * Konfiguráció env-ből: SOCIAL_HUB_API_URL (pl. https://…/api/v1), SOCIAL_HUB_API_KEY
 * (Authorization: Bearer). Bármelyik hiányában a kliens nem jön létre (fail-closed).
 *
 * Biztonság: a kulcs CSAK az Authorization fejlécben szerepel. Naplóba és a hívónak
 * visszaadott hibába csak a végpont-sablon, a HTTP-státusz és rövid ok kerül —
 * soha a kulcs, a fejlécek vagy a teljes URL.
 */
import { z } from "zod";

export type SocialHubConfig = { baseUrl: string; apiKey: string };

/** Env-ből olvasott konfiguráció; ha bármelyik érték hiányzik, null (fail-closed). */
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

export type SocialHubClient = z.infer<typeof clientsResponseSchema>["data"][number];
export type SocialHubMetricsResponse = z.infer<typeof metricsResponseSchema>;

// ─── Hibák ───────────────────────────────────────────────────────────────────

export type SocialHubErrorKind = "timeout" | "http" | "network" | "invalid_response";

/** A hívónak és a naplónak szánt hiba: csak végpont-sablon, státusz és rövid ok. */
export class SocialHubError extends Error {
  constructor(
    readonly kind: SocialHubErrorKind,
    readonly endpoint: string,
    readonly status: number | null = null,
  ) {
    super(
      kind === "http" ? `Social Hub ${endpoint}: HTTP ${status}`
        : kind === "timeout" ? `Social Hub ${endpoint}: időtúllépés`
        : kind === "network" ? `Social Hub ${endpoint}: hálózati hiba`
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
};

const DEFAULTS = { timeoutMs: 15_000, maxRetries: 2, maxRetryDelayMs: 10_000 };
const BASE_BACKOFF_MS = 500;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

/** Retry-After (másodperc vagy HTTP-dátum) → ms; ismeretlennél null. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export function createSocialHubClient(config: SocialHubConfig, options: SocialHubClientOptions = {}) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULTS.maxRetryDelayMs;

  /** `endpoint` a naplózható sablon (pl. "/clients/{id}/metrics"); `path` a valódi útvonal. */
  async function getJson(endpoint: string, path: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(`${config.baseUrl}${path}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
          signal: controller.signal,
        });
      } catch {
        // Az eredeti hibát szándékosan nem adjuk tovább: a kérés adatait tartalmazhatja.
        throw new SocialHubError(controller.signal.aborted ? "timeout" : "network", endpoint);
      } finally {
        clearTimeout(timer);
      }

      if (res.ok) {
        try {
          return await res.json();
        } catch {
          throw new SocialHubError("invalid_response", endpoint, res.status);
        }
      }
      if (!isRetryable(res.status) || attempt >= maxRetries) {
        throw new SocialHubError("http", endpoint, res.status);
      }
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const delay = Math.min(retryAfter ?? BASE_BACKOFF_MS * 2 ** attempt, maxRetryDelayMs);
      console.warn(`[socialHub] ${endpoint}: HTTP ${res.status}, újrapróbálás ${attempt + 1}/${maxRetries} (${delay} ms múlva)`);
      await sleep(delay);
    }
  }

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

  return { listClients, getClientMetrics, getClientMetricsRange };
}

export type SocialHubApi = ReturnType<typeof createSocialHubClient>;
