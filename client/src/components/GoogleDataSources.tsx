/**
 * Riportok → Adatforrások: Google-csatlakozás (GA4, Search Console, Google Ads).
 *   - „Csatlakozás Google-lel” gomb platformonként (Google-env nélkül letiltva, magyarázattal;
 *     a Google Ads developer token nélkül is);
 *   - csatlakozás után property/site/fiók választó a kiválasztásra váró kapcsolathoz.
 * Token a kliensre soha nem jön: a lista a szerver explicit, titokmentes nézetét kapja.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  GOOGLE_ADS_NOT_CONFIGURED_TEXT,
  GOOGLE_NOT_CONFIGURED_TEXT,
  GOOGLE_SOURCE_LABEL,
  GOOGLE_SOURCE_PLATFORMS,
  googleConnectEnabled,
  googleConnectUrl,
} from "@/lib/googleConnect";

const textPrimary = "var(--qa-fg)";
const textMuted = "var(--qa-fg3)";
const border = "var(--qa-border)";
const cardBg = "var(--qa-surface)";

export function GoogleConnectButtons({ profileId }: { profileId: string }) {
  const { data: status } = trpc.reports.connections.google.status.useQuery();
  const configured = status?.googleConfigured === true;
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {GOOGLE_SOURCE_PLATFORMS.map((platform) => {
          const enabled = googleConnectEnabled(platform, status) && !!profileId;
          return (
            <button key={platform} type="button" disabled={!enabled}
              onClick={() => { if (enabled) window.location.href = googleConnectUrl(profileId, platform); }}
              className="px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--qa-surface2)", borderColor: border, color: textPrimary }}>
              Csatlakozás Google-lel – {GOOGLE_SOURCE_LABEL[platform]}
            </button>
          );
        })}
      </div>
      {status && !configured && (
        <p className="text-xs mt-2" style={{ color: textMuted }}>{GOOGLE_NOT_CONFIGURED_TEXT}</p>
      )}
      {status && configured && !status.googleAdsConfigured && (
        <p className="text-xs mt-2" style={{ color: textMuted }}>{GOOGLE_ADS_NOT_CONFIGURED_TEXT}</p>
      )}
    </div>
  );
}

export function GoogleAccountPicker({ profileId, connectionId, platform, onSaved }: {
  profileId: string;
  connectionId: string;
  platform: string;
  onSaved: () => void;
}) {
  const isAds = platform === "google_ads";
  const [choice, setChoice] = useState("");
  const { data, isLoading, error } = trpc.reports.connections.google.accounts.useQuery(
    { profileId, connectionId }, { retry: false },
  );
  const selectMutation = trpc.reports.connections.google.select.useMutation({
    onSuccess: () => { toast.success("Mentve. A következő frissítéskor már innen jön az adat."); onSaved(); },
    onError: (err) => toast.error(err.message),
  });
  const accounts = data?.accounts ?? [];

  if (isLoading) return <p className="text-xs" style={{ color: textMuted }}>Lista betöltése…</p>;
  if (error) return <p className="text-xs" style={{ color: "var(--qa-danger)" }}>{error.message}</p>;
  if (accounts.length === 0) {
    return (
      <p className="text-xs" style={{ color: textMuted }}>
        {isAds
          ? "Ehhez a Google-fiókhoz nem találtunk Google Ads-fiókot."
          : "Ehhez a Google-fiókhoz nem találtunk választható tulajdont."}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 mt-2">
      <select value={choice} aria-label={isAds ? "Google Ads-fiók" : "Tulajdon"} onChange={(e) => setChoice(e.target.value)}
        className="px-2 py-1 rounded-lg text-xs border flex-1 min-w-0"
        style={{ background: cardBg, borderColor: border, color: textPrimary }}>
        <option value="">{isAds ? "Válassz fiókot…" : "Válassz…"}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" disabled={!choice || selectMutation.isPending}
        onClick={() => selectMutation.mutate({
          profileId, connectionId, externalAccountId: choice,
          externalAccountName: accounts.find((a) => a.id === choice)?.name,
        })}
        className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
        style={{ background: "var(--qa-accent)", color: "#fff" }}>
        Mentés
      </button>
    </div>
  );
}
