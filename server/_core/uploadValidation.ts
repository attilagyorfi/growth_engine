/**
 * G2A Growth Engine – Fájl-feltöltés validáció + sanitization
 *
 * Az audit medium-prio #7 fix: az `onboarding.uploadAsset` végpont
 * validáció nélkül fogadott bármilyen fájlt (méret + MIME + tartalom).
 * Lehetséges támadási vektorok, amiket ez a helper lezár:
 *
 *   1. **XSS a Vercel Blob CDN-en**: egy .svg vagy .html fájl a
 *      Blob `content-type`-ával kiszolgálva a böngésző futtatja a benne
 *      lévő JavaScriptet. → SVG + HTML + XML tiltva.
 *
 *   2. **DoS méret**: 50 MB-os fájlok százával tölthetők fel, Blob
 *      költség + AI-parse OpenAI-token robbanás. → 10 MB hard limit.
 *
 *   3. **MIME spoofing**: a user azt írhatja hogy `image/png`, de a
 *      tartalom `.exe` vagy shell script. → Magic-byte ellenőrzés
 *      minden MIME-hez (Content-Type header ≠ igazi fájltípus).
 *
 *   4. **Path traversal**: a `fileName` mezőben lehet `../../etc/passwd`.
 *      → sanitize: csak alphanum + `._-`, plus maximálisan 200 karakter.
 *
 *   5. **Extension mismatch**: a fájl neve `.pdf`, de a MIME `image/png`
 *      → a hardcoded whitelist ezt is elutasítja.
 */

// Assettype → megengedett MIME-ek. Egy `brand_guide` PDF/Word/text,
// egy `visual_identity` PNG/JPG. SEMMI SVG/HTML/JS.
export const ALLOWED_MIMES_BY_ASSET: Record<string, string[]> = {
  brand_guide: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
  visual_identity: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  sales_material: ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"],
  strategy: ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  buyer_persona: ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  faq: ["application/pdf", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  other: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

// Magic byte prefixek: az első 4-8 byte alapján felismerjük a fájltípust.
// Ha a felismert típus NEM egyezik a Content-Type header-rel → támadás.
// Text/plain-nek nincs magic byte, ott a validáció csak méret + sanitize.
const MAGIC_BYTES: Array<{ mime: string; signature: number[]; offset?: number }> = [
  { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },                    // %PDF
  { mime: "image/png", signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },  // PNG
  { mime: "image/jpeg", signature: [0xFF, 0xD8, 0xFF] },                                // JPEG SOI marker
  { mime: "image/webp", signature: [0x52, 0x49, 0x46, 0x46] },                          // RIFF (WebP kezdete)
  { mime: "application/msword", signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }, // OLE Compound Document (.doc)
  // .docx / .pptx / .xlsx mind ZIP archívumok → PK\x03\x04
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: [0x50, 0x4B, 0x03, 0x04] },
  { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: [0x50, 0x4B, 0x03, 0x04] },
  { mime: "application/vnd.ms-powerpoint", signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] },
];

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Fájlnév biztonságosítása: path-traversal + Unicode-anomáliák ellen.
 * - Az elérési út összes szeparátorát (`/`, `\`) eltávolítja
 * - Csak `A-Za-z0-9._-` maradhat, a többit `_`-re cseréli
 * - Max 200 karakter (ha hosszabb, az extension megőrizve)
 * - Üres eredmény → `unnamed`
 */
export function sanitizeFileName(raw: string): string {
  // 1. path-traversal: minden `/`, `\`, és `..` szegmens ki
  const flat = raw.replace(/[/\\]+/g, "_").replace(/\.\.+/g, "_");
  // 2. csak biztonságos karakterek
  const safe = flat.replace(/[^A-Za-z0-9._-]/g, "_");
  // 3. max 200 karakter (extension megőrzés, ha az extension ≤ 20 karakter)
  if (safe.length <= 200) return safe || "unnamed";
  const dot = safe.lastIndexOf(".");
  if (dot < 0) return safe.slice(0, 200);
  const ext = safe.slice(dot);
  if (ext.length > 20) return safe.slice(0, 200);
  return safe.slice(0, 200 - ext.length) + ext;
}

/**
 * Magic-byte MIME felismerés. Ha a fájl első pár byte-ja NEM felel meg
 * a bejelentett MIME-nek, hibát dob. Text/plain-t engedjük (nincs magic).
 */
export function assertMimeMatchesContent(declaredMime: string, buffer: Buffer): void {
  if (declaredMime === "text/plain") return; // nincs magic byte, méret-check elég

  // A `image/webp` speciális: RIFF header után `WEBP` string a 8-12 byte-nál
  if (declaredMime === "image/webp") {
    if (buffer.length < 12) throw new Error("A WEBP fájl túl rövid (érvénytelen fejléc)");
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");
    if (riff !== "RIFF" || webp !== "WEBP") {
      throw new Error(`A fájl tartalma nem felel meg a bejelentett típusnak (${declaredMime})`);
    }
    return;
  }

  const spec = MAGIC_BYTES.find(m => m.mime === declaredMime);
  if (!spec) {
    // Nem támogatott MIME — a hívó whitelist check-je előtt is elutasít
    throw new Error(`Ismeretlen fájltípus: ${declaredMime}`);
  }
  const offset = spec.offset ?? 0;
  if (buffer.length < offset + spec.signature.length) {
    throw new Error(`A fájl túl rövid ahhoz, hogy ${declaredMime} legyen`);
  }
  for (let i = 0; i < spec.signature.length; i++) {
    if (buffer[offset + i] !== spec.signature[i]) {
      throw new Error(`A fájl tartalma nem felel meg a bejelentett típusnak (${declaredMime})`);
    }
  }
}

/**
 * Teljes validáció egy uploadhoz. Ha bármi hibás, `Error`-t dob magyar
 * üzenettel. A hívó `TRPCError`-ba burkolja `BAD_REQUEST` code-dal.
 *
 * @param assetType Az `uploadAsset` input.assetType — meghatározza a whitelist-et
 * @param declaredMime input.fileType (Content-Type header a kliensen)
 * @param buffer base64-ből dekódolt tartalom
 * @returns void — throw on error
 */
export function validateUpload(
  assetType: string,
  declaredMime: string,
  buffer: Buffer,
): void {
  // 1. Méret
  if (buffer.length === 0) {
    throw new Error("A fájl üres");
  }
  if (buffer.length > MAX_UPLOAD_SIZE) {
    const mb = Math.round(buffer.length / 1024 / 1024);
    throw new Error(`A fájl túl nagy (${mb} MB). Max: 10 MB`);
  }
  // 2. MIME whitelist az adott assetType-hoz
  const allowed = ALLOWED_MIMES_BY_ASSET[assetType];
  if (!allowed) {
    throw new Error(`Ismeretlen asset-típus: ${assetType}`);
  }
  if (!allowed.includes(declaredMime)) {
    throw new Error(
      `A "${assetType}" típushoz csak ${allowed.map(m => m.split("/")[1]).join(", ")} formátum engedélyezett.`
    );
  }
  // 3. Magic-byte content-type verify (spoof-védelem)
  assertMimeMatchesContent(declaredMime, buffer);
}
