/**
 * G2A Growth Engine – egy profil riport-adatainak szinkronja (G1)
 *
 * A `reports.sync` mutation és a napi háttérfeladat (server/reportSyncScheduler.ts)
 * közös magja:
 *   1. a profil adatkapcsolatai platformonként csoportosítva: a platform ÖSSZES
 *      kapcsolatának sorai egyetlen `replaceRows`-hívással íródnak (a report_metrics-ben
 *      nincs kapcsolat-oszlop, így a kapcsolatonkénti csere törölné a testvérkapcsolat
 *      sorait). Ha a platform bármely kapcsolatának lekérése hibát dob, arra a
 *      platformra nincs csere — a régi adat megmarad, nem cserélődik részlegesre;
 *   2. a közösségi ág (Social Hub GET /metrics → replaceSocialReportMetrics).
 *
 * Márkák (0025): a csoport kulcsa platform + a kapcsolat brandId-ja, a sorok ezt a
 * márkát kapják, és a csere csak ezt a márkát érinti. A közösségi ág a profil
 * external_ref-jével brandId=NULL-lal fut (a márkák előtti viselkedés), majd minden
 * Social Hub-azonosítóval rendelkező márkára külön, az ő brandId-jával.
 *
 * A kapcsolat-hibák nem dobódnak tovább (a többi platform menjen), hanem az
 * `errors` listába kerülnek. A mutation ezt elnyeli, az ütemező újrapróbál/értesít.
 */
import type { DataConnection } from "../../drizzle/schema";
import { getProfileById, listDataConnections, listProfileBrands, replaceReportMetrics, replaceSocialReportMetrics } from "../db";
import { syncSocialMetrics, type SocialSyncResult } from "../socialHub/metrics";
import { fetchMetrics, isSocialMetricPlatform, type MetricPlatform } from "./connectors";

type ConnectionRows = Awaited<ReturnType<typeof fetchMetrics>>;

export type SyncProfileDeps = {
  listConnections(profileId: string): Promise<DataConnection[]>;
  fetchMetrics(conn: DataConnection, from: string, to: string): Promise<ConnectionRows>;
  /** Tranzakcióban: a profil adott platformjának (és márkájának) sorai [from, to]-ban törlődnek, majd beszúrás. */
  replaceRows(profileId: string, platform: DataConnection["platform"], from: string, to: string, rows: ConnectionRows, brandId?: string | null): Promise<{ inserted: number }>;
  getProfile(profileId: string): Promise<{ externalRef?: string | null } | null | undefined>;
  syncSocial(input: { profileId: string; externalRef: string | null | undefined; from: string; to: string; requested: boolean; brandId?: string | null }): Promise<SocialSyncResult>;
  /** A profil márkái (a Social Hub-azonosítós márkák közösségi szinkronjához). Hiányában nincs márkás ág. */
  listBrands?(profileId: string): Promise<Array<{ id: string; socialHubExternalRef?: string | null }>>;
};

export type SyncProfileError = { platform: string; name: string; message: string };

export type SyncProfileResult = {
  platforms: string[];
  inserted: number;
  social: SocialSyncResult;
  /** Márkánkénti közösségi eredmény — csak ha van Social Hub-azonosítós márka. */
  brandSocial?: Array<{ brandId: string; social: SocialSyncResult }>;
  /** Kapcsolat-platformok lekérési/írási hibái (a közösségi hiba a `social.status`-ban van). */
  errors: SyncProfileError[];
};

export const defaultSyncProfileDeps: SyncProfileDeps = {
  listConnections: (profileId) => listDataConnections(profileId),
  fetchMetrics: (conn, from, to) => fetchMetrics(conn, from, to),
  // Márka nélkül a márkák előtti, 5 (ill. 4) argumentumos hívás marad.
  replaceRows: (profileId, platform, from, to, rows, brandId) => brandId
    ? replaceReportMetrics(profileId, platform, from, to, rows, undefined, brandId)
    : replaceReportMetrics(profileId, platform, from, to, rows),
  getProfile: (profileId) => getProfileById(profileId),
  syncSocial: (input) => syncSocialMetrics(input, {
    replaceRows: (profileId, from, to, rows, brandId) => brandId
      ? replaceSocialReportMetrics(profileId, from, to, rows, undefined, brandId)
      : replaceSocialReportMetrics(profileId, from, to, rows),
  }),
  listBrands: (profileId) => listProfileBrands(profileId),
};

