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
 * A kapcsolat-hibák nem dobódnak tovább (a többi platform menjen), hanem az
 * `errors` listába kerülnek. A mutation ezt elnyeli, az ütemező újrapróbál/értesít.
 */
import type { DataConnection } from "../../drizzle/schema";
import { getProfileById, listDataConnections, replaceReportMetrics, replaceSocialReportMetrics } from "../db";
import { syncSocialMetrics, type SocialSyncResult } from "../socialHub/metrics";
import { fetchMetrics, isSocialMetricPlatform, type MetricPlatform } from "./connectors";

type ConnectionRows = Awaited<ReturnType<typeof fetchMetrics>>;

export type SyncProfileDeps = {
  listConnections(profileId: string): Promise<DataConnection[]>;
  fetchMetrics(conn: DataConnection, from: string, to: string): Promise<ConnectionRows>;
  /** Tranzakcióban: a profil adott platformjának sorai [from, to]-ban törlődnek, majd beszúrás. */
  replaceRows(profileId: string, platform: DataConnection["platform"], from: string, to: string, rows: ConnectionRows): Promise<{ inserted: number }>;
  getProfile(profileId: string): Promise<{ externalRef?: string | null } | null | undefined>;
  syncSocial(input: { profileId: string; externalRef: string | null | undefined; from: string; to: string; requested: boolean }): Promise<SocialSyncResult>;
};

export type SyncProfileError = { platform: string; name: string; message: string };

export type SyncProfileResult = {
  platforms: string[];
  inserted: number;
  social: SocialSyncResult;
  /** Kapcsolat-platformok lekérési/írási hibái (a közösségi hiba a `social.status`-ban van). */
  errors: SyncProfileError[];
};

export const defaultSyncProfileDeps: SyncProfileDeps = {
  listConnections: (profileId) => listDataConnections(profileId),
  fetchMetrics: (conn, from, to) => fetchMetrics(conn, from, to),
  replaceRows: (profileId, platform, from, to, rows) => replaceReportMetrics(profileId, platform, from, to, rows),
  getProfile: (profileId) => getProfileById(profileId),
  syncSocial: (input) => syncSocialMetrics(input, { replaceRows: replaceSocialReportMetrics }),
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

  const byPlatform = new Map<DataConnection["platform"], DataConnection[]>();
  for (const conn of targets) {
    const group = byPlatform.get(conn.platform) ?? [];
    group.push(conn);
    byPlatform.set(conn.platform, group);
  }

  let inserted = 0;
  const errors: SyncProfileError[] = [];
  for (const [platform, group] of Array.from(byPlatform.entries())) {
    try {
      const rows: ConnectionRows = [];
      for (const conn of group) rows.push(...(await deps.fetchMetrics(conn, from, to)));
      const result = await deps.replaceRows(profileId, platform, from, to, rows);
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
  const profile = await deps.getProfile(profileId);
  const social = await deps.syncSocial({
    profileId,
    externalRef: profile?.externalRef,
    from,
    to,
    requested: !platforms || platforms.some(isSocialMetricPlatform),
  });
  if (social.status === "synced") inserted += social.inserted;

  return { platforms: targets.map((t) => t.platform), inserted, social, errors };
}
