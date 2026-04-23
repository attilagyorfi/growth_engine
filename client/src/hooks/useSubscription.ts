/**
 * useSubscription – Plan-alapú feature gating hook
 * Meghatározza, hogy az adott felhasználónak milyen funkciókhoz van hozzáférése
 * a subscriptionPlan alapján.
 */
import { useAppAuth } from "./useAppAuth";

export type SubscriptionPlan = "free" | "starter" | "pro" | "agency";

export interface PlanFeatures {
  plan: SubscriptionPlan;
  aiGenerationsPerMonth: number; // -1 = unlimited
  maxProfiles: number;           // -1 = unlimited
  maxLeads: number;              // -1 = unlimited
  maxContentPosts: number;       // -1 = unlimited
  canUseContentStudio: boolean;
  canUseStrategy: boolean;
  canUseAnalytics: boolean;
  canUseCampaigns: boolean;
  canUseSocialPublish: boolean;
  canExportData: boolean;
  canInviteTeam: boolean;
  isUnlimited: boolean;
}

const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  free: {
    plan: "free",
    aiGenerationsPerMonth: 3,
    maxProfiles: 1,
    maxLeads: 25,
    maxContentPosts: 10,
    canUseContentStudio: true,
    canUseStrategy: false,
    canUseAnalytics: false,
    canUseCampaigns: false,
    canUseSocialPublish: false,
    canExportData: false,
    canInviteTeam: false,
    isUnlimited: false,
  },
  starter: {
    plan: "starter",
    aiGenerationsPerMonth: 20,
    maxProfiles: 3,
    maxLeads: 200,
    maxContentPosts: 50,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: false,
    canUseSocialPublish: true,
    canExportData: false,
    canInviteTeam: false,
    isUnlimited: false,
  },
  pro: {
    plan: "pro",
    aiGenerationsPerMonth: -1,
    maxProfiles: -1,
    maxLeads: -1,
    maxContentPosts: -1,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: true,
    canUseSocialPublish: true,
    canExportData: true,
    canInviteTeam: true,
    isUnlimited: true,
  },
  agency: {
    plan: "agency",
    aiGenerationsPerMonth: -1,
    maxProfiles: -1,
    maxLeads: -1,
    maxContentPosts: -1,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: true,
    canUseSocialPublish: true,
    canExportData: true,
    canInviteTeam: true,
    isUnlimited: true,
  },
};

export function useSubscription() {
  const { user, isSuperAdmin } = useAppAuth();

  // Super admin always gets all features
  if (isSuperAdmin) {
    return {
      ...PLAN_FEATURES.agency,
      plan: "agency" as SubscriptionPlan,
      isUnlimited: true,
      isSuperAdmin: true,
    };
  }

  const rawPlan = user?.subscriptionPlan ?? "free";
  const plan = (rawPlan in PLAN_FEATURES ? rawPlan : "free") as SubscriptionPlan;
  const features = PLAN_FEATURES[plan];

  return {
    ...features,
    isSuperAdmin: false,
  };
}

export { PLAN_FEATURES };
