/**
 * G2A Growth Engine – OAuth token titkosítás nyugalmi állapotban (at rest).
 *
 * A social/adat-kapcsolat accessToken/refreshToken értékei eddig plaintextként
 * kerültek a DB-be. Ez a modul AES-256-GCM-mel titkosítja őket, a JWT_SECRET-ből
 * (ENV.cookieSecret) scrypt-tel származtatott kulccsal.
 *
 * Tárolt formátum:  enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 *
 * BACKWARD-KOMPATIBILIS: a decryptToken a régi, prefix NÉLKÜLI (plaintext)
 * értékeket változatlanul visszaadja, így a meglévő tokenek deploy után is
 * működnek. Új írások titkosítottak; a tokenek a következő refresh/újracsatlakozás
 * során fokozatosan átállnak titkosítottra. Nincs szükség adat-migrációra.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { ENV } from "./env";

const PREFIX = "enc:v1:";
let _key: Buffer | null = null;

function getKey(): Buffer {
  if (_key) return _key;
  const secret = ENV.cookieSecret || "";
  if (!secret) {
    // Nincs kulcs (pl. lokális dev JWT_SECRET nélkül) — figyelmeztetünk, és
    // passthrough-ba esünk. Productionban a JWT_SECRET kötelező (env.ts fail-fast).
    console.warn("[tokenCrypto] JWT_SECRET hiányzik — a tokenek NEM titkosítottak (csak dev/teszt).");
    _key = Buffer.alloc(0);
    return _key;
  }
  _key = scryptSync(secret, "g2a-token-enc-v1", 32);
  return _key;
}

/** Titkosít egy tokent. Üres/null → változatlan; már titkosított → változatlan. */
export function encryptToken(plain: string): string;
export function encryptToken(plain: string | null | undefined): string | null;
export function encryptToken(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return plain ?? null;
  if (plain.startsWith(PREFIX)) return plain; // már titkosított — ne duplán
  const key = getKey();
  if (key.length === 0) return plain; // dev passthrough
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Visszafejt egy tokent. Prefix nélküli (legacy plaintext) → változatlan. */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return stored ?? null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getKey();
  if (key.length === 0) return stored; // nincs kulcs — nem tudjuk visszafejteni
  try {
    const parts = stored.split(":"); // [enc, v1, iv, tag, data]
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const data = Buffer.from(parts[4], "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (e) {
    console.error("[tokenCrypto] visszafejtés sikertelen:", e);
    return null;
  }
}
