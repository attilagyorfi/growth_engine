/**
 * G2A Growth Engine – ProfileContext (tRPC-backed, user-scoped)
 * Profiles are persisted in the database via tRPC.
 * Each user only sees their own profiles (enforced server-side).
 * Super admins see all profiles.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
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
  refetch: () => void;
};

const ProfileContext = createContext<ProfileContextType | null>(null);

// A minimal empty profile used as a safe fallback when no profile exists yet
const EMPTY_PROFILE: ClientProfile = {
  id: "",
  name: "",
  initials: "?",
  color: "oklch(0.6 0.2 255)",
  website: "",
  industry: "",
  description: "",
  primaryColor: "#3B82F6",
  secondaryColor: "#10B981",
  fontHeading: "Sora",
  fontBody: "Inter",
  brandVoice: { tone: "", style: "", avoid: "", keywords: [] },
  contentPillars: [],
  socialAccounts: [],
  createdAt: new Date().toISOString().slice(0, 10),
  active: false,
};

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfileId, setActiveProfileId] = useState<string>("");

  const { data: dbProfiles, isLoading, refetch } = trpc.profiles.list.useQuery(undefined, {
    staleTime: 30_000,
    retry: false,
  });

  const upsertMutation = trpc.profiles.upsert.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.profiles.delete.useMutation({ onSuccess: () => refetch() });

  const profiles: ClientProfile[] = (dbProfiles ?? []).map(dbToProfile);

  // Auto-select first profile when list loads
  const resolvedActiveId = activeProfileId || profiles[0]?.id || "";
  const activeProfile = profiles.find((p) => p.id === resolvedActiveId) ?? profiles[0] ?? EMPTY_PROFILE;

  const addProfile = useCallback(async (profile: Omit<ClientProfile, "createdAt">) => {
    await upsertMutation.mutateAsync({ ...profile, id: profile.id || nanoid() });
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
      refetch,
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
