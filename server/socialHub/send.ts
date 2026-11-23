/**
 * Küldés a Social Hubba vázlatként (G2): előnézet, küldés, ismétlés.
 *
 * Itt semmi nem ütemez és nem publikál, a content_posts sorai nem változnak.
 *
 * Idempotencia: darabonként egy kísérlet; a kulcs, a cél ügyfél és a pontos törzs a hívás
 * ELŐTT tárolódik (store.claim). Bizonytalan eredmény után csak ugyanaz a kísérlet
 * ismételhető (ugyanaz a kulcs és törzs), a 24 órás ablakon belül, ráhagyással. Utána új
 * kulccsal, külön megerősítéssel mehet.
 */
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import type { ContentPost } from "../../drizzle/schema";
import {
  createSocialHubClient, findClientByExternalRef, SocialHubError,
  type SocialHubApi, type SocialHubClient, type SocialHubClientOptions, type SocialHubConfig,
} from "./client";
import { resolveSocialHubConfig, SOCIAL_HUB_RESOLVE_ERROR, type SocialHubResolution } from "./config";
import { buildDraft, buildDraftsBody, buildPostContent, chunkDrafts, isUuid, type OutboundDraft } from "./drafts";
import type { ClaimItem, PostDelivery, SendAttempt, SocialHubStore } from "./store";

/** A Social Hub 24 óráig ismétli a tárolt választ; ennél korábban zárunk. */
export const REPEAT_WINDOW_MS = 23 * 3_600_000;
/** Ennél régebbi „folyamatban” kísérlet beragadt (a Vercel-hívás legfeljebb 60 s). */
export const STALE_SENDING_MS = 90_000;
/** Egy szerverhívás kerete, és amennyinek egy új darab indításához maradnia kell. */
export const SEND_BUDGET_MS = 45_000;
export const MIN_CHUNK_WINDOW_MS = 18_000;

export type SendTargetRef = { id: string; name: string; externalRef: string | null };

export type SendDeps = {
  store: SocialHubStore;
  resolve?: () => Promise<SocialHubResolution>;
  createClient?: (config: SocialHubConfig, options: SocialHubClientOptions) => Pick<SocialHubApi, "listClients" | "createDrafts">;
  now?: () => number;
};

export type PostState =
  | "ready" | "changed" | "uncertain_expired" // küldhető (az utóbbi kettő csak külön megerősítéssel)
  | "already_sent" | "published" | "rejected" | "no_pairing" | "choose_target" | "no_account"
  | "choose_account" | "invalid" | "in_progress" | "uncertain";

export const STATE_TEXT: Record<PostState, string> = {
  ready: "Küldhető.",
  changed: "Már elküldted, de azóta változott. Újraküldve új vázlat lesz belőle.",
  uncertain_expired: "Nem tudjuk, átment-e. Előbb nézd meg a Social Hubban, mert újraküldve kétszer is ott lehet.",
  already_sent: "Már elküldted, és azóta nem változott.",
  published: "Már megjelent.",
  rejected: "Elutasított poszt.",
  no_pairing: "Az ügyfél nincs párosítva a Social Hubbal.",
  choose_target: "Válaszd ki, melyik ügyfélhez menjen.",
  no_account: "Nincs hozzá csatlakozott fiók a Social Hubban.",
  choose_account: "Válaszd ki, melyik fiókra menjen.",
  invalid: "A szöveg üres vagy túl hosszú.",
  in_progress: "Éppen küldjük.",
  uncertain: "Nem tudjuk, átment-e. Az „Ismétlés” biztonságos, nem küldi kétszer.",
};

type AccountOption = { id: string; name: string };
export type PlannedPost = {
  postId: string;
  title: string;
  platform: string;
  state: PostState;
  reason: string;
  attemptId: string | null;
  imageDropped: boolean;
  pillarShortened: boolean;
  alsoScheduled: boolean;
};
type InternalPlan = PlannedPost & { draft: OutboundDraft | null; hash: string | null; expected: ClaimItem["expected"] };

const hashUrl = (url: string) => createHash("sha256").update(url).digest("hex");

