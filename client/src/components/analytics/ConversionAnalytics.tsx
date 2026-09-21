/**
 * #16 – Konverzió tab (Kimutatások)
 *
 * Tölcsér (megjelenés → kattintás → konverzió), konverziós ráta, költség/
 * konverzió, napi trend és csatornánkénti hozzájárulás. Adat:
 * `reports.conversion` — DEMO módban mock, élesben valós report_metrics.
 */
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Filter, Info, Target, Coins, CheckCircle2 } from "lucide-react";

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

export default function ConversionAnalytics() {
  const { activeProfile } = useProfile();
  const { data, isLoading } = trpc.reports.conversion.useQuery(
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

  const { funnel } = data;
  // Tölcsér-lépcsők + szűkülés az előző lépcsőhöz képest.
  const stages = [
    { key: "impr", label: "Megjelenés", value: funnel.impressions, color: accent },
    { key: "clk", label: "Kattintás", value: funnel.clicks, color: "oklch(0.65 0.18 250)" },
    { key: "conv", label: "Konverzió", value: funnel.conversions, color: green },
  ];
  const maxVal = Math.max(funnel.impressions, 1);

  const kpis = [
    { icon: Target, label: "Konverziós ráta", value: pct(data.conversionRate, 2), sub: "kattintásból konverzió", color: green },
    { icon: Coins, label: "Költség / konverzió", value: data.costPerConversion != null ? ft(data.costPerConversion) : "—", sub: "átlagos akvizíciós költség", color: accent },
    { icon: CheckCircle2, label: "Összes konverzió", value: nf.format(funnel.conversions), sub: `${pct(data.clickThroughRate)} CTR`, color: "oklch(0.65 0.18 250)" },
  ];

  return (
    <div className="space-y-6">
      {/* Fejléc + DEMO */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--qa-accent-soft)", color: accent }}>
            <Filter size={15} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Konverzió</p>
            <p className="text-xs" style={{ color: textMuted }}>{data.from} → {data.to} · megjelenéstől a konverzióig</p>
          </div>
        </div>
        {data.demo && <DemoBadge />}
      </div>

      {data.demo && (
        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "var(--qa-warning-soft, rgba(245,158,11,.12))", color: "var(--qa-warning)" }}>
          Ezek <strong>minta-számok</strong> — a valós konverziós adat a Google &amp; Meta összekötése (OAuth-verifikáció) után jelenik meg automatikusan.
        </div>
      )}

      {/* KPI-k */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ background: cardBg, border }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: `${k.color.replace(")", " / 15%)")}`, color: k.color }}>
              <k.icon size={16} />
            </div>
            <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>{k.value}</p>
            <p className="text-xs font-medium" style={{ color: textMuted }}>{k.label}</p>
            <p className="text-xs mt-1" style={{ color: k.color }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tölcsér */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
        <p className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Konverziós tölcsér</p>
        <div className="space-y-3">
          {stages.map((s, i) => {
            const widthPct = Math.max((s.value / maxVal) * 100, 2);
            const prev = i > 0 ? stages[i - 1].value : null;
            const dropTo = prev && prev > 0 ? s.value / prev : null;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: textPrimary }}>{s.label}</span>
                  <span className="text-xs tabular-nums" style={{ color: textMuted }}>
                    {nf.format(s.value)}{dropTo != null && <span style={{ color: s.color }}> · {pct(dropTo)}</span>}
                  </span>
                </div>
                <div className="h-7 rounded-lg overflow-hidden" style={{ background: "var(--qa-surface2)" }}>
                  <div className="h-full rounded-lg transition-all" style={{ width: `${widthPct}%`, background: s.color, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Napi konverzió-trend */}
      <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
        <p className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Konverzió időben</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.trend} barSize={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--qa-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: textMuted, fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(d: string) => d.slice(5)} minTickGap={20} />
            <YAxis tick={{ fill: textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "var(--qa-surface2)" }} contentStyle={{ background: "var(--qa-surface2)", border, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="conversions" name="Konverzió" fill={green} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Csatornánkénti hozzájárulás */}
      {data.byChannel.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: cardBg, border }}>
          <p className="text-sm font-bold mb-4" style={{ fontFamily: "var(--font-heading)", color: textPrimary }}>Melyik csatorna hozza a konverziót</p>
          <div className="space-y-3">
            {data.byChannel.map((c) => (
              <div key={c.platform}>
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: textPrimary }}>
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHANNEL_COLOR[c.platform] ?? accent }} />
                    {c.label}
                  </span>
                  <span className="text-xs tabular-nums" style={{ color: textMuted }}>{nf.format(c.conversions)} · {pct(c.share)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--qa-surface2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(c.share * 100)}%`, background: CHANNEL_COLOR[c.platform] ?? accent }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
