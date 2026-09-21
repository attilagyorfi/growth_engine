/**
 * #15 – Csatorna-teljesítmény tab (Kimutatások)
 *
 * Csatornánkénti összevetés (költés / megjelenés / kattintás / CTR / CPC /
 * konverzió / költség-per-konverzió) + „legjobb a pénzért" kiemelés. Az adat a
 * `reports.channelPerformance` végpontból jön: DEMO módban a mock generátor,
 * élesben a valós report_metrics. A `demo` flag vezérli a DEMO-jelölést.
 */
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Radio, Trophy, Info } from "lucide-react";

const cardBg = "var(--qa-surface)";
const border = "1px solid var(--qa-border)";
const textPrimary = "var(--qa-fg)";
const textMuted = "var(--qa-fg3)";
const accent = "var(--qa-accent)";
const green = "var(--qa-success)";

const CHANNEL_COLOR: Record<string, string> = {
  google_ads: "oklch(0.7 0.17 145)",
  meta_ads: "oklch(0.6 0.18 250)",
  ga4: "oklch(0.7 0.16 60)",
  search_console: "oklch(0.65 0.18 300)",
};

const nf = new Intl.NumberFormat("hu-HU");
const ft = (n: number) => `${nf.format(Math.round(n))} Ft`;
const pct = (v: number | null, digits = 1) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: "var(--qa-warning-soft, rgba(245,158,11,.15))", color: "var(--qa-warning)" }}>
      <Info size={10} /> DEMO adat
    </span>
  );
}

export default function ChannelPerformance() {
  const { activeProfile } = useProfile();
  const { data, isLoading } = trpc.reports.channelPerformance.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id },
  );

  if (isLoading || !data) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accent, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const channels = data.channels;
  const bestLabel = channels.find((c) => c.platform === data.best)?.label ?? null;
  const chartData = channels.map((c) => ({ name: c.label, konverzió: c.conversions, color: CHANNEL_COLOR[c.platform] ?? accent }));

  return (
    <div className="space-y-6">
      {/* Fejléc + DEMO-jelölés */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--qa-accent-soft)", color: accent }}>
            <Radio size={15} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Csatorna-teljesítmény</p>
            <p className="text-xs" style={{ color: textMuted }}>{data.from} → {data.to} · melyik csatorna hozza a legtöbbet</p>
          </div>
        </div>
        {data.demo && <DemoBadge />}
      </div>

      {data.demo && (
        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "var(--qa-warning-soft, rgba(245,158,11,.12))", color: "var(--qa-warning)" }}>
          Ezek <strong>minta-számok</strong> — a valós hirdetési/analitika adat a Google &amp; Meta összekötése (OAuth-verifikáció) után jelenik meg automatikusan. Ne add ki valós teljesítmény-jelentésként.
        </div>
      )}

      {/* „Legjobb a pénzért" kiemelés */}
      {bestLabel && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${green.replace(")", " / 10%)")}`, border: `1px solid ${green.replace(")", " / 25%)")}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${green.replace(")", " / 15%)")}`, color: green }}>
            <Trophy size={17} />
          </div>
          <div>
            <p className="text-xs" style={{ color: textMuted }}>Legjobb a pénzért (legalacsonyabb költség/konverzió)</p>
            <p className="text-sm font-bold" style={{ color: green }}>{bestLabel}</p>
          </div>
        </div>
      )}

      {/* Összehasonlító táblázat */}
      <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: border }}>
                {["Csatorna", "Költés", "Megjelenés", "Kattintás", "CTR", "CPC", "Konverzió", "Költség/konv."].map((h, i) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap"
                    style={{ color: textMuted, textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.platform} style={{ borderBottom: "1px solid var(--qa-border)" }}>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHANNEL_COLOR[c.platform] ?? accent }} />
                      <span className="font-medium" style={{ color: textPrimary }}>{c.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: textPrimary }}>{c.spend > 0 ? ft(c.spend) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: textPrimary }}>{c.impressions > 0 ? nf.format(c.impressions) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: textPrimary }}>{c.clicks > 0 ? nf.format(c.clicks) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: textMuted }}>{pct(c.ctr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: textMuted }}>{c.cpc != null ? ft(c.cpc) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: textPrimary }}>{c.conversions > 0 ? nf.format(c.conversions) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: c.platform === data.best ? green : textPrimary }}>{c.costPerConversion != null ? ft(c.costPerConversion) : "—"}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--qa-surface2)" }}>
                <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: textPrimary }}>Összesen</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: textPrimary }}>{ft(data.totals.spend)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: textPrimary }}>{nf.format(data.totals.impressions)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: textPrimary }}>{nf.format(data.totals.clicks)}</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: textPrimary }}>{nf.format(data.totals.conversions)}</td>
                <td className="px-3 py-2.5" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Konverzió csatornánként — oszlopdiagram */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
        <p className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Konverzió csatornánként</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--qa-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--qa-surface2)" }} contentStyle={{ background: "var(--qa-surface2)", border, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="konverzió" name="Konverzió" radius={[4, 4, 0, 0]}>
              {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
