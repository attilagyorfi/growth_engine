/**
 * G2A Growth Engine – Reports page
 *
 * A riportgenerátor UI: kapcsolatok kezelése, adat-szinkron, riport
 * generálás, korábbi riportok listája + Recharts-preview.
 *
 * MVP korlátozások (a foundation-first scope-ban):
 *   - A kapcsolatok gomb egyelőre a "Coming soon" modal-t nyitja (a Google
 *     OAuth verification + Meta Ads Insights review a kritikus úton).
 *   - Mock adatot generálunk minden platformra a `sync` mutation-ben.
 *   - A PDF gomb `window.print()`-et hív (a Playwright renderer külön PR).
 */
import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  BarChart3, Plus, Loader2, FileText, Zap, Calendar,
  Facebook, Search, TrendingUp, X, Printer, Trash2, RefreshCw,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";
const textPrimary = "var(--qa-fg)";
const textMuted = "var(--qa-fg3)";
const accent = "var(--qa-accent)";
const green = "var(--qa-success)";

// Platform ikonok + színek
const PLATFORM_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  google_ads: { label: "Google Ads", color: "#4285F4", icon: <Search size={14} /> },
  ga4:        { label: "GA4",        color: "#F9AB00", icon: <TrendingUp size={14} /> },
  search_console: { label: "Search Console", color: "#34A853", icon: <Search size={14} /> },
  meta_ads:   { label: "Meta Ads",   color: "#1877F2", icon: <Facebook size={14} /> },
};

const CHART_COLORS = ["#4285F4", "#F9AB00", "#34A853", "#1877F2", "#EA4335"];

// Utility — az elmúlt 30 nap default range
function defaultRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

function formatNumber(n: number, unit?: string) {
  if (unit === "HUF") return `${n.toLocaleString("hu-HU")} Ft`;
  return n.toLocaleString("hu-HU");
}

