/**
 * G2A Growth Engine – ProfileContext (tRPC-backed)
 * Profiles are persisted in the database via tRPC.
 * Falls back to seed data on first load if DB is empty.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SocialAccount = {
  platform: "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok";
  handle: string;
  connected: boolean;
  followers?: number;
  lastSync?: string;
};

export type BrandVoice = {
  tone: string;
  style: string;
  avoid: string;
  keywords: string[];
};

export type ContentPillar = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  percentage: number;
};

export type ClientProfile = {
  id: string;
  name: string;
  initials: string;
  color: string;
  website: string;
  industry: string;
  description: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  brandGuidelineUrl?: string;
  brandVoice: BrandVoice;
  contentPillars: ContentPillar[];
  socialAccounts: SocialAccount[];
  createdAt: string;
  active: boolean;
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const seedProfiles: Omit<ClientProfile, "createdAt">[] = [
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
      { platform: "tiktok", handle: "g2amarketing", connected: false },
    ],
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
    active: true,
  },
];

// ─── Helper: DB row → ClientProfile ──────────────────────────────────────────

function dbToProfile(row: any): ClientProfile {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    color: row.color ?? "oklch(0.6 0.2 255)",
    website: row.website ?? "",
    industry: row.industry ?? "",
    description: row.description ?? "",
    logoUrl: row.logoUrl ?? undefined,
    primaryColor: row.primaryColor ?? "#3B82F6",
    secondaryColor: row.secondaryColor ?? "#10B981",
    fontHeading: row.fontHeading ?? "Sora",
    fontBody: row.fontBody ?? "Inter",
    brandGuidelineUrl: row.brandGuidelineUrl ?? undefined,
    brandVoice: row.brandVoice ?? { tone: "", style: "", avoid: "", keywords: [] },
    contentPillars: row.contentPillars ?? [],
    socialAccounts: (row.socialAccounts ?? []) as SocialAccount[],
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    active: row.active ?? true,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ProfileContextType = {
  profiles: ClientProfile[];
  activeProfile: ClientProfile;
  isLoading: boolean;
  setActiveProfileId: (id: string) => void;
  addProfile: (profile: Omit<ClientProfile, "createdAt">) => Promise<void>;
  updateProfile: (id: string, updates: Partial<ClientProfile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfileId, setActiveProfileId] = useState<string>("g2a");
  const [seeded, setSeeded] = useState(false);

  const { data: dbProfiles, isLoading, refetch } = trpc.profiles.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const upsertMutation = trpc.profiles.upsert.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.profiles.delete.useMutation({ onSuccess: () => refetch() });

  // Seed the DB with initial profiles on first load if empty
  useEffect(() => {
    if (!isLoading && dbProfiles && dbProfiles.length === 0 && !seeded) {
      setSeeded(true);
      Promise.all(seedProfiles.map(p => upsertMutation.mutateAsync(p)));
    }
  }, [isLoading, dbProfiles, seeded]);

  const profiles: ClientProfile[] = (dbProfiles && dbProfiles.length > 0)
    ? dbProfiles.map(dbToProfile)
    : seedProfiles.map(p => ({ ...p, createdAt: "2026-01-01" }));

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? seedProfiles[0] as ClientProfile;

  const addProfile = useCallback(async (profile: Omit<ClientProfile, "createdAt">) => {
    await upsertMutation.mutateAsync({ ...profile, id: profile.id ?? nanoid() });
  }, [upsertMutation]);

  const updateProfile = useCallback(async (id: string, updates: Partial<ClientProfile>) => {
    const existing = profiles.find(p => p.id === id);
    if (!existing) return;
    await upsertMutation.mutateAsync({ ...existing, ...updates, id });
  }, [profiles, upsertMutation]);

  const deleteProfileFn = useCallback(async (id: string) => {
    await deleteMutation.mutateAsync({ id });
    if (activeProfileId === id) {
      const remaining = profiles.filter(p => p.id !== id);
      setActiveProfileId(remaining[0]?.id ?? "");
    }
  }, [deleteMutation, activeProfileId, profiles]);

  return (
    <ProfileContext.Provider value={{
      profiles,
      activeProfile,
      isLoading,
      setActiveProfileId,
      addProfile,
      updateProfile,
      deleteProfile: deleteProfileFn,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
