/*
 * G2A Growth Engine – Content Studio v3.0
 * Összevont tartalom kezelő: Calendar, Drafts, Approval Queue, Published
 */

import { useState, useMemo } from "react";
import {
  Calendar, FileText, Clock, CheckCircle2, Eye, ThumbsUp, ThumbsDown,
  Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Loader2,
  Instagram, Linkedin, Facebook, Twitter, Sparkles, Image as ImageIcon,
  Hash, AlignLeft, Send, CalendarDays,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";

type PostStatus = "draft" | "approved" | "scheduled" | "published" | "rejected";
type Platform = "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok";

type Post = {
  id: string;
  profileId: string;
  title: string;
  platform: Platform;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  hashtags?: string[];
  pillar?: string;
  status: PostStatus;
  scheduledAt?: Date | string | null;
  publishedAt?: Date | string | null;
  weekNumber?: number;
  createdAt?: Date | string;
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  linkedin: <Linkedin size={14} />,
  facebook: <Facebook size={14} />,
  instagram: <Instagram size={14} />,
  twitter: <Twitter size={14} />,
  tiktok: <span style={{ fontSize: 13, fontWeight: 700 }}>TT</span>,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  linkedin: "oklch(0.55 0.18 255)",
  facebook: "oklch(0.55 0.2 250)",
  instagram: "oklch(0.65 0.22 20)",
  twitter: "oklch(0.6 0.18 220)",
  tiktok: "oklch(0.7 0.18 330)",
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Piszkozat",
  approved: "Jóváhagyva",
  scheduled: "Ütemezve",
  published: "Publikálva",
  rejected: "Elutasítva",
};

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "oklch(0.75 0.18 75)",
  approved: "oklch(0.65 0.18 165)",
  scheduled: "oklch(0.6 0.2 255)",
  published: "oklch(0.65 0.18 165)",
  rejected: "oklch(0.65 0.22 25)",
};

type Tab = "calendar" | "drafts" | "approval" | "published";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "calendar", label: "Naptár", icon: <Calendar size={14} /> },
  { id: "drafts", label: "Piszkozatok", icon: <FileText size={14} /> },
  { id: "approval", label: "Jóváhagyás", icon: <Clock size={14} /> },
  { id: "published", label: "Publikált", icon: <CheckCircle2 size={14} /> },
];

const MONTHS_HU = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
const DAYS_HU = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

