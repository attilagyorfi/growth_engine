/**
 * G2A Growth Engine – Image generation (OpenAI DALL-E 3)
 *
 * Korábban a Manus Forge proxyt használta, ami DALL-E 2/3-at közvetített.
 * Mostantól közvetlenül az OpenAI Images API-t hívjuk a meglévő
 * OPENAI_API_KEY-vel — nincs Manus-függőség.
 *
 * Modell: dall-e-3 (1024x1024, standard quality). Image-to-image edit
 * (originalImages opció) NEM támogatott DALL-E 3-ban — ha valaki ezt
 * a path-et hívja, a prompt-ba szövegesen építjük a referenciát.
 *
 * Példa hívás:
 *   const { url } = await generateImage({ prompt: "A serene landscape" });
 *
 * Költség: ~$0.04 / 1024x1024 standard kép (2026 árazás szerint).
 */
import { storagePut } from "../storage";
import { ENV } from "./env";

// DALL-E 3 a 3 méretet támogatja — minden közösségi média formátum ezek
// közül a "legközelebbire" mappelendő (lásd PLATFORM_IMAGE_SIZE alább).
export type DalleSize = "1024x1024" | "1024x1792" | "1792x1024";

export type GenerateImageOptions = {
  prompt: string;
  size?: DalleSize;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

// Platform → DALL-E 3 méret mapping. Ezzel az AI-generált kép azonnali
// arányban érkezik a kiválasztott közösségi platformnak. A "platform"
// érték a tartalomkészítő UI-jából érkezik (linkedin / facebook /
// instagram_post / instagram_story / tiktok / twitter / square).
export const PLATFORM_IMAGE_SIZE: Record<string, DalleSize> = {
  linkedin: "1024x1024",          // LinkedIn poszt 1:1 (1200x1200 közelítés)
  facebook: "1024x1024",          // Facebook poszt 1:1 (1200x1200 közelítés)
  instagram: "1024x1024",         // Instagram alapértelmezett 1:1
  instagram_post: "1024x1024",    // 1080x1080
  instagram_story: "1024x1792",   // 9:16 story / reel (1080x1920)
  tiktok: "1024x1792",            // TikTok 9:16
  twitter: "1792x1024",           // X/Twitter link share 16:9 (1200x675)
  x: "1792x1024",
  youtube_thumbnail: "1792x1024", // 16:9 thumbnail
  blog: "1792x1024",              // blog header 16:9
  square: "1024x1024",
};

export type GenerateImageResponse = {
  url?: string;
};

const OPENAI_IMAGES_ENDPOINT_DEFAULT = "https://api.openai.com/v1/images/generations";

function resolveImagesEndpoint(): string {
  // Ha valaki OpenAI-kompatibilis proxy-t (pl. Azure OpenAI, Together)
  // használ az OPENAI_API_URL env-vel, azt is támogatjuk.
  const base = ENV.openaiApiUrl?.trim().replace(/\/+$/, "");
  if (base && base.length > 0 && base !== "https://api.openai.com") {
    return `${base}/v1/images/generations`;
  }
  return OPENAI_IMAGES_ENDPOINT_DEFAULT;
}

export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error(
      "Image generation requires OPENAI_API_KEY. Set it in your environment.",
    );
  }

  // DALL-E 3 nem támogatja az image-to-image edit-et — ha originalImages
  // van adva, a prompt-ba szövegesen utalunk rá hogy a felhasználó tudja.
  const hasReference = options.originalImages && options.originalImages.length > 0;
  const finalPrompt = hasReference
    ? `${options.prompt}\n\n(Reference image style was provided; recreate a similar composition.)`
    : options.prompt;

  const size = options.size ?? "1024x1024";
  const response = await fetch(resolveImagesEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    );
  }

  const result = (await response.json()) as {
    created: number;
    data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
  };

  const item = result.data?.[0];
  if (!item) {
    throw new Error("OpenAI image generation returned no data");
  }

  // b64_json formátum: dekódoljuk, feltöltjük Vercel Blob-ra, és visszaadjuk
  // a publikus URL-t. (Az OpenAI saját URL-je csak 1 órán át él, ezért tárolnunk kell.)
  if (item.b64_json) {
    const buffer = Buffer.from(item.b64_json, "base64");
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      "image/png",
    );
    return { url };
  }

  // Fallback: ha valamiért URL-t kaptunk vissza (nem szokványos a fenti
  // response_format: "b64_json" miatt, de védendő)
  if (item.url) {
    return { url: item.url };
  }

  throw new Error("OpenAI image generation returned no usable image data");
}
