/**
 * G2A Growth Engine – Social Media Publisher
 *
 * Támogatott platformok (2026-06 állapot):
 *   - LinkedIn (UGC Posts API) — text vagy text+kép
 *   - Facebook Page (Graph API v18) — text-only vagy text+kép (photos endpoint)
 *   - Instagram Business (Graph API v18) — MUSZÁJ kép (2-step: container + publish)
 *   - TikTok — TODO (a Videókészítő 'hamarosan'-ig, mert csak videót fogad)
 *
 * A tokenek forrása: `social_connections` tábla, a facebook/instagram OAuth
 * flow-ból (server/facebookOAuth.ts). A Page-tokenek 60 napig élnek, IG-hoz
 * ugyanaz a Page-token megy (Meta dokumentum).
 */

const META_GRAPH_VERSION = "v18.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ─── LinkedIn ─────────────────────────────────────────────────────────────

export async function publishToLinkedIn(
  accessToken: string,
  authorId: string,
  text: string,
  imageUrl?: string
): Promise<{ postId: string }> {
  const body = {
    author: `urn:li:person:${authorId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: imageUrl ? "IMAGE" : "NONE",
        ...(imageUrl && {
          media: [{ status: "READY", originalUrl: imageUrl }],
        }),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LinkedIn API error: ${response.status} – ${errText}`);
  }
  const data = await response.json() as { id: string };
  return { postId: data.id };
}

// ─── Facebook Page ────────────────────────────────────────────────────────

/**
 * Facebook Page publish — kép nélkül a /feed endpoint, képpel a /photos.
 * A `pageAccessToken` a Page-hez kötött Page-token (a facebookOAuth.ts
 * /me/accounts-ból kapott per-page token).
 * A `pageId` a Facebook Page numeric ID-je.
 */
export async function publishToFacebook(
  pageAccessToken: string,
  pageId: string,
  text: string,
  imageUrl?: string,
): Promise<{ postId: string }> {
  const endpoint = imageUrl
    ? `${META_GRAPH_BASE}/${pageId}/photos`
    : `${META_GRAPH_BASE}/${pageId}/feed`;

  const body: Record<string, string> = { access_token: pageAccessToken };
  if (imageUrl) {
    body.url = imageUrl;
    body.caption = text;
  } else {
    body.message = text;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Facebook API error: ${response.status} – ${errText}`);
  }
  // /photos ad `id` (photo-id) + `post_id`; /feed csak `id`.
  const data = await response.json() as { id?: string; post_id?: string };
  const postId = data.post_id ?? data.id ?? "";
  if (!postId) throw new Error("Facebook API returned no post ID");
  return { postId };
}

// ─── Instagram Business ───────────────────────────────────────────────────

/**
 * Instagram Business publish — 2-step:
 *   1. Container létrehozás: POST /{ig-user-id}/media?image_url&caption
 *   2. Publish:              POST /{ig-user-id}/media_publish?creation_id
 *
 * FONTOS: az Instagram MUSZÁJ képet vagy videót — text-only nem megy.
 * A `pageAccessToken` a hozzátartozó Facebook Page-token (Meta konvenció).
 * Az `igUserId` a Business Instagram Account ID (facebookOAuth-ból).
 * Az `imageUrl` PUBLICLY REACHABLE HTTPS kell legyen (Vercel Blob OK,
 * a lekéréshez a Meta serverei odamennek).
 */
export async function publishToInstagram(
  pageAccessToken: string,
  igUserId: string,
  caption: string,
  imageUrl: string,
): Promise<{ postId: string }> {
  if (!imageUrl) {
    throw new Error("Instagram post requires an image_url — text-only posts not supported.");
  }

  // Step 1: container létrehozás
  const containerRes = await fetch(`${META_GRAPH_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: pageAccessToken,
    }).toString(),
  });
  if (!containerRes.ok) {
    const errText = await containerRes.text();
    throw new Error(`Instagram container error: ${containerRes.status} – ${errText}`);
  }
  const { id: creationId } = await containerRes.json() as { id: string };
  if (!creationId) throw new Error("Instagram API returned no creation ID");

  // Step 2: publish
  const publishRes = await fetch(`${META_GRAPH_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: pageAccessToken,
    }).toString(),
  });
  if (!publishRes.ok) {
    const errText = await publishRes.text();
    throw new Error(`Instagram publish error: ${publishRes.status} – ${errText}`);
  }
  const publishData = await publishRes.json() as { id: string };
  return { postId: publishData.id };
}
