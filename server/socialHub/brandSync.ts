/**
 * Márkaprofil-szinkron a Social Hubba (G2): mentés után és kézzel.
 *
 * Sorrend: a mentés UTÁN nő a változásszám (requestedRev); profilonként egy bérlet engedi a
 * küldést. A bérlet birtokosa a változásszám kiolvasása után frissen olvassa a TELJES állapotot,
 * a célt és a kísérletet a küldés előtt rögzíti, és ha közben újabb mentés jött, korlátozott
 * számban ismétel. Így az utolsó küldés mindig a legújabb állapotot viszi.
 *
 * A mentést semmi nem buktathatja el és nem lassíthatja érdemben: a hiba itt marad, a várakozás
 * rövid, és a háttérben futó rész befejezésére nem építünk (Vercelen megállhat) — az elmaradt
 * változást a tárolt hash mutatja, és a gomb pótolja. Az alárkákra nincs szinkron.
 */
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { getProfileById } from "../db";
import { buildBrandProfile, EMPTY_BRAND_RULES, type BrandRules } from "./brandProfile";
import { getBrandStore, type BrandOutcome, type BrandRow, type BrandStore } from "./brandStore";
import {
  createSocialHubClient, findClientByExternalRef, SocialHubError,
  type SocialHubApi, type SocialHubClientOptions, type SocialHubConfig,
} from "./client";
import { resolveSocialHubConfig, SOCIAL_HUB_RESOLVE_ERROR, type SocialHubResolution } from "./config";
import { isUuid } from "./drafts";
import { classifyFailure } from "./send";

/** Legfeljebb ennyit vár a mentés a szinkronra (az adatbázis-műveletekkel együtt). */
export const SAVE_WAIT_MS = 2_000;
/** Ennyit vár a „Szinkronizálás most” gomb. */
export const MANUAL_WAIT_MS = 30_000;
/** A bérlet jóval hosszabb egy küldés teljes határidejénél. */
export const LEASE_MS = 90_000;
export const LIST_BUDGET_MS = 12_000;
export const PUT_BUDGET_MS = 20_000;
const REQUEST_TIMEOUT_MS = 8_000;
/** A küldéshez ennyi bérletidőnek kell maradnia; a rögzítés legfeljebb ennyit késhet. */
export const MIN_LEASE_LEFT_MS = 30_000;
export const MAX_BEGIN_DELAY_MS = 5_000;
/** Bizonytalan eredmény után ennyi ideig nem indul újabb küldés. */
export const UNCERTAIN_HOLD_MS = 60_000;
export const MAX_ROUNDS = 3;
/** Ennél régebb óta futó szinkron nem kezd új kört. */
const RUN_BUDGET_MS = 30_000;

type BrandProfileRow = Pick<NonNullable<Awaited<ReturnType<typeof getProfileById>>>, "externalRef" | "brandVoice" | "contentPillars">;

export type BrandSyncDeps = {
  store?: BrandStore | null;
  resolve?: () => Promise<SocialHubResolution>;
  getProfile?: (profileId: string) => Promise<BrandProfileRow | undefined>;
  createClient?: (config: SocialHubConfig, options: SocialHubClientOptions) => Pick<SocialHubApi, "listClients" | "putBrandProfile">;
  now?: () => number;
};

export type BrandSyncResult =
  | { status: "sent" | "empty" | "busy" | "lost" | "deleted" | "not_paired" | "not_configured" | "connection_error" | "unavailable" }
  | { status: "failed" | "uncertain"; code: string };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const errorTarget = (ref: string, urlHash: string) => sha256(`${urlHash}|${ref}`);
const pairedRef = (profile: BrandProfileRow | undefined) => profile?.externalRef?.trim() || null;
const sameCell = (row: BrandRow | null, ref: string, urlHash: string) => !!row && row.targetRef === ref && row.targetUrlHash === urlHash;

const toRules = (row: BrandRow | null): BrandRules => row
  ? { requiredPhrases: row.requiredPhrases, forbiddenPhrases: row.forbiddenPhrases, requiredDisclaimer: row.requiredDisclaimer }
  : EMPTY_BRAND_RULES;

