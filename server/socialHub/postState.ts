/**
 * A Social Hub-poszt állapota az eseményekből (G2) — tiszta függvények.
 *
 * Az események sorrendje nem garantált, ezért az eredmény csak az események halmazától függ:
 *   - külön tároljuk a legutóbbi nem hibás eseményt és a legutóbbi hibát;
 *   - ha a poszt valaha megjelent, a hiba soha nem érvényes (a közbeeső események sem bontják meg);
 *   - régebbi nem ír felül újabbat, azonos időnél a rangsor dönt.
 */
export const SOCIAL_HUB_EVENT_STATUS = {
  "post.approved": "approved",
  "post.changes_requested": "changes_requested",
  "post.published": "published",
  "post.failed": "failed",
} as const;
export type SocialHubEventType = keyof typeof SOCIAL_HUB_EVENT_STATUS;
export type SocialHubPostStatus = (typeof SOCIAL_HUB_EVENT_STATUS)[SocialHubEventType];

export type PostStateRecord = {
  latestStatus: string | null;
  latestAtMs: number | null;
  failedAtMs: number | null;
  publishedAtMs: number | null;
};
export type VisibleState = { status: SocialHubPostStatus; atMs: number };

export const EMPTY_POST_STATE: PostStateRecord = { latestStatus: null, latestAtMs: null, failedAtMs: null, publishedAtMs: null };

const RANK: Record<SocialHubPostStatus, number> = { approved: 1, changes_requested: 2, failed: 3, published: 4 };
const isNewer = (a: VisibleState, b: VisibleState | null) =>
  !b || a.atMs > b.atMs || (a.atMs === b.atMs && RANK[a.status] > RANK[b.status]);

function latestOf(record: PostStateRecord): VisibleState | null {
  const { latestStatus, latestAtMs } = record;
  if (latestAtMs === null || latestStatus === null || !(latestStatus in RANK)) return null;
  return { status: latestStatus as SocialHubPostStatus, atMs: latestAtMs };
}

/** A felületen látszó állapot. */
export function visibleState(record: PostStateRecord): VisibleState | null {
  const latest = latestOf(record);
  if (record.failedAtMs === null || record.publishedAtMs !== null) return latest;
  const failed: VisibleState = { status: "failed", atMs: record.failedAtMs };
  return isNewer(failed, latest) ? failed : latest;
}

/** Az esemény utáni rekord; `applied`, ha a látszó állapot ettől az eseménytől változott meg. */
export function applyEvent(record: PostStateRecord, event: VisibleState): { record: PostStateRecord; applied: boolean } {
  const next = { ...record };
  if (event.status === "failed") {
    next.failedAtMs = Math.max(event.atMs, record.failedAtMs ?? event.atMs);
  } else {
    if (isNewer(event, latestOf(record))) Object.assign(next, { latestStatus: event.status, latestAtMs: event.atMs });
    if (event.status === "published") next.publishedAtMs = Math.min(event.atMs, record.publishedAtMs ?? event.atMs);
  }
  const before = visibleState(record);
  const after = visibleState(next);
  const changed = after?.status !== before?.status || after?.atMs !== before?.atMs;
  return { record: next, applied: changed && after?.status === event.status && after.atMs === event.atMs };
}
