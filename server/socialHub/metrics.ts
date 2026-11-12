/**
 * G2A Growth Engine – Social Hub metrikák → report_metrics (G1)
 *
 * `mapSocialHubMetrics` tiszta függvény: a GET /clients/{id}/metrics válaszának
 * napi fiókmetrikáit (accounts[].days[]) a connectors normalizált soraira képezi.
 * A posts[] ebben a körben nem kerül be.
 *
 * `syncSocialMetrics` a reports.sync közösségi ága (a data_connections-ciklus
 * mellett, nem annak része). Fail-closed: konfiguráció, external_ref vagy
 * Social Hub-párosítás hiányában nincs metrics-hívás, csak ok-kóddal jelzett kimaradás.
 */
import type { NormalizedMetricRow, SocialMetricPlatform } from "../reports/connectors";
import {
  createSocialHubClient,
  getSocialHubConfig,
  SocialHubError,
  type SocialHubApi,
  type SocialHubConfig,
  type SocialHubMetricsResponse,
} from "./client";

/**
 * A Social Hub analytics_daily.provider értékei → report_metrics.platform.
 * A Social Hub az éles Meta-adatot `meta:<platform>` providerrel tárolja
 * (packages/server/analytics-sync.ts); a sima platformnevek (packages/core/domain.ts)
 * a későbbi adapterekre (pl. LinkedIn) is felkészítenek. A `mock:*` provider a
 * Social Hub saját mintaadata, ezért szándékosan NINCS a térképben (kimarad).
 */
export const SOCIAL_HUB_PROVIDER_PLATFORM: Readonly<Record<string, SocialMetricPlatform>> = {
  "meta:facebook": "facebook",
  "meta:instagram": "instagram",
  "linkedin:linkedin": "linkedin",
  facebook: "facebook",
  instagram: "instagram",
  linkedin: "linkedin",
};

export type SocialMetricRow = Omit<NormalizedMetricRow, "platform"> & { platform: SocialMetricPlatform };

export function mapSocialHubMetrics(response: Pick<SocialHubMetricsResponse, "accounts">): {
  rows: SocialMetricRow[];
  skippedAccounts: number;
} {
  const rows: SocialMetricRow[] = [];
  let skippedAccounts = 0;
  for (const account of response.accounts) {
    const platform = SOCIAL_HUB_PROVIDER_PLATFORM[account.provider];
    if (!platform) {
      skippedAccounts++;
      continue;
    }
    for (const { day, metrics } of account.days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      for (const [metricKey, value] of Object.entries(metrics ?? {})) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        rows.push({
          platform,
          date: new Date(`${day}T00:00:00Z`),
          metricKey: metricKey.slice(0, 64),
          value,
          currency: null,
          dimension: { socialAccountId: account.social_account_id },
        });
      }
    }
  }
  return { rows, skippedAccounts };
}

export type SocialSkipReason = "not_requested" | "not_configured" | "no_external_ref" | "no_match";

export type SocialSyncResult =
  | { status: "synced"; inserted: number; skippedAccounts: number }
  | { status: "skipped"; reason: SocialSkipReason }
  | { status: "failed"; reason: "error"; message: string };

export type SocialSyncDeps = {
  config?: SocialHubConfig | null;
  createClient?: (config: SocialHubConfig) => Pick<SocialHubApi, "listClients" | "getClientMetricsRange">;
  /** Tranzakcióban: a profil közösségi sorainak törlése [from, to]-ban, majd beszúrás. */
  replaceRows: (profileId: string, from: string, to: string, rows: SocialMetricRow[]) => Promise<{ inserted: number }>;
};

export async function syncSocialMetrics(
  input: { profileId: string; externalRef: string | null | undefined; from: string; to: string; requested?: boolean },
  deps: SocialSyncDeps,
): Promise<SocialSyncResult> {
  if (input.requested === false) return { status: "skipped", reason: "not_requested" };
  const config = deps.config === undefined ? getSocialHubConfig() : deps.config;
  if (!config) return { status: "skipped", reason: "not_configured" };
  const externalRef = input.externalRef?.trim();
  if (!externalRef) return { status: "skipped", reason: "no_external_ref" };

  const client = (deps.createClient ?? createSocialHubClient)(config);
  try {
    const match = (await client.listClients()).find((c) => c.external_ref === externalRef);
    if (!match) return { status: "skipped", reason: "no_match" };
    const response = await client.getClientMetricsRange(match.id, input.from, input.to);
    const { rows, skippedAccounts } = mapSocialHubMetrics(response);
    const inRange = rows.filter((r) => {
      const day = r.date.toISOString().slice(0, 10);
      return day >= input.from && day <= input.to;
    });
    const { inserted } = await deps.replaceRows(input.profileId, input.from, input.to, inRange);
    return { status: "synced", inserted, skippedAccounts };
  } catch (err) {
    // Csak a saját, kulcsmentes hibaszöveg kerül naplóba és a válaszba.
    const message = err instanceof SocialHubError ? err.message : "Social Hub: váratlan hiba";
    console.error(`[reports.sync] közösségi szinkron sikertelen: ${message}`);
    return { status: "failed", reason: "error", message };
  }
}
