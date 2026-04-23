/**
 * G2A Growth Engine – Onboarding Wizard
 * 3-step wizard: Basic Data → Brand & Communication → Operations & WOW Moment
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { HelpBanner, HelpPopup, StepTour } from "@/components/OnboardingHelpPopup";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Globe, Upload, Zap, ChevronRight, ChevronLeft,
  Check, Loader2, Building2, Users, Target,
  Sparkles, TrendingUp, Star, AlertTriangle,
  FileText, Image, BarChart3, X, Plus, Trash2,
  MessageSquare, Palette, Settings
} from "lucide-react";
import { nanoid } from "nanoid";
import { useAppAuth } from "@/hooks/useAppAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1 – Basic Data
  profileId: string;
  sessionId: string;
  companyName: string;
  website: string;
  industry: string;
  companySize: string;
  description: string;
  services: string[];
  targetAudience: string;
  competitors: string[];
  // Step 1 – Social Media URLs
  socialUrls: {
    linkedin: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
  // Step 2 – Brand & Communication
  toneOfVoice: string;
  communicationStyle: string;
  brandKeywords: string[];
  avoidWords: string[];
  brandColors: string[];
  uploadedAssets: UploadedAsset[];
  // Step 3 – Operations
  monthlyBudget: string;
  teamSize: string;
  currentChannels: string[];
  marketingPriorities: string[]; // multi-select (replaces single mainGoal)
  mainGoal: string; // kept for backward compat, set to first priority
  timeframe: string;
  // WOW output
  wowOutput: WowOutput | null;
  // Post-WOW auto-generated assets
  strategyGenerated: boolean;
  calendarGenerated: boolean;
}

interface UploadedAsset {
  id: string;
  name: string;
  type: string;
  assetType: string;
  url?: string;
  status: "uploading" | "done" | "error";
}

interface WowOutput {
  companySummary: string;
  topStrengths: string[];
  topRisks: string[];
  ninetyDayStrategyOutline: string;
  contentPillars: { name: string; description: string; percentage: number }[];
  contentIdeas: { title: string; platform: string; format: string; pillar: string }[];
  quickWins: { title: string; description: string; impact: string; effort: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "Technológia / SaaS", "E-kereskedelem", "Pénzügyi szolgáltatások",
  "Egészségügy", "Oktatás", "Ingatlan", "Jogi szolgáltatások",
  "Marketing / Reklám", "Gyártás / Ipar", "Vendéglátás / Turizmus",
  "Szépségipar / Wellness", "Nonprofit", "Egyéb"
];

const COMPANY_SIZES = ["1-5 fő", "6-20 fő", "21-50 fő", "51-200 fő", "200+ fő"];

// Normalize AI-returned industry string to the closest INDUSTRIES list value
function normalizeIndustry(aiIndustry: string): string {
  if (!aiIndustry) return "";
  const lower = aiIndustry.toLowerCase();
  const map: [string[], string][] = [
    [["tech", "szoftver", "saas", "it", "informatika", "fejleszt", "digital", "web", "app"], "Technológia / SaaS"],
    [["e-ker", "eker", "webshop", "online áruház", "webstore", "ecommerce", "e-commerce"], "E-kereskedelem"],
    [["pénz", "bank", "fintech", "biztosit", "befektet", "számvitel", "könyvel", "adó"], "Pénzügyi szolgáltatások"],
    [["egészség", "orvos", "gyógysz", "klinika", "kórház", "medical", "health"], "Egészségügy"],
    [["oktatás", "képzés", "iskola", "tanfolyam", "edtech", "education", "training"], "Oktatás"],
    [["ingatlan", "ing", "real estate", "property", "bérlet"], "Ingatlan"],
    [["jogi", "jog", "ügyvéd", "law", "legal", "notari"], "Jogi szolgáltatások"],
    [["marketing", "reklám", "pr", "kommunikáció", "hirdetés", "advertising", "media"], "Marketing / Reklám"],
    [["gyártás", "ipar", "mérnök", "manufacturing", "industrial", "logisztika", "szállít"], "Gyártás / Ipar"],
    [["vendéglátás", "hotel", "turizmus", "étterem", "café", "hospitality", "travel", "tourism"], "Vendéglátás / Turizmus"],
    [["szépség", "wellness", "fitness", "spa", "beauty", "kozmetik", "fodrász"], "Szépségipar / Wellness"],
    [["nonprofit", "civil", "alapítvány", "ngo", "jótékony"], "Nonprofit"],
  ];
  for (const [keywords, label] of map) {
    if (keywords.some(k => lower.includes(k))) return label;
  }
  // If no match found, return "Egyéb" so dropdown is not empty
  return "Egyéb";
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professzionális", desc: "Formális, tekintélyes, megbízható" },
  { value: "friendly", label: "Barátságos", desc: "Közvetlen, meleg, könnyen megközelíthető" },
  { value: "bold", label: "Merész", desc: "Magabiztos, provokatív, kiemelkedő" },
  { value: "educational", label: "Oktató", desc: "Informatív, hasznos, szakértői" },
  { value: "inspirational", label: "Inspiráló", desc: "Motiváló, érzelmi, vízióorientált" },
  { value: "humorous", label: "Humoros", desc: "Szórakoztató, könnyed, emlékezetes" },
];

const CHANNELS = [
  "LinkedIn", "Facebook", "Instagram", "TikTok", "Twitter/X",
  "Email marketing", "Google Ads", "SEO / Blog", "YouTube", "Podcast"
];

const GOALS = [
  "Brand awareness növelése", "Lead generálás", "Értékesítés növelése",
  "Ügyfélmegtartás", "Közösség építése", "Piaci pozíció erősítése"
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = [
    { label: "Alapadatok", icon: Building2 },
    { label: "Brand & Hang", icon: Palette },
    { label: "Működés", icon: Settings },
    { label: "WOW Kimenet", icon: Sparkles },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "text-white"
                    : "text-gray-500"
                }`}
                style={isCurrent ? { background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" } : isCompleted ? {} : { background: "oklch(0.22 0.02 255)" }}
              >
                {isCompleted ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${isCurrent ? "text-white" : isCompleted ? "text-green-400" : "text-gray-500"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-1 mb-5 ${stepNum < current ? "bg-green-500" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder, max = 10 }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < max) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-3 rounded-xl border min-h-[52px]" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
      {tags.map((tag, i) => (
        <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full text-sm text-white" style={{ background: "oklch(0.25 0.05 255)" }}>
          {tag}
          <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-gray-400 hover:text-white">
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < max && (
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
          onBlur={addTag}
          placeholder={placeholder}
          className="bg-transparent text-white text-sm outline-none flex-1 min-w-[120px] placeholder-gray-500"
        />
      )}
    </div>
  );
}

// ─── localStorage key ─────────────────────────────────────────────────────────
const LS_KEY = "g2a_onboarding_draft";
const LS_STEP_KEY = "g2a_onboarding_step";

function loadDraft(): Partial<WizardData> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<WizardData>;
  } catch {
    return null;
  }
}

function saveDraft(data: WizardData) {
  try {
    // Don't persist wowOutput (large, regeneratable)
    const { wowOutput, ...rest } = data;
    localStorage.setItem(LS_KEY, JSON.stringify(rest));
  } catch {
    // localStorage might be full or unavailable
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_STEP_KEY);
  } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpressMode, setIsExpressMode] = useState(false);
  const [isExpressRunning, setIsExpressRunning] = useState(false);
  const [showTour, setShowTour] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLanguage();
  const { user: appUser } = useAppAuth();

  // Draft restore banner
  const [showDraftBanner, setShowDraftBanner] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const draft = JSON.parse(raw) as Partial<WizardData>;
      // Only show banner if there's meaningful data (not just empty fields)
      return !!(draft.companyName || draft.website || draft.industry);
    } catch {
      return false;
    }
  });

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
    setStep(1);
    setData({
      profileId: appUser?.profileId || nanoid(),
      sessionId: nanoid(),
      companyName: "",
      website: "",
      industry: "",
      companySize: "",
      description: "",
      services: [],
      targetAudience: "",
      competitors: [],
      socialUrls: { linkedin: "", facebook: "", instagram: "", tiktok: "", youtube: "" },
      toneOfVoice: "",
      communicationStyle: "",
      brandKeywords: [],
      avoidWords: [],
      brandColors: [],
      uploadedAssets: [],
      monthlyBudget: "",
      teamSize: "",
      currentChannels: [],
      marketingPriorities: [],
      mainGoal: "",
      timeframe: "",
      wowOutput: null,
      strategyGenerated: false,
      calendarGenerated: false,
    });
  };

  // Restore step from localStorage
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(LS_STEP_KEY);
      const parsed = saved ? parseInt(saved, 10) : 1;
      // Don't restore WOW step (4) on reload – restart from step 3
      return parsed === 4 ? 3 : (parsed >= 1 && parsed <= 3 ? parsed : 1);
    } catch {
      return 1;
    }
  });

  const [data, setData] = useState<WizardData>(() => {
    const draft = loadDraft();
    const defaultData: WizardData = {
      profileId: appUser?.profileId || nanoid(),
      sessionId: nanoid(),
      companyName: "",
      website: "",
      industry: "",
      companySize: "",
      description: "",
      services: [],
      targetAudience: "",
      competitors: [],
      socialUrls: { linkedin: "", facebook: "", instagram: "", tiktok: "", youtube: "" },
      toneOfVoice: "",
      communicationStyle: "",
      brandKeywords: [],
      avoidWords: [],
      brandColors: [],
      uploadedAssets: [],
      monthlyBudget: "",
      teamSize: "",
      currentChannels: [],
      marketingPriorities: [],
      mainGoal: "",
      timeframe: "",
      wowOutput: null,
      strategyGenerated: false,
      calendarGenerated: false,
    };
    if (draft) {
      return { ...defaultData, ...draft, wowOutput: null, strategyGenerated: false, calendarGenerated: false };
    }
    return defaultData;
  });

  // Persist data to localStorage on every change
  useEffect(() => {
    saveDraft(data);
  }, [data]);

  // Persist step to localStorage
  useEffect(() => {
    if (step < 4) {
      try { localStorage.setItem(LS_STEP_KEY, String(step)); } catch {}
    }
  }, [step]);

  const update = (fields: Partial<WizardData>) => setData(prev => ({ ...prev, ...fields }));

  // tRPC mutations
  const scrapeWebsite = trpc.onboarding.scrapeWebsite.useMutation();
  const saveAnswers = trpc.onboarding.saveAnswers.useMutation();
  const upsertSession = trpc.onboarding.upsertSession.useMutation();
  const uploadAsset = trpc.onboarding.uploadAsset.useMutation();
  const upsertProfile = trpc.profiles.upsert.useMutation();
  const generateIntelligence = trpc.intelligence.generate.useMutation();
  const generateWow = trpc.intelligence.generateWowMoment.useMutation();
  const generateStrategy = trpc.strategyVersions.generate.useMutation();
  const generateMonthlyPlan = trpc.content.generateMonthlyPlan.useMutation();
  const utils = trpc.useUtils();
  const completeOnboarding = trpc.appAuth.completeOnboarding.useMutation();
  const [postWowStatus, setPostWowStatus] = useState<{ strategy: "idle" | "loading" | "done" | "error"; calendar: "idle" | "loading" | "done" | "error" }>({
    strategy: "idle",
    calendar: "idle",
  });

  // ─── Step 1: Website Scraping ───────────────────────────────────────────────

  const handleScrapeWebsite = async () => {
    if (!data.website) return;
    setIsScraping(true);
    try {
      let url = data.website;
      if (!url.startsWith("http")) url = "https://" + url;
      const result = await scrapeWebsite.mutateAsync({ url });
      // Normalize AI-returned industry to the closest dropdown value
      const normalizedIndustry = result.industry ? normalizeIndustry(result.industry) : "";
      update({
        // Fill companyName and industry from AI so validation passes
        ...(result.companyName && !data.companyName ? { companyName: result.companyName } : {}),
        ...(normalizedIndustry && !data.industry ? { industry: normalizedIndustry } : {}),
        services: result.services ?? [],
        targetAudience: result.targetAudience ?? "",
        competitors: result.competitorCandidates ?? [],
        description: result.companySummary ?? "",
      });
      toast.success("Weboldal elemzés kész! Az adatok automatikusan kitöltve.");
    } catch {
      toast.error("Nem sikerült elemezni a weboldalt. Töltsd ki kézzel!");
    } finally {
      setIsScraping(false);
    }
  };

  // ─── Express Mode: Skip to WOW ──────────────────────────────────────────────

  const handleExpressFinish = async () => {
    if (!data.companyName || !data.industry) {
      toast.error("Az Express módhoz add meg a cég nevét és iparágát!");
      return;
    }
    setIsExpressRunning(true);
    try {
      // Save session and step 1 answers
      await upsertSession.mutateAsync({ id: data.sessionId, profileId: data.profileId, currentStep: 3 });
      await saveAnswers.mutateAsync({
        sessionId: data.sessionId,
        profileId: data.profileId,
        step: 1,
        answers: [
          { fieldKey: "companyName", fieldValue: data.companyName },
          { fieldKey: "website", fieldValue: data.website },
          { fieldKey: "industry", fieldValue: data.industry },
          { fieldKey: "companySize", fieldValue: data.companySize },
          { fieldKey: "description", fieldValue: data.description },
          { fieldKey: "services", fieldValue: JSON.stringify(data.services) },
          { fieldKey: "targetAudience", fieldValue: data.targetAudience },
          { fieldKey: "competitors", fieldValue: JSON.stringify(data.competitors) },
        ],
      });
      // Create profile
      await upsertProfile.mutateAsync({
        id: data.profileId,
        name: data.companyName,
        initials: data.companyName.slice(0, 2).toUpperCase(),
        website: data.website,
        industry: data.industry,
        description: data.description,
        brandVoice: { tone: "Professzionális", style: "Informatív", keywords: [], avoid: "" },
        contentPillars: [],
      });
      // Generate intelligence
      const intelligence = await generateIntelligence.mutateAsync({
        profileId: data.profileId,
        profileData: {
          name: data.companyName,
          website: data.website,
          industry: data.industry,
          description: data.description,
          brandVoice: { tone: "Professzionális", style: "Informatív", keywords: [] },
        },
        onboardingAnswers: [
          { fieldKey: "services", fieldValue: JSON.stringify(data.services) },
          { fieldKey: "targetAudience", fieldValue: data.targetAudience },
          { fieldKey: "competitors", fieldValue: JSON.stringify(data.competitors) },
          { fieldKey: "mainGoal", fieldValue: "lead_generation" },
          { fieldKey: "currentChannels", fieldValue: JSON.stringify([]) },
        ],
      });
      // Generate WOW moment
      const wow = await generateWow.mutateAsync({ profileId: data.profileId, intelligenceData: intelligence });
      await upsertSession.mutateAsync({ id: data.sessionId, profileId: data.profileId, status: "completed", currentStep: 4, completedAt: new Date() });
      update({ wowOutput: wow });
      setStep(4);
      toast.success("🎉 Express elemzés kész!");
    } catch (e: unknown) {
      const errMsg = (e as { message?: string })?.message ?? "";
      const isAuthError = errMsg.includes("login") || errMsg.includes("Bejelentkezés") || errMsg.includes("10001");
      if (isAuthError) {
        toast.error("A munkamenet lejárt. Kérlek jelentkezz be újra!", { duration: 6000 });
      } else {
        toast.error("Hiba az elemzés során. Próbáld újra!", { duration: 5000 });
      }
    } finally {
      setIsExpressRunning(false);
    }
  };

  // ─── Step 2: File Upload ────────────────────────────────────────────────────

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const tempId = nanoid();
      const newAsset: UploadedAsset = {
        id: tempId,
        name: file.name,
        type: file.type,
        assetType: "brand_guide",
        status: "uploading",
      };
      update({ uploadedAssets: [...data.uploadedAssets, newAsset] });

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await uploadAsset.mutateAsync({
          profileId: data.profileId,
          fileName: file.name,
          fileType: file.type,
          fileBase64: base64,
          assetType: "brand_guide",
        });

        setData(prev => ({
          ...prev,
          uploadedAssets: prev.uploadedAssets.map(a =>
            a.id === tempId ? { ...a, id: result?.id ?? tempId, url: result?.fileUrl ?? "", status: "done" } : a
          ),
        }));
        toast.success(`${file.name} feltöltve!`);
      } catch {
        setData(prev => ({
          ...prev,
          uploadedAssets: prev.uploadedAssets.map(a =>
            a.id === tempId ? { ...a, status: "error" } : a
          ),
        }));
        toast.error(`${file.name} feltöltése sikertelen.`);
      }
    }
  };

  // ─── Step Navigation ────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (step === 1) {
      if (!data.companyName || !data.industry) {
        toast.error("Kérlek töltsd ki a kötelező mezőket (cég neve, iparág)!");
        return;
      }
      setIsLoading(true);
      try {
        await upsertSession.mutateAsync({ id: data.sessionId, profileId: data.profileId, currentStep: 2 });
        await saveAnswers.mutateAsync({
          sessionId: data.sessionId,
          profileId: data.profileId,
          step: 1,
          answers: [
            { fieldKey: "companyName", fieldValue: data.companyName },
            { fieldKey: "website", fieldValue: data.website },
            { fieldKey: "industry", fieldValue: data.industry },
            { fieldKey: "companySize", fieldValue: data.companySize },
            { fieldKey: "description", fieldValue: data.description },
            { fieldKey: "services", fieldValue: JSON.stringify(data.services) },
            { fieldKey: "targetAudience", fieldValue: data.targetAudience },
            { fieldKey: "competitors", fieldValue: JSON.stringify(data.competitors) },
          ],
        });
        setStep(2);
      } catch {
        toast.error("Hiba a mentés során, próbáld újra!");
      } finally {
        setIsLoading(false);
      }
    } else if (step === 2) {
      setIsLoading(true);
      try {
        await saveAnswers.mutateAsync({
          sessionId: data.sessionId,
          profileId: data.profileId,
          step: 2,
          answers: [
            { fieldKey: "toneOfVoice", fieldValue: data.toneOfVoice },
            { fieldKey: "communicationStyle", fieldValue: data.communicationStyle },
            { fieldKey: "brandKeywords", fieldValue: JSON.stringify(data.brandKeywords) },
            { fieldKey: "avoidWords", fieldValue: JSON.stringify(data.avoidWords) },
          ],
        });
        setStep(3);
      } catch {
        toast.error("Hiba a mentés során, próbáld újra!");
      } finally {
        setIsLoading(false);
      }
    } else if (step === 3) {
      if (data.marketingPriorities.length === 0) {
        toast.error("Kérlek válassz legalább egy marketing prioritást!");
        return;
      }
      setIsLoading(true);
      setIsGenerating(true);
      try {
        // Save step 3 answers
        await saveAnswers.mutateAsync({
          sessionId: data.sessionId,
          profileId: data.profileId,
          step: 3,
          answers: [
            { fieldKey: "monthlyBudget", fieldValue: data.monthlyBudget },
            { fieldKey: "teamSize", fieldValue: data.teamSize },
            { fieldKey: "currentChannels", fieldValue: JSON.stringify(data.currentChannels) },
            { fieldKey: "marketingPriorities", fieldValue: JSON.stringify(data.marketingPriorities) },
            { fieldKey: "mainGoal", fieldValue: data.mainGoal },
            { fieldKey: "timeframe", fieldValue: data.timeframe },
            { fieldKey: "socialUrls", fieldValue: JSON.stringify(data.socialUrls) },
          ],
        });

        // Create/update profile
        await upsertProfile.mutateAsync({
          id: data.profileId,
          name: data.companyName,
          initials: data.companyName.slice(0, 2).toUpperCase(),
          website: data.website,
          industry: data.industry,
          description: data.description,
          brandVoice: {
            tone: data.toneOfVoice,
            style: data.communicationStyle,
            keywords: data.brandKeywords,
            avoid: data.avoidWords.join(", "),
          },
          contentPillars: [],
        });

        // Generate company intelligence (with social URLs + priorities for richer AI context)
        const intelligence = await generateIntelligence.mutateAsync({
          profileId: data.profileId,
          profileData: {
            name: data.companyName,
            website: data.website,
            industry: data.industry,
            description: data.description,
            brandVoice: {
              tone: data.toneOfVoice,
              style: data.communicationStyle,
              keywords: data.brandKeywords,
            },
          },
          onboardingAnswers: [
            { fieldKey: "services", fieldValue: JSON.stringify(data.services) },
            { fieldKey: "targetAudience", fieldValue: data.targetAudience },
            { fieldKey: "competitors", fieldValue: JSON.stringify(data.competitors) },
            { fieldKey: "marketingPriorities", fieldValue: JSON.stringify(data.marketingPriorities) },
            { fieldKey: "mainGoal", fieldValue: data.mainGoal },
            { fieldKey: "currentChannels", fieldValue: JSON.stringify(data.currentChannels) },
            { fieldKey: "socialUrls", fieldValue: JSON.stringify(data.socialUrls) },
          ],
        });

        // Generate WOW moment
        const wow = await generateWow.mutateAsync({
          profileId: data.profileId,
          intelligenceData: intelligence,
        });

        // Complete session
        await upsertSession.mutateAsync({
          id: data.sessionId,
          profileId: data.profileId,
          status: "completed",
          currentStep: 4,
          completedAt: new Date(),
        });

        update({ wowOutput: wow });
        setStep(4);
        toast.success("🎉 Elemzés kész! Íme a Growth Engine eredménye.");

        // Auto-generate strategy and monthly calendar in background
        (async () => {
          // 1. Strategy
          setPostWowStatus(prev => ({ ...prev, strategy: "loading" }));
          try {
            await generateStrategy.mutateAsync({ profileId: data.profileId, intelligenceData: intelligence });
            setPostWowStatus(prev => ({ ...prev, strategy: "done" }));
            update({ strategyGenerated: true });
          } catch {
            setPostWowStatus(prev => ({ ...prev, strategy: "error" }));
          }
          // 2. Monthly content calendar
          setPostWowStatus(prev => ({ ...prev, calendar: "loading" }));
          try {
            const now = new Date();
            const pillars = wow.contentPillars?.map((p: { name: string }) => p.name) ?? ["Edukáció", "Inspiráció", "Termék/Szolgáltatás", "Közösség", "Mögöttes tartalom"];
            const platforms = data.currentChannels.filter(c =>
              ["linkedin", "facebook", "instagram", "tiktok", "twitter"].some(p => c.toLowerCase().includes(p))
            );
            await generateMonthlyPlan.mutateAsync({
              profileId: data.profileId,
              year: now.getFullYear(),
              month: now.getMonth(),
              intelligenceData: intelligence,
              contentPillars: pillars,
              platforms: platforms.length > 0 ? platforms : ["LinkedIn", "Facebook", "Instagram"],
            });
            setPostWowStatus(prev => ({ ...prev, calendar: "done" }));
            update({ calendarGenerated: true });
          } catch {
            setPostWowStatus(prev => ({ ...prev, calendar: "error" }));
          }
        })();
      } catch (e: unknown) {
        console.error(e);
        // Detect session expiry (UNAUTHORIZED) vs generic error
        const errMsg = (e as { message?: string })?.message ?? "";
        const isAuthError = errMsg.includes("login") || errMsg.includes("Bejelentkezés") || errMsg.includes("10001");
        if (isAuthError) {
          toast.error("A munkamenet lejárt. Kérlek jelentkezz be újra, majd folytasd az onboardingot.", { duration: 6000 });
        } else {
          toast.error("Hiba az elemzés során. Próbáld újra!", { duration: 5000 });
        }
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
      }
    }
  };

  const handleFinish = async (destination?: string) => {
    if (data.profileId) {
      try {
        // Save content pillars from WOW output to clientProfiles
        if (data.wowOutput?.contentPillars?.length) {
          const pillarsToSave = data.wowOutput.contentPillars.map((p, i) => ({
            id: nanoid(),
            name: p.name,
            description: p.description,
            active: true,
            percentage: p.percentage,
          }));
          await upsertProfile.mutateAsync({
            id: data.profileId,
            name: data.companyName,
            initials: data.companyName.slice(0, 2).toUpperCase(),
            contentPillars: pillarsToSave,
          });
        }
        await completeOnboarding.mutateAsync({ profileId: data.profileId });
        // Invalidate auth cache so AppRoute sees onboardingCompleted=true immediately
        await utils.appAuth.me.invalidate();
      } catch (e) {
        console.error("Onboarding complete error:", e);
      }
    }
    clearDraft();
    const target = destination ?? "/iranyitopult";
    navigate(target);
    toast.success(`${data.companyName} profil sikeresen létrehozva!`);
  };

  // ─── Render Steps ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.11 0.02 255)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "oklch(0.22 0.03 255)", background: "oklch(0.13 0.02 255)" }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-white" style={{ fontFamily: "Sora, sans-serif" }}>G2A Growth Engine</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{lang === "hu" ? "Új ügyfél beállítása" : "New client setup"}</span>
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.7 0.18 255)", border: "1px solid oklch(0.6 0.2 255 / 30%)" }}
          >
            <span>💡</span>
            <span>{lang === "hu" ? "Lépés útmutatója" : "Step guide"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <StepIndicator current={step} total={4} />

        {/* Draft Restore Banner */}
        {showDraftBanner && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: "oklch(0.75 0.18 75 / 8%)", borderColor: "oklch(0.75 0.18 75 / 30%)" }}>
            <span className="text-lg">&#128221;</span>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 240)" }}>Folytatod a korábbi kitöltést?</p>
              <p className="text-xs" style={{ color: "oklch(0.6 0.015 240)" }}>Találtunk egy korábban megkezdett űrlapot. Folytathatod onnan, ahol abbahagytad.</p>
            </div>
            <button
              onClick={() => setShowDraftBanner(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: "oklch(0.6 0.2 255)" }}
            >
              Folytatás
            </button>
            <button
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "oklch(0.28 0.02 255)", color: "oklch(0.65 0.015 240)" }}
            >
              Újrakezdjünk
            </button>
          </div>
        )}

        {/* Step Tour Overlay */}
        {showTour && <StepTour step={step} onClose={() => setShowTour(false)} />}

        {/* ─── Step 1: Basic Data ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
                {lang === "hu" ? "Ismerjük meg a cégedet" : "Tell us about your company"}
              </h1>
              <p className="text-gray-400">{lang === "hu" ? "Add meg az alapadatokat – a weboldal elemzéssel automatikusan kitöltjük a többit" : "Enter basic data – website analysis will auto-fill the rest"}</p>
            </div>

            <HelpBanner helpKey="help_company_name" title={lang === "hu" ? "Tipp az alapadatokhoz" : "Tip for basic data"} />

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                {lang === "hu" ? "Cég neve *" : "Company name *"}
                <HelpPopup helpKey="help_company_name" title={lang === "hu" ? "Cég neve" : "Company name"} />
              </label>
              <input
                value={data.companyName}
                onChange={e => update({ companyName: e.target.value })}
                placeholder="pl. G2A Marketing Kft."
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors"
                style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
              />
            </div>

            {/* Website with scrape */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Weboldal</label>
              <div className="flex gap-2">
                <input
                  value={data.website}
                  onChange={e => update({ website: e.target.value })}
                  placeholder="https://pelda.hu"
                  className="flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors"
                  style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                />
                <button
                  onClick={handleScrapeWebsite}
                  disabled={!data.website || isScraping}
                  className="px-4 py-3 rounded-xl font-medium text-white flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
                >
                  {isScraping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {isScraping ? "Elemzés..." : "AI Elemzés"}
                </button>
              </div>
              {isScraping && (
                <p className="text-blue-400 text-sm mt-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Az AI elemzi a weboldalt és automatikusan kitölti az adatokat...
                </p>
              )}
            </div>

            {/* Industry & Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Iparág *</label>
                <select
                  value={data.industry}
                  onChange={e => update({ industry: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none border focus:border-blue-500 transition-colors"
                  style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                >
                  <option value="">Válassz...</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cégméret</label>
                <select
                  value={data.companySize}
                  onChange={e => update({ companySize: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none border focus:border-blue-500 transition-colors"
                  style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                >
                  <option value="">Válassz...</option>
                  {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cég leírása</label>
              <textarea
                value={data.description}
                onChange={e => update({ description: e.target.value })}
                placeholder="Rövid leírás a cégről, fő tevékenységekről..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors resize-none"
                style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
              />
            </div>

            {/* Services */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Termékek / Szolgáltatások</label>
              <TagInput
                tags={data.services}
                onChange={services => update({ services })}
                placeholder="Adj hozzá szolgáltatást, Enter-rel..."
              />
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Célközönség</label>
              <input
                value={data.targetAudience}
                onChange={e => update({ targetAudience: e.target.value })}
                placeholder="pl. KKV-k, 30-50 éves döntéshozók, B2B..."
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors"
                style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
              />
            </div>

            {/* Competitors */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Versenytársak</label>
              <TagInput
                tags={data.competitors}
                onChange={competitors => update({ competitors })}
                placeholder="Versenytárs neve, Enter-rel..."
                max={8}
              />
            </div>

            {/* Social Media URLs */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <span>Közösségi média profilok</span>
                <span className="text-xs text-gray-500 font-normal">(opcionális – az AI elemzi a tartalmaidat)</span>
              </label>
              <div className="space-y-3">
                {[
                  { key: "linkedin" as const, label: "LinkedIn", placeholder: "https://linkedin.com/company/cegnev", icon: "in" },
                  { key: "facebook" as const, label: "Facebook", placeholder: "https://facebook.com/cegnev", icon: "fb" },
                  { key: "instagram" as const, label: "Instagram", placeholder: "https://instagram.com/cegnev", icon: "ig" },
                  { key: "tiktok" as const, label: "TikTok", placeholder: "https://tiktok.com/@cegnev", icon: "tt" },
                  { key: "youtube" as const, label: "YouTube", placeholder: "https://youtube.com/@cegnev", icon: "yt" },
                ].map(({ key, label, placeholder, icon }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                      style={{
                        background: key === "linkedin" ? "#0A66C2" : key === "facebook" ? "#1877F2" : key === "instagram" ? "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" : key === "tiktok" ? "#010101" : "#FF0000"
                      }}
                    >
                      {icon}
                    </div>
                    <input
                      value={data.socialUrls[key]}
                      onChange={e => update({ socialUrls: { ...data.socialUrls, [key]: e.target.value } })}
                      placeholder={placeholder}
                      className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors text-sm"
                      style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Az AI a megadott profilok alapján elemzi a meglévő tartalmaidat, hangvételedet és eléréseidet – ez lesz a kiindulási alap.</p>
            </div>
          </div>
        )}

        {/* ─── Step 2: Brand & Communication ─────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
                Brand & Kommunikáció
              </h1>
              <p className="text-gray-400">Határozd meg a márka hangját és töltsd fel a meglévő anyagokat</p>
            </div>

            {/* Tone of Voice */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Márkahangg (Tone of Voice)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TONE_OPTIONS.map(tone => (
                  <button
                    key={tone.value}
                    onClick={() => update({ toneOfVoice: tone.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      data.toneOfVoice === tone.value
                        ? "border-blue-500 text-white"
                        : "text-gray-400 hover:border-gray-500"
                    }`}
                    style={{
                      background: data.toneOfVoice === tone.value ? "oklch(0.2 0.05 255)" : "oklch(0.15 0.02 255)",
                      borderColor: data.toneOfVoice === tone.value ? "oklch(0.6 0.2 255)" : "oklch(0.28 0.03 255)",
                    }}
                  >
                    <div className="font-medium text-sm mb-1">{tone.label}</div>
                    <div className="text-xs opacity-70">{tone.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Communication Style */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Kommunikációs stílus</label>
              <textarea
                value={data.communicationStyle}
                onChange={e => update({ communicationStyle: e.target.value })}
                placeholder="pl. Rövid, tömör mondatok. Kerüljük a szakzsargont. Mindig konkrét példákkal illusztrálunk..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none border focus:border-blue-500 transition-colors resize-none"
                style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
              />
            </div>

            {/* Brand Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Kulcsszavak, amelyeket HASZNÁLJUNK</label>
              <TagInput
                tags={data.brandKeywords}
                onChange={brandKeywords => update({ brandKeywords })}
                placeholder="Kulcsszó, Enter-rel..."
              />
            </div>

            {/* Avoid Words */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Szavak, amelyeket KERÜLJÜNK</label>
              <TagInput
                tags={data.avoidWords}
                onChange={avoidWords => update({ avoidWords })}
                placeholder="Kerülendő szó, Enter-rel..."
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Márkaanyagok feltöltése (opcionális)</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-blue-500"
                style={{ borderColor: "oklch(0.28 0.03 255)", background: "oklch(0.13 0.02 255)" }}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-500" />
                <p className="text-gray-300 font-medium mb-1">Húzd ide a fájlokat, vagy kattints</p>
                <p className="text-gray-500 text-sm">Arculati kézikönyv, brand guide, sales deck, persona leírás (PDF, DOCX, PNG)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.pptx"
                className="hidden"
                onChange={e => handleFileUpload(e.target.files)}
              />

              {data.uploadedAssets.length > 0 && (
                <div className="mt-3 space-y-2">
                  {data.uploadedAssets.map(asset => (
                    <div key={asset.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "oklch(0.15 0.02 255)" }}>
                      <FileText size={18} className="text-blue-400 flex-shrink-0" />
                      <span className="text-gray-300 text-sm flex-1 truncate">{asset.name}</span>
                      {asset.status === "uploading" && <Loader2 size={16} className="animate-spin text-blue-400" />}
                      {asset.status === "done" && <Check size={16} className="text-green-400" />}
                      {asset.status === "error" && <X size={16} className="text-red-400" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 3: Operations ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
                Működés & Erőforrások
              </h1>
              <p className="text-gray-400">Az utolsó lépés – ezután az AI elkészíti a teljes Growth Engine elemzést</p>
            </div>

            {/* Marketing Priorities – multi-select */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-300">Marketing prioritások *</label>
                <button
                  onClick={() => {
                    const allSelected = data.marketingPriorities.length === GOALS.length;
                    update({
                      marketingPriorities: allSelected ? [] : [...GOALS],
                      mainGoal: allSelected ? "" : GOALS[0],
                    });
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                  style={{
                    background: data.marketingPriorities.length === GOALS.length ? "oklch(0.6 0.2 255)" : "oklch(0.22 0.03 255)",
                    color: data.marketingPriorities.length === GOALS.length ? "white" : "oklch(0.65 0.015 240)",
                    border: `1px solid ${data.marketingPriorities.length === GOALS.length ? "oklch(0.6 0.2 255)" : "oklch(0.32 0.03 255)"}`
                  }}
                >
                  {data.marketingPriorities.length === GOALS.length ? "✓ Minden kiválasztva" : "Minden"}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Válassz egyet vagy többet – az AI ezek alapján építi fel a stratégiát</p>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(goal => {
                  const selected = data.marketingPriorities.includes(goal);
                  return (
                    <button
                      key={goal}
                      onClick={() => {
                        const next = selected
                          ? data.marketingPriorities.filter(g => g !== goal)
                          : [...data.marketingPriorities, goal];
                        update({ marketingPriorities: next, mainGoal: next[0] ?? "" });
                      }}
                      className={`p-3 rounded-xl border text-left text-sm transition-all ${selected ? "text-white" : "text-gray-400 hover:border-gray-500"}`}
                      style={{
                        background: selected ? "oklch(0.2 0.05 255)" : "oklch(0.15 0.02 255)",
                        borderColor: selected ? "oklch(0.6 0.2 255)" : "oklch(0.28 0.03 255)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: selected ? "oklch(0.6 0.2 255)" : "oklch(0.22 0.03 255)", border: `1px solid ${selected ? "oklch(0.6 0.2 255)" : "oklch(0.35 0.03 255)"}` }}
                        >
                          {selected && <Check size={10} className="text-white" />}
                        </div>
                        <Target size={13} className="opacity-60 flex-shrink-0" />
                        <span>{goal}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Channels */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Jelenleg aktív csatornák</label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map(channel => (
                  <button
                    key={channel}
                    onClick={() => {
                      const channels = data.currentChannels.includes(channel)
                        ? data.currentChannels.filter(c => c !== channel)
                        : [...data.currentChannels, channel];
                      update({ currentChannels: channels });
                    }}
                    className={`px-4 py-2 rounded-full border text-sm transition-all ${
                      data.currentChannels.includes(channel) ? "text-white" : "text-gray-400 hover:border-gray-500"
                    }`}
                    style={{
                      background: data.currentChannels.includes(channel) ? "oklch(0.2 0.05 255)" : "oklch(0.15 0.02 255)",
                      borderColor: data.currentChannels.includes(channel) ? "oklch(0.6 0.2 255)" : "oklch(0.28 0.03 255)",
                    }}
                  >
                    {data.currentChannels.includes(channel) && <Check size={12} className="inline mr-1" />}
                    {channel}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget & Team */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Havi marketing büdzsé</label>
                <select
                  value={data.monthlyBudget}
                  onChange={e => update({ monthlyBudget: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none border focus:border-blue-500 transition-colors"
                  style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                >
                  <option value="">Válassz...</option>
                  <option>0 – 100 000 Ft</option>
                  <option>100 000 – 300 000 Ft</option>
                  <option>300 000 – 500 000 Ft</option>
                  <option>500 000 – 1 000 000 Ft</option>
                  <option>1 000 000 Ft felett</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Időkeret</label>
                <select
                  value={data.timeframe}
                  onChange={e => update({ timeframe: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl text-white outline-none border focus:border-blue-500 transition-colors"
                  style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}
                >
                  <option value="">Válassz...</option>
                  <option>30 nap</option>
                  <option>90 nap</option>
                  <option>6 hónap</option>
                  <option>1 év</option>
                </select>
              </div>
            </div>

            {/* Generating indicator */}
            {isGenerating && (
              <div className="rounded-xl p-6 border text-center" style={{ background: "oklch(0.15 0.05 255)", borderColor: "oklch(0.35 0.1 255)" }}>
                <Loader2 size={32} className="animate-spin mx-auto mb-3 text-blue-400" />
                <p className="text-white font-medium mb-1">Az AI elemzi a cégedet...</p>
                <p className="text-gray-400 text-sm">Company Intelligence generálás, stratégia tervezés, tartalom ötletek – ez 20-30 másodpercet vesz igénybe</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 4: WOW Moment ─────────────────────────────────────────── */}
        {step === 4 && data.wowOutput && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
                <Sparkles size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
                🎉 A Growth Engine készen áll!
              </h1>
              <p className="text-gray-400">Az AI elvégezte az elemzést. Íme a {data.companyName} Growth Engine profil:</p>
            </div>

            {/* Company Summary */}
            <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Building2 size={18} className="text-blue-400" /> Cégprofil összefoglaló
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{data.wowOutput.companySummary}</p>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.13 0.04 145)", borderColor: "oklch(0.35 0.1 145)" }}>
                <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
                  <Star size={16} /> Erősségek
                </h3>
                <ul className="space-y-2">
                  {data.wowOutput.topStrengths.map((s, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <Check size={14} className="text-green-400 mt-0.5 flex-shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.13 0.04 30)", borderColor: "oklch(0.35 0.1 30)" }}>
                <h3 className="text-orange-400 font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} /> Kockázatok
                </h3>
                <ul className="space-y-2">
                  {data.wowOutput.topRisks.map((r, i) => (
                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                      <AlertTriangle size={14} className="text-orange-400 mt-0.5 flex-shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 90-day Strategy */}
            <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" /> 90 napos stratégia vázlat
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">{data.wowOutput.ninetyDayStrategyOutline}</p>
            </div>

            {/* Content Pillars */}
            <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-400" /> Tartalmi pillérek
              </h3>
              <div className="space-y-3">
                {data.wowOutput.contentPillars.map((pillar, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 font-medium">{pillar.name}</span>
                      <span className="text-gray-500">{pillar.percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.22 0.02 255)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pillar.percentage}%`,
                          background: `hsl(${i * 60}, 70%, 60%)`,
                        }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Wins */}
            <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap size={18} className="text-yellow-400" /> Gyors győzelmek (Quick Wins)
              </h3>
              <div className="space-y-3">
                {data.wowOutput.quickWins.map((win, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg" style={{ background: "oklch(0.18 0.02 255)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.25 0.05 255)" }}>
                      <span className="text-white text-sm font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium">{win.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${win.impact === "high" ? "bg-green-900 text-green-400" : win.impact === "medium" ? "bg-yellow-900 text-yellow-400" : "bg-gray-800 text-gray-400"}`}>
                          {win.impact === "high" ? "Nagy hatás" : win.impact === "medium" ? "Közepes" : "Kis hatás"}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs">{win.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Post-WOW auto-generation status */}
            {(postWowStatus.strategy !== "idle" || postWowStatus.calendar !== "idle") && (
              <div className="rounded-xl p-5 border" style={{ background: "oklch(0.13 0.05 145 / 30%)", borderColor: "oklch(0.4 0.12 145 / 40%)" }}>
                <h3 className="text-green-400 font-semibold mb-4 flex items-center gap-2">
                  <Sparkles size={16} /> Az AI még dolgozik a számodra...
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {postWowStatus.strategy === "loading" && <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />}
                    {postWowStatus.strategy === "done" && <Check size={16} className="text-green-400 flex-shrink-0" />}
                    {postWowStatus.strategy === "error" && <AlertTriangle size={16} className="text-orange-400 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-white">90 napos stratégia</p>
                      <p className="text-xs text-gray-400">
                        {postWowStatus.strategy === "loading" ? "Stratégia generálása folyamatban..." : postWowStatus.strategy === "done" ? "Kész! A Stratégia menüpontban találod." : postWowStatus.strategy === "error" ? "Nem sikerült, később a Stratégia oldalon generálhatod." : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {postWowStatus.calendar === "loading" && <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />}
                    {postWowStatus.calendar === "done" && <Check size={16} className="text-green-400 flex-shrink-0" />}
                    {postWowStatus.calendar === "error" && <AlertTriangle size={16} className="text-orange-400 flex-shrink-0" />}
                    {postWowStatus.calendar === "idle" && postWowStatus.strategy !== "idle" && <Loader2 size={16} className="animate-spin text-gray-500 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-white">Havi tartalmi naptár</p>
                      <p className="text-xs text-gray-400">
                        {postWowStatus.calendar === "loading" ? "12-16 poszt generálása folyamatban..." : postWowStatus.calendar === "done" ? "Kész! A Tartalom Studió naptár nézetben találod." : postWowStatus.calendar === "error" ? "Nem sikerült, később a Tartalom Studióban generálhatod." : postWowStatus.strategy !== "idle" ? "Várakozik a stratégia készülésére..." : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Ideas Preview */}
            <div className="rounded-xl p-5 border" style={{ background: "oklch(0.15 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-cyan-400" /> Tartalom ötletek (első 5)
              </h3>
              <div className="space-y-2">
                {data.wowOutput.contentIdeas.slice(0, 5).map((idea, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "oklch(0.18 0.02 255)" }}>
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "oklch(0.25 0.05 255)", color: "oklch(0.7 0.15 255)" }}>
                      {idea.platform}
                    </span>
                    <span className="text-gray-300 text-sm flex-1">{idea.title}</span>
                    <span className="text-gray-500 text-xs">{idea.format}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

            {/* ─── Navigation Buttons ─────────────────────────────────── */}
        <div className="flex justify-between mt-8 pt-6 border-t" style={{ borderColor: "oklch(0.22 0.03 255)" }}>
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-gray-400 hover:text-white border transition-all"
              style={{ borderColor: "oklch(0.28 0.03 255)", background: "oklch(0.15 0.02 255)" }}
            >
              <ChevronLeft size={18} /> Vissza
            </button>
          ) : <div />}

          {step < 4 ? (
            <div className="flex flex-col items-end gap-2">
              {step === 1 && (
                <button
                  onClick={handleExpressFinish}
                  disabled={isExpressRunning || !data.companyName || !data.industry}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 text-sm"
                  style={{ background: "linear-gradient(135deg, oklch(0.65 0.2 60), oklch(0.6 0.18 30))" }}
                >
                  {isExpressRunning ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                  {isExpressRunning ? "Express elemzés..." : "⚡ Express mód – átugorja a 2-3. lépést"}
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={isLoading || isGenerating || isExpressRunning}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {step === 3 ? (isGenerating ? "Elemzés folyamatban..." : "Growth Engine indítása") : "Következő"}
                {!isLoading && !isGenerating && <ChevronRight size={18} />}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full">
              <p className="text-gray-400 text-sm text-center mb-1">Mivel szeretnéd kezdeni?</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleFinish("/strategia?autoGenerate=true")}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl font-medium text-white transition-all hover:opacity-90 text-sm"
                  style={{ background: "linear-gradient(135deg, oklch(0.5 0.18 255), oklch(0.45 0.16 255))" }}
                >
                  <TrendingUp size={20} />
                  Stratégia
                  <span className="text-xs opacity-70">90 napos terv</span>
                </button>
                <button
                  onClick={() => handleFinish("/tartalom-studio")}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl font-medium text-white transition-all hover:opacity-90 text-sm"
                  style={{ background: "linear-gradient(135deg, oklch(0.5 0.18 165), oklch(0.45 0.16 165))" }}
                >
                  <MessageSquare size={20} />
                  Tartalom
                  <span className="text-xs opacity-70">Content calendar</span>
                </button>
                <button
                  onClick={() => handleFinish("/ertekesites")}
                  className="flex flex-col items-center gap-2 px-4 py-4 rounded-xl font-medium text-white transition-all hover:opacity-90 text-sm"
                  style={{ background: "linear-gradient(135deg, oklch(0.5 0.18 30), oklch(0.45 0.16 30))" }}
                >
                  <Zap size={20} />
                  Email kampány
                  <span className="text-xs opacity-70">Első outbound</span>
                </button>
              </div>
              <button
                onClick={() => handleFinish("/iranyitopult")}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-gray-400 hover:text-white border transition-all text-sm"
                style={{ borderColor: "oklch(0.28 0.03 255)", background: "oklch(0.15 0.02 255)" }}
              >
                <Check size={16} /> Belépés a vezérlőpultra
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
