/**
 * Content Studio-poszt → Social Hub-vázlat (POST /clients/{id}/drafts) — tiszta függvények.
 *
 * Csak a szerződés mezői mennek ki. A köteg a Social Hubban atomi (egy hibás vázlat az egész
 * darabot elbuktatja), ezért minden posztot előre, helyben ellenőrzünk.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ContentPost } from "../../drizzle/schema";
import { composePostText } from "../publishing";

export const MAX_DRAFTS_PER_REQUEST = 50;
export const MAX_BODY_BYTES = 1_000_000;
export const MAX_TEXT_LENGTH = 63_206;
const MAX_LABEL_LENGTH = 100;
const MAX_MEDIA_URL_LENGTH = 2048;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

const notBlank = (v: string) => v.trim().length > 0;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const label = z.string().max(MAX_LABEL_LENGTH).refine(notBlank);
const text = z.string().max(MAX_TEXT_LENGTH).refine(notBlank);

/** A kimenő vázlat szerződése (a Social Hub draftInput sémájának tükre). */
export const outboundDraftSchema = z.object({
  text,
  targets: z.array(z.object({ social_account_id: uuid, text: text.optional() }).strict()).min(1).max(15),
  suggested_at: z.string().datetime({ offset: true }).optional(),
  media_urls: z.array(z.string().max(MAX_MEDIA_URL_LENGTH).refine(isPublicHttpsUrl)).max(10).optional(),
  pillar: label.optional(),
  source: label.optional(),
}).strict();
export type OutboundDraft = z.infer<typeof outboundDraftSchema>;

export const isUuid = (v: string) => uuid.safeParse(v).success;

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Legfeljebb `max` UTF-16 egység, emoji közepén nem vágva. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

export type DraftContent = Omit<OutboundDraft, "targets">;
export type PostContent =
  | { ok: true; content: DraftContent; hash: string; imageDropped: boolean; pillarShortened: boolean }
  | { ok: false };

/**
 * A tartalom hash-e. Az összetétel nem változhat: a naplózott sentHash-ek ezzel készültek,
 * eltérésnél minden korábbi küldés „módosítottnak” látszana.
 */
export function hashDraftContent(content: DraftContent, platform: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["v1", content.text, platform, content.suggested_at ?? null, content.media_urls?.[0] ?? null, content.pillar ?? null]))
    .digest("hex");
}

/** A poszt célfiók nélküli tartalma és hash-e (a fiók cseréje nem számít változásnak). */
export function buildPostContent(
  post: Pick<ContentPost, "content" | "hashtags" | "platform" | "scheduledAt" | "imageUrl" | "pillar">,
): PostContent {
  const body = composePostText(post.content, post.hashtags);
  if (!text.safeParse(body).success) return { ok: false };
  const image = post.imageUrl?.trim() || null;
  const imageOk = image !== null && image.length <= MAX_MEDIA_URL_LENGTH && isPublicHttpsUrl(image);
  const fullPillar = post.pillar?.trim() || null;
  const pillar = fullPillar ? truncate(fullPillar, MAX_LABEL_LENGTH).trim() : null;
  const suggestedAt = post.scheduledAt && !Number.isNaN(post.scheduledAt.getTime()) ? post.scheduledAt.toISOString() : null;
  const content: DraftContent = {
    text: body,
    ...(suggestedAt ? { suggested_at: suggestedAt } : {}),
    ...(imageOk ? { media_urls: [image] } : {}),
    ...(pillar ? { pillar } : {}),
    source: "growth_engine",
  };
  return { ok: true, content, hash: hashDraftContent(content, post.platform), imageDropped: image !== null && !imageOk, pillarShortened: pillar !== fullPillar };
}

/** Kész vázlat a célfiókkal; null, ha nem felel meg a szerződésnek. */
export function buildDraft(content: DraftContent, socialAccountId: string): OutboundDraft | null {
  const parsed = outboundDraftSchema.safeParse({ ...content, targets: [{ social_account_id: socialAccountId }] });
  return parsed.success ? parsed.data : null;
}

export const buildDraftsBody = (drafts: unknown[]) => JSON.stringify({ drafts });

/** Darabolás: legfeljebb 50 vázlat és ≤1 MB (bájtban mért) törzs darabonként, sorrendtartóan. */
export function chunkDrafts<T extends { draft: unknown }>(items: T[], maxBytes = MAX_BODY_BYTES): T[][] {
  const base = Buffer.byteLength(buildDraftsBody([]));
  const chunks: T[][] = [];
  let size = 0;
  for (const item of items) {
    const bytes = Buffer.byteLength(JSON.stringify(item.draft)) + 1; // + elválasztó vessző
    const current = chunks[chunks.length - 1];
    if (!current || current.length >= MAX_DRAFTS_PER_REQUEST || size + bytes > maxBytes) {
      chunks.push([item]);
      size = base + bytes;
    } else {
      current.push(item);
      size += bytes;
    }
  }
  return chunks;
}

const budapestMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit" });

/** A poszt időpontja az adott hónapban van-e (YYYY-MM, Europe/Budapest). */
export function isInBudapestMonth(date: Date | null | undefined, month: string): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  const parts = budapestMonth.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}` === month;
}
