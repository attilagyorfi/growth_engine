/**
 * G2A Growth Engine – SEO Audit Page
 * Full-page SEO audit: scrape, analyze, AI insights, recommendations
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Search, Globe, AlertTriangle, CheckCircle, Info,
  Trash2, ChevronDown, ChevronUp, Loader2, RefreshCw,
  BarChart2, FileText, Zap, Shield, Image, Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Style tokens ──────────────────────────────────────────────────────────────
const cardBg = "oklch(0.18 0.022 255)";
const border = "oklch(1 0 0 / 8%)";
const textPrimary = "oklch(0.92 0.008 240)";
const textMuted = "oklch(0.55 0.015 240)";
const accent = "oklch(0.65 0.22 290)";
const green = "oklch(0.65 0.18 165)";
const yellow = "oklch(0.78 0.18 75)";
const red = "oklch(0.65 0.22 25)";
const blue = "oklch(0.6 0.2 255)";

// ─── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? green : score >= 50 ? yellow : red;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth={8} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold" style={{ color, fontFamily: "Sora, sans-serif" }}>{score}</span>
        <span className="text-xs" style={{ color: textMuted }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: "critical" | "warning" | "info" }) {
  const map = {
    critical: { label: "Kritikus", color: red, bg: "oklch(0.65 0.22 25 / 12%)", icon: <AlertTriangle size={11} /> },
    warning: { label: "Figyelmeztetés", color: yellow, bg: "oklch(0.78 0.18 75 / 12%)", icon: <AlertTriangle size={11} /> },
    info: { label: "Infó", color: blue, bg: "oklch(0.6 0.2 255 / 12%)", icon: <Info size={11} /> },
  };
  const { label, color, bg, icon } = map[severity];
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {icon} {label}
    </span>
  );
}

// ─── Issue card ────────────────────────────────────────────────────────────────
function IssueCard({ issue }: { issue: { severity: "critical" | "warning" | "info"; category: string; title: string; description: string; recommendation: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: border }}>
      <button className="w-full flex items-center gap-3 p-3 text-left" style={{ background: cardBg }} onClick={() => setOpen(o => !o)}>
        <SeverityBadge severity={issue.severity} />
        <span className="text-xs font-semibold flex-1" style={{ color: textPrimary }}>{issue.title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(1 0 0 / 5%)", color: textMuted }}>{issue.category}</span>
        {open ? <ChevronUp size={14} style={{ color: textMuted }} /> : <ChevronDown size={14} style={{ color: textMuted }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} style={{ overflow: "hidden" }}>
            <div className="px-4 pb-4 pt-2 space-y-2" style={{ background: "oklch(0.16 0.02 255)" }}>
              <p className="text-xs" style={{ color: textMuted }}>{issue.description}</p>
              <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "oklch(0.65 0.18 165 / 8%)" }}>
                <CheckCircle size={12} style={{ color: green, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "oklch(0.78 0.015 240)" }}>{issue.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Metric row ────────────────────────────────────────────────────────────────
function MetricRow({ label, value, good }: { label: string; value: string | number | boolean | null; good?: boolean }) {
  const display = value === null || value === undefined ? "N/A" : typeof value === "boolean" ? (value ? "✓ Igen" : "✗ Nem") : String(value);
  const color = good === undefined ? textPrimary : good ? green : red;
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: border }}>
      <span className="text-xs" style={{ color: textMuted }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color }}>{display}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SeoAudit() {
  const { activeProfile } = useProfile();
  const [url, setUrl] = useState(activeProfile?.website ?? "");
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"issues" | "meta" | "content" | "technical" | "ai">("issues");

  const { data: audits = [], refetch } = trpc.seo.getAudits.useQuery(
    { profileId: activeProfile?.id ?? "" },
    { enabled: !!activeProfile?.id }
  );

  const runAudit = trpc.seo.runAudit.useMutation({
    onSuccess: () => { refetch(); toast.success("SEO audit kész!"); },
    onError: (e) => toast.error(`Hiba: ${e.message}`),
  });

  const deleteAudit = trpc.seo.deleteAudit.useMutation({
    onSuccess: () => { refetch(); toast.success("Audit törölve"); },
  });

  const latestAudit = audits[0];
  const expanded = audits.find(a => a.id === expandedAudit) ?? latestAudit;

  if (!activeProfile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p style={{ color: textMuted }}>Válassz profilt a SEO audithoz.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>SEO Audit</h1>
            <p className="text-sm mt-0.5" style={{ color: textMuted }}>Teljes körű keresőoptimalizálási elemzés és javaslatok</p>
          </div>
        </div>

        {/* URL input + run */}
        <div className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: border }}>
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ background: "oklch(0.22 0.02 255)", borderColor: border }}>
              <Globe size={15} style={{ color: textMuted, flexShrink: 0 }} />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && url) runAudit.mutate({ profileId: activeProfile.id, url }); }}
                placeholder="https://pelda.hu"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: textPrimary }}
              />
            </div>
            <button
              onClick={() => { if (!url) { toast.error("Add meg a weboldal URL-jét"); return; } runAudit.mutate({ profileId: activeProfile.id, url }); }}
              disabled={runAudit.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: runAudit.isPending ? "oklch(0.45 0.15 290)" : accent }}>
              {runAudit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {runAudit.isPending ? "Elemzés..." : "Audit indítása"}
            </button>
          </div>
          {runAudit.isPending && (
            <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: textMuted }}>
              <Loader2 size={12} className="animate-spin" />
              Weboldal betöltése, HTML elemzés, AI értékelés... Ez 20-40 másodpercet vehet igénybe.
            </div>
          )}
        </div>

        {/* Audit history list */}
        {audits.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {audits.map(a => (
              <button key={a.id}
                onClick={() => setExpandedAudit(a.id === expandedAudit ? null : a.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border"
                style={{
                  background: a.id === (expandedAudit ?? latestAudit?.id) ? "oklch(0.65 0.22 290 / 15%)" : "oklch(0.22 0.02 255)",
                  borderColor: a.id === (expandedAudit ?? latestAudit?.id) ? "oklch(0.65 0.22 290 / 40%)" : border,
                  color: a.id === (expandedAudit ?? latestAudit?.id) ? accent : textMuted,
                }}>
                <BarChart2 size={11} />
                {new Date(a.createdAt).toLocaleDateString("hu-HU")} – {a.score ?? "?"}/100
              </button>
            ))}
          </div>
        )}

        {/* Audit result */}
        {expanded?.report && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Score + summary */}
            <div className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center gap-6">
                <ScoreRing score={expanded.score ?? 0} />
                <div className="flex-1">
                  <p className="text-base font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: textPrimary }}>{expanded.url}</p>
                  <p className="text-xs mb-3" style={{ color: textMuted }}>
                    {new Date(expanded.createdAt).toLocaleString("hu-HU")} •{" "}
                    {expanded.report.issues.filter(i => i.severity === "critical").length} kritikus,{" "}
                    {expanded.report.issues.filter(i => i.severity === "warning").length} figyelmeztetés,{" "}
                    {expanded.report.issues.filter(i => i.severity === "info").length} infó
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: "HTTPS", ok: expanded.report.performance.hasHttps },
                      { label: "Sitemap", ok: expanded.report.performance.hasSitemap },
                      { label: "robots.txt", ok: expanded.report.performance.hasRobotsTxt },
                      { label: "Viewport", ok: expanded.report.technical.hasViewport },
                      { label: "Strukt. adat", ok: expanded.report.technical.hasStructuredData },
                    ].map(({ label, ok }) => (
                      <span key={label} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: ok ? "oklch(0.65 0.18 165 / 12%)" : "oklch(0.65 0.22 25 / 12%)", color: ok ? green : red }}>
                        {ok ? <CheckCircle size={10} /> : <AlertTriangle size={10} />} {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setUrl(expanded.url); runAudit.mutate({ profileId: activeProfile.id, url: expanded.url }); }}
                    className="p-2 rounded-lg" style={{ background: "oklch(0.22 0.02 255)", color: textMuted }} title="Újrafuttatás">
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={() => deleteAudit.mutate({ id: expanded.id })}
                    className="p-2 rounded-lg" style={{ background: "oklch(0.65 0.22 25 / 10%)", color: red }} title="Törlés">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: "issues", label: "Problémák", icon: <AlertTriangle size={13} /> },
                { id: "meta", label: "Meta adatok", icon: <FileText size={13} /> },
                { id: "content", label: "Tartalom", icon: <BarChart2 size={13} /> },
                { id: "technical", label: "Technikai", icon: <Shield size={13} /> },
                { id: "ai", label: "AI elemzés", icon: <Zap size={13} /> },
              ].map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                  style={{
                    background: activeTab === tab.id ? "oklch(0.65 0.22 290 / 15%)" : "oklch(0.22 0.02 255)",
                    color: activeTab === tab.id ? accent : textMuted,
                  }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="rounded-2xl border p-5" style={{ background: cardBg, borderColor: border }}>
              {activeTab === "issues" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold mb-3" style={{ color: textMuted }}>
                    {expanded.report.issues.length} azonosított probléma
                  </p>
                  {expanded.report.issues.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle size={32} className="mx-auto mb-2" style={{ color: green }} />
                      <p className="text-sm font-semibold" style={{ color: green }}>Nincs azonosított probléma!</p>
                    </div>
                  ) : (
                    <>
                      {expanded.report.issues.filter(i => i.severity === "critical").map((issue, idx) => <IssueCard key={idx} issue={issue} />)}
                      {expanded.report.issues.filter(i => i.severity === "warning").map((issue, idx) => <IssueCard key={idx} issue={issue} />)}
                      {expanded.report.issues.filter(i => i.severity === "info").map((issue, idx) => <IssueCard key={idx} issue={issue} />)}
                    </>
                  )}
                </div>
              )}

              {activeTab === "meta" && (
                <div className="space-y-1">
                  <MetricRow label="Title" value={expanded.report.meta.title} />
                  <MetricRow label="Title hossz" value={`${expanded.report.meta.titleLength} karakter`} good={expanded.report.meta.titleLength >= 30 && expanded.report.meta.titleLength <= 60} />
                  <MetricRow label="Meta description" value={expanded.report.meta.description} />
                  <MetricRow label="Description hossz" value={`${expanded.report.meta.descriptionLength} karakter`} good={expanded.report.meta.descriptionLength >= 100 && expanded.report.meta.descriptionLength <= 160} />
                  <MetricRow label="Canonical URL" value={expanded.report.meta.canonical} good={!!expanded.report.meta.canonical} />
                  <MetricRow label="Robots" value={expanded.report.meta.robots ?? "nincs megadva"} />
                  <MetricRow label="OG Title" value={expanded.report.meta.ogTitle} good={!!expanded.report.meta.ogTitle} />
                  <MetricRow label="OG Description" value={expanded.report.meta.ogDescription} good={!!expanded.report.meta.ogDescription} />
                  <MetricRow label="OG Image" value={expanded.report.meta.ogImage ? "✓ Van" : "Hiányzik"} good={!!expanded.report.meta.ogImage} />
                  <MetricRow label="H1 fejlécek száma" value={expanded.report.headings.h1Count} good={expanded.report.headings.h1Count === 1} />
                  {expanded.report.headings.h1Texts.length > 0 && <MetricRow label="H1 szöveg" value={expanded.report.headings.h1Texts[0]} />}
                  <MetricRow label="H2 fejlécek száma" value={expanded.report.headings.h2Count} />
                  <MetricRow label="H3 fejlécek száma" value={expanded.report.headings.h3Count} />
                </div>
              )}

              {activeTab === "content" && (
                <div className="space-y-1">
                  <MetricRow label="Szószám" value={expanded.report.content.wordCount} good={expanded.report.content.wordCount >= 300} />
                  <MetricRow label="Belső linkek" value={expanded.report.content.internalLinks} />
                  <MetricRow label="Külső linkek" value={expanded.report.content.externalLinks} />
                  <MetricRow label="Összes kép" value={expanded.report.content.totalImages} />
                  <MetricRow label="Alt szöveg nélküli képek" value={expanded.report.content.imagesWithoutAlt} good={expanded.report.content.imagesWithoutAlt === 0} />
                  <MetricRow label="Oldal mérete" value={expanded.report.performance.pageSize ? `${Math.round(expanded.report.performance.pageSize / 1024)} KB` : "N/A"} />
                  <MetricRow label="Betöltési idő" value={expanded.report.performance.loadTime ? `${expanded.report.performance.loadTime} ms` : "N/A"} good={(expanded.report.performance.loadTime ?? 9999) < 3000} />
                </div>
              )}

              {activeTab === "technical" && (
                <div className="space-y-1">
                  <MetricRow label="HTTPS" value={expanded.report.performance.hasHttps} good={expanded.report.performance.hasHttps} />
                  <MetricRow label="Sitemap.xml" value={expanded.report.performance.hasSitemap} good={expanded.report.performance.hasSitemap} />
                  <MetricRow label="Robots.txt" value={expanded.report.performance.hasRobotsTxt} good={expanded.report.performance.hasRobotsTxt} />
                  <MetricRow label="Viewport meta tag" value={expanded.report.technical.hasViewport} good={expanded.report.technical.hasViewport} />
                  <MetricRow label="Charset meta tag" value={expanded.report.technical.hasCharset} good={expanded.report.technical.hasCharset} />
                  <MetricRow label="Favicon" value={expanded.report.technical.hasFavicon} good={expanded.report.technical.hasFavicon} />
                  <MetricRow label="Strukturált adat (JSON-LD)" value={expanded.report.technical.hasStructuredData} good={expanded.report.technical.hasStructuredData} />
                  <MetricRow label="Lang attribútum" value={expanded.report.technical.langAttribute ?? "Hiányzik"} good={!!expanded.report.technical.langAttribute} />
                </div>
              )}

              {activeTab === "ai" && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={14} style={{ color: accent }} />
                      <p className="text-sm font-bold" style={{ color: textPrimary }}>AI Elemzés</p>
                    </div>
                    {expanded.report.aiInsights ? (
                      <div className="text-sm leading-relaxed" style={{ color: "oklch(0.78 0.008 240)" }}>
                        <Streamdown>{expanded.report.aiInsights}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: textMuted }}>Az AI elemzés nem érhető el ehhez az audithoz.</p>
                    )}
                  </div>
                  {expanded.report.aiRecommendations && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle size={14} style={{ color: green }} />
                        <p className="text-sm font-bold" style={{ color: textPrimary }}>Cselekvési terv</p>
                      </div>
                      <div className="text-sm leading-relaxed" style={{ color: "oklch(0.78 0.008 240)" }}>
                        <Streamdown>{expanded.report.aiRecommendations}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {audits.length === 0 && !runAudit.isPending && (
          <div className="rounded-2xl border p-12 text-center" style={{ background: cardBg, borderColor: border }}>
            <Globe size={40} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
            <p className="text-base font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Még nincs SEO audit</p>
            <p className="text-sm" style={{ color: textMuted }}>Add meg a weboldal URL-jét fent, és indítsd el az elemzést.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
