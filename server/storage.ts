/**
 * G2A Growth Engine – Storage helper (Vercel Blob)
 *
 * Korábban a Manus Forge S3 proxy-t használta. Mostantól Vercel Blob —
 * a Vercel saját asset storage szolgáltatása, amely:
 * - Vercel deploy-okon automatikusan elérhető
 * - Publikus URL-t ad vissza (CDN-en keresztül szolgáltatva)
 * - BLOB_READ_WRITE_TOKEN env változót használ (Vercel UI állítja be)
 *
 * Ha a BLOB_READ_WRITE_TOKEN nincs beállítva (pl. lokális dev DB nélkül),
 * a put() értelmes hibát dob a hívási helyen.
 *
 * API kompatibilitás: a storagePut() ugyanazt a { key, url } shape-et
 * adja vissza mint korábban, így a hívók (image generation, brand asset
 * upload) változatlanul működnek.
 */
import { put } from "@vercel/blob";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Feltölt egy fájlt Vercel Blob-ra publikus elérési URL-lel.
 *
 * @param relKey  Logikai elérési útvonal (pl. "brand-assets/profile-1/abc.pdf")
 * @param data    Buffer / Uint8Array / string
 * @param contentType  MIME type, default application/octet-stream
 * @returns { key, url } — a key megegyezik a normalizált input-tal,
 *          az url egy publikus Vercel Blob URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  // Vercel Blob put() expects Buffer, Blob, ReadableStream, or File —
  // a Uint8Array-t Buffer.from-mal Buffer-ré alakítjuk.
  const body: Buffer | string =
    typeof data === "string"
      ? data
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data);
  const blob = await put(key, body, {
    access: "public",
    contentType,
    // addRandomSuffix=false: a felhasználó által megadott útvonal stabil maradjon
    // (egyébként Vercel Blob -<random> sufflixet ad minden uploadhoz)
    addRandomSuffix: false,
    // allowOverwrite: ugyanazzal a key-jel újra feltöltve felülír
    allowOverwrite: true,
  });
  return { key, url: blob.url };
}

/**
 * Vercel Blob URLs publikusak — nincs külön "get" hívás, a fenti
 * storagePut() return-jében kapott URL-t lehet közvetlenül használni.
 * Backward compatibility: az eddigi callers (ha volt) megkapják ugyanazt
 * a key + URL párt, de a key alapján csak a feltöltéskor érhető el az
 * URL — ezt frissíteni kell a hívóknak (jelenleg csak storagePut van
 * használva a kódbázisban).
 */
export async function storageGet(_relKey: string): Promise<{ key: string; url: string }> {
  throw new Error(
    "storageGet() not supported with Vercel Blob — use the URL returned by storagePut() and store it in your DB.",
  );
}
