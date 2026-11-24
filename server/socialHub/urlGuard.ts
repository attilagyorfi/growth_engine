/**
 * A Social Hub API-címének ellenőrzése (SSRF-védelem).
 *
 * Csak https, felhasználónév/jelszó, lekérdezés és töredék nélkül; a hoszt (és minden
 * cím, amire feloldódik) nyilvános. Mentéskor és a tárolt címre menő minden kérés előtt
 * fut. A localhost csak NODE_ENV=development mellett engedett (ott http is).
 */
import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { isPrivateIp } from "../_core/safeFetch";

export type SocialHubLookup = (host: string) => Promise<{ address: string }[]>;

export class SocialHubUrlError extends Error {}

const DNS_TIMEOUT_MS = 5_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isPublicAddress(ip: string): boolean {
  if (isPrivateIp(ip)) return false;
  if (net.isIPv6(ip)) {
    // IPv4-be ágyazott alak: az isPrivateIp már a beágyazott címet nézte.
    if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) return isPublicAddress(ip.slice(7));
    // Csak a globális tartomány (2000::/3), a 6to4 és a Teredo (beágyazott IPv4) nélkül.
    return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2002:/i.test(ip) && !/^2001:(0{1,4})?:/i.test(ip);
  }
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 198 && (b === 18 || b === 19)) return false; // mérési tartomány
  if (a === 192 && b === 0 && c === 0) return false; // IETF-célú
  return true;
}

async function resolve(host: string, lookup: SocialHubLookup): Promise<{ address: string }[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(host),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("dns timeout")), DNS_TIMEOUT_MS); }),
    ]);
  } catch {
    throw new SocialHubUrlError("Ez a cím nem található. Ellenőrizd, jól írtad-e be.");
  } finally {
    clearTimeout(timer);
  }
}

/** Ellenőrzi és normalizálja (záró / nélkül) az API-címet. Dob (SocialHubUrlError), ha nem engedett. */
export async function assertSocialHubUrl(
  rawUrl: string,
  options: { lookup?: SocialHubLookup; env?: Record<string, string | undefined> } = {},
): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SocialHubUrlError("Ez nem érvényes cím.");
  }
  if (url.username || url.password) throw new SocialHubUrlError("A címben ne legyen felhasználónév vagy jelszó.");
  if (url.search || url.hash) throw new SocialHubUrlError("A címben ne legyen ? vagy # jel.");
  const normalized = url.toString().replace(/\/+$/, "");
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();

  const devLocal = (options.env ?? process.env).NODE_ENV === "development" && LOCAL_HOSTS.has(host);
  if (devLocal && (url.protocol === "http:" || url.protocol === "https:")) return normalized;

  if (url.protocol !== "https:") throw new SocialHubUrlError("A cím csak https:// kezdetű lehet.");
  const blocked = new SocialHubUrlError("Belső hálózati cím nem adható meg.");
  if (LOCAL_HOSTS.has(host) || /\.(localhost|local|internal)$/.test(host)) throw blocked;
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw blocked;
    return normalized;
  }
  const addresses = await resolve(host, options.lookup ?? ((h) => dnsLookup(h, { all: true })));
  if (!addresses.length) throw new SocialHubUrlError("Ez a cím nem található. Ellenőrizd, jól írtad-e be.");
  if (addresses.some((a) => !isPublicAddress(a.address))) throw blocked;
  return normalized;
}