// ─── Hibakódok ───────────────────────────────────────────────────────────────

const ERROR_TEXT: Record<string, string> = {
  unreachable: "A Social Hub most nem érhető el.",
  blocked: "A Social Hub címe nem engedélyezett. Kérd meg a rendszergazdát, hogy nézze meg.",
  invalid_response: "A Social Hub váratlan választ adott.",
  auth: "A Social Hub nem fogadta el a kulcsot. Szólj a rendszergazdának.",
  redirect: "A Social Hub megadott címe átirányít. Szólj a rendszergazdának.",
  rate_limited: "A Social Hub most túlterhelt.",
  server: "A Social Hubban hiba történt.",
  not_found: "A Social Hub nem találja az ügyfelet.",
  no_match: "A Social Hubban nincs ilyen azonosítójú ügyfél. Szólj a rendszergazdának.",
  rejected: "A Social Hub nem fogadta el a márkaprofilt.",
};
const UNKNOWN_ERROR_TEXT = "A szinkron most nem sikerült.";

/** Rögzített, titokmentes hibakód; nyers szerverüzenet soha nem tárolódik. */
export function syncErrorCode(err: unknown): string {
  if (!(err instanceof SocialHubError)) return "unknown";
  if (err.kind === "timeout" || err.kind === "network") return "unreachable";
  if (err.kind !== "http") return err.kind;
  const status = err.status ?? 0;
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  if (status >= 300 && status < 400) return "redirect";
  return "rejected";
}

export const syncErrorText = (code: string): string => ERROR_TEXT[code] ?? UNKNOWN_ERROR_TEXT;

// ─── Egy kör ─────────────────────────────────────────────────────────────────

type Round = { outcome: BrandOutcome; result: BrandSyncResult };
const skipped = (status: "not_paired" | "not_configured" | "connection_error" | "deleted" | "lost"): Round =>
  ({ outcome: { kind: "skipped" }, result: { status } });

async function runRound(profileId: string, token: string, row: BrandRow, store: BrandStore, deps: BrandSyncDeps): Promise<Round> {
  const now = deps.now ?? Date.now;
  // Minden frissen, a változásszám kiolvasása UTÁN.
  const resolved = await (deps.resolve ?? resolveSocialHubConfig)();
  if (resolved.status !== "ok") return skipped(resolved.status === "error" ? "connection_error" : "not_configured");
  const [profile, { row: rulesRow }] = await Promise.all([(deps.getProfile ?? getProfileById)(profileId), store.read(profileId)]);
  if (!profile || !rulesRow) return skipped("deleted");
  const ref = pairedRef(profile);
  if (!ref) return skipped("not_paired");
  const urlHash = sha256(resolved.config.baseUrl);
  const target = errorTarget(ref, urlHash);
  const mapping = buildBrandProfile(profile, toRules(rulesRow));
  const nothingToSend: Round = { outcome: { kind: "empty" }, result: { status: "empty" } };
  const everSent = row.maybeSent && sameCell(row, ref, urlHash);
  if (mapping.empty && !everSent) return nothingToSend;

  const failed = (code: string, restore?: Pick<BrandRow, "maybeSent" | "sentHash">): Round =>
    ({ outcome: { kind: "failed", code, target, restore }, result: { status: "failed", code } });
  const createClient = deps.createClient ?? createSocialHubClient;

  let clientId: string | undefined;
  try {
    const api = createClient(resolved.config, { timeoutMs: REQUEST_TIMEOUT_MS, deadlineAt: now() + LIST_BUDGET_MS });
    clientId = findClientByExternalRef(await api.listClients(), ref)?.id;
  } catch (err) {
    return failed(syncErrorCode(err)); // olvasás volt: biztosan nem változott semmi
  }
  if (!clientId || !isUuid(clientId)) return failed("no_match");
  const sameTarget = sameCell(row, ref, urlHash) && row.targetClientId === clientId;
  if (mapping.empty && !(sameTarget && row.maybeSent)) return nothingToSend;

  const startedAt = now();
  const begun = await store.begin(profileId, token, { ref, urlHash, clientId }, { sameTarget, minLeftMs: MIN_LEASE_LEFT_MS, leaseMs: LEASE_MS });
  // Lejárt a bérlet, vagy közben megváltozott a párosítás.
  if (!begun) return skipped("lost");
  const restore = sameTarget ? { maybeSent: row.maybeSent, sentHash: row.sentHash } : { maybeSent: false, sentHash: null };
  // Ha a rögzítés válasza sokat késett, a bérlet már másé lehet: nem küldünk.
  if (now() - startedAt > MAX_BEGIN_DELAY_MS) return failed("unknown", restore);
  try {
    const api = createClient(resolved.config, { timeoutMs: REQUEST_TIMEOUT_MS, deadlineAt: startedAt + PUT_BUDGET_MS });
    await api.putBrandProfile(clientId, JSON.stringify(mapping.body));
  } catch (err) {
    const code = syncErrorCode(err);
    console.error(`[socialHub] márkaprofil-szinkron: ${err instanceof SocialHubError ? err.message : "váratlan hiba"}`);
    if (classifyFailure(err, false) === "failed") return failed(code, restore);
    return { outcome: { kind: "uncertain", code, target, holdMs: UNCERTAIN_HOLD_MS }, result: { status: "uncertain", code } };
  }
  return { outcome: { kind: "sent", hash: mapping.hash }, result: { status: "sent" } };
}

