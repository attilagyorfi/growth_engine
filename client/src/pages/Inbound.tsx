/**
 * G2A Growth Engine – Inbound Emails Page (tRPC-backed)
 * Features: Categorized inbound replies, read/unread, category change, detail view
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Inbox, Mail, ChevronDown, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useData, InboundEmail, InboundCategory } from "@/contexts/DataContext";

const categoryConfig: Record<InboundCategory, { label: string; color: string; cls: string; description: string }> = {
  meeting_request: { label: "Meeting kérés", color: "var(--qa-success)", cls: "status-replied", description: "Az érdeklődő időpontot szeretne egyeztetni." },
  interested: { label: "Érdeklődő", color: "var(--qa-accent)", cls: "status-sent", description: "Pozitív visszajelzés, de konkrét lépés nélkül." },
  question: { label: "Kérdés", color: "var(--qa-warning)", cls: "status-pending", description: "Több információt kér a szolgáltatásról." },
  not_interested: { label: "Nem érdekli", color: "var(--qa-danger)", cls: "status-rejected", description: "Visszautasítás, nem érdekli az ajánlat." },
  out_of_office: { label: "Irodán kívül", color: "var(--qa-fg3)", cls: "status-new", description: "Automatikus távolléti üzenet." },
  unsubscribe: { label: "Leiratkozás", color: "oklch(0.55 0.18 25)", cls: "status-rejected", description: "Leiratkozási kérés." },
  other: { label: "Egyéb", color: "var(--qa-fg4)", cls: "status-new", description: "Egyéb kategória." },
};

const categoryOptions: InboundCategory[] = ["meeting_request", "interested", "question", "not_interested", "out_of_office", "unsubscribe", "other"];

export default function Inbound() {
  const { inbound, inboundLoading, markInboundRead, updateInboundCategory } = useData();
  const [viewEmail, setViewEmail] = useState<InboundEmail | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<InboundCategory | "">("");

  const handleCategoryChange = async (id: string, category: InboundCategory) => {
    try {
      await updateInboundCategory(id, category);
      setOpenCategoryId(null);
      toast.success(`Kategória frissítve: ${categoryConfig[category].label}`);
    } catch {
      toast.error("Kategória frissítés sikertelen.");
    }
  };

  const openView = async (email: InboundEmail) => {
    if (!email.read) {
      try { await markInboundRead(email.id); } catch { /* ignore */ }
    }
    setViewEmail(email);
  };

  const filtered = filterCategory ? inbound.filter((e) => e.category === filterCategory) : inbound;
  const unread = inbound.filter((e) => !e.read).length;

  const categoryCounts = categoryOptions.reduce((acc, cat) => {
    acc[cat] = inbound.filter((e) => e.category === cat).length;
    return acc;
  }, {} as Record<InboundCategory, number>);

  return (
    <DashboardLayout title="Inbound Emailek" subtitle="Beérkező válaszok kategorizálva és nyomon követve">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Összes Válasz", value: String(inbound.length), color: "var(--qa-accent)" },
          { label: "Olvasatlan", value: String(unread), color: "var(--qa-warning)" },
          { label: "Meeting Kérés", value: String(categoryCounts.meeting_request ?? 0), color: "var(--qa-success)" },
          { label: "Érdeklődő", value: String(categoryCounts.interested ?? 0), color: "var(--qa-danger)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-0.5" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterCategory("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === "" ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
          style={{ background: filterCategory === "" ? "var(--qa-accent)" : "var(--qa-surface2)" }}
        >
          Összes ({inbound.length})
        </button>
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors`}
            style={{
              background: filterCategory === cat ? categoryConfig[cat].color : "var(--qa-surface2)",
              color: filterCategory === cat ? "white" : "var(--qa-fg3)",
            }}
          >
            {categoryConfig[cat].label} ({categoryCounts[cat] ?? 0})
          </button>
        ))}
      </div>

      {/* Email List */}
      <div className="space-y-3">
        {inboundLoading ? (
          <div className="p-8 text-center text-gray-400">Betöltés...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nincs beérkező email.</div>
        ) : filtered.map((email) => {
          const catCfg = email.category ? categoryConfig[email.category] : null;
          return (
            <div
              key={email.id}
              className={`bg-gray-800 border rounded-xl p-4 transition-colors ${!email.read ? "border-blue-500/40" : "border-gray-700"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: catCfg ? `color-mix(in oklch, ${catCfg.color} 15%, transparent)` : "var(--qa-surface2)", color: catCfg?.color ?? "var(--qa-fg3)" }}>
                    <Mail size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!email.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--qa-accent)" }} />}
                      <span className="text-white font-medium text-sm truncate">{email.subject}</span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      <span className="text-gray-300">{email.fromName ?? email.from}</span>
                      {email.company && <span className="text-gray-500"> · {email.company}</span>}
                    </div>
                    <div className="text-gray-500 text-xs mt-1 line-clamp-1">{email.body.slice(0, 100)}...</div>
                    <div className="text-gray-600 text-xs mt-1">
                      {email.receivedAt ? new Date(email.receivedAt).toLocaleDateString("hu-HU") : "–"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Category dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenCategoryId(openCategoryId === email.id ? null : email.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${catCfg?.cls ?? "status-new"}`}
                    >
                      {catCfg?.label ?? "Kategorizálatlan"} <ChevronDown size={10} />
                    </button>
                    {openCategoryId === email.id && (
                      <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[160px]">
                        {categoryOptions.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => handleCategoryChange(email.id, cat)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: categoryConfig[cat].color }} />
                            {categoryConfig[cat].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => openView(email)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
                  >
                    <Eye size={12} /> Megtekintés
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {viewEmail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{viewEmail.subject}</h2>
              <button onClick={() => setViewEmail(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Feladó:</span> <span className="text-white">{viewEmail.fromName ?? viewEmail.from}</span></div>
              <div><span className="text-gray-400">Email:</span> <span className="text-white">{viewEmail.from}</span></div>
              {viewEmail.company && <div><span className="text-gray-400">Cég:</span> <span className="text-white">{viewEmail.company}</span></div>}
              <div>
                <span className="text-gray-400">Kategória:</span>
                {viewEmail.category && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${categoryConfig[viewEmail.category]?.cls ?? "status-new"}`}>
                    {categoryConfig[viewEmail.category]?.label}
                  </span>
                )}
              </div>
              <div><span className="text-gray-400">Beérkezett:</span> <span className="text-white">{viewEmail.receivedAt ? new Date(viewEmail.receivedAt).toLocaleDateString("hu-HU") : "–"}</span></div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Üzenet</label>
              <pre className="text-gray-300 text-sm whitespace-pre-wrap bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">{viewEmail.body}</pre>
            </div>
            {viewEmail.category && categoryConfig[viewEmail.category] && (
              <div className="rounded-lg p-3" style={{ background: `color-mix(in oklch, ${categoryConfig[viewEmail.category].color} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${categoryConfig[viewEmail.category].color} 30%, transparent)` }}>
                <p className="text-xs font-semibold mb-1" style={{ color: categoryConfig[viewEmail.category].color }}>
                  <Inbox size={12} className="inline mr-1" />
                  {categoryConfig[viewEmail.category].label}
                </p>
                <p className="text-xs text-gray-300">{categoryConfig[viewEmail.category].description}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setViewEmail(null)} className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm">Bezárás</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
