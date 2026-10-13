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

const LINKEDIN_API = "https://api.linkedin.com/v2";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
type ImageLoader = (url: string) => Promise<{ data: Uint8Array; contentType: string }>;

/** Kép letöltése feltöltéshez — SSRF-védett (safeFetch), méret- és típusellenőrzéssel. */
async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string }> {
  const { safeFetch } = await import("./_core/safeFetch");
  const res = await safeFetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`A poszt képe nem tölthető le (HTTP ${res.status})`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) throw new Error("A poszt képe nem kép formátumú");
  const data = new Uint8Array(await res.arrayBuffer());
  if (data.byteLength > MAX_IMAGE_BYTES) throw new Error("A poszt képe túl nagy (max. 10 MB)");
  return { data, contentType };
}

/**
 * Kép feltöltése a LinkedIn-re (dokumentált 3 lépés: registerUpload → bináris
 * feltöltés → az `asset` URN a posztban). Az `originalUrl` CSAK link (ARTICLE)
 * megosztásnál érvényes — képpel eddig a poszt hibára futott.
 * https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 */
async function uploadLinkedInImage(f: FetchLike, accessToken: string, owner: string, imageUrl: string, loadImage: ImageLoader): Promise<string> {
  const reg = await f(`${LINKEDIN_API}/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner,
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  });
  if (!reg.ok) throw new Error(`LinkedIn API error: ${reg.status} – képfeltöltés regisztrálása: ${await reg.text()}`);
  const regData = await reg.json() as any;
  const uploadUrl: string | undefined = regData?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const asset: string | undefined = regData?.value?.asset;
  if (!uploadUrl || !asset) throw new Error("LinkedIn API error: a képfeltöltés regisztrációja nem adott feltöltési címet");

  const image = await loadImage(imageUrl);
  const send = (method: "PUT" | "POST") => f(uploadUrl, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": image.contentType },
    body: image.data as unknown as BodyInit,
  });
  // A dokumentáció szövege POST-ot ír, a példája (curl --upload-file) PUT-ot — mindkettőt elfogadjuk.
  let up = await send("PUT");
  if (up.status === 405) up = await send("POST");
  if (!up.ok) throw new Error(`LinkedIn API error: ${up.status} – kép feltöltése: ${await up.text()}`);
  return asset;
}

export async function publishToLinkedIn(
  accessToken: string,
  authorId: string,
  text: string,
  imageUrl?: string,
  deps: { fetch?: FetchLike; loadImage?: ImageLoader } = {},
): Promise<{ postId: string }> {
  const f: FetchLike = deps.fetch ?? fetch;
  const author = `urn:li:person:${authorId}`;
  const asset = imageUrl ? await uploadLinkedInImage(f, accessToken, author, imageUrl, deps.loadImage ?? downloadImage) : null;

  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: asset ? "IMAGE" : "NONE",
        ...(asset && { media: [{ status: "READY", media: asset }] }),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const response = await f(`${LINKEDIN_API}/ugcPosts`, {
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
  // 201 Created: az azonosító az X-RestLi-Id fejlécben jön, a törzs üres is lehet.
  // Eddig response.json() → üres törzsnél kivétel a SIKERES poszt után → a felület
  // hibát mutatott, az újrapróbálás pedig duplán posztolt. Sikernél soha nem dobunk.
  let postId = response.headers.get("x-restli-id") ?? "";
  if (!postId) {
    try {
      const raw = await response.text();
      postId = raw ? String(JSON.parse(raw)?.id ?? "") : "";
    } catch { /* üres/nem-JSON törzs — a poszt ettől még létrejött */ }
  }
  if (!postId) console.warn("[LinkedIn] A poszt létrejött, de nem jött vissza azonosító.");
  return { postId };
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