/**
 * A teljes márkaprofil szinkronja. `bump: false`, ha a hívó mentése már növelte a változásszámot.
 * Párosítás vagy kapcsolat nélkül nem tesz semmit. Tárolóhibánál dob (a hívó kezeli).
 */
export async function syncBrandProfile(profileId: string, opts: { bump: boolean }, deps: BrandSyncDeps = {}): Promise<BrandSyncResult> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const store = deps.store === undefined ? getBrandStore() : deps.store;
  if (!store) return { status: "unavailable" };
  const profile = await (deps.getProfile ?? getProfileById)(profileId);
  if (!profile) return { status: "deleted" };
  if (!pairedRef(profile)) return { status: "not_paired" };
  const resolved = await (deps.resolve ?? resolveSocialHubConfig)();
  if (resolved.status !== "ok") return { status: resolved.status === "error" ? "connection_error" : "not_configured" };

  if (opts.bump && !(await store.bumpRev(profileId))) return { status: "deleted" };
  const token = nanoid();
  let row = await store.acquire(profileId, token, LEASE_MS);
  // Más küldi éppen: az a futás a mi változásunkat is észreveszi, mielőtt elengedi a bérletet.
  if (!row) return { status: "busy" };
  for (let round = 1; ; round++) {
    const { outcome, result } = await runRound(profileId, token, row, store, deps);
    const canRepeat = round < MAX_ROUNDS && now() - startedAt < RUN_BUDGET_MS;
    row = await store.finish(profileId, token, row.requestedRev, outcome, canRepeat ? LEASE_MS : 0);
    if (!row) return result;
  }
}

