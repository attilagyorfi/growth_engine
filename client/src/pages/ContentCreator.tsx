/*
 * G2A Growth Engine – ContentCreator Page
 * Design: "Dark Ops Dashboard"
 * Features: Post cards per platform, edit text, edit image URL/prompt, approve, schedule
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import DetailModal from "@/components/DetailModal";
import { PenTool, Linkedin, Facebook, Instagram, Image, Edit2, CheckCircle, Calendar, ChevronDown, Eye, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
  linkedin: { label: "LinkedIn", icon: <Linkedin size={14} />, color: "oklch(0.55 0.18 255)" },
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

const unsplashImages = [
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
];

const initialPosts: Post[] = [
  {
    id: "p1", platform: "linkedin", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI eszközök a napi marketing munkában",
    text: `A legtöbb vállalat még mindig manuálisan végzi azt, amit az AI másodpercek alatt elvégez.\n\nAz outbound értékesítés, a tartalomgyártás és a kampányoptimalizálás – mind automatizálható. A G2A Marketing Growth Engine napi szinten azonosít potenciális ügyfeleket, személyre szabott emaileket generál és social media tartalmakat készít.\n\nEz nem a jövő – ez ma elérhető.\n\n👉 Kíváncsi vagy, hogyan működik? Írj üzenetet!\n\n#AIMarketing #B2BMarketing #GrowthEngine`,
    imageUrl: unsplashImages[0],
    imagePrompt: "Professional AI marketing dashboard with data visualization, dark modern UI, blue accent colors",
    status: "pending_approval",
  },
  {
    id: "p2", platform: "facebook", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI marketing – Facebook poszt",
    text: `Tudtad, hogy az AI ma már képes személyre szabott üzleti emaileket írni, stratégiát alkotni és tartalmat gyártani?\n\nA G2A Marketing ezt valósítja meg ügyfeleinek naponta. Automatizált lead-gyűjtés, email piszkozatok és social media tartalmak – mindezt emberi jóváhagyással kombinálva.\n\nSzeretnéd látni, hogyan működik? Kommentelj vagy küldj üzenetet! 👇`,
    imageUrl: unsplashImages[1],
    imagePrompt: "Business team working with AI tools, modern office, warm lighting, professional atmosphere",
    status: "pending_approval",
  },
  {
    id: "p3", platform: "instagram", weekRef: "1. Hét", pillar: "AI a marketingben",
    title: "AI marketing – Instagram poszt",
    text: `AI + Marketing = Skálázható növekedés 🚀\n\nNapi automatizált lead-azonosítás ✅\nSzemélyre szabott email piszkozatok ✅\nHeti social media tartalmak ✅\n\nMindezt emberi kontroll mellett.\n\n#AIMarketing #B2BMarketing #GrowthEngine #MarketingAutomation`,
    imageUrl: unsplashImages[2],
    imagePrompt: "Minimalist marketing growth chart, clean design, vibrant colors, social media aesthetic",
    status: "draft",
  },
  {
    id: "p4", platform: "linkedin", weekRef: "2. Hét", pillar: "Stratégiai gondolkodás",
    title: "Stratégiai vs. taktikai marketing",
    text: `A legtöbb cég taktikázik, miközben stratégiára lenne szüksége.\n\nTaktika = posztolás. Stratégia = rendszer.\n\nAz igazi növekedés nem abból fakad, hogy minden nap posztolsz. Hanem abból, hogy minden poszt egy nagyobb cél felé visz.\n\nA G2A Marketing Growth Engine ezt a rendszert építi fel – automatizáltan, emberi jóváhagyással.\n\n#Stratégia #B2BMarketing #MarketingStrategy`,
    imageUrl: unsplashImages[3],
    imagePrompt: "Strategic planning board with charts and arrows, professional business setting, dark theme",
    status: "draft",
  },
];

export default function ContentCreator() {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [viewPost, setViewPost] = useState<Post | null>(null);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [schedulePost, setSchedulePost] = useState<Post | null>(null);
  const [editForm, setEditForm] = useState({ text: "", imageUrl: "", imagePrompt: "" });
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "">("");
  const [generatingImage, setGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
    if (!editForm.imagePrompt.trim()) {
      toast.error("Adj meg egy kép promptot a generatáláshoz!");
      return;
    }
    setGeneratingImage(true);
    // Simulate AI image generation with a relevant Unsplash image based on prompt keywords
    await new Promise((r) => setTimeout(r, 1800));
    const promptLower = editForm.imagePrompt.toLowerCase();
    let generatedUrl = "";
    if (promptLower.includes("ai") || promptLower.includes("tech") || promptLower.includes("data")) {
      generatedUrl = `https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80&t=${Date.now()}`;
    } else if (promptLower.includes("team") || promptLower.includes("business") || promptLower.includes("office")) {
      generatedUrl = `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80&t=${Date.now()}`;
    } else if (promptLower.includes("social") || promptLower.includes("marketing") || promptLower.includes("growth")) {
      generatedUrl = `https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80&t=${Date.now()}`;
    } else if (promptLower.includes("strateg") || promptLower.includes("plan")) {
      generatedUrl = `https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80&t=${Date.now()}`;
    } else {
      generatedUrl = `https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&t=${Date.now()}`;
    }
    setEditForm((p) => ({ ...p, imageUrl: generatedUrl }));
    setGeneratingImage(false);
    toast.success("Kép sikeresen generálva!", { description: "Az URL automatikusan be lett töltve." });
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
          { label: "Összes Poszt", value: String(posts.length), color: "oklch(0.6 0.2 255)" },
          { label: "Jóváhagyásra Vár", value: String(posts.filter((p) => p.status === "pending_approval").length), color: "oklch(0.75 0.18 75)" },
          { label: "Jóváhagyva", value: String(posts.filter((p) => p.status === "approved").length), color: "oklch(0.65 0.18 165)" },
          { label: "Ütemezve", value: String(posts.filter((p) => p.status === "scheduled").length), color: "oklch(0.6 0.2 290)" },
        ].map((s) => (
          <div key={s.label} className="g2a-stat-card p-4">
            <p className="text-2xl font-bold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{s.value}</p>
            <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Platform Filter */}
      <div className="flex items-center gap-2 mb-5">
        {(["", "linkedin", "facebook", "instagram"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilterPlatform(p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filterPlatform === p ? (p ? `${platformConfig[p]?.color.replace(")", " / 20%)")}` : "oklch(0.6 0.2 255 / 20%)") : "oklch(0.22 0.02 255)",
              color: filterPlatform === p ? (p ? platformConfig[p]?.color : "oklch(0.75 0.18 255)") : "oklch(0.55 0.015 240)",
              border: `1px solid ${filterPlatform === p ? (p ? platformConfig[p]?.color.replace(")", " / 30%)") : "oklch(0.6 0.2 255 / 30%)") : "oklch(1 0 0 / 8%)"}`,
            }}
          >
            {p ? platformConfig[p].icon : <PenTool size={12} />}
            {p ? platformConfig[p].label : "Összes"}
          </button>
        ))}
      </div>

      {/* Posts by Week */}
      {weeks.map((week) => {
        const weekPosts = filtered.filter((p) => p.weekRef === week);
        if (weekPosts.length === 0) return null;
        return (
          <div key={week} className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "oklch(0.5 0.015 240)", fontFamily: "Sora, sans-serif" }}>{week}</h3>
            <div className="grid grid-cols-2 gap-4">
              {weekPosts.map((post) => {
                const plat = platformConfig[post.platform];
                const st = statusConfig[post.status];
                return (
                  <div key={post.id} className="g2a-card overflow-hidden">
                    {/* Image */}
                    <div className="relative h-36 overflow-hidden">
                      <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = unsplashImages[0]; }} />
                      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, oklch(0.16 0.022 255 / 80%), transparent)" }} />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" style={{ background: `${plat.color.replace(")", " / 85%)")}`, color: "white" }}>
                        {plat.icon}{plat.label}
                      </div>
                      <div className="absolute top-2 right-2 relative">
                        <button
                          onClick={() => setOpenStatusId(openStatusId === post.id ? null : post.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium status-badge ${st.cls}`}
                        >
                          {st.label}<ChevronDown size={10} />
                        </button>
                        {openStatusId === post.id && (
                          <div className="absolute right-0 top-7 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "oklch(0.2 0.022 255)", border: "1px solid oklch(1 0 0 / 12%)", minWidth: "150px" }}>
                            {statusOptions.map((s) => (
                              <button key={s} onClick={() => updateStatus(post.id, s)} className="w-full text-left px-3 py-2 text-xs transition-colors" style={{ color: post.status === s ? "oklch(0.75 0.18 255)" : "oklch(0.72 0.01 240)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 6%)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                {statusConfig[s].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-4">
                      <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.92 0.008 240)", fontFamily: "Sora, sans-serif" }}>{post.title}</p>
                      <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>Pillér: {post.pillar}</p>
                      <p className="text-xs line-clamp-2 mb-3" style={{ color: "oklch(0.6 0.015 240)" }}>{post.text.split("\n")[0]}</p>
                      {post.scheduledAt && (
                        <p className="text-xs mb-2 flex items-center gap-1" style={{ color: "oklch(0.6 0.2 290)" }}>
                          <Calendar size={11} />Ütemezve: {post.scheduledAt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setViewPost(post)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.18 255)" }}>
                          <Eye size={11} />Megtekintés
                        </button>
                        <button onClick={() => openEdit(post)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.75 0.18 75 / 15%)", color: "oklch(0.8 0.15 75)" }}>
                          <Edit2 size={11} />Szerkesztés
                        </button>
                        {(post.status === "pending_approval" || post.status === "draft") && (
                          <button onClick={() => handleApprove(post)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.75 0.15 165)" }}>
                            <CheckCircle size={11} />Jóváhagyás
                          </button>
                        )}
                        {post.status === "approved" && (
                          <button onClick={() => { setSchedulePost(post); setScheduleDate(""); setScheduleTime("09:00"); }} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md hover:opacity-80" style={{ background: "oklch(0.6 0.2 290 / 15%)", color: "oklch(0.7 0.18 290)" }}>
                            <Calendar size={11} />Ütemezés
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* View Modal */}
      {viewPost && (
        <DetailModal isOpen={!!viewPost} onClose={() => setViewPost(null)} title={viewPost.title} subtitle={`${platformConfig[viewPost.platform].label} · ${viewPost.weekRef}`}
          footer={
            <>
              <button onClick={() => setViewPost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Bezárás</button>
              <button onClick={() => openEdit(viewPost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.75 0.18 75)", color: "white" }}>
                <Edit2 size={13} className="inline mr-1.5" />Szerkesztés
              </button>
              {(viewPost.status === "pending_approval" || viewPost.status === "draft") && (
                <button onClick={() => handleApprove(viewPost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.65 0.18 165)", color: "white" }}>
                  <CheckCircle size={13} className="inline mr-1.5" />Jóváhagyás
                </button>
              )}
              {viewPost.status === "approved" && (
                <button onClick={() => { setSchedulePost(viewPost); setViewPost(null); setScheduleDate(""); setScheduleTime("09:00"); }} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 290)", color: "white" }}>
                  <Calendar size={13} className="inline mr-1.5" />Ütemezés
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <img src={viewPost.imageUrl} alt={viewPost.title} className="w-full h-48 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = unsplashImages[0]; }} />
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "oklch(0.55 0.015 240)", fontFamily: "Sora, sans-serif" }}>POSZT SZÖVEG</p>
              {viewPost.text.split("\n").map((line, i) => (
                line === "" ? <div key={i} className="h-2" /> : <p key={i} className="text-sm" style={{ color: "oklch(0.78 0.01 240)" }}>{line}</p>
              ))}
            </div>
            <div className="rounded-lg p-3" style={{ background: "oklch(0.22 0.02 255)" }}>
              <p className="text-xs mb-1" style={{ color: "oklch(0.5 0.015 240)" }}>Kép prompt</p>
              <p className="text-sm" style={{ color: "oklch(0.72 0.01 240)" }}>{viewPost.imagePrompt}</p>
            </div>
          </div>
        </DetailModal>
      )}

      {/* Edit Modal */}
      {editPost && (
        <DetailModal isOpen={!!editPost} onClose={() => setEditPost(null)} title={`Szerkesztés – ${editPost.title}`} subtitle="Módosítsd a szöveget és a képet"
          footer={
            <>
              <button onClick={() => setEditPost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 255)", color: "white", fontFamily: "Sora, sans-serif" }}>Mentés</button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>Poszt szöveg</label>
              <textarea value={editForm.text} onChange={(e) => setEditForm((p) => ({ ...p, text: e.target.value }))} rows={8}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)", lineHeight: "1.6" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>
                <Image size={12} className="inline mr-1" />Kép URL
              </label>
              <input type="text" value={editForm.imageUrl} onChange={(e) => setEditForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
              />
              {editForm.imageUrl && (
                <img src={editForm.imageUrl} alt="preview" className="mt-2 w-full h-28 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.015 240)" }}>Kép prompt (AI generáláshoz)</label>
                <button
                  onClick={handleGenerateImage}
                  disabled={generatingImage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: generatingImage ? "oklch(0.22 0.02 255)" : "oklch(0.6 0.2 290 / 20%)", color: generatingImage ? "oklch(0.55 0.015 240)" : "oklch(0.7 0.2 290)", cursor: generatingImage ? "not-allowed" : "pointer" }}
                >
                  {generatingImage ? <><Loader2 size={11} className="animate-spin" /> Generálás...</> : <><Sparkles size={11} /> AI Kép Generálás</>}
                </button>
              </div>
              <textarea value={editForm.imagePrompt} onChange={(e) => setEditForm((p) => ({ ...p, imagePrompt: e.target.value }))} rows={2}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                placeholder="Írd le a kívánt képet angolul, pl: professional business meeting, dark background, blue accents..."
              />
              {generatingImage && (
                <div className="mt-2 h-20 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.02 255)", border: "1px dashed oklch(0.6 0.2 290 / 30%)" }}>
                  <div className="flex items-center gap-2" style={{ color: "oklch(0.6 0.2 290)" }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs">Kép generálása folyamatban...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DetailModal>
      )}

      {/* Schedule Modal */}
      {schedulePost && (
        <DetailModal isOpen={!!schedulePost} onClose={() => setSchedulePost(null)} title="Poszt Ütemezése" subtitle={`${schedulePost.title} – ${platformConfig[schedulePost.platform].label}`}
          footer={
            <>
              <button onClick={() => setSchedulePost(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>Mégse</button>
              <button onClick={() => handleSchedule(schedulePost)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.6 0.2 290)", color: "white", fontFamily: "Sora, sans-serif" }}>
                <Calendar size={13} className="inline mr-1.5" />Ütemezés Mentése
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg p-4" style={{ background: "oklch(0.22 0.02 255)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: platformConfig[schedulePost.platform].color }}>{platformConfig[schedulePost.platform].icon}</span>
                <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{schedulePost.title}</p>
              </div>
              <p className="text-xs line-clamp-2" style={{ color: "oklch(0.55 0.015 240)" }}>{schedulePost.text.split("\n")[0]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>Dátum *</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)", colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "oklch(0.65 0.015 240)" }}>Időpont</label>
                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: "oklch(0.22 0.02 255)", border: "1px solid oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)", colorScheme: "dark" }}
                />
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "oklch(0.75 0.18 75 / 8%)", border: "1px solid oklch(0.75 0.18 75 / 20%)" }}>
              <p className="text-xs" style={{ color: "oklch(0.75 0.15 75)" }}>
                <strong>Megjegyzés:</strong> Éles Social Media API integráció esetén a poszt automatikusan közzétételre kerül. A jelenlegi verzióban az ütemezési dátum rögzítésre kerül.
              </p>
            </div>
          </div>
        </DetailModal>
      )}

      {openStatusId && <div className="fixed inset-0 z-10" onClick={() => setOpenStatusId(null)} />}
    </DashboardLayout>
  );
}