/** A felhasználónak szánt, zsargon- és titokmentes hibaszöveg. */
export function userMessage(err: unknown): string {
  if (!(err instanceof SocialHubError)) return "Váratlan hiba történt.";
  if (err.kind === "timeout" || err.kind === "network") return "A Social Hub most nem érhető el.";
  if (err.kind === "blocked") return "A Social Hub címe nem engedélyezett. Ellenőrizd a Beállításokban.";
  if (err.kind === "invalid_response") return "A Social Hub váratlan választ adott.";
  const status = err.status ?? 0;
  if (status === 401 || status === 403) return "A Social Hub nem fogadta el a kulcsot.";
  if (status >= 300 && status < 400) return "A megadott cím átirányít. Add meg a végleges címet.";
  if (status === 429) return "A Social Hub most túlterhelt.";
  if (status >= 500) return "A Social Hubban hiba történt.";
  if (err.code === "ACCOUNT_NOT_CONNECTED" || err.code === "ACCOUNT_NOT_FOUND") return "A célfiók közben lecsatlakozott a Social Hubban.";
  if (status === 404) return "A Social Hub nem találja az ügyfelet vagy a címet.";
  return "A Social Hub nem fogadta el ezt a csomagot, semmi nem jött létre belőle.";
}

/**
 * Végleges-e a hiba (biztosan semmi nem jött létre)? Kétség esetén „uncertain”.
 * Ismétlésnél a jogosultsági hiba nem bizonyítja, hogy az első hívás sem sikerült.
 */
export function classifyFailure(err: unknown, repeat: boolean): "failed" | "uncertain" {
  if (!(err instanceof SocialHubError) || err.ambiguous) return "uncertain";
  if (err.kind === "blocked") return repeat ? "uncertain" : "failed";
  if (err.kind !== "http") return "uncertain";
  const status = err.status ?? 0;
  if (status < 400 || status >= 500 || status === 408 || status === 409 || status === 429) return "uncertain";
  if (err.code === "IDEMPOTENCY_KEY_REUSED") return "uncertain";
  if (repeat && (status === 401 || status === 403 || (status === 404 && !err.code))) return "uncertain";
  return "failed";
}

function attemptState(attempt: Pick<SendAttempt, "status" | "firstTriedAt" | "lastTriedAt">, now: number): "in_progress" | "uncertain" | "uncertain_expired" {
  if (attempt.status === "sending" && now - attempt.lastTriedAt.getTime() < STALE_SENDING_MS) return "in_progress";
  return now - attempt.firstTriedAt.getTime() < REPEAT_WINDOW_MS ? "uncertain" : "uncertain_expired";
}

export function connectedAccounts(client: SocialHubClient, platform: string): AccountOption[] {
  return client.accounts
    .filter((a) => a.platform.toLowerCase() === platform.toLowerCase() && a.status.toUpperCase() === "CONNECTED" && isUuid(a.id))
    .map((a) => ({ id: a.id, name: a.name }));
}

function planPost(
  post: ContentPost, client: SocialHubClient | null, noTargetState: PostState,
  choices: Record<string, string>, delivery: PostDelivery | undefined, attempt: SendAttempt | undefined, now: number,
): InternalPlan {
  const built = buildPostContent(post);
  const base = {
    postId: post.id, title: post.title, platform: post.platform, attemptId: null,
    imageDropped: built.ok && built.imageDropped, pillarShortened: built.ok && built.pillarShortened,
    alsoScheduled: post.status === "scheduled",
    draft: null, hash: built.ok ? built.hash : null,
    expected: { status: delivery?.status ?? "new", attemptId: delivery?.attemptId ?? null } as ClaimItem["expected"],
  };
  const as = (state: PostState, extra: Partial<InternalPlan> = {}): InternalPlan => ({ ...base, state, reason: STATE_TEXT[state], ...extra });

  let confirmState: PostState = "ready";
  if (delivery && (delivery.status === "sending" || delivery.status === "uncertain")) {
    const state = attempt ? attemptState(attempt, now) : "uncertain_expired";
    if (state !== "uncertain_expired") return as(state, { attemptId: state === "uncertain" ? delivery.attemptId : null });
    confirmState = "uncertain_expired";
  } else if (delivery?.sentHash) {
    if (built.ok && delivery.sentHash === built.hash) return as("already_sent");
    confirmState = "changed";
  }
  if (post.status === "published") return as("published");
  if (post.status === "rejected") return as("rejected");
  if (!client) return as(noTargetState);
  if (!built.ok) return as("invalid");
  const accounts = connectedAccounts(client, post.platform);
  if (accounts.length === 0) return as("no_account");
  const account = accounts.length === 1 ? accounts[0] : accounts.find((a) => a.id === choices[post.platform]);
  if (!account) return as("choose_account");
  const draft = buildDraft(built.content, account.id);
  return draft ? as(confirmState, { draft }) : as("invalid");
}