/** Legfeljebb `ms` ideig vár; a munka a háttérben futhat tovább, hibája soha nem kezeletlen. */
async function waitAtMost<T>(work: Promise<T>, ms: number): Promise<T | "pending" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guarded = work.catch(() => {
    console.error("[socialHub] a márkaprofil-szinkron megszakadt");
    return "error" as const;
  });
  try {
    return await Promise.race([guarded, new Promise<"pending">((resolve) => { timer = setTimeout(() => resolve("pending"), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

/** Mentés után hívandó. Soha nem dob, és legfeljebb kb. 2 másodpercig vár. */
export async function syncBrandAfterSave(profileId: string, opts: { bump?: boolean } = {}, deps: BrandSyncDeps = {}): Promise<void> {
  await waitAtMost(syncBrandProfile(profileId, { bump: opts.bump ?? true }, deps), SAVE_WAIT_MS);
}

const BUSY_TEXT = "Épp fut egy szinkron, vagy az előző eredményére várunk. Próbáld újra kb. egy perc múlva.";

/** „Szinkronizálás most”: a felhasználónak szóló eredmény. */
export async function syncBrandNow(profileId: string, deps: BrandSyncDeps = {}): Promise<{ ok: boolean; message: string }> {
  const result = await waitAtMost(syncBrandProfile(profileId, { bump: true }, deps), MANUAL_WAIT_MS);
  if (result === "pending") return { ok: false, message: "A szinkron még fut. Nézz vissza kicsit később." };
  if (result === "error") return { ok: false, message: UNKNOWN_ERROR_TEXT };
  switch (result.status) {
    case "sent": return { ok: true, message: "A márkaprofil átment a Social Hubba." };
    case "empty": return { ok: true, message: "Még nincs mit átküldeni." };
    case "failed": return { ok: false, message: syncErrorText(result.code) };
    case "uncertain": return { ok: false, message: `${syncErrorText(result.code)} Nem tudjuk, átment-e. Próbáld újra kb. egy perc múlva.` };
    case "busy": return { ok: false, message: BUSY_TEXT };
    case "not_paired": return { ok: false, message: "Az ügyfél nincs párosítva a Social Hubbal." };
    case "not_configured": return { ok: false, message: "A Social Hub még nincs bekötve." };
    case "connection_error": return { ok: false, message: SOCIAL_HUB_RESOLVE_ERROR };
    case "lost": return { ok: false, message: "Közben megváltozott a párosítás vagy lejárt az idő. Próbáld újra." };
    default: return { ok: false, message: UNKNOWN_ERROR_TEXT };
  }
}

// ─── Állapot ─────────────────────────────────────────────────────────────────

export type BrandSyncStatus = {
  state: "ok" | "not_paired" | "not_configured" | "connection_error" | "unavailable";
  rules: BrandRules;
  lastSyncedAt: Date | null;
  lastError: { message: string; at: Date } | null;
  /** Van még el nem küldött változás. */
  pending: boolean;
  running: boolean;
  warnings: string[];
};

/** A mezők és a szinkron állapota, kizárólag a saját adatainkból: a Social Hubot nem hívja. */
export async function getBrandSyncStatus(profileId: string, deps: BrandSyncDeps = {}): Promise<BrandSyncStatus> {
  const none: BrandSyncStatus = {
    state: "unavailable", rules: EMPTY_BRAND_RULES, lastSyncedAt: null, lastError: null, pending: false, running: false, warnings: [],
  };
  const store = deps.store === undefined ? getBrandStore() : deps.store;
  if (!store) return none;
  let stored: Awaited<ReturnType<BrandStore["read"]>>;
  let profile: BrandProfileRow | undefined;
  try {
    stored = await store.read(profileId);
    profile = stored.missingTable ? undefined : await (deps.getProfile ?? getProfileById)(profileId);
  } catch {
    return none;
  }
  if (!profile) return none;
  const { row, nowMs } = stored;
  const rules = toRules(row);
  const mapping = buildBrandProfile(profile, rules);
  const base: BrandSyncStatus = { ...none, rules, warnings: mapping.warnings };
  const ref = pairedRef(profile);
  if (!ref) return { ...base, state: "not_paired" };
  const resolved = await (deps.resolve ?? resolveSocialHubConfig)();
  if (resolved.status !== "ok") return { ...base, state: resolved.status === "error" ? "connection_error" : "not_configured" };

  const urlHash = sha256(resolved.config.baseUrl);
  const current = sameCell(row, ref, urlHash) ? row : null; // más párosítás vagy kapcsolat sikere nem számít
  const errorShown = row?.lastErrorCode && row.lastErrorAtMs && row.lastErrorTarget === errorTarget(ref, urlHash) ? row : null;
  return {
    ...base,
    state: "ok",
    lastSyncedAt: current?.sentAtMs ? new Date(current.sentAtMs) : null,
    lastError: errorShown ? { message: syncErrorText(errorShown.lastErrorCode!), at: new Date(errorShown.lastErrorAtMs!) } : null,
    pending: mapping.empty && !current?.maybeSent ? false : current?.sentHash !== mapping.hash,
    running: !!row?.leaseUntilMs && row.leaseUntilMs > nowMs,
  };
}
