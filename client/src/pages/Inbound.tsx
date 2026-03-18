/*
 * G2A Growth Engine – Inbound Emails Page
 * Design: "Dark Ops Dashboard"
 * Features: Categorized inbound replies, read/unread, category change, detail view
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { Inbox, Mail, ChevronDown, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useData, InboundEmail, InboundCategory } from "@/contexts/DataContext";

const categoryConfig: Record<InboundCategory, { label: string; color: string; cls: string; description: string }> = {
  meeting_request: { label: "Meeting kérés", color: "oklch(0.65 0.18 165)", cls: "status-replied", description: "Az érdeklődő időpontot szeretne egyeztetni." },
  interested: { label: "Érdeklődő", color: "oklch(0.6 0.2 255)", cls: "status-sent", description: "Pozitív visszajelzés, de konkrét lépés nélkül." },
  request_info: { label: "Infót kér", color: "oklch(0.75 0.18 75)", cls: "status-pending", description: "Több információt kér a szolgáltatásról." },
  not_interested: { label: "Nem érdekli", color: "oklch(0.65 0.22 25)", cls: "status-rejected", description: "Visszautasítás, nem érdekli az ajánlat." },
  out_of_office: { label: "Irodán kívül", color: "oklch(0.55 0.015 240)", cls: "status-new", description: "Automatikus távolléti üzenet." },
  uncategorized: { label: "Kategorizálatlan", color: "oklch(0.5 0.015 240)", cls: "status-new", description: "Még nincs besorolva." },
};

const categoryOptions: InboundCategory[] = ["meeting_request", "interested", "request_info", "not_interested", "out_of_office", "uncategorized"];

export default function Inbound() {
  const { inbound, setInbound } = useData();
  const [viewEmail, setViewEmail] = useState<InboundEmail | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<InboundCategory | "">("");

  const updateCategory = (id: string, category: InboundCategory) => {
    setInbound((prev) => prev.map((e) => e.id === id ? { ...e, category, read: true } : e));
    setOpenCategoryId(null);
    toast.success(`Kategória frissítve: ${categoryConfig[category].label}`);
  };

  const markRead = (id: string) => {
    setInbound((prev) => prev.map((e) => e.id === id ? { ...e, read: true } : e));
  };

  const openView = (email: InboundEmail) => {
    markRead(email.id);
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
          { label: "Összes Válasz", value: String(inbound.length), color: "oklch(0.6 0.2 255)" },
          { label: "Olvasatlan", value: String(unread), color: "oklch(0.75 0.18 75)" },
          { label: "Meeting Kérés", value: String(categoryCounts.meeting_request), color: "oklch(0.65 0.18 165)" },
          { label: "Érdeklődő", value: String(categoryCounts.interested), color: "oklch(0.6 0.2 255)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* Category Sidebar */}
        <div className="col-span-1 space-y-2">
          <div className="g2a-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "oklch(0.5 0.015 240)", fontFamily: "Sora, sans-serif" }}>Kategóriák</p>
            <button
              onClick={() => setFilterCategory("")}
              className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-all"
              style={{
                background: filterCategory === "" ? "oklch(0.6 0.2 255 / 15%)" : "transparent",
                color: filterCategory === "" ? "oklch(0.75 0.18 255)" : "oklch(0.65 0.015 240)",
              }}
            >
              <div className="flex items-center gap-2">
                <Inbox size={13} />
                Összes
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(1 0 0 / 8%)" }}>{inbound.length}</span>
            </button>
            {categoryOptions.map((cat) => {
              const cfg = categoryConfig[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-all"
                  style={{
                    background: filterCategory === cat ? `${cfg.color.replace(")", " / 15%)")}` : "transparent",
                    color: filterCategory === cat ? cfg.color : "oklch(0.65 0.015 240)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                    {cfg.label}
                  </div>
                  {categoryCounts[cat] > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(1 0 0 / 8%)" }}>{categoryCounts[cat]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email List */}
        <div className="col-span-3 g2a-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              {filterCategory ? categoryConfig[filterCategory].label : "Összes Beérkező Email"}
              <span className="ml-2 text-xs font-normal" style={{ color: "oklch(0.5 0.015 240)" }}>({filtered.length})</span>
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: "oklch(1 0 0 / 6%)" }}>
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm" style={{ color: "oklch(0.5 0.015 240)" }}>Nincs email ebben a kategóriában.</p>
              </div>
            ) : filtered.map((email) => {
              const cat = categoryConfig[email.category];
              return (
                <div key={email.id} className="px-5 py-4 flex items-start gap-4" style={{ background: email.read ? "transparent" : "oklch(0.6 0.2 255 / 4%)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 relative" style={{ background: `${cat.color.replace(")", " / 12%)")}` }}>
                    <Mail size={16} style={{ color: cat.color }} />
                    {!email.read && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.65 0.22 25)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>
                          {email.from}
                          {!email.read && <span className="ml-2 text-xs font-normal" style={{ color: "oklch(0.65 0.22 25)" }}>● Új</span>}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>{email.company} · {email.date}</p>
                        <p className="text-xs mt-0.5 font-medium" style={{ color: "oklch(0.65 0.015 240)" }}>{email.subject}</p>
                      </div>
                      {/* Category Dropdown */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenCategoryId(openCategoryId === email.id ? null : email.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium status-badge ${cat.cls}`}
                        >
                          {cat.label}
                          <ChevronDown size={11} />
                        </button>
                        {openCategoryId === email.id && (
                          <div className="absolute right-0 top-8 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "oklch(0.2 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)", minWidth: "170px" }}>
                            {categoryOptions.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => updateCategory(email.id, cat)}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                                style={{ color: email.category === cat ? "oklch(0.75 0.18 255)" : "oklch(0.72 0.01 240)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 6%)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryConfig[cat].color }} />
                                {categoryConfig[cat].label}
                                {email.category === cat && <CheckCircle size={10} className="ml-auto" style={{ color: "oklch(0.75 0.18 255)" }} />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs mt-2 line-clamp-2" style={{ color: "oklch(0.5 0.015 240)" }}>
                      {email.body.split("\n")[0]}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => openView(email)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}>
                        Megtekintés
                      </button>
                      <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>
                        {cat.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewEmail && (
        <DetailModal isOpen={!!viewEmail} onClose={() => setViewEmail(null)} title={`${viewEmail.from} – ${viewEmail.company}`} subtitle={viewEmail.subject}
          footer={
            <button onClick={() => setViewEmail(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Bezárás</button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Feladó", value: viewEmail.from },
                { label: "Cég", value: viewEmail.company },
                { label: "Tárgy", value: viewEmail.subject },
                { label: "Dátum", value: viewEmail.date },
              ].map((f) => (
                <div key={f.label} className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
                  <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>{f.label}</p>
                  <p className="text-sm font-medium" style={{ color: "oklch(0.88 0.008 240)" }}>{f.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg p-3" style={{ background: `${categoryConfig[viewEmail.category].color.replace(")", " / 10%)")}`, border: `1px solid ${categoryConfig[viewEmail.category].color.replace(")", " / 25%)")}` }}>
              <p className="text-xs font-semibold mb-1" style={{ color: categoryConfig[viewEmail.category].color, fontFamily: "Sora, sans-serif" }}>
                Kategória: {categoryConfig[viewEmail.category].label}
              </p>
              <p className="text-xs" style={{ color: "oklch(0.65 0.015 240)" }}>{categoryConfig[viewEmail.category].description}</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 8%)" }}>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>EMAIL SZÖVEG</p>
              {viewEmail.body.split("\n").map((line, i) => (
                line === "" ? <div key={i} className="h-3" /> : <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>
              ))}
            </div>
          </div>
        </DetailModal>
      )}

      {openCategoryId && <div className="fixed inset-0 z-10" onClick={() => setOpenCategoryId(null)} />}
    </DashboardLayout>
  );
}