export default function Reports() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id ?? "";
  const utils = trpc.useUtils();
  const initialRange = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  const { data: connections = [], refetch: refetchConns } = trpc.reports.connections.list.useQuery(
    { profileId }, { enabled: !!profileId }
  );
  const { data: reports = [], refetch: refetchReports } = trpc.reports.list.useQuery(
    { profileId }, { enabled: !!profileId }
  );
  const { data: selectedReport } = trpc.reports.get.useQuery(
    { profileId, reportId: selectedReportId ?? "" },
    { enabled: !!profileId && !!selectedReportId }
  );

  const syncMutation = trpc.reports.sync.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.inserted} metrika beszinkronizálva (${data.platforms.length} platform)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateMutation = trpc.reports.generate.useMutation({
    onSuccess: (report) => {
      toast.success("Riport legenerálva!");
      refetchReports();
      if (report?.id) setSelectedReportId(report.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnectMutation = trpc.reports.connections.disconnect.useMutation({
    onSuccess: () => { refetchConns(); toast.success("Kapcsolat törölve"); },
  });

  const handleGenerate = async () => {
    if (!profileId) return;
    // Előbb szinkronizálunk (mock adatot ír a DB-be), aztán generálunk.
    await syncMutation.mutateAsync({ profileId, from, to });
    utils.reports.list.invalidate({ profileId });
    generateMutation.mutate({ profileId, from, to, templateKey: "default", compareToPrevious: true });
  };

  const activeReport = selectedReport ?? (reports.length > 0 ? reports[0] : null);
  const summary = activeReport?.summaryData as any;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
              <BarChart3 size={20} style={{ color: accent }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: textPrimary, fontFamily: "Sora, sans-serif" }}>
                Riportok
              </h1>
              <p className="text-sm" style={{ color: textMuted }}>
                Google Ads · GA4 · Search Console · Meta Ads — havi vezetői riportok
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConnectionsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--qa-surface2)", color: textMuted }}
          >
            <Plus size={14} /> Kapcsolat ({connections.length})
          </button>
        </div>

        {/* Generate bar */}
        <div className="rounded-xl border p-4 flex flex-wrap items-end gap-3" style={{ background: cardBg, borderColor: border }}>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>Ettől</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ background: "var(--qa-surface2)", borderColor: border, color: textPrimary }} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: textMuted }}>Eddig</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border"
              style={{ background: "var(--qa-surface2)", borderColor: border, color: textPrimary }} />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!profileId || syncMutation.isPending || generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: accent }}
          >
            {(syncMutation.isPending || generateMutation.isPending)
              ? <><Loader2 size={14} className="animate-spin" /> Generálás…</>
              : <><Zap size={14} /> Riport generálása</>}
          </button>
          {connections.length === 0 && (
            <p className="text-xs" style={{ color: "oklch(0.75 0.18 75)" }}>
              ⚠ Még nincs csatlakoztatott adatforrás — a mock adapter fut helyette (demo mode).
            </p>
          )}
        </div>

        {/* Reports list — sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          {/* Sidebar */}
          <div className="rounded-xl border p-3 space-y-1" style={{ background: cardBg, borderColor: border }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: textMuted }}>
              Korábbi riportok ({reports.length})
            </p>
            {reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={24} className="mx-auto mb-2 opacity-40" style={{ color: textMuted }} />
                <p className="text-xs" style={{ color: textMuted }}>Még nincs riport.</p>
                <p className="text-xs mt-1" style={{ color: textMuted }}>Kattints a "Riport generálása" gombra.</p>
              </div>
            ) : reports.map(r => (
              <button key={r.id} onClick={() => setSelectedReportId(r.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors"
                style={{
                  background: activeReport?.id === r.id ? "oklch(0.6 0.2 255 / 15%)" : "transparent",
                  color: activeReport?.id === r.id ? accent : textPrimary,
                }}>
                <p className="font-semibold truncate">{r.title}</p>
                <p style={{ color: textMuted }}>
                  {r.status === "rendering" ? "⏳ Generálás…" : r.status === "failed" ? "❌ Hiba" : "✓ Kész"}
                </p>
              </button>
            ))}
          </div>

          {/* Report preview */}
          <div>
            {!activeReport ? (
              <div className="rounded-xl border p-12 text-center" style={{ background: cardBg, borderColor: border }}>
                <BarChart3 size={40} className="mx-auto mb-3 opacity-40" style={{ color: textMuted }} />
                <p className="text-sm font-semibold" style={{ color: textMuted }}>Válassz vagy generálj egy riportot</p>
              </div>
            ) : activeReport.status !== "rendered" ? (
              <div className="rounded-xl border p-12 text-center" style={{ background: cardBg, borderColor: border }}>
                {activeReport.status === "rendering"
                  ? <><Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: accent }} /><p className="text-sm">Riport generálása folyamatban…</p></>
                  : <p className="text-sm" style={{ color: "var(--qa-danger)" }}>❌ A riport generálása sikertelen. Próbáld újra.</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Report header */}
                <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold" style={{ color: textPrimary }}>{activeReport.title}</h2>
                    <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--qa-surface2)", color: textMuted }}>
                      <Printer size={12} /> Nyomtatás / PDF
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: textMuted }}>
                    <Calendar size={12} className="inline mr-1" />
                    {activeReport.periodFrom ? String(activeReport.periodFrom).slice(0, 10) : ""} → {activeReport.periodTo ? String(activeReport.periodTo).slice(0, 10) : ""}
                  </p>
                </div>

                {/* KPI kártyák */}
                {summary?.kpis && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {summary.kpis.map((kpi: any) => (
                      <div key={kpi.key} className="rounded-xl border p-4" style={{ background: cardBg, borderColor: border }}>
                        <p className="text-xs mb-1" style={{ color: textMuted }}>{kpi.label}</p>
                        <p className="text-xl font-bold" style={{ color: textPrimary, fontFamily: "Sora, sans-serif" }}>
                          {formatNumber(kpi.value, kpi.unit)}
                        </p>
                        {kpi.prevValue != null && (
                          <p className="text-xs mt-1" style={{ color: textMuted }}>
                            Előző: {formatNumber(kpi.prevValue, kpi.unit)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Spend trend chart */}
                {summary?.series?.find((s: any) => s.metricKey === "spend")?.points?.length > 0 && (
                  <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
                    <h3 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>Költés napi trend</h3>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={summary.series.find((s: any) => s.metricKey === "spend").points}>
                          <CartesianGrid stroke="var(--qa-border)" strokeDasharray="3 3" />
                          <XAxis dataKey="date" stroke="var(--qa-fg4)" style={{ fontSize: 11 }} />
                          <YAxis stroke="var(--qa-fg4)" style={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", borderRadius: 8, fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Platform bontás — bar chart */}
                {summary?.byPlatform && summary.byPlatform.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
                      <h3 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>Költés platformonként</h3>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={summary.byPlatform.map((p: any) => ({ ...p, label: PLATFORM_META[p.platform]?.label ?? p.platform }))}>
                            <CartesianGrid stroke="var(--qa-border)" strokeDasharray="3 3" />
                            <XAxis dataKey="label" stroke="var(--qa-fg4)" style={{ fontSize: 11 }} />
                            <YAxis stroke="var(--qa-fg4)" style={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="spend" fill={accent} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
                      <h3 className="text-sm font-bold mb-3" style={{ color: textPrimary }}>Konverziók platformonként</h3>
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={summary.byPlatform.map((p: any) => ({ name: PLATFORM_META[p.platform]?.label ?? p.platform, value: p.conversions ?? 0 }))}
                              dataKey="value" cx="50%" cy="50%" outerRadius={70} label>
                              {summary.byPlatform.map((_: any, i: number) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI narratíva */}
                {activeReport.aiSummary && (
                  <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={14} style={{ color: green }} />
                      <h3 className="text-sm font-bold" style={{ color: textPrimary }}>AI vezetői összefoglaló</h3>
                    </div>
                    <div className="text-sm leading-relaxed" style={{ color: "var(--qa-fg2)" }}>
                      <Streamdown>{activeReport.aiSummary}</Streamdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kapcsolatok modal */}
      {showConnectionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowConnectionsModal(false)}>
          <div className="rounded-xl border p-6 max-w-lg w-full" style={{ background: cardBg, borderColor: border }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: textPrimary }}>Adatforrások</h3>
              <button onClick={() => setShowConnectionsModal(false)} style={{ color: textMuted }}><X size={18} /></button>
            </div>

            {connections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: textMuted }}>Még nincs csatlakoztatott adatforrás.</p>
                <p className="text-xs" style={{ color: textMuted }}>
                  A Google Ads / GA4 / Search Console / Meta Ads OAuth flow-i a Google Cloud OAuth verification és Meta Ads Insights review lezárása után lesznek elérhetők (2-6 hét platformonként). Addig a mock adapter fut demo módban.
                </p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {connections.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
                    <div className="flex items-center gap-2">
                      {PLATFORM_META[c.platform]?.icon}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                          {PLATFORM_META[c.platform]?.label ?? c.platform}
                        </p>
                        <p className="text-xs" style={{ color: textMuted }}>{c.externalAccountName ?? c.externalAccountId}</p>
                      </div>
                    </div>
                    <button onClick={() => disconnectMutation.mutate({ profileId, connectionId: c.id })}
                      className="p-1.5 rounded" style={{ color: "var(--qa-danger)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowConnectionsModal(false)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: textMuted }}>Bezárás</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
