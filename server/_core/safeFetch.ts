/**
 * G2A Growth Engine — SSRF-védett fetch
 *
 * A szerver több helyen letölt egy FELHASZNÁLÓ által megadott URL-t (SEO audit,
 * onboarding website/social scrape). Validáció nélkül ez SSRF: a támadó a
 * szervert a felhő-metadata endpointra (169.254.169.254), a localhostra vagy a
 * belső hálózatra irányíthatja, és a válasz vissza is tükröződik.
 *
 * Ez a helper:
 *   - csak http/https sémát enged,
 *   - feloldja a hostname-t, és MINDEN feloldott IP-t ellenőriz a privát /
 *     loopback / link-local / metadata / CGNAT tartományok ellen,
 *   - a redirecteket KÉZZEL követi, és minden hopot újravalidál (különben egy
 *     publikus host 302-vel átirányíthatna egy belső címre).
 *
 * Maradék kockázat: DNS-rebinding (a lookup és a tényleges connect közti
 * időablak). Ennek teljes kizárása IP-pinnelt dispatchert igényelne; a
 * gyakorlati SSRF-et (metadata/localhost/belső) ez a réteg lefedi.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, ""); // IPv4-mapped IPv6 lecsupaszítása
  if (net.isIPv4(v)) {
    const [a, b] = v.split(".").map(Number);
    if (a === 0) return true;                      // "this" network
    if (a === 10) return true;                     // private
    if (a === 127) return true;                    // loopback
    if (a === 169 && b === 254) return true;       // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true;       // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                      // multicast / reserved
    return false;
  }
  if (net.isIPv6(v)) {
    const lower = v.toLowerCase();
    if (lower === "::1" || lower === "::") return true;   // loopback / unspecified
    if (lower.startsWith("fe80")) return true;            // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    return false;
  }
  return true; // ismeretlen formátum → biztonságos oldalra hajlunk
}

/** Ellenőrzi, hogy az URL publikus és biztonságos. Dob, ha nem. */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Érvénytelen URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Csak http/https URL engedélyezett");
  }
  const host = url.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Belső/privát cím nem engedélyezett");
    return url;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("A hostname nem feloldható");
  }
  if (!addrs.length) throw new Error("A hostname nem feloldható");
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error("Belső/privát célpont nem engedélyezett");
  }
  return url;
}

/**
 * SSRF-védett fetch: validál, kézzel követi a redirecteket, minden hopot
 * újravalidál. Ugyanazt a Response-t adja vissza, mint a natív fetch.
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}, maxHops = 4): Promise<Response> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertSafePublicUrl(currentUrl);
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error("Túl sok átirányítás");
}