/**
 * Naplózható, titokmentes hibaösszegzés: csak a hibaosztály és egy rövid üzenet,
 * az URL-ek (bennük esetleg token/kulcs paraméter) kitakarva. Stack és teljes
 * err-objektum soha nem kerül a naplóba.
 */
export function describeError(err: unknown): { name: string; message: string } {
  const name = err instanceof Error ? err.name || "Error" : typeof err;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "ismeretlen hiba";
  const message = raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(bearer|token|key|secret|password)\b\s*[:=]?\s*\S+/gi, "$1 [rejtve]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return { name: name.slice(0, 40), message: message || "ismeretlen hiba" };
}

export async function syncProfileMetrics(
  profileId: string,
  from: string,
  to: string,
  platforms?: readonly MetricPlatform[],
  deps: SyncProfileDeps = defaultSyncProfileDeps,
): Promise<SyncProfileResult> {
  const conns = await deps.listConnections(profileId);
  const targets = platforms ? conns.filter((c) => (platforms as readonly string[]).includes(c.platform)) : conns;

  // Csoport = platform + márka: a csere profil + platform + brandId hatókörű.
  const groups = new Map<string, { platform: DataConnection["platform"]; brandId: string | null; conns: DataConnection[] }>();
  for (const conn of targets) {
    const brandId = conn.brandId ?? null;
    const key = `${conn.platform}\u0000${brandId ?? ""}`;
    const group = groups.get(key) ?? { platform: conn.platform, brandId, conns: [] };
    group.conns.push(conn);
    groups.set(key, group);
  }

  let inserted = 0;
  const errors: SyncProfileError[] = [];
  for (const { platform, brandId, conns: group } of Array.from(groups.values())) {
    try {
      const rows: ConnectionRows = [];
      for (const conn of group) rows.push(...(await deps.fetchMetrics(conn, from, to)));
      // Márka nélkül a régi, 5 argumentumos hívás (változatlan viselkedés).
      const result = brandId
        ? await deps.replaceRows(profileId, platform, from, to, rows, brandId)
        : await deps.replaceRows(profileId, platform, from, to, rows);
      inserted += result.inserted;
    } catch (err) {
      // Nem dobjuk tovább — a többi platform szinkron menjen tovább; a régi adat marad.
      const info = describeError(err);
      errors.push({ platform, ...info });
      console.error(`[reports.sync] profil=${profileId} platform=${platform} sikertelen: ${info.name}: ${info.message}`);
    }
  }

  // Közösségi csatorna (Social Hub GET /metrics), a kapcsolat-ciklus mellett.
  // Fail-closed: konfiguráció / external_ref / párosítás nélkül nincs hívás, csak ok-kód.
  const requested = !platforms || platforms.some(isSocialMetricPlatform);
  const profile = await deps.getProfile(profileId);
  const social = await deps.syncSocial({
    profileId,
    externalRef: profile?.externalRef,
    from,
    to,
    requested,
  });
  if (social.status === "synced") inserted += social.inserted;

  // Márkánként: ha a márka a Social Hubban külön ügyfél, a saját azonosítójával
  // húzunk, és a sorok a márka brandId-ját kapják.
  const brands = deps.listBrands ? (await deps.listBrands(profileId)).filter((b) => b.socialHubExternalRef) : [];
  const brandSocial: Array<{ brandId: string; social: SocialSyncResult }> = [];
  for (const brand of brands) {
    const result = await deps.syncSocial({
      profileId,
      externalRef: brand.socialHubExternalRef,
      from,
      to,
      requested,
      brandId: brand.id,
    });
    if (result.status === "synced") inserted += result.inserted;
    brandSocial.push({ brandId: brand.id, social: result });
  }

  return {
    platforms: targets.map((t) => t.platform),
    inserted,
    social,
    ...(brandSocial.length ? { brandSocial } : {}),
    errors,
  };
}
