/**
 * G2A Growth Engine – Content Studio v4.0
 * Stratégia-alapú tartalomjavaslatok + szabad tartalom létrehozás AI segítséggel
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Calendar, FileText, Clock, CheckCircle2, ThumbsUp, ThumbsDown,
  Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight, Loader2,
  Instagram, Linkedin, Facebook, Twitter, Sparkles, Image as ImageIcon,
  CalendarDays, Send, Lightbulb, Wand2, Target, Layers, ArrowRight,
  BookOpen, TrendingUp, MessageSquare, Video, BarChart2, Zap,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState } from "@/components/EmptyState";
import { AiLimitBanner } from "@/components/AiLimitBanner";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { toast } from "sonner";

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
  createdAt?: Date | string;
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  linkedin: <Linkedin size={14} />,
  facebook: <Facebook size={14} />,
  instagram: <Instagram size={14} />,
  twitter: <Twitter size={14} />,
  tiktok: <span style={{ fontSize: 12, fontWeight: 700 }}>TT</span>,
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

type Tab = "javasolt" | "calendar" | "drafts" | "approval" | "published";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "javasolt", label: "Javasolt", icon: <Lightbulb size={14} /> },
  { id: "calendar", label: "Naptár", icon: <Calendar size={14} /> },
  { id: "drafts", label: "Piszkozatok", icon: <FileText size={14} /> },
  { id: "approval", label: "Jóváhagyás", icon: <Clock size={14} /> },
  { id: "published", label: "Publikált", icon: <CheckCircle2 size={14} /> },
];

const MONTHS_HU = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
const DAYS_HU = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

// Content type templates for strategy-based suggestions
type ContentTemplate = {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  platform: Platform;
  contentType: string;
  color: string;
  pillar?: string; // optional: which content pillar this template belongs to
};

const CONTENT_TEMPLATES: ContentTemplate[] = [
  { id: "linkedin-thought", icon: <BookOpen size={16} />, label: "Thought Leadership", description: "Szakmai vélemény, iparági insight", platform: "linkedin", contentType: "Thought Leadership poszt", color: "oklch(0.55 0.18 255)" },
  { id: "linkedin-case", icon: <TrendingUp size={16} />, label: "Sikertörténet", description: "Ügyfél eredmény, esettanulmány", platform: "linkedin", contentType: "Sikertörténet / Case Study", color: "oklch(0.55 0.18 255)" },
  { id: "instagram-visual", icon: <ImageIcon size={16} />, label: "Vizuális tartalom", description: "Képes poszt, infografika", platform: "instagram", contentType: "Vizuális / Infografika poszt", color: "oklch(0.65 0.22 20)" },
  { id: "instagram-reel", icon: <Video size={16} />, label: "Reel/Videó script", description: "Rövid videó szöveg, hook", platform: "instagram", contentType: "Reel / Videó script", color: "oklch(0.65 0.22 20)" },
  { id: "facebook-community", icon: <MessageSquare size={16} />, label: "Közösségi kérdés", description: "Engagement, szavazás, kérdés", platform: "facebook", contentType: "Közösségi kérdés / Poll", color: "oklch(0.55 0.2 250)" },
  { id: "linkedin-tips", icon: <Zap size={16} />, label: "Tippek & Trükkök", description: "Praktikus tanácsok, listicle", platform: "linkedin", contentType: "Tippek & Trükkök poszt", color: "oklch(0.55 0.18 255)" },
  { id: "twitter-news", icon: <BarChart2 size={16} />, label: "Iparági hírek", description: "Trend kommentár, adat megosztás", platform: "twitter", contentType: "Iparági hír / Kommentár", color: "oklch(0.6 0.18 220)" },
  { id: "facebook-promo", icon: <Target size={16} />, label: "Promóció", description: "Ajánlat, akció, CTA", platform: "facebook", contentType: "Promóciós / Ajánlat poszt", color: "oklch(0.55 0.2 250)" },
];

export default function ContentStudio() {
  const { activeProfile } = useProfile();
  const [activeTab, setActiveTab] = useState<Tab>("javasolt");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<Post | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [editForm, setEditForm] = useState<Partial<Post>>({});
  const [generatingImage, setGeneratingImage] = useState(false);

  // New post / AI generation modal
  const [createModal, setCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"template" | "free">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [newPost, setNewPost] = useState<Partial<Post>>({ platform: "linkedin", status: "draft", hashtags: [] });
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatingContent, setGeneratingContent] = useState(false);
  const [activePillarFilter, setActivePillarFilter] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: posts = [], isLoading } = trpc.content.list.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: intelligence } = trpc.intelligence.get.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const { data: activeStrategy } = trpc.strategyVersions.getActive.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );

  const updateMutation = trpc.content.update.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });
  const createMutation = trpc.content.create.useMutation({
    onSuccess: () => {
      utils.content.list.invalidate({ profileId: activeProfile.id });
      setCreateModal(false);
      setNewPost({ platform: "linkedin", status: "draft", hashtags: [] });
      setAdditionalContext("");
      setSelectedTemplate(null);
    },
  });
  const deleteMutation = trpc.content.delete.useMutation({
    onSuccess: () => utils.content.list.invalidate({ profileId: activeProfile.id }),
  });
  const generateImageMutation = trpc.ai.generateImage.useMutation();
  const generateContentMutation = trpc.ai.generatePostContent.useMutation();

  // Monthly plan generation
  const [generatingMonthlyPlan, setGeneratingMonthlyPlan] = useState(false);
  const generateMonthlyPlanMutation = trpc.content.generateMonthlyPlan.useMutation({
    onSuccess: (data) => {
      utils.content.list.invalidate({ profileId: activeProfile.id });
      toast.success(`✅ ${data.created} tartalom létrehozva ${MONTHS_HU[calendarMonth]} hónapra!`);
      setGeneratingMonthlyPlan(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setGeneratingMonthlyPlan(false);
    },
  });

  // Social connections
  const { data: socialConnections = [] } = trpc.social.listConnections.useQuery(
    { profileId: activeProfile.id },
    { enabled: !!activeProfile.id }
  );
  const publishNowMutation = trpc.social.publishNow.useMutation({
    onSuccess: () => {
      toast.success("Tartalom sikeresen publikálva!");
      setPublishModal(false);
      utils.content.list.invalidate({ profileId: activeProfile.id });
    },
    onError: (e) => toast.error(e.message),
  });
  const [publishModal, setPublishModal] = useState(false);
  const [publishTarget, setPublishTarget] = useState<Post | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");

  // Strategy-based content pillars for suggestions
  const contentPillars: string[] = useMemo(() => {
    // Read from activeProfile.contentPillars (clientProfiles table)
    const pillars = (activeProfile as any).contentPillars;
    if (pillars && Array.isArray(pillars)) {
      return pillars.filter((p: any) => p.active !== false).map((p: any) => p.name ?? p).filter(Boolean).slice(0, 4);
    }
    // Fallback: read from intelligence.platformPriorities channel names
    if (intelligence?.platformPriorities && Array.isArray(intelligence.platformPriorities)) {
      return intelligence.platformPriorities
        .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
        .slice(0, 4)
        .map((p: any) => p.platform);
    }
    return [];
  }, [activeProfile, intelligence]);

  const strategyChannels: string[] = useMemo(() => {
    if (activeStrategy?.channelStrategy && Array.isArray(activeStrategy.channelStrategy)) {
      return (activeStrategy.channelStrategy as any[])
        .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
        .slice(0, 3)
        .map((c: any) => c.channel?.toLowerCase() ?? "");
    }
    return [];
  }, [activeStrategy]);

  // Full pillar data with descriptions for richer context
  const contentPillarsFull = useMemo(() => {
    const pillars = (activeProfile as any).contentPillars;
    if (pillars && Array.isArray(pillars)) {
      return pillars.filter((p: any) => p.active !== false).slice(0, 5);
    }
    return [];
  }, [activeProfile]);

  // Generate dynamic templates from content pillars if available
  const suggestedTemplates = useMemo(() => {
    // If we have saved content pillars, generate pillar-specific templates
    if (contentPillarsFull.length > 0) {
      const PLATFORM_CYCLE: Platform[] = ["linkedin", "instagram", "facebook", "linkedin", "twitter"];
      const CONTENT_TYPE_CYCLE = [
        "Thought Leadership poszt",
        "Vizuális / Infografika poszt",
        "Közösségi kérdés / Poll",
        "Tippek & Trükkök poszt",
        "Iparági hír / Kommentár",
      ];
      const ICON_CYCLE = [
        <BookOpen size={16} />,
        <ImageIcon size={16} />,
        <MessageSquare size={16} />,
        <Zap size={16} />,
        <BarChart2 size={16} />,
      ];
      const COLOR_CYCLE = [
        "oklch(0.55 0.18 255)",
        "oklch(0.65 0.22 20)",
        "oklch(0.55 0.2 250)",
        "oklch(0.55 0.18 255)",
        "oklch(0.6 0.18 220)",
      ];
      // If we also have strategy channels, prefer those platforms
      const preferredPlatforms = strategyChannels.length > 0
        ? strategyChannels.map(ch => ch.split(" ")[0]?.toLowerCase() as Platform).filter(Boolean)
        : PLATFORM_CYCLE;

      return contentPillarsFull.map((pillar: any, i: number) => ({
        id: `pillar-${i}`,
        icon: ICON_CYCLE[i % ICON_CYCLE.length],
        label: pillar.name ?? pillar,
        description: pillar.description ?? `${pillar.name ?? pillar} témájú tartalom`,
        platform: (preferredPlatforms[i % preferredPlatforms.length] ?? PLATFORM_CYCLE[i % PLATFORM_CYCLE.length]) as Platform,
        contentType: CONTENT_TYPE_CYCLE[i % CONTENT_TYPE_CYCLE.length],
        color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      } as ContentTemplate)).concat(
        // Add 2-3 generic templates at the end for variety
        CONTENT_TEMPLATES.slice(0, 3).filter(t => !contentPillarsFull.some((p: any) => (p.name ?? p) === t.label))
      ).slice(0, 8);
    }
    // Fallback: filter templates based on strategy channels if available
    if (strategyChannels.length === 0) return CONTENT_TEMPLATES;
    return CONTENT_TEMPLATES.filter(t =>
      strategyChannels.some(ch => ch.includes(t.platform) || t.platform.includes(ch.split(" ")[0]?.toLowerCase() ?? ""))
    ).slice(0, 6).concat(CONTENT_TEMPLATES.filter(t => !strategyChannels.some(ch => ch.includes(t.platform))).slice(0, 2));
  }, [contentPillarsFull, strategyChannels]);

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

  const handleGenerateNewImage = async () => {
    const prompt = newPost.imagePrompt || newPost.title || "marketing post visual";
    setGeneratingImage(true);
    try {
      const result = await generateImageMutation.mutateAsync({ prompt });
      setNewPost(p => ({ ...p, imageUrl: result.url ?? undefined }));
      toast.success("Kép generálva");
    } catch { toast.error("Képgenerálás sikertelen"); }
    finally { setGeneratingImage(false); }
  };

  const handleGenerateContent = async () => {
    const template = selectedTemplate;
    setGeneratingContent(true);
    try {
      const intelligenceSummary = intelligence
        ? `${(intelligence as any).companyOverview ?? ""} UVP: ${(intelligence as any).uniqueValueProposition ?? ""}`.trim()
        : undefined;
      const strategyContext = activeStrategy
        ? `Kampány prioritások: ${((activeStrategy as any).campaignPriorities ?? []).slice(0, 3).join(", ")}`
        : undefined;

      const result = await generateContentMutation.mutateAsync({
        platform: template?.platform ?? (newPost.platform as string) ?? "linkedin",
        contentType: template?.contentType ?? "általános poszt",
        pillar: newPost.pillar ?? contentPillars[0],
        tone: (intelligence as any)?.brandVoice?.tone ?? "professzionális, barátságos",
        companyName: activeProfile.name,
        industry: activeProfile.industry ?? undefined,
        intelligenceSummary,
        strategyContext,
        additionalContext: additionalContext || undefined,
      });
      setNewPost(p => ({
        ...p,
        title: result.title ?? p.title,
        content: result.content ?? p.content,
        hashtags: result.hashtags ?? p.hashtags,
        imagePrompt: result.imagePrompt ?? p.imagePrompt,
        platform: template?.platform ?? p.platform,
      }));
      toast.success("Tartalom generálva! Szerkesztheted és mentheted.");
    } catch (err: unknown) {
      const cause = (err as { data?: { cause?: { code?: string; used?: number; limit?: number } } })?.data?.cause;
      if (cause?.code === "AI_LIMIT_REACHED") {
        toast.error(`AI limit elérve (${cause.used}/${cause.limit} használat ebben a hónapban). Frissítsd az előfizetésed!`, { duration: 7000 });
      } else {
        toast.error("Generálás sikertelen. Próbáld újra!");
      }
    }
    finally { setGeneratingContent(false); }
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

  const openTemplate = (template: ContentTemplate) => {
    setSelectedTemplate(template);
    setNewPost({ platform: template.platform, status: "draft", hashtags: [], pillar: contentPillars[0] ?? "" });
    setAdditionalContext("");
    setCreateMode("template");
    setCreateModal(true);
  };

  const openFreeCreate = () => {
    setSelectedTemplate(null);
    setNewPost({ platform: "linkedin", status: "draft", hashtags: [] });
    setAdditionalContext("");
    setCreateMode("free");
    setCreateModal(true);
  };

  // Calendar logic
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
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
              className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 10%)" }}>
              <Pencil size={12} style={{ color: "oklch(0.6 0.2 255)" }} />
            </button>
            <button onClick={() => handleDelete(post.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 10%)" }}>
              <Trash2 size={12} style={{ color: "oklch(0.65 0.22 25)" }} />
            </button>
          </div>
        )}
      </div>
      {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="w-full h-32 object-cover rounded-lg mb-3" />}
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
          <button onClick={() => handleApprove(post)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>
            <ThumbsUp size={12} /> Jóváhagyás
          </button>
          <button onClick={() => handleReject(post)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.65 0.22 25)" }}>
            <ThumbsDown size={12} /> Elutasítás
          </button>
        </div>
      )}
      {showActions && post.status === "approved" && (
        <button onClick={() => setScheduleModal(post)} className="w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
          style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>
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
        <div className="flex gap-2">
          <button onClick={openFreeCreate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>
            <Plus size={14} /> Szabad tartalom
          </button>
          <button onClick={() => { setActiveTab("javasolt"); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
            <Sparkles size={14} /> AI Tartalom
          </button>
        </div>
      </div>

      {/* AI Limit Banner */}
      <AiLimitBanner />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style={{ background: "oklch(0.17 0.022 255)" }}>
        {TABS.map(tab => {
          const count = tab.id === "drafts" ? draftPosts.length : tab.id === "approval" ? approvalPosts.length : tab.id === "published" ? publishedPosts.length : null;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: activeTab === tab.id ? "oklch(0.6 0.2 255)" : "transparent",
                color: activeTab === tab.id ? "white" : "oklch(0.55 0.015 240)",
              }}>
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

      {/* Javasolt Tab – Strategy-based content guidance */}
      {!isLoading && activeTab === "javasolt" && (
        <div className="space-y-6">
          {/* Strategy context banner */}
          {activeStrategy ? (
            <div className="rounded-xl border p-4 flex items-start gap-3" style={{ background: "oklch(0.6 0.2 255 / 8%)", borderColor: "oklch(0.6 0.2 255 / 25%)" }}>
              <Target size={18} style={{ color: "oklch(0.6 0.2 255)", flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.88 0.008 240)" }}>
                  Aktív stratégia: {(activeStrategy as any).title}
                </p>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "oklch(0.6 0.015 240)" }}>
                  {(activeStrategy as any).executiveSummary ?? "Stratégia betöltve – az alábbi javaslatok erre épülnek."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border p-4 flex items-start gap-3" style={{ background: "oklch(0.75 0.18 75 / 8%)", borderColor: "oklch(0.75 0.18 75 / 25%)" }}>
              <Lightbulb size={18} style={{ color: "oklch(0.75 0.18 75)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.88 0.008 240)" }}>Nincs aktív stratégia</p>
                <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>
                  A tartalmak pontosabbak lesznek, ha előbb generálsz egy{" "}
                  <a href="/strategia" className="underline" style={{ color: "oklch(0.75 0.18 75)" }}>marketing stratégiát</a>.
                  Addig is az alábbi sablonok segítenek.
                </p>
              </div>
            </div>
          )}

          {/* Content pillars filter */}
          {contentPillars.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers size={14} style={{ color: "oklch(0.65 0.18 165)" }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.65 0.015 240)" }}>Szűrés pillér szerint</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActivePillarFilter(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: activePillarFilter === null ? "oklch(0.6 0.2 255 / 20%)" : "oklch(0.22 0.02 255)",
                    color: activePillarFilter === null ? "oklch(0.7 0.18 255)" : "oklch(0.55 0.015 240)",
                    border: activePillarFilter === null ? "1px solid oklch(0.6 0.2 255 / 40%)" : "1px solid oklch(0.3 0.02 255)"
                  }}>
                  Összes
                </button>
                {contentPillars.map(pillar => (
                  <button key={pillar}
                    onClick={() => setActivePillarFilter(activePillarFilter === pillar ? null : pillar)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: activePillarFilter === pillar ? "oklch(0.65 0.18 165 / 20%)" : "oklch(0.22 0.02 255)",
                      color: activePillarFilter === pillar ? "oklch(0.65 0.18 165)" : "oklch(0.55 0.015 240)",
                      border: activePillarFilter === pillar ? "1px solid oklch(0.65 0.18 165 / 40%)" : "1px solid oklch(0.3 0.02 255)"
                    }}>
                    <Layers size={11} /> {pillar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content Studio hero image – shown when no strategy yet */}
          {!activeStrategy && suggestedTemplates.length === 0 && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: border }}>
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/content-studio-hero_cdb2a587.png"
                alt="Content Studio preview"
                className="w-full object-cover opacity-70"
              />
            </div>
          )}

          {/* Suggested content templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: "oklch(0.75 0.18 75)" }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.65 0.015 240)" }}>
                  {activePillarFilter ? `„${activePillarFilter}” pillér tartalmai` : activeStrategy ? "Stratégiára épülő tartalomtípusok" : "Javasolt tartalomtípusok"}
                </p>
              </div>
              {activePillarFilter && (
                <button onClick={() => setActivePillarFilter(null)} className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>Szűrő törlése ×</button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(activePillarFilter
                ? suggestedTemplates.filter(t => t.pillar === activePillarFilter)
                : suggestedTemplates
              ).map(template => (
                <button key={template.id} onClick={() => openTemplate(template)}
                  className="rounded-xl border p-4 text-left transition-all hover:scale-[1.02] group"
                  style={{ background: cardBg, borderColor: border }}
                  onMouseEnter={(e: any) => (e.currentTarget.style.borderColor = `${template.color} / 40%`)}
                  onMouseLeave={(e: any) => (e.currentTarget.style.borderColor = border)}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${template.color} / 15%`, color: template.color }}>
                      {template.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${PLATFORM_COLORS[template.platform]} / 15%`, color: PLATFORM_COLORS[template.platform] }}>
                        {PLATFORM_ICONS[template.platform]}
                      </div>
                      <span className="text-xs capitalize" style={{ color: "oklch(0.5 0.015 240)" }}>{template.platform}</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.008 240)", fontFamily: "Sora, sans-serif" }}>{template.label}</p>
                  <p className="text-xs mb-3" style={{ color: "oklch(0.55 0.015 240)" }}>{template.description}</p>
                  <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: template.color }}>
                    <Wand2 size={11} /> AI generálás <ArrowRight size={11} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Free create CTA */}
          <div className="rounded-xl border p-4 flex items-center justify-between" style={{ background: cardBg, borderColor: border }}>
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "oklch(0.88 0.008 240)" }}>Saját ötleted van?</p>
              <p className="text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>Hozz létre teljesen szabad tartalmat – AI segítséggel vagy anélkül</p>
            </div>
            <button onClick={openFreeCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold flex-shrink-0 ml-4"
              style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.75 0.015 240)" }}>
              <Plus size={14} /> Szabad tartalom
            </button>
          </div>
        </div>
      )}

      {/* Calendar Tab */}
      {!isLoading && activeTab === "calendar" && (
        <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.88 0.008 240)" }}>
              {MONTHS_HU[calendarMonth]} {calendarYear}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (generatingMonthlyPlan) return;
                  setGeneratingMonthlyPlan(true);
                  generateMonthlyPlanMutation.mutate({
                    profileId: activeProfile.id,
                    year: calendarYear,
                    month: calendarMonth,
                    intelligenceData: intelligence ?? undefined,
                    contentPillars: contentPillars.length > 0 ? contentPillars : undefined,
                    platforms: strategyChannels.length > 0 ? strategyChannels : undefined,
                  });
                }}
                disabled={generatingMonthlyPlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: generatingMonthlyPlan ? "oklch(0.22 0.02 255)" : "oklch(0.55 0.2 255)",
                  color: "oklch(0.95 0.005 240)",
                  cursor: generatingMonthlyPlan ? "not-allowed" : "pointer",
                  opacity: generatingMonthlyPlan ? 0.7 : 1,
                }}
              >
                {generatingMonthlyPlan ? (
                  <><Loader2 size={12} className="animate-spin" /> Generálás...</>
                ) : (
                  <><Sparkles size={12} /> Teljes hónap AI-vel</>
                )}
              </button>
              <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.02 255)" }}>
                <ChevronLeft size={14} style={{ color: "oklch(0.7 0.015 240)" }} />
              </button>
              <button onClick={() => setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.22 0.02 255)" }}>
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
                          onClick={() => setSelectedPost(p)}>
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
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="Nincsenek piszkozataid"
              description="Generálj AI-vel tartalmat, majd mentsd el piszkozatként szerkesztés előtt."
              action={
                <button onClick={() => setActiveTab("javasolt")} className="text-sm text-primary hover:underline">
                  Nézd meg a javasolt tartalmakat →
                </button>
              }
            />
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
            <EmptyState
              icon={<Clock className="w-12 h-12" />}
              title="Nincs jóváhagyott tartalom"
              description="Jóváhagyott tartalmakat itt ütemezd közzétételre."
            />
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
            <EmptyState
              icon={<CheckCircle2 className="w-12 h-12" />}
              title="Még nincs publikált tartalmad"
              description="Publikált tartalmaid itt jelennek meg az előzményekben."
            />
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
                <input value={editForm.imageUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} placeholder="https://..." />
                {editForm.imageUrl && <img src={editForm.imageUrl} alt="preview" className="mt-2 w-full h-32 object-cover rounded-lg" />}
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>AI Kép Prompt</label>
                <div className="flex gap-2">
                  <input value={editForm.imagePrompt ?? ""} onChange={e => setEditForm(f => ({ ...f, imagePrompt: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    placeholder="Pl. modern office, professional team..." />
                  <button onClick={handleGenerateImage} disabled={generatingImage}
                    className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                    style={{ background: "oklch(0.7 0.18 300 / 20%)", color: "oklch(0.7 0.18 300)" }}>
                    {generatingImage ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Kép
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Hashtagek (vesszővel)</label>
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

      {/* Create / AI Content Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 70%)" }}>
          <div className="w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
                  {selectedTemplate ? `${selectedTemplate.label} – AI Generálás` : "Új Tartalom Létrehozása"}
                </h3>
                {selectedTemplate && (
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                    {selectedTemplate.description} · {selectedTemplate.platform}
                  </p>
                )}
              </div>
              <button onClick={() => { setCreateModal(false); setSelectedTemplate(null); }} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "oklch(0.22 0.02 255)" }}>
              <button onClick={() => setCreateMode("template")}
                className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                style={{ background: createMode === "template" ? "oklch(0.6 0.2 255)" : "transparent", color: createMode === "template" ? "white" : "oklch(0.55 0.015 240)" }}>
                <Wand2 size={12} /> AI segítséggel
              </button>
              <button onClick={() => setCreateMode("free")}
                className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                style={{ background: createMode === "free" ? "oklch(0.22 0.02 255 / 0%)" : "transparent", color: createMode === "free" ? "oklch(0.88 0.008 240)" : "oklch(0.55 0.015 240)", border: createMode === "free" ? "1px solid oklch(1 0 0 / 15%)" : "1px solid transparent" }}>
                <Plus size={12} /> Saját szöveg
              </button>
            </div>

            {createMode === "template" && (
              <div className="space-y-4 mb-4">
                {/* Platform selector */}
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: "oklch(0.65 0.015 240)" }}>Platform</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["linkedin", "facebook", "instagram", "twitter", "tiktok"] as Platform[]).map(pl => (
                      <button key={pl} onClick={() => setNewPost(p => ({ ...p, platform: pl }))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: newPost.platform === pl ? `${PLATFORM_COLORS[pl]} / 20%` : "oklch(0.22 0.02 255)",
                          color: newPost.platform === pl ? PLATFORM_COLORS[pl] : "oklch(0.55 0.015 240)",
                          border: `1px solid ${newPost.platform === pl ? PLATFORM_COLORS[pl] : "transparent"}`,
                        }}>
                        {PLATFORM_ICONS[pl]} {pl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pillar selector */}
                {contentPillars.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "oklch(0.65 0.015 240)" }}>Tartalmi pillér</label>
                    <div className="flex gap-2 flex-wrap">
                      {contentPillars.map(pillar => (
                        <button key={pillar} onClick={() => setNewPost(p => ({ ...p, pillar }))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: newPost.pillar === pillar ? "oklch(0.65 0.18 165 / 20%)" : "oklch(0.22 0.02 255)",
                            color: newPost.pillar === pillar ? "oklch(0.65 0.18 165)" : "oklch(0.55 0.015 240)",
                            border: `1px solid ${newPost.pillar === pillar ? "oklch(0.65 0.18 165)" : "transparent"}`,
                          }}>
                          {pillar}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional context */}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Kiegészítő instrukciók (opcionális)</label>
                  <textarea value={additionalContext} onChange={e => setAdditionalContext(e.target.value)} rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    placeholder="Pl. fókuszálj a Q2-es kampányra, emeld ki az ár-érték arányt..." />
                </div>

                {/* Generate button */}
                <button onClick={handleGenerateContent} disabled={generatingContent}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
                  {generatingContent ? <><Loader2 size={15} className="animate-spin" /> Generálás...</> : <><Wand2 size={15} /> AI Tartalom Generálása</>}
                </button>
              </div>
            )}

            {/* Generated / manual content fields */}
            {(newPost.title || newPost.content || createMode === "free") && (
              <div className="space-y-4">
                {createMode === "template" && newPost.title && (
                  <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: "oklch(0.65 0.18 165 / 10%)", borderColor: "oklch(0.65 0.18 165 / 20%)", border: "1px solid" }}>
                    <CheckCircle2 size={14} style={{ color: "oklch(0.65 0.18 165)" }} />
                    <p className="text-xs font-semibold" style={{ color: "oklch(0.65 0.18 165)" }}>Tartalom generálva – szerkeszd és mentsd el!</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Cím *</label>
                  <input value={newPost.title ?? ""} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                </div>
                {createMode === "free" && (
                  <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: "oklch(0.65 0.015 240)" }}>Platform *</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["linkedin", "facebook", "instagram", "twitter", "tiktok"] as Platform[]).map(pl => (
                        <button key={pl} onClick={() => setNewPost(p => ({ ...p, platform: pl }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: newPost.platform === pl ? `${PLATFORM_COLORS[pl]} / 20%` : "oklch(0.22 0.02 255)",
                            color: newPost.platform === pl ? PLATFORM_COLORS[pl] : "oklch(0.55 0.015 240)",
                            border: `1px solid ${newPost.platform === pl ? PLATFORM_COLORS[pl] : "transparent"}`,
                          }}>
                          {PLATFORM_ICONS[pl]} {pl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Szöveg *</label>
                  <textarea value={newPost.content ?? ""} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={5}
                    className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>AI Kép Prompt</label>
                  <div className="flex gap-2">
                    <input value={newPost.imagePrompt ?? ""} onChange={e => setNewPost(p => ({ ...p, imagePrompt: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                      placeholder="Pl. modern office, professional team..." />
                    <button onClick={handleGenerateNewImage} disabled={generatingImage}
                      className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                      style={{ background: "oklch(0.7 0.18 300 / 20%)", color: "oklch(0.7 0.18 300)" }}>
                      {generatingImage ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Kép
                    </button>
                  </div>
                  {newPost.imageUrl && <img src={newPost.imageUrl} alt="preview" className="mt-2 w-full h-32 object-cover rounded-lg" />}
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.65 0.015 240)" }}>Hashtagek (vesszővel)</label>
                  <input value={(newPost.hashtags ?? []).join(", ")} onChange={e => setNewPost(p => ({ ...p, hashtags: e.target.value.split(",").map(h => h.trim()).filter(Boolean) }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={{ background: "oklch(0.22 0.02 255)", borderColor: "oklch(1 0 0 / 10%)", color: "oklch(0.88 0.008 240)" }}
                    placeholder="marketing, b2b, growth" />
                </div>
              </div>
            )}

            {(newPost.title || newPost.content || createMode === "free") && (
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setCreateModal(false); setSelectedTemplate(null); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
                <button onClick={handleCreatePost} disabled={createMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                  style={{ background: "oklch(0.6 0.2 255)" }}>
                  {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Mentés piszkozatként
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Detail Drawer */}
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
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setEditForm({ title: selectedPost.title, content: selectedPost.content, imageUrl: selectedPost.imageUrl, imagePrompt: selectedPost.imagePrompt, hashtags: selectedPost.hashtags }); setEditModal(true); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.6 0.2 255)" }}>
                <Pencil size={13} /> Szerkesztés
              </button>
              {socialConnections.filter(c => c.isActive).length > 0 && (
                <button onClick={() => { setPublishTarget(selectedPost); setSelectedConnectionId(socialConnections.filter(c => c.isActive)[0]?.id ?? ""); setPublishModal(true); setSelectedPost(null); }}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                  style={{ background: "oklch(0.65 0.18 165 / 15%)", color: "oklch(0.65 0.18 165)" }}>
                  <Send size={13} /> Publikálás
                </button>
              )}
              <button onClick={() => handleDelete(selectedPost.id)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "oklch(0.65 0.22 25)" }}>
                <Trash2 size={13} /> Törlés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {publishModal && publishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 60%)" }} onClick={() => setPublishModal(false)}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: "oklch(0.15 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>Közzététel</h3>
              <button onClick={() => setPublishModal(false)} style={{ color: "oklch(0.5 0.015 240)" }}><X size={18} /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: "oklch(0.65 0.015 240)" }}>Válaszd ki, melyik fiókra szeretnéd publikálni:</p>
            <div className="space-y-2 mb-4">
              {socialConnections.filter(c => c.isActive).map(conn => (
                <button key={conn.id} onClick={() => setSelectedConnectionId(conn.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                  style={{ background: selectedConnectionId === conn.id ? "oklch(0.6 0.2 255 / 10%)" : "oklch(0.22 0.02 255)", borderColor: selectedConnectionId === conn.id ? "oklch(0.6 0.2 255 / 40%)" : "oklch(1 0 0 / 8%)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.18 255 / 20%)", color: "oklch(0.55 0.18 255)" }}>
                    <Linkedin size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)" }}>{conn.platformUsername ?? conn.platform}</p>
                    <p className="text-xs" style={{ color: "oklch(0.5 0.015 240)" }}>{conn.platform}</p>
                  </div>
                  {selectedConnectionId === conn.id && <div className="ml-auto w-4 h-4 rounded-full" style={{ background: "oklch(0.6 0.2 255)" }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPublishModal(false)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.65 0.015 240)" }}>Mégse</button>
              <button
                onClick={() => {
                  if (!selectedConnectionId || !publishTarget) return;
                  publishNowMutation.mutate({
                    profileId: activeProfile.id,
                    connectionId: selectedConnectionId,
                    text: publishTarget.content,
                    imageUrl: publishTarget.imageUrl ?? undefined,
                    contentId: publishTarget.id,
                  });
                }}
                disabled={!selectedConnectionId || publishNowMutation.isPending}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                style={{ background: "oklch(0.6 0.2 255)" }}>
                {publishNowMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Közzétesz most
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
