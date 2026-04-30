/**
 * G2A Growth Engine – AI Writing Engine
 * Generate emails, social posts, and other content using AI
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useProfile } from "@/contexts/ProfileContext";
import { useData } from "@/contexts/DataContext";
import { toast } from "sonner";
import {
  Wand2, Mail, Share2, FileText, Loader2, Copy, Check,
  RefreshCw, Send, Save, ChevronDown, Sparkles, Edit3,
  Linkedin, Twitter, Instagram, Video, Plus, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "cold_email" | "follow_up_email" | "linkedin_post" | "facebook_post" | "instagram_post" | "tiktok_post" | "blog_outline" | "ad_copy";

interface GeneratedContent {
  type: ContentType;
  content: string;
  subject?: string;
  hashtags?: string[];
  callToAction?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { value: ContentType; label: string; icon: React.ElementType; color: string; category: "email" | "social" | "other" }[] = [
  { value: "cold_email", label: "Hideg email", icon: Mail, color: "oklch(0.65 0.18 255)", category: "email" },
  { value: "follow_up_email", label: "Follow-up email", icon: Mail, color: "oklch(0.65 0.15 220)", category: "email" },
  { value: "linkedin_post", label: "LinkedIn poszt", icon: Linkedin, color: "oklch(0.65 0.18 240)", category: "social" },
  { value: "facebook_post", label: "Facebook poszt", icon: Share2, color: "oklch(0.65 0.18 270)", category: "social" },
  { value: "instagram_post", label: "Instagram poszt", icon: Instagram, color: "oklch(0.65 0.18 330)", category: "social" },
  { value: "tiktok_post", label: "TikTok script", icon: Video, color: "oklch(0.65 0.18 0)", category: "social" },
  { value: "blog_outline", label: "Blog vázlat", icon: FileText, color: "oklch(0.65 0.18 145)", category: "other" },
  { value: "ad_copy", label: "Hirdetési szöveg", icon: Sparkles, color: "oklch(0.65 0.18 60)", category: "other" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIWriter() {
  const { activeProfile } = useProfile();
  const { addOutbound } = useData();

  // Form state
  const [contentType, setContentType] = useState<ContentType>("cold_email");
  const [targetAudience, setTargetAudience] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientCompany, setRecipientCompany] = useState("");

  // Output state
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const generateEmailMutation = trpc.aiWrite.generateEmailDraft.useMutation();
  const generateSocialMutation = trpc.aiWrite.generateSocialPost.useMutation();

  const selectedType = CONTENT_TYPES.find(t => t.value === contentType)!;
  const isEmail = selectedType.category === "email";

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Add meg a téma/célkitűzés mezőt!");
      return;
    }
    setIsGenerating(true);
    setGenerated(null);
    try {
      let result: GeneratedContent;
      const profileBrandVoice = activeProfile?.brandVoice as { tone?: string; style?: string; keywords?: string[] } | undefined;
      if (isEmail) {
        const r = await generateEmailMutation.mutateAsync({
          profileId: activeProfile?.id ?? "",
          leadData: { contact: recipientName || "Kapcsolattartó", company: recipientCompany || "Cég", industry: targetAudience || activeProfile?.industry || "" },
          brandVoice: profileBrandVoice ? { tone: profileBrandVoice.tone ?? "", style: profileBrandVoice.style ?? "", keywords: profileBrandVoice.keywords ?? [] } : undefined,
          emailGoal: topic,
          previousContext: additionalContext || undefined,
        });
        result = { type: contentType, content: r.body, subject: r.subject };
      } else {
        const r = await generateSocialMutation.mutateAsync({
          profileId: activeProfile?.id ?? "",
          platform: (contentType.replace("_post", "").replace("_script", "") as "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok"),
          topic,
          pillar: targetAudience || "",
          brandVoice: profileBrandVoice ? { tone: profileBrandVoice.tone ?? "", style: profileBrandVoice.style ?? "", keywords: profileBrandVoice.keywords ?? [] } : undefined,
          targetAudience: additionalContext || undefined,
        });
        result = { type: contentType, content: r.content, hashtags: r.hashtags, callToAction: r.callToAction };
      }
      setGenerated(result);
      setEditedContent(result.content);
    } catch (err) {
      toast.error("Hiba a generálás során. Próbáld újra!");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const text = isEditing ? editedContent : (generated?.content ?? "");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Vágólapra másolva!");
  };

  const handleSaveToOutbound = () => {
    if (!generated || !isEmail) return;
    addOutbound({
      toName: recipientName || "Ismeretlen",
      company: recipientCompany || "Ismeretlen cég",
      to: "",
      subject: generated.subject ?? topic,
      body: isEditing ? editedContent : generated.content,
      status: "draft",
    });
    toast.success("Email mentve az Outbound listába!");
  };

  const displayContent = isEditing ? editedContent : (generated?.content ?? "");

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: "Sora, sans-serif" }}>
            <Wand2 size={24} className="text-violet-400" />
            AI Writing Engine
          </h1>
          <p className="text-gray-400 mt-1">Generálj emaileket, social posztokat és egyéb tartalmakat AI segítségével</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input Panel */}
          <div className="space-y-5">
            {/* Content Type Selector */}
            <div className="rounded-xl p-5 border" style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}>
              <h3 className="text-white font-semibold mb-3">Tartalom típusa</h3>
              <div className="grid grid-cols-2 gap-2">
                {CONTENT_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = contentType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setContentType(type.value)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all"
                      style={{
                        background: isSelected ? `${type.color}22` : "oklch(0.18 0.02 255)",
                        border: `1px solid ${isSelected ? type.color : "var(--qa-surface3)"}`,
                        color: isSelected ? type.color : "oklch(0.65 0.05 255)",
                      }}
                    >
                      <Icon size={14} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email-specific fields */}
            {isEmail && (
              <div className="rounded-xl p-5 border space-y-3" style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}>
                <h3 className="text-white font-semibold">Címzett adatai</h3>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Kapcsolattartó neve</label>
                  <input
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="pl. Kovács Péter"
                    className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                    style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Cég neve</label>
                  <input
                    value={recipientCompany}
                    onChange={e => setRecipientCompany(e.target.value)}
                    placeholder="pl. TechVision Kft."
                    className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                    style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                  />
                </div>
              </div>
            )}

            {/* Core inputs */}
            <div className="rounded-xl p-5 border space-y-3" style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}>
              <h3 className="text-white font-semibold">Tartalom paraméterei</h3>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Téma / Célkitűzés *</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="pl. LinkedIn marketing szolgáltatásaink bemutatása"
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Célközönség</label>
                <input
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder={`pl. ${activeProfile?.industry ?? "KKV döntéshozók"}`}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Hangnem</label>
                <input
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  placeholder={`pl. ${(activeProfile?.brandVoice as { tone?: string } | undefined)?.tone ?? "professzionális, barátságos"}`}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none"
                  style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Kiegészítő kontextus</label>
                <textarea
                  value={additionalContext}
                  onChange={e => setAdditionalContext(e.target.value)}
                  placeholder="pl. Nemrég díjat nyertünk, akciós ajánlat van érvényben..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm outline-none resize-none"
                  style={{ background: "oklch(0.18 0.02 255)", border: "1px solid var(--qa-surface3)" }}
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic.trim()}
              className="w-full py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.2 285), oklch(0.5 0.18 255))" }}
            >
              {isGenerating ? (
                <><Loader2 size={18} className="animate-spin" /> Generálás folyamatban...</>
              ) : (
                <><Wand2 size={18} /> Tartalom generálása</>
              )}
            </button>
          </div>

          {/* Right: Output Panel */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "var(--qa-bg)", borderColor: "var(--qa-surface3)" }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                Generált tartalom
              </h3>
              {generated && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsEditing(!isEditing); if (!isEditing) setEditedContent(generated.content); }}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    title={isEditing ? "Szerkesztés befejezése" : "Szerkesztés"}
                  >
                    {isEditing ? <Check size={14} className="text-green-400" /> : <Edit3 size={14} className="text-gray-400" />}
                  </button>
                  <button onClick={handleCopy} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" title="Másolás">
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                  </button>
                  <button onClick={handleGenerate} disabled={isGenerating} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" title="Újragenerálás">
                    <RefreshCw size={14} className="text-gray-400" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 min-h-[400px]">
              {isGenerating && (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="relative">
                    <Loader2 size={40} className="animate-spin text-violet-400" />
                    <Sparkles size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-300" />
                  </div>
                  <p className="text-gray-400 text-sm">AI generálja a tartalmat...</p>
                </div>
              )}

              {!isGenerating && !generated && (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <Wand2 size={40} className="text-gray-600" />
                  <p className="text-gray-400">Töltsd ki a bal oldali mezőket és kattints a "Tartalom generálása" gombra</p>
                </div>
              )}

              {!isGenerating && generated && (
                <div className="space-y-4">
                  {/* Subject line for emails */}
                  {generated.subject && (
                    <div className="p-3 rounded-lg" style={{ background: "oklch(0.18 0.02 255)" }}>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Tárgy</p>
                      <p className="text-white font-medium">{generated.subject}</p>
                    </div>
                  )}

                  {/* Main content */}
                  {isEditing ? (
                    <textarea
                      value={editedContent}
                      onChange={e => setEditedContent(e.target.value)}
                      className="w-full text-gray-200 text-sm leading-relaxed outline-none resize-none rounded-lg p-3"
                      style={{ background: "oklch(0.18 0.02 255)", border: "1px solid oklch(0.35 0.05 255)", minHeight: "280px" }}
                    />
                  ) : (
                    <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {generated.content}
                    </div>
                  )}

                  {/* Hashtags for social */}
                  {generated.hashtags && generated.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {generated.hashtags.map((tag, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full" style={{ background: "oklch(0.22 0.05 255)", color: "var(--qa-accent)" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  {generated.callToAction && (
                    <div className="p-3 rounded-lg border-l-2" style={{ background: "oklch(0.18 0.02 255)", borderColor: "oklch(0.55 0.18 145)" }}>
                      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Call to Action</p>
                      <p className="text-gray-200 text-sm">{generated.callToAction}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
                    <button
                      onClick={handleCopy}
                      className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all hover:bg-white/10"
                      style={{ border: "1px solid var(--qa-surface3)", color: "oklch(0.7 0.05 255)" }}
                    >
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                      Másolás
                    </button>
                    {isEmail && (
                      <button
                        onClick={handleSaveToOutbound}
                        className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                        style={{ background: "oklch(0.25 0.08 255)", color: "oklch(0.75 0.15 255)", border: "1px solid oklch(0.35 0.1 255)" }}
                      >
                        <Save size={14} />
                        Mentés Outbound-ba
                      </button>
                    )}
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all hover:opacity-90"
                      style={{ background: "oklch(0.25 0.08 285)", color: "oklch(0.75 0.15 285)", border: "1px solid oklch(0.35 0.1 285)" }}
                    >
                      <RefreshCw size={14} />
                      Újra
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
