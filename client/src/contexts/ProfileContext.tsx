/*
 * G2A Growth Engine – ProfileContext
 * Design: "Dark Ops Dashboard"
 * Multi-client profile management: switch between managed client accounts
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocialAccount = {
  platform: "linkedin" | "facebook" | "instagram" | "twitter";
  handle: string;
  connected: boolean;
  followers?: number;
  lastSync?: string;
};

export type BrandVoice = {
  tone: string;           // pl. "Szakmai, hiteles, közvetlen"
  style: string;          // pl. "B2B, gondolatvezetői tartalom"
  avoid: string;          // pl. "Túlzott szleng, clickbait"
  keywords: string[];     // pl. ["AI", "marketing", "növekedés"]
};

export type ContentPillar = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  percentage: number;     // tartalom arány %
};

export type ClientProfile = {
  id: string;
  name: string;           // pl. "G2A Marketing"
  initials: string;       // pl. "G2"
  color: string;          // oklch szín az avatárhoz
  website: string;
  industry: string;
  description: string;
  logoUrl?: string;
  // Arculati kézikönyv
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  brandGuidelineUrl?: string;
  // Márkahangg
  brandVoice: BrandVoice;
  // Tartalmi irányok
  contentPillars: ContentPillar[];
  // Social fiókok
  socialAccounts: SocialAccount[];
  // Meta
  createdAt: string;
  active: boolean;
};

// ─── Initial Profiles ─────────────────────────────────────────────────────────

const initialProfiles: ClientProfile[] = [
  {
    id: "g2a",
    name: "G2A Marketing",
    initials: "G2",
    color: "oklch(0.6 0.2 255)",
    website: "https://g2amarketing.hu",
    industry: "Marketing & Reklám",
    description: "AI-alapú marketing és growth hacking ügynökség, B2B fókusszal.",
    primaryColor: "#3B82F6",
    secondaryColor: "#10B981",
    fontHeading: "Sora",
    fontBody: "Inter",
    brandVoice: {
      tone: "Szakmai, hiteles, közvetlen",
      style: "B2B gondolatvezetői tartalom, adatvezérelt megközelítés",
      avoid: "Túlzott szleng, clickbait, általánosságok",
      keywords: ["AI", "marketing automatizálás", "B2B növekedés", "lead generálás", "ROI"],
    },
    contentPillars: [
      { id: "cp1", name: "AI & Automatizálás", description: "AI eszközök és marketing automatizálás bemutatása", active: true, percentage: 35 },
      { id: "cp2", name: "Esettanulmányok", description: "Ügyfélsiker történetek és mérhető eredmények", active: true, percentage: 25 },
      { id: "cp3", name: "Iparági trendek", description: "B2B marketing és tech trendek elemzése", active: true, percentage: 25 },
      { id: "cp4", name: "Tippek & Trükkök", description: "Gyakorlati marketing tippek döntéshozóknak", active: true, percentage: 15 },
    ],
    socialAccounts: [
      { platform: "linkedin", handle: "g2a-marketing", connected: true, followers: 1240, lastSync: "2026-03-18" },
      { platform: "facebook", handle: "g2amarketing", connected: false },
      { platform: "instagram", handle: "g2a.marketing", connected: false },
    ],
    createdAt: "2026-01-01",
    active: true,
  },
  {
    id: "techvision",
    name: "TechVision Kft.",
    initials: "TV",
    color: "oklch(0.65 0.18 165)",
    website: "https://techvision.hu",
    industry: "IT Services",
    description: "Vállalati IT megoldások és digitális transzformáció.",
    primaryColor: "#10B981",
    secondaryColor: "#6366F1",
    fontHeading: "Sora",
    fontBody: "Inter",
    brandVoice: {
      tone: "Megbízható, innovatív, szakértői",
      style: "Technológiai tartalom, vállalati döntéshozóknak szóló kommunikáció",
      avoid: "Túl technikai zsargon, értékesítési nyomás",
      keywords: ["digitális transzformáció", "IT megoldások", "biztonság", "felhő", "hatékonyság"],
    },
    contentPillars: [
      { id: "cp1", name: "Digitális transzformáció", description: "Vállalati digitalizáció folyamata és előnyei", active: true, percentage: 40 },
      { id: "cp2", name: "IT biztonság", description: "Kiberbiztonsági trendek és megoldások", active: true, percentage: 30 },
      { id: "cp3", name: "Felhő megoldások", description: "Cloud infrastruktúra és migráció", active: true, percentage: 30 },
    ],
    socialAccounts: [
      { platform: "linkedin", handle: "techvision-kft", connected: false },
      { platform: "facebook", handle: "techvisionkft", connected: false },
    ],
    createdAt: "2026-02-15",
    active: true,
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

type ProfileContextType = {
  profiles: ClientProfile[];
  activeProfile: ClientProfile;
  setActiveProfileId: (id: string) => void;
  addProfile: (profile: ClientProfile) => void;
  updateProfile: (id: string, updates: Partial<ClientProfile>) => void;
  deleteProfile: (id: string) => void;
};

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<ClientProfile[]>(initialProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string>("g2a");

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  const addProfile = useCallback((profile: ClientProfile) => {
    setProfiles((prev) => [...prev, profile]);
  }, []);

  const updateProfile = useCallback((id: string, updates: Partial<ClientProfile>) => {
    setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setActiveProfileId((prev) => prev === id ? profiles[0]?.id ?? "" : prev);
  }, [profiles]);

  return (
    <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfileId, addProfile, updateProfile, deleteProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