/** Kapcsolat + a profil párosított céljai. A teljes ügyféllista nem hagyja el ezt a függvényt. */
async function loadTargets(refs: SendTargetRef[], deps: SendDeps, deadlineAt: number) {
  const resolved = await (deps.resolve ?? resolveSocialHubConfig)();
  if (resolved.status === "error") throw new TRPCError({ code: "PRECONDITION_FAILED", message: SOCIAL_HUB_RESOLVE_ERROR });
  if (resolved.status === "not_configured") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A Social Hub még nincs bekötve. Kérd meg a rendszergazdát, hogy állítsa be." });
  }
  const api = (deps.createClient ?? createSocialHubClient)(resolved.config, { deadlineAt });
  let clients: SocialHubClient[];
  try {
    clients = await api.listClients();
  } catch (err) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${userMessage(err)} Semmit nem küldtünk el.` });
  }
  const targets = refs.flatMap((ref) => {
    const client = findClientByExternalRef(clients, ref.externalRef);
    return client && isUuid(client.id) ? [{ id: ref.id, name: ref.name, client }] : [];
  });
  return { api, config: resolved.config, targets };
}

async function buildPlan(
  posts: ContentPost[], client: SocialHubClient | null, noTargetState: PostState,
  choices: Record<string, string>, deps: SendDeps, now: number,
): Promise<InternalPlan[]> {
  const deliveries = client && posts.length ? await deps.store.getDeliveries(client.id, posts.map((p) => p.id)) : [];
  const attemptIds = Array.from(new Set(deliveries.flatMap((d) => (d.attemptId ? [d.attemptId] : []))));
  const attempts = attemptIds.length ? await deps.store.getAttempts(attemptIds) : [];
  return posts.map((post) => {
    const delivery = deliveries.find((d) => d.postId === post.id);
    return planPost(post, client, noTargetState, choices, delivery, attempts.find((a) => a.id === delivery?.attemptId), now);
  });
}

const toPublic = ({ draft: _d, hash: _h, expected: _e, ...item }: InternalPlan): PlannedPost => item;

export async function previewSend(
  input: { posts: ContentPost[]; refs: SendTargetRef[]; targetId?: string; accountChoices?: Record<string, string> },
  deps: SendDeps,
) {
  const now = (deps.now ?? Date.now)();
  const { targets } = await loadTargets(input.refs, deps, now + SEND_BUDGET_MS);
  const selected = input.targetId ? targets.find((t) => t.id === input.targetId) : targets.length === 1 ? targets[0] : undefined;
  const noTargetState: PostState = targets.length > 1 && !input.targetId ? "choose_target" : "no_pairing";
  const items = await buildPlan(input.posts, selected?.client ?? null, noTargetState, input.accountChoices ?? {}, deps, now);
  const platforms = Array.from(new Set(input.posts.map((p) => p.platform)));
  return {
    targets: targets.map((t) => ({ id: t.id, name: t.name, clientName: t.client.name })),
    target: selected ? { id: selected.id, clientId: selected.client.id, clientName: selected.client.name } : null,
    accountOptions: selected
      ? platforms.map((platform) => ({ platform, accounts: connectedAccounts(selected.client, platform) })).filter((o) => o.accounts.length > 1)
      : [],
    items: items.map(toPublic),
  };
}

export type SendResult = {
  postId: string;
  outcome: "sent" | "failed" | "uncertain" | "not_started" | "skipped";
  message: string;
  socialHubPostId: string | null;
  attemptId: string | null;
};

const result = (postId: string, outcome: SendResult["outcome"], message: string, extra: Partial<SendResult> = {}): SendResult =>
  ({ postId, outcome, message, socialHubPostId: null, attemptId: null, ...extra });

/** Egy lefoglalt kísérlet HTTP-hívása és az eredmény rögzítése. */
async function runAttempt(
  attempt: SendAttempt, api: Pick<SocialHubApi, "createDrafts">, deps: SendDeps, repeat: boolean,
): Promise<{ results: SendResult[]; failure: unknown }> {
  const nowDate = () => new Date((deps.now ?? Date.now)());
  let ids: string[];
  try {
    ids = await api.createDrafts(attempt.socialHubClientId, attempt.idempotencyKey, attempt.body, attempt.postIds.length);
  } catch (err) {
    const status = classifyFailure(err, repeat);
    const message = userMessage(err);
    console.error(`[socialHub] küldés (${attempt.postIds.length} poszt) ${status}: ${err instanceof SocialHubError ? err.message : "váratlan hiba"}`);
    try {
      await deps.store.finishUnsent(attempt.id, attempt.runToken, status, message, nowDate());
    } catch {
      console.error("[socialHub] a küldés eredménye nem rögzíthető");
      // „sending” marad → beragadtként ismételhető, új kulccsal nem megy.
      return { results: attempt.postIds.map((id) => result(id, "uncertain", `${message} ${STATE_TEXT.uncertain}`, { attemptId: attempt.id })), failure: err };
    }
    return {
      results: attempt.postIds.map((id) => result(id, status, status === "uncertain" ? `${message} ${STATE_TEXT.uncertain}` : message,
        { attemptId: status === "uncertain" ? attempt.id : null })),
      failure: err,
    };
  }
  try {
    await deps.store.finishSent(attempt.id, attempt.postIds.map((postId, i) => ({ postId, socialHubPostId: ids[i] })), nowDate());
  } catch (err) {
    console.error("[socialHub] a sikeres küldés nem rögzíthető");
    return { results: attempt.postIds.map((id) => result(id, "uncertain", STATE_TEXT.uncertain, { attemptId: attempt.id })), failure: err };
  }
  return { results: attempt.postIds.map((postId, i) => result(postId, "sent", "Vázlatként átment.", { socialHubPostId: ids[i] })), failure: null };
}

/** Ilyen hiba után a többi darab is elbukna (vagy bizonytalan lenne): nem indítjuk el. */
function stopsSending(err: unknown): boolean {
  return classifyFailure(err, false) === "uncertain"
    || (err instanceof SocialHubError && (err.kind === "blocked" || err.status === 401 || err.status === 403 || err.status === 404));
}

export async function sendPosts(
  input: {
    profileId: string; userId: string; posts: ContentPost[]; refs: SendTargetRef[];
    targetId: string; expectedClientId: string; accountChoices: Record<string, string>;
    confirmResendIds: string[]; confirmUncertainIds: string[];
  },
  deps: SendDeps,
): Promise<{ clientName: string; results: SendResult[] }> {
  const now = deps.now ?? Date.now;
  const deadlineAt = now() + SEND_BUDGET_MS;
  const { api, config, targets } = await loadTargets(input.refs, deps, deadlineAt);
  const target = targets.find((t) => t.id === input.targetId);
  if (!target || target.client.id !== input.expectedClientId) {
    throw new TRPCError({ code: "CONFLICT", message: "Közben megváltozott a párosítás. Nyisd meg újra az ablakot." });
  }
  for (const [platform, accountId] of Object.entries(input.accountChoices)) {
    if (!connectedAccounts(target.client, platform).some((a) => a.id === accountId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A kiválasztott fiók ennél az ügyfélnél nem használható." });
    }
  }
  const plan = await buildPlan(input.posts, target.client, "no_pairing", input.accountChoices, deps, now());
  const results: SendResult[] = [];
  const toSend: (InternalPlan & { draft: OutboundDraft; hash: string })[] = [];
  for (const item of plan) {
    const allowed = item.state === "ready"
      || (item.state === "changed" && input.confirmResendIds.includes(item.postId))
      || (item.state === "uncertain_expired" && input.confirmUncertainIds.includes(item.postId));
    if (allowed && item.draft && item.hash) toSend.push({ ...item, draft: item.draft, hash: item.hash });
    else results.push(result(item.postId, "skipped", item.reason, { attemptId: item.attemptId }));
  }

  let stopped = false;
  for (const chunk of chunkDrafts(toSend)) {
    if (stopped || deadlineAt - now() < MIN_CHUNK_WINDOW_MS) {
      results.push(...chunk.map((c) => result(c.postId, "not_started", "Ez még nem indult el. Folytathatod.")));
      continue;
    }
    const tried = new Date(now());
    let attempt: SendAttempt | null;
    try {
      attempt = await deps.store.claim({
        id: nanoid(), profileId: input.profileId, socialHubClientId: target.client.id, baseUrlHash: hashUrl(config.baseUrl),
        idempotencyKey: `ge:${nanoid(32)}`, runToken: nanoid(), firstTriedAt: tried, lastTriedAt: tried, createdBy: input.userId,
        items: chunk.map((c) => ({ postId: c.postId, contentHash: c.hash, draft: c.draft, expected: c.expected })),
        buildBody: buildDraftsBody,
      });
    } catch {
      console.error("[socialHub] a küldési kísérlet nem rögzíthető");
      stopped = true;
      results.push(...chunk.map((c) => result(c.postId, "not_started", "Nem tudtuk elindítani. Próbáld újra.")));
      continue;
    }
    const claimed = new Set(attempt?.postIds ?? []);
    results.push(...chunk.filter((c) => !claimed.has(c.postId)).map((c) => result(c.postId, "skipped", STATE_TEXT.in_progress)));
    if (!attempt) continue;
    const run = await runAttempt(attempt, api, deps, false);
    results.push(...run.results);
    if (run.failure && stopsSending(run.failure)) stopped = true;
  }
  return { clientName: target.client.name, results };
}

/** Bizonytalan kísérlet ismétlése: ugyanaz a kulcs, ugyanaz a TÁROLT törzs. */
export async function repeatAttempt(
  input: { profileId: string; attemptId: string; refs: SendTargetRef[] }, deps: SendDeps,
): Promise<{ clientName: string; results: SendResult[] }> {
  const now = deps.now ?? Date.now;
  const [attempt] = await deps.store.getAttempts([input.attemptId]);
  if (!attempt || attempt.profileId !== input.profileId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ez a küldés nem található." });
  }
  if (attempt.status === "sent" || attempt.status === "failed") {
    throw new TRPCError({ code: "CONFLICT", message: "Ez a küldés közben lezárult. Nyisd meg újra az ablakot." });
  }
  const state = attemptState(attempt, now());
  if (state === "in_progress") throw new TRPCError({ code: "CONFLICT", message: STATE_TEXT.in_progress });
  if (state === "uncertain_expired") throw new TRPCError({ code: "CONFLICT", message: STATE_TEXT.uncertain_expired });

  const { api, config, targets } = await loadTargets(input.refs, deps, now() + SEND_BUDGET_MS);
  const target = targets.find((t) => t.client.id === attempt.socialHubClientId);
  if (!target || hashUrl(config.baseUrl) !== attempt.baseUrlHash) {
    throw new TRPCError({ code: "CONFLICT", message: "Közben megváltozott a kapcsolat vagy a párosítás, ezért ez most nem ismételhető." });
  }
  const runToken = nanoid();
  const lastTriedAt = new Date(now());
  if (!(await deps.store.reclaim(attempt.id, attempt.runToken, runToken, lastTriedAt))) {
    throw new TRPCError({ code: "CONFLICT", message: STATE_TEXT.in_progress });
  }
  const run = await runAttempt({ ...attempt, runToken, lastTriedAt }, api, deps, true);
  return { clientName: target.client.name, results: run.results };
}
