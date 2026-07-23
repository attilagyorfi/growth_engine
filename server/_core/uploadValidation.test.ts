/**
 * Unit tesztek az upload validáció-helper hardening logikájához.
 * `pnpm exec vitest run server/_core/uploadValidation.test.ts`
 */
import { describe, it, expect } from "vitest";
import { sanitizeFileName, assertMimeMatchesContent, validateUpload, MAX_UPLOAD_SIZE } from "./uploadValidation";

// Magic byte fixture-ök — a valós fájlok első pár byte-ja
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
const JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from("RIFF"), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from("WEBP"), Buffer.from([0x00])
]);
const FAKE_PNG_ACTUALLY_HTML = Buffer.from("<script>alert(1)</script>");

describe("sanitizeFileName", () => {
  it("removes path traversal segments", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
  });
  it("removes backslashes (Windows paths)", () => {
    expect(sanitizeFileName("..\\..\\Windows\\system32.dll")).not.toContain("\\");
  });
  it("keeps allowed characters", () => {
    expect(sanitizeFileName("brand-guide_v2.pdf")).toBe("brand-guide_v2.pdf");
  });
  it("replaces unsafe characters with underscore (ékezet + szóköz cserél)", () => {
    // Az "Á", "í", "ű", "ő", "ü", "ó", "é" és a szóköz cserélődik, az r/v/z/t/k stb. marad
    expect(sanitizeFileName("Árvíztűrő tükörfúrógép.pdf")).toBe("_rv_zt_r__t_k_rf_r_g_p.pdf");
  });
  it("caps length at 200 characters preserving extension", () => {
    const long = "a".repeat(300) + ".pdf";
    const result = sanitizeFileName(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
  });
  it("returns 'unnamed' for empty input", () => {
    expect(sanitizeFileName("")).toBe("unnamed");
    // "///" → az /[\/\\]+/g regex `+` miatt egyetlen underscore-ra collapse-ol
    expect(sanitizeFileName("///")).toBe("_");
  });
});

describe("assertMimeMatchesContent", () => {
  it("accepts valid PDF magic bytes", () => {
    expect(() => assertMimeMatchesContent("application/pdf", PDF_HEADER)).not.toThrow();
  });
  it("accepts valid PNG magic bytes", () => {
    expect(() => assertMimeMatchesContent("image/png", PNG_HEADER)).not.toThrow();
  });
  it("accepts valid JPEG magic bytes", () => {
    expect(() => assertMimeMatchesContent("image/jpeg", JPEG_HEADER)).not.toThrow();
  });
  it("accepts valid WebP RIFF+WEBP fejlécet", () => {
    expect(() => assertMimeMatchesContent("image/webp", WEBP_HEADER)).not.toThrow();
  });
  it("rejects fake PNG with HTML content (XSS vector)", () => {
    expect(() => assertMimeMatchesContent("image/png", FAKE_PNG_ACTUALLY_HTML))
      .toThrow(/nem felel meg/);
  });
  it("rejects file too short for magic byte check", () => {
    expect(() => assertMimeMatchesContent("application/pdf", Buffer.from([0x25, 0x50])))
      .toThrow(/túl rövid/);
  });
  it("skips magic check for text/plain (nincs magic byte)", () => {
    expect(() => assertMimeMatchesContent("text/plain", Buffer.from("Simple text")))
      .not.toThrow();
  });
});

describe("validateUpload", () => {
  it("rejects empty file", () => {
    expect(() => validateUpload("brand_guide", "application/pdf", Buffer.alloc(0)))
      .toThrow(/üres/);
  });
  it("rejects file over 10 MB", () => {
    const oversize = Buffer.concat([PDF_HEADER, Buffer.alloc(MAX_UPLOAD_SIZE)]);
    expect(() => validateUpload("brand_guide", "application/pdf", oversize))
      .toThrow(/túl nagy/);
  });
  it("rejects unknown asset type", () => {
    expect(() => validateUpload("malicious_type", "application/pdf", PDF_HEADER))
      .toThrow(/Ismeretlen asset-típus/);
  });
  it("rejects SVG upload (XSS vector) via MIME whitelist", () => {
    // image/svg+xml NINCS az ALLOWED_MIMES_BY_ASSET egyik listájában sem
    expect(() => validateUpload("visual_identity", "image/svg+xml", PNG_HEADER))
      .toThrow(/csak.*formátum engedélyezett/);
  });
  it("rejects HTML upload (XSS vector) via MIME whitelist", () => {
    expect(() => validateUpload("brand_guide", "text/html", PDF_HEADER))
      .toThrow(/csak.*formátum engedélyezett/);
  });
  it("rejects .exe uploaded as PDF (spoofed Content-Type)", () => {
    const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03]); // MZ (PE executable)
    expect(() => validateUpload("brand_guide", "application/pdf", exeHeader))
      .toThrow(/nem felel meg/);
  });
  it("accepts valid PDF as brand_guide", () => {
    expect(() => validateUpload("brand_guide", "application/pdf", PDF_HEADER))
      .not.toThrow();
  });
  it("accepts valid PNG as visual_identity", () => {
    expect(() => validateUpload("visual_identity", "image/png", PNG_HEADER))
      .not.toThrow();
  });
});
