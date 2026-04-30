/*
 * G2A Growth Engine – ContentCreator Page
 * Design: "Dark Ops Dashboard"
 * Features: Post cards, calendar view, real AI image generation, edit, approve, schedule
 */

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import {
  PenTool, Linkedin, Facebook, Instagram, Image, Edit2, CheckCircle,
  Calendar, ChevronDown, Eye, Sparkles, Loader2, LayoutGrid, CalendarDays,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { hu } from "date-fns/locale";

type PostStatus = "draft" | "pending_approval" | "approved" | "scheduled" | "published";
type Platform = "linkedin" | "facebook" | "instagram";

type Post = {
  id: string;
  platform: Platform;
  title: string;
  text: string;
  imageUrl: string;
  imagePrompt: string;
  status: PostStatus;
  scheduledAt?: string;
  weekRef: string;
  pillar: string;
};

const platformConfig: Record<Platform, { label: string; icon: React.ReactNode; color: string }> = {
  linkedin: { label: "LinkedIn", icon: <Linkedin size={14} />, color: "var(--qa-accent)" },
  facebook: { label: "Facebook", icon: <Facebook size={14} />, color: "oklch(0.55 0.2 240)" },
  instagram: { label: "Instagram", icon: <Instagram size={14} />, color: "oklch(0.6 0.2 330)" },
};

const statusConfig: Record<PostStatus, { label: string; cls: string }> = {
  draft: { label: "Piszkozat", cls: "status-new" },
  pending_approval: { label: "Jóváhagyásra vár", cls: "status-pending" },
  approved: { label: "Jóváhagyva", cls: "status-sent" },
  scheduled: { label: "Ütemezve", cls: "status-replied" },
  published: { label: "Publikálva", cls: "status-replied" },
};

const statusOptions: PostStatus[] = ["draft", "pending_approval", "approved", "scheduled", "published"];

const initialPosts: Post[] = [
  {
    id: "p1", platform: "linkedin", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI eszközök a napi marketing munkában",
    text: `A legtöbb vállalat még mindig manuálisan végzi azt, amit az AI másodpercek alatt elvégez.\n\nAz outbound értékesítés, a tartalomgyártás és a kampányoptimalizálás – mind automatizálható. A G2A Marketing Growth Engine napi szinten azonosít potenciális ügyfeleket, személyre szabott emaileket generál és social media tartalmakat készít.\n\nEz nem a jövő – ez ma elérhető.\n\n👉 Kíváncsi vagy, hogyan működik? Írj üzenetet!\n\n#AIMarketing #B2BMarketing #GrowthEngine`,
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    imagePrompt: "Professional AI marketing dashboard with data visualization, dark modern UI, blue accent colors",
    status: "pending_approval",
  },
  {
    id: "p2", platform: "facebook", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI marketing – Facebook poszt",
    text: `Tudtad, hogy az AI ma már képes személyre szabott üzleti emaileket írni, stratégiát alkotni és tartalmat gyártani?\n\nA G2A Marketing ezt valósítja meg ügyfeleinek naponta.\n\nSzeretnéd látni, hogyan működik? Kommentelj vagy küldj üzenetet! 👇`,
    imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
    imagePrompt: "Business team working with AI tools, modern office, warm lighting, professional atmosphere",
    status: "pending_approval",
    scheduledAt: "2026-03-25 10:00",
  },
  {
    id: "p3", platform: "instagram", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI marketing – Instagram poszt",
    text: `AI + Marketing = Skálázható növekedés 🚀\n\nNapi automatizált lead-azonosítás ✅\nSzemélyre szabott email piszkozatok ✅\nHeti social media tartalmak ✅\n\n#AIMarketing #B2BMarketing #GrowthEngine`,
    imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    imagePrompt: "Minimalist marketing growth chart, clean design, vibrant colors, social media aesthetic",
    status: "draft",
    scheduledAt: "2026-03-27 09:00",
  },
  {
    id: "p4", platform: "linkedin", weekRef: "2. Hét", pillar: "Stratégiai gondolkodás",
    title: "Stratégiai vs. taktikai marketing",
    text: `A legtöbb cég taktikázik, miközben stratégiára lenne szüksége.\n\nTaktika = posztolás. Stratégia = rendszer.\n\nAz igazi növekedés nem abból fakad, hogy minden nap posztolsz. Hanem abból, hogy minden poszt egy nagyobb cél felé visz.\n\n#Stratégia #B2BMarketing #MarketingStrategy`,
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    imagePrompt: "Strategic planning board with charts and arrows, professional business setting, dark theme",
    status: "approved",
    scheduledAt: "2026-04-01 10:00",
  },
];

// ─── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({ posts, onPostClick }: { posts: Post[]; onPostClick: (p: Post) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 2, 1)); // March 2026

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (getDay(days[0]) + 6) % 7; // Monday-based

  const scheduledPosts = useMemo(() => {
    const map: Record<string, Post[]> = {};
    posts.forEach((p) => {
      if (p.scheduledAt) {
        const dateKey = p.scheduledAt.slice(0, 10);
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(p);
      }
    });
    return map;
  }, [posts]);

  const weekDays = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

  return (
    <div className="g2a-card">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--qa-fg2)", fontFamily: "Sora, sans-serif" }}>
          {format(currentMonth, "yyyy. MMMM", { locale: hu })}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--qa-fg3)" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrentMonth(new Date(2026, 2, 1))}
            className="px-2 py-1 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "var(--qa-fg3)" }}>
            Ma
          </button>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--qa-fg3)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs py-1" style={{ color: "var(--qa-fg4)" }}>{d}</div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for first week offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayPosts = scheduledPosts[dateKey] ?? [];
          const isToday = isSameDay(day, new Date());
          return (
            <div key={dateKey} className="min-h-[60px] rounded-lg p-1.5 transition-colors"
              style={{ background: isToday ? "oklch(from var(--qa-accent) l c h / 10%)" : "oklch(0.22 0.02 255 / 50%)", border: isToday ? "1px solid oklch(from var(--qa-accent) l c h / 30%)" : "1px solid transparent" }}>
              <span className="text-xs block mb-1" style={{ color: isToday ? "oklch(0.7 0.2 255)" : "var(--qa-fg3)", fontWeight: isToday ? "600" : "400" }}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 2).map((p) => (
                  <button key={p.id} onClick={() => onPostClick(p)}
                    className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate transition-colors hover:opacity-80"
                    style={{ background: platformConfig[p.platform].color + "30", color: platformConfig[p.platform].color }}>
                    {platformConfig[p.platform].icon}
                    <span className="ml-1 text-xs">{p.title.slice(0, 12)}…</span>
                  </button>
                ))}
                {dayPosts.length > 2 && (
                  <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>+{dayPosts.length - 2} több</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: "1px solid var(--qa-border)" }}>
        {(Object.keys(platformConfig) as Platform[]).map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <span style={{ color: platformConfig[p].color }}>{platformConfig[p].icon}</span>
            <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>{platformConfig[p].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ContentCreator() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [viewPost, setViewPost] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState({ text: "", imageUrl: "", imagePrompt: "" });
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "">("");

  // Real AI image generation via tRPC
  const generateImageMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setEditForm((p) => ({ ...p, imageUrl: data.url! }));
        toast.success("Kép sikeresen generálva!", { description: "Az URL automatikusan be lett töltve." });
      }
    },
    onError: (err) => {
      toast.error("Képgenerálás sikertelen", { description: err.message });
    },
  });

  const handleGenerateImage = () => {
    if (!editForm.imagePrompt.trim()) {
      toast.error("Adj meg egy kép promptot a generáláshoz!");
      return;
    }
    generateImageMutation.mutate({ prompt: editForm.imagePrompt });
  };

  const updateStatus = (id: string, status: PostStatus) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    setOpenStatusId(null);
    toast.success(`Státusz frissítve: ${statusConfig[status].label}`);
  };

  const handleApprove = (post: Post) => {
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: "approved" } : p));
    setViewPost(null);
    toast.success(`Poszt jóváhagyva: ${post.title}`);
  };

  const handleSaveEdit = () => {
    if (!editPost) return;
    setPosts((prev) => prev.map((p) => p.id === editPost.id ? { ...p, text: editForm.text, imageUrl: editForm.imageUrl, imagePrompt: editForm.imagePrompt } : p));
    setEditPost(null);
    toast.success("Poszt mentve.");
  };

  const handleSchedule = (post: Post) => {
    if (!scheduleDate) { toast.error("Adj meg egy dátumot!"); return; }
    const scheduledAt = `${scheduleDate} ${scheduleTime}`;
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: "scheduled", scheduledAt } : p));
    setSchedulePost(null);
    toast.success(`Poszt ütemezve: ${scheduledAt}`, { description: `Platform: ${platformConfig[post.platform].label}` });
  };

  const openEdit = (post: Post) => {
    setEditForm({ text: post.text, imageUrl: post.imageUrl, imagePrompt: post.imagePrompt });
    setEditPost(post);
    setViewPost(null);
  };

  const filtered = filterPlatform ? posts.filter((p) => p.platform === filterPlatform) : posts;
  const weeks = Array.from(new Set(posts.map((p) => p.weekRef)));

  return (
    <DashboardLayout title="Tartalomgyártó" subtitle="Bejegyzések létrehozása, szerkesztése és ütemezése">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Összes Poszt", value: String(posts.length), color: "var(--qa-accent)" },
          { label: "Jóváhagyásra Vár", value: String(posts.filter((p) => p.status === "pending_approval").length), color: "var(--qa-warning)" },
          { label: "Ütemezve", value: String(posts.filter((p) => p.status === "scheduled").length), color: "oklch(0.65 0.2 165)" },
          { label: "Publikálva", value: String(posts.filter((p) => p.status === "published").length), color: "oklch(0.7 0.18 140)" },
        ].map((s) => (
          <div key={s.label} className="g2a-card">
            <p className="text-xs mb-1" style={{ color: "var(--qa-fg3)" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "Sora, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {/* Platform filter */}
          <button onClick={() => setFilterPlatform("")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: filterPlatform === "" ? "var(--qa-accent)" : "var(--qa-surface2)", color: filterPlatform === "" ? "white" : "var(--qa-fg3)" }}>
            Összes
          </button>
          {(Object.keys(platformConfig) as Platform[]).map((p) => (
            <button key={p} onClick={() => setFilterPlatform(p === filterPlatform ? "" : p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: filterPlatform === p ? platformConfig[p].color + "30" : "var(--qa-surface2)", color: filterPlatform === p ? platformConfig[p].color : "var(--qa-fg3)" }}>
              {platformConfig[p].icon}{platformConfig[p].label}
            </button>
          ))}
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
          <button onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ background: viewMode === "grid" ? "var(--qa-accent)" : "transparent", color: viewMode === "grid" ? "white" : "var(--qa-fg3)" }}>
            <LayoutGrid size={13} />Lista
          </button>
          <button onClick={() => setViewMode("calendar")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ background: viewMode === "calendar" ? "var(--qa-accent)" : "transparent", color: viewMode === "calendar" ? "white" : "var(--qa-fg3)" }}>
            <CalendarDays size={13} />Naptár
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <CalendarView posts={posts} onPostClick={(p) => setViewPost(p)} />
      )}

      {/* Grid View */}
      {viewMode === "grid" && weeks.map((week) => {
        const weekPosts = filtered.filter((p) => p.weekRef === week);
        if (weekPosts.length === 0) return null;
        return (
          <div key={week} className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--qa-fg4)" }}>{week}</h3>
            <div className="grid grid-cols-3 gap-4">
              {weekPosts.map((post) => (
                <div key={post.id} className="g2a-card flex flex-col gap-3">
                  {/* Image */}
                  {post.imageUrl && (
                    <div className="relative rounded-lg overflow-hidden" style={{ height: 140 }}>
                      <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.15 0.02 255 / 80%), transparent)" }} />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        <span style={{ color: platformConfig[post.platform].color }}>{platformConfig[post.platform].icon}</span>
                        <span className="text-xs font-medium" style={{ color: "white" }}>{platformConfig[post.platform].label}</span>
                      </div>
                    </div>
                  )}
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--qa-fg2)", fontFamily: "Sora, sans-serif" }}>{post.title}</p>
                      {/* Status dropdown */}
                      <div className="relative flex-shrink-0">
                        <button onClick={() => setOpenStatusId(openStatusId === post.id ? null : post.id)}
                          className={`${statusConfig[post.status].cls} flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-pointer`}>
                          {statusConfig[post.status].label}<ChevronDown size={10} />
                        </button>
                        {openStatusId === post.id && (
                          <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden z-20 min-w-[140px]"
                            style={{ background: "oklch(0.2 0.02 255)", border: "1px solid var(--qa-border)", boxShadow: "0 8px 24px oklch(0 0 0 / 40%)" }}>
                            {statusOptions.map((s) => (
                              <button key={s} onClick={() => updateStatus(post.id, s)}
                                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5"
                                style={{ color: post.status === s ? "oklch(0.7 0.2 255)" : "oklch(0.72 0.01 240)" }}>
                                {statusConfig[s].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs line-clamp-2 mb-2" style={{ color: "var(--qa-fg3)" }}>{post.text.split("\n")[0]}</p>
                    {post.scheduledAt && (
                      <p className="text-xs mb-2" style={{ color: "oklch(0.65 0.2 165)" }}>
                        <Calendar size={10} className="inline mr-1" />{post.scheduledAt}
                      </p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--qa-border)" }}>
                    <button onClick={() => setViewPost(post)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "var(--qa-fg3)" }}>
                      <Eye size={12} />Megtekint
                    </button>
                    <button onClick={() => openEdit(post)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "var(--qa-fg3)" }}>
                      <Edit2 size={12} />Szerkeszt
                    </button>
                    {post.status !== "approved" && post.status !== "published" && (
                      <button onClick={() => handleApprove(post)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "oklch(0.65 0.2 165)" }}>
                        <CheckCircle size={12} />Jóváhagy
                      </button>
                    )}
                    {(post.status === "approved" || post.status === "scheduled") && (
                      <button onClick={() => { setSchedulePost(post); setScheduleDate(post.scheduledAt?.slice(0, 10) ?? ""); setScheduleTime(post.scheduledAt?.slice(11, 16) ?? "09:00"); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5 ml-auto" style={{ color: "oklch(0.6 0.2 290)" }}>
                        <Calendar size={12} />Ütemez
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* View Modal */}
      {viewPost && (
        <DetailModal isOpen={!!viewPost} onClose={() => setViewPost(null)} title={viewPost.title}
          subtitle={`${platformConfig[viewPost.platform].label} – ${viewPost.weekRef} – ${viewPost.pillar}`}
          footer={
            <>
              <button onClick={() => setViewPost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>Bezárás</button>
              <button onClick={() => openEdit(viewPost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-accent)", color: "white" }}>
                <Edit2 size={13} className="inline mr-1.5" />Szerkesztés
              </button>
              {viewPost.status !== "approved" && viewPost.status !== "published" && (
                <button onClick={() => handleApprove(viewPost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.65 0.2 165)", color: "white" }}>
                  <CheckCircle size={13} className="inline mr-1.5" />Jóváhagyás
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            {viewPost.imageUrl && (
              <img src={viewPost.imageUrl} alt={viewPost.title} className="w-full h-48 object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>
              {viewPost.text}
            </div>
            {viewPost.scheduledAt && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.65 0.2 165)" }}>
                <Calendar size={13} />Ütemezve: {viewPost.scheduledAt}
              </div>
            )}
          </div>
        </DetailModal>
      )}

      {/* Edit Modal */}
      {editPost && (
        <DetailModal isOpen={!!editPost} onClose={() => setEditPost(null)} title="Poszt Szerkesztése"
          subtitle={`${platformConfig[editPost.platform].label} – ${editPost.title}`}
          footer={
            <>
              <button onClick={() => setEditPost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>Mégse</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-accent)", color: "white" }}>Mentés</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--qa-fg3)" }}>Szöveg</label>
              <textarea value={editForm.text} onChange={(e) => setEditForm((p) => ({ ...p, text: e.target.value }))} rows={8}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", color: "var(--qa-fg2)", lineHeight: "1.6" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--qa-fg3)" }}>
                <Image size={12} className="inline mr-1" />Kép URL
              </label>
              <input type="text" value={editForm.imageUrl} onChange={(e) => setEditForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", color: "var(--qa-fg2)" }}
              />
              {editForm.imageUrl && (
                <img src={editForm.imageUrl} alt="preview" className="mt-2 w-full h-28 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--qa-fg3)" }}>Kép prompt (AI generáláshoz)</label>
                <button
                  onClick={handleGenerateImage}
                  disabled={generateImageMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: generateImageMutation.isPending ? "var(--qa-surface2)" : "oklch(0.6 0.2 290 / 20%)",
                    color: generateImageMutation.isPending ? "var(--qa-fg3)" : "oklch(0.7 0.2 290)",
                    cursor: generateImageMutation.isPending ? "not-allowed" : "pointer"
                  }}
                >
                  {generateImageMutation.isPending
                    ? <><Loader2 size={11} className="animate-spin" /> Generálás...</>
                    : <><Sparkles size={11} /> AI Kép Generálás</>}
                </button>
              </div>
              <textarea value={editForm.imagePrompt} onChange={(e) => setEditForm((p) => ({ ...p, imagePrompt: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", color: "var(--qa-fg2)" }}
                placeholder="Írd le a kívánt képet angolul, pl: professional business meeting, dark background, blue accents..."
              />
              {generateImageMutation.isPending && (
                <div className="mt-2 h-20 rounded-lg flex items-center justify-center" style={{ background: "var(--qa-surface2)", border: "1px dashed oklch(0.6 0.2 290 / 30%)" }}>
                  <div className="flex items-center gap-2" style={{ color: "oklch(0.6 0.2 290)" }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs">Kép generálása folyamatban... (5-20 mp)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DetailModal>
      )}

      {/* Schedule Modal */}
      {schedulePost && (
        <DetailModal isOpen={!!schedulePost} onClose={() => setSchedulePost(null)} title="Poszt Ütemezése"
          subtitle={`${schedulePost.title} – ${platformConfig[schedulePost.platform].label}`}
          footer={
            <>
              <button onClick={() => setSchedulePost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>Mégse</button>
              <button onClick={() => handleSchedule(schedulePost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 290)", color: "white" }}>
                <Calendar size={13} className="inline mr-1.5" />Ütemezés Mentése
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ background: "var(--qa-surface2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: platformConfig[schedulePost.platform].color }}>{platformConfig[schedulePost.platform].icon}</span>
                <p className="text-sm font-semibold" style={{ color: "var(--qa-fg2)", fontFamily: "Sora, sans-serif" }}>{schedulePost.title}</p>
              </div>
              <p className="text-xs line-clamp-2" style={{ color: "var(--qa-fg3)" }}>{schedulePost.text.split("\n")[0]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--qa-fg3)" }}>Dátum *</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", color: "var(--qa-fg2)", colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--qa-fg3)" }}>Időpont</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "var(--qa-surface2)", border: "1px solid var(--qa-border)", color: "var(--qa-fg2)", colorScheme: "dark" }}
                />
              </div>
            </div>
            <div className="rounded-lg p-3 text-xs" style={{ background: "oklch(0.6 0.2 290 / 10%)", color: "oklch(0.65 0.2 290)" }}>
              A poszt az ütemezett időpontban automatikusan megjelenik a naptár nézetben. A tényleges publikáláshoz a Social Media fiókot össze kell kötni.
            </div>
          </div>
        </DetailModal>
      )}
    </DashboardLayout>
  );
}
