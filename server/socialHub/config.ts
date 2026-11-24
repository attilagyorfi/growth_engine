/**
 * A Social Hub-kapcsolat EGYETLEN feloldója (metrika-szinkron, párosítás, küldés).
 *
 * Elsőbbség: tárolt kapcsolat (socialHub/store.ts) > env (SOCIAL_HUB_API_URL / _KEY)
 * > nincs beállítva (fail-closed). Ha a tárolt sor nem olvasható vagy a kulcsa nem
 * fejthető vissza, hiba — szándékosan NINCS env-visszaesés, különben a küldés
 * észrevétlenül másik szervezethez mehetne.
 */
import { decryptToken, encryptToken } from "../_core/tokenCrypto";
import { getSocialHubConfig, type SocialHubConfig } from "./client";
import { getSocialHubStore, type StoredConnection } from "./store";

export const SOCIAL_HUB_RESOLVE_ERROR = "A mentett Social Hub-kapcsolat nem olvasható. Add meg újra a Beállításokban.";
const ENC_PREFIX = "enc:v1:";

export type SocialHubResolution =
  | { status: "ok"; source: "stored" | "env"; config: SocialHubConfig }
  | { status: "not_configured" }
  | { status: "error" };

export type ResolveDeps = {
  getConnection?: () => Promise<Pick<StoredConnection, "baseUrl" | "apiKeyEnc"> | null>;
  env?: Record<string, string | undefined>;
};

export async function resolveSocialHubConfig(deps: ResolveDeps = {}): Promise<SocialHubResolution> {
  let stored: Pick<StoredConnection, "baseUrl" | "apiKeyEnc"> | null;
  try {
    stored = await (deps.getConnection ?? (async () => (await getSocialHubStore()?.getConnection()) ?? null))();
  } catch {
    console.error("[socialHub] a tárolt kapcsolat nem olvasható");
    return { status: "error" };
  }
  if (stored) {
    const apiKey = stored.apiKeyEnc.startsWith(ENC_PREFIX) ? decryptToken(stored.apiKeyEnc) : null;
    // Kulcs (JWT_SECRET) nélkül a decryptToken a titkosított alakot adja vissza.
    if (!apiKey || apiKey.startsWith(ENC_PREFIX)) return { status: "error" };
    return { status: "ok", source: "stored", config: { baseUrl: stored.baseUrl, apiKey, source: "stored" } };
  }
  const env = getSocialHubConfig(deps.env ?? process.env);
  return env ? { status: "ok", source: "env", config: { ...env, source: "env" } } : { status: "not_configured" };
}

/** Titkosítja a kulcsot; null, ha nem lehet (JWT_SECRET nélkül az encryptToken nyers szöveget adna). */
export function encryptApiKey(apiKey: string): string | null {
  if (apiKey.startsWith(ENC_PREFIX)) return null;
  const enc = encryptToken(apiKey);
  return enc.startsWith(ENC_PREFIX) ? enc : null;
}