export default function ContentStudio() {
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("drafts");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<Post | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [editForm, setEditForm] = useState<Partial<Post>>({});
  const [generatingImage, setGeneratingImage] = useState(false);
  const [newPostModal, setNewPostModal] = useState(false);
  const [newPost, setNewPost] = useState<Partial<Post>>({ platform: "linkedin", status: "draft", hashtags: [] });

  const utils = trpc.useUtils();
  const { data: posts = [], isLoading } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const updateMutation = trpc.content.update.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });
  const createMutation = trpc.content.create.useMutation({
    onSuccess: () => { utils.content.list.invalidate({ profileId: activeProfile.id }); setNewPostModal(false); setNewPost({ platform: "linkedin", status: "draft", hashtags: [] }); },
  });
  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });
  const generateImageMutation = trpc.ai.generateImage.useMutation();

  const handleApprove = async (post: Post) => {
    await updateMutation.mutateAsync({ id: post.id, status: "approved" });
    toast.success("Tartalom jóváhagyva");
  };
  const handleReject = async (post: Post) => {
    await updateMutation.mutateAsync({ id: post.id, status: "rejected" });
    toast.error("Tartalom elutasítva");
  };
  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    toast.success("Tartalom törölve");
    setSelectedPost(null);
  };
  const handleSchedule = async () => {
    if (!scheduleModal || !scheduleDate) return;
    const dt = new Date(`${scheduleDate}T${scheduleTime}`);
    await updateMutation.mutateAsync({ id: scheduleModal.id, status: "scheduled", scheduledAt: dt });
    toast.success("Poszt ütemezve: " + dt.toLocaleString("hu-HU"));
    setScheduleModal(null);
  };
  const handleSaveEdit = async () => {
    if (!selectedPost) return;
    const { scheduledAt, publishedAt, ...restEdit } = editForm as any;
    await updateMutation.mutateAsync({ id: selectedPost.id, ...restEdit });
    toast.success("Tartalom mentve");
    setEditModal(false);
    setSelectedPost(null);
  };
  const handleGenerateImage = async () => {
    const prompt = editForm.imagePrompt || editForm.title || "marketing post visual";
    setGeneratingImage(true);
    try {
      const result = await generateImageMutation.mutateAsync({ prompt });
      setEditForm(f => ({ ...f, imageUrl: result.url ?? undefined }));
      toast.success("Kép generálva");
    } catch { toast.error("Képgenerálás sikertelen"); }
    finally { setGeneratingImage(false); }
  };
  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content || !newPost.platform) { toast.error("Töltsd ki a kötelező mezőket"); return; }
    await createMutation.mutateAsync({
      profileId: activeProfile.id,
      title: newPost.title!,
      platform: newPost.platform as Platform,
      content: newPost.content!,
      imageUrl: newPost.imageUrl,
      imagePrompt: newPost.imagePrompt,
      hashtags: newPost.hashtags,
      pillar: newPost.pillar,
    });
    toast.success("Tartalom létrehozva");
  };

  // Calendar logic
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = lastDay.getDate();
  const calendarCells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const scheduledByDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    (posts as Post[]).filter(p => p.status === "scheduled" && p.scheduledAt).forEach(p => {
      const d = new Date(p.scheduledAt!);
      if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonth) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    });
    return map;
  }, [posts, calendarYear, calendarMonth]);

  const draftPosts = (posts as Post[]).filter(p => p.status === "draft");
  const approvalPosts = (posts as Post[]).filter(p => p.status === "approved");
  const publishedPosts = (posts as Post[]).filter(p => p.status === "published");

  const cardBg = "oklch(0.17 0.022 255)";
  const border = "oklch(1 0 0 / 8%)";

  const PostCard = ({ post, showActions = true }: { post: Post; showActions?: boolean }) => (
    <div className="rounded-xl border p-4 transition-all" style={{ background: cardBg, borderColor: border }}
      onMouseEnter={(e: any) => (e.currentTarget.style.borderColor = "oklch(0.6 0.2 255 / 30%)")}
      onMouseLeave={(e: any) => (e.currentTarget.style.borderColor = border)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${PLATFORM_COLORS[post.platform]} / 15%`, color: PLATFORM_COLORS[post.platform] }}>
            {PLATFORM_ICONS[post.platform]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{post.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${STATUS_COLORS[post.status]} / 15%`, color: STATUS_COLORS[post.status] }}>
                {STATUS_LABELS[post.status]}
              </span>
              {post.pillar && <span className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{post.pillar}</span>}
            </div>
          </div>
        </div>
        {showActions && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setSelectedPost(post); setEditForm({ title: post.title, content: post.content, imageUrl: post.imageUrl, imagePrompt: post.imagePrompt, hashtags: post.hashtags }); setEditModal(true); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "oklch(0.6 0.2 255 / 10%)" }}
              onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 20%)")}
              onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 10%)")}
            >
              <Pencil size={12} style={{ color: "oklch(0.6 0.2 255)" }} />
            </button>
            <button onClick={() => handleDelete(post.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "oklch(0.65 0.22 25 / 10%)" }}
              onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.22 25 / 20%)")}
              onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.22 25 / 10%)")}
            >
              <Trash2 size={12} style={{ color: "oklch(0.65 0.22 25)" }} />
            </button>
          </div>
        )}
      </div>
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title} className="w-full h-32 object-cover rounded-lg mb-3" />
      )}
      <p className="text-xs leading-relaxed mb-3 line-clamp-3" style={{ color: "oklch(0.62 0.015 240)" }}>{post.content}</p>
      {post.hashtags && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.hashtags.slice(0, 4).map(h => (
            <span key={h} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "oklch(0.6 0.2 255 / 10%)", color: "oklch(0.6 0.2 255)" }}>#{h}</span>
          ))}
        </div>
      )}
      {post.scheduledAt && (
        <p className="text-xs mb-3" style={{ color: "oklch(0.5 0.015 240)" }}>
          <CalendarDays size={11} className="inline mr-1" />
          {new Date(post.scheduledAt).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {showActions && post.status === "draft" && (
        <div className="flex gap-2">
          <button onClick={() => handleApprove(post)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}
            onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.18 165 / 25%)")}
            onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.18 165 / 15%)")}
          >
            <ThumbsUp size={12} /> Jóváhagyás
          </button>
          <button onClick={() => handleReject(post)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.65 0.22 25)" }}
            onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.22 25 / 25%)")}
            onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.65 0.22 25 / 15%)")}
          >
            <ThumbsDown size={12} /> Elutasítás
          </button>
        </div>
      )}
      {showActions && post.status === "approved" && (
        <button onClick={() => setScheduleModal(post)} className="w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}
          onMouseEnter={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 25%)")}
          onMouseLeave={(e: any) => (e.currentTarget.style.background = "oklch(0.6 0.2 255 / 15%)")}
        >
          <CalendarDays size={12} /> Időzítés
        </button>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Content Studio</h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
            {activeProfile.name} · {(posts as Post[]).length} tartalom
          </p>
        </div>
        <button onClick={() => setNewPostModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
        >
          <Plus size={14} /> Új Tartalom
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "oklch(0.17 0.022 255)" }}>
        {TABS.map(tab => {
          const count = tab.id === "drafts" ? draftPosts.length : tab.id === "approval" ? approvalPosts.length : tab.id === "published" ? publishedPosts.length : null;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "oklch(0.6 0.2 255)" : "transparent",
                color: activeTab === tab.id ? "white" : "oklch(0.55 0.015 240)",
              }}
            >
              {tab.icon} {tab.label}
              {count !== null && count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: activeTab === tab.id ? "oklch(1 0 0 / 20%)" : "oklch(0.6 0.2 255 / 20%)", color: activeTab === tab.id ? "white" : "oklch(0.6 0.2 255)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: "oklch(0.6 0.2 255)" }} />
        </div>
      )}

      {/* Calendar Tab */}
      {!isLoading && activeTab === "calendar" && (
        <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.88 0.008 240)" }}>
              {MONTHS_HU[calendarMonth]} {calendarYear}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: "oklch(0.22 0.02 255)" }}
              >
                <ChevronLeft size={14} style={{ color: "oklch(0.7 0.015 240)" }} />
              </button>
              <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: "oklch(0.22 0.02 255)" }}
              >
                <ChevronRight size={14} style={{ color: "oklch(0.7 0.015 240)" }} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_HU.map(d => (
              <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: "oklch(0.5 0.015 240)" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, i) => {
              const isToday = day !== null && new Date().getDate() === day && new Date().getMonth() === calendarMonth && new Date().getFullYear() === calendarYear;
              const dayPosts = day !== null ? (scheduledByDay[day.toString()] ?? []) : [];
              return (
                <div key={i} className="min-h-[72px] rounded-lg p-1.5" style={{ background: day !== null ? "oklch(0.22 0.02 255)" : "transparent", border: isToday ? "1px solid oklch(0.6 0.2 255)" : "1px solid transparent" }}>
                  {day !== null && (
                    <>
                      <p className="text-xs font-semibold mb-1" style={{ color: isToday ? "oklch(0.6 0.2 255)" : "oklch(0.65 0.015 240)" }}>{day}</p>
                      {dayPosts.slice(0, 2).map(p => (
                        <div key={p.id} className="text-xs px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer" style={{ background: `${PLATFORM_COLORS[p.platform]} / 20%`, color: PLATFORM_COLORS[p.platform] }}
                          onClick={() => setSelectedPost(p)}
                        >
                          {p.title}
                        </div>
                      ))}
                      {dayPosts.length > 2 && <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>+{dayPosts.length - 2}</p>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drafts Tab */}
      {!isLoading && activeTab === "drafts" && (
        <div>
          {draftPosts.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Nincsenek piszkozatok</p>
              <button onClick={() => setNewPostModal(true)} className="mt-2 text-sm" style={{ color: "oklch(0.6 0.2 255)" }}>Új tartalom létrehozása →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {draftPosts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}

      {/* Approval Tab */}
      {!isLoading && activeTab === "approval" && (
        <div>
          {approvalPosts.length === 0 ? (
            <div className="text-center py-16">
              <Clock size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Nincs jóváhagyott tartalom</p>
              <p className="text-xs" style={{ color: "oklch(0.45 0.015 240)" }}>Jóváhagyott tartalmakat itt időzítheted</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvalPosts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
          )}
        </div>
      )}

      {/* Published Tab */}
      {!isLoading && activeTab === "published" && (
        <div>
          {publishedPosts.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: "oklch(0.35 0.015 240)" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>Még nincs publikált tartalom</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publishedPosts.map(p => <PostCard key={p.id} post={p} showActions={false} />)}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editModal && selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Tartalom Szerkesztése</h3>
              <button onClick={() => { setEditModal(false); setSelectedPost(null); }} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Cím</label>
                <input value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Szöveg</label>
                <textarea value={editForm.content ?? ""} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={6}
                  className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Kép URL</label>
                <div className="flex gap-2">
                  <input value={editForm.imageUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    placeholder="https://..." />
                </div>
                {editForm.imageUrl && <img src={editForm.imageUrl} alt="preview" className="mt-2 w-full h-32 object-cover rounded-lg" />}
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>AI Kép Prompt</label>
                <div className="flex gap-2">
                  <input value={editForm.imagePrompt ?? ""} onChange={e => setEditForm(f => ({ ...f, imagePrompt: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    placeholder="Pl. modern office, professional team..." />
                  <button onClick={handleGenerateImage} disabled={generatingImage}
                    className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
                    style={{ background: "oklch(0.7 0.18 300 / 20%)", color: "oklch(0.7 0.18 300)" }}
                  >
                    {generatingImage ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    Generálás
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Hashtagek (vesszővel elválasztva)</label>
                <input value={(editForm.hashtags ?? []).join(", ")} onChange={e => setEditForm(f => ({ ...f, hashtags: e.target.value.split(",").map(h => h.trim()).filter(Boolean) }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                  placeholder="marketing, b2b, growth" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setEditModal(false); setSelectedPost(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "oklch(0.6 0.2 255)" }}>Mentés</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Poszt Időzítése</h3>
              <button onClick={() => setScheduleModal(null)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <p className="text-sm mb-4 font-medium truncate" style={{ color: "oklch(0.78 0.008 240)" }}>{scheduleModal.title}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Dátum</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Időpont</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setScheduleModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button onClick={handleSchedule} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "oklch(0.6 0.2 255)" }}>
                <Send size={13} /> Ütemezés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Post Modal */}
      {newPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Új Tartalom Létrehozása</h3>
              <button onClick={() => setNewPostModal(false)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Cím *</label>
                <input value={newPost.title ?? ""} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Platform *</label>
                <div className="flex gap-2 flex-wrap">
                  {(["linkedin", "facebook", "instagram", "twitter", "tiktok"] as Platform[]).map(pl => (
                    <button key={pl} onClick={() => setNewPost(p => ({ ...p, platform: pl }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: newPost.platform === pl ? `${PLATFORM_COLORS[pl]} / 20%` : "oklch(0.22 0.02 255)",
                        color: newPost.platform === pl ? PLATFORM_COLORS[pl] : "oklch(0.55 0.015 240)",
                        border: `1px solid ${newPost.platform === pl ? PLATFORM_COLORS[pl] : "transparent"}`,
                      }}
                    >
                      {PLATFORM_ICONS[pl]} {pl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Szöveg *</label>
                <textarea value={newPost.content ?? ""} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={5}
                  className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Kép URL</label>
                <input value={newPost.imageUrl ?? ""} onChange={e => setNewPost(p => ({ ...p, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Tartalmi pillér</label>
                <input value={newPost.pillar ?? ""} onChange={e => setNewPost(p => ({ ...p, pillar: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} placeholder="Pl. Thought Leadership" />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Hashtagek (vesszővel elválasztva)</label>
                <input value={(newPost.hashtags ?? []).join(", ")} onChange={e => setNewPost(p => ({ ...p, hashtags: e.target.value.split(",").map(h => h.trim()).filter(Boolean) }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} placeholder="marketing, b2b, growth" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setNewPostModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button onClick={handleCreatePost} disabled={createMutation.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "oklch(0.6 0.2 255)" }}>
                {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Létrehozás
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Drawer (calendar click) */}
      {selectedPost && !editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 60%)" }} onClick={() => setSelectedPost(null)}>
          <div className="w-full max-w-lg rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${PLATFORM_COLORS[selectedPost.platform]} / 15%`, color: PLATFORM_COLORS[selectedPost.platform] }}>
                  {PLATFORM_ICONS[selectedPost.platform]}
                </div>
                <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>{selectedPost.title}</h3>
              </div>
              <button onClick={() => setSelectedPost(null)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            {selectedPost.imageUrl && <img src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full h-40 object-cover rounded-xl mb-4" />}
            <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.72 0.015 240)" }}>{selectedPost.content}</p>
            {selectedPost.scheduledAt && (
              <p className="text-xs mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
                <CalendarDays size={11} className="inline mr-1" />
                {new Date(selectedPost.scheduledAt).toLocaleString("hu-HU")}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setEditForm({ title: selectedPost.title, content: selectedPost.content, imageUrl: selectedPost.imageUrl, imagePrompt: selectedPost.imagePrompt, hashtags: selectedPost.hashtags }); setEditModal(true); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}
              >
                <Pencil size={13} /> Szerkesztés
              </button>
              <button onClick={() => handleDelete(selectedPost.id)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.65 0.22 25)" }}
              >
                <Trash2 size={13} /> Törlés
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
