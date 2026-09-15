/**
 * G2A Growth Engine – token-titkosítás (tokenCrypto) unit-teszt.
 *
 * A JWT_SECRET-et a modul betöltése ELŐTT állítjuk be (dinamikus import a
 * beforeAll-ban), hogy a valós kulccsal fusson a round-trip.
 */
import { describe, it, expect, beforeAll } from "vitest";

let encryptToken: (s: string | null | undefined) => string | null;
let decryptToken: (s: string | null | undefined) => string | null;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-000000";
  const mod = await import("./_core/tokenCrypto");
  encryptToken = mod.encryptToken;
  decryptToken = mod.decryptToken;
});

describe("tokenCrypto", () => {
  it("round-trip: a visszafejtés visszaadja az eredetit", () => {
    const secret = "ya29.a0AfH-SUPER-TITKOS-TOKEN_123";
    const enc = encryptToken(secret)!;
    expect(enc).not.toBe(secret);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(decryptToken(enc)).toBe(secret);
  });

  it("ugyanaz a bemenet KÜLÖNBÖZŐ titkosítottat ad (random IV), de mindkettő visszafejthető", () => {
    const a = encryptToken("token")!;
    const b = encryptToken("token")!;
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("token");
    expect(decryptToken(b)).toBe("token");
  });

  it("nem titkosít duplán (már titkosított bemenet változatlan)", () => {
    const enc = encryptToken("token")!;
    expect(encryptToken(enc)).toBe(enc);
  });

  it("legacy: prefix nélküli (plaintext) tokent változatlanul visszaad", () => {
    expect(decryptToken("legacy-plaintext-token")).toBe("legacy-plaintext-token");
  });

  it("null / üres kezelése", () => {
    expect(encryptToken(null)).toBe(null);
    expect(encryptToken(undefined)).toBe(null);
    expect(encryptToken("")).toBe("");
    expect(decryptToken(null)).toBe(null);
    expect(decryptToken("")).toBe("");
  });

  it("sérült ciphertext → null (nem dob, nem szivárog)", () => {
    expect(decryptToken("enc:v1:AAAA:BBBB:CCCC")).toBe(null);
  });
});
