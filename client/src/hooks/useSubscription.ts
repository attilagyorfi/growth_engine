/**
 * useSubscription – Plan-alapú feature gating hook
 * Meghatározza, hogy az adott felhasználónak milyen funkciókhoz van hozzáférése
 * a subscriptionPlan alapján.
 *
 * Szinkronban van a server/authDb.ts AI_PLAN_LIMITS struktúrával.
 */
import { useAppAuth } from "./useAppAuth";

export type SubscriptionPlan = "free" | "starter" | "pro" | "agency";

export interface PlanFeatures {
  plan: SubscriptionPlan;
  // Per-feature AI kvóták (szinkron: server/authDb.ts AI_PLAN_LIMITS)
  aiStrategyPerMonth: number;       // -1 = unlimited
  aiContentPlanPerMonth: number;
  aiPostPerMonth: number;
  aiCampaignPerMonth: number;
  aiImagePerMonth: number;
  aiVideoPerMonth: number;
  aiSeoPerMonth: number;
  aiIntelligencePerMonth: number;
  aiDailyTasksPerMonth: number;
  // Általános limitek
  maxProfiles: number;              // -1 = unlimited
  maxLeads: number;
  maxContentPosts: number;
  // Feature jogosultságok
  canUseContentStudio: boolean;
  canUseStrategy: boolean;
  canUseAnalytics: boolean;
  canUseCampaigns: boolean;
  canUseSocialPublish: boolean;
  canUseVideoStudio: boolean;
  canExportData: boolean;
  canInviteTeam: boolean;
  canWhiteLabel: boolean;
  isUnlimited: boolean;
  // Ár megjelenítéshez
  monthlyPrice: number;             // Ft/hó (0 = ingyenes)
  planLabel: string;
}

const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  free: {
    plan: "free",
    aiStrategyPerMonth: 1,
    aiContentPlanPerMonth: 1,
    aiPostPerMonth: 5,
    aiCampaignPerMonth: 1,
    aiImagePerMonth: 0,
    aiVideoPerMonth: 0,
    aiSeoPerMonth: 1,
    aiIntelligencePerMonth: 1,
    aiDailyTasksPerMonth: 5,
    maxProfiles: 1,
    maxLeads: 25,
    maxContentPosts: 10,
    canUseContentStudio: true,
    canUseStrategy: false,
    canUseAnalytics: true,
    canUseCampaigns: false,
    canUseSocialPublish: false,
    canUseVideoStudio: false,
    canExportData: false,
    canInviteTeam: false,
    canWhiteLabel: false,
    isUnlimited: false,
    monthlyPrice: 0,
    planLabel: "Ingyenes",
  },
  starter: {
    plan: "starter",
    aiStrategyPerMonth: 5,
    aiContentPlanPerMonth: 2,
    aiPostPerMonth: 50,
    aiCampaignPerMonth: 3,
    aiImagePerMonth: 5,
    aiVideoPerMonth: 0,
    aiSeoPerMonth: 3,
    aiIntelligencePerMonth: 3,
    aiDailyTasksPerMonth: 30,
    maxProfiles: 1,
    maxLeads: 200,
    maxContentPosts: 100,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: false,
    canUseSocialPublish: true,
    canUseVideoStudio: false,
    canExportData: true,
    canInviteTeam: false,
    canWhiteLabel: false,
    isUnlimited: false,
    monthlyPrice: 9900,
    planLabel: "Starter",
  },
  pro: {
    plan: "pro",
    aiStrategyPerMonth: 20,
    aiContentPlanPerMonth: 6,
    aiPostPerMonth: 300,
    aiCampaignPerMonth: 15,
    aiImagePerMonth: 30,
    aiVideoPerMonth: 5,
    aiSeoPerMonth: 10,
    aiIntelligencePerMonth: 10,
    aiDailyTasksPerMonth: 90,
    maxProfiles: 3,
    maxLeads: -1,
    maxContentPosts: -1,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: true,
    canUseSocialPublish: true,
    canUseVideoStudio: true,
    canExportData: true,
    canInviteTeam: true,
    canWhiteLabel: false,
    isUnlimited: false,
    monthlyPrice: 24900,
    planLabel: "Pro",
  },
  agency: {
    plan: "agency",
    aiStrategyPerMonth: 60,
    aiContentPlanPerMonth: 20,
    aiPostPerMonth: 1000,
    aiCampaignPerMonth: 50,
    aiImagePerMonth: 100,
    aiVideoPerMonth: 15,
    aiSeoPerMonth: 30,
    aiIntelligencePerMonth: 30,
    aiDailyTasksPerMonth: 300,
    maxProfiles: -1,
    maxLeads: -1,
    maxContentPosts: -1,
    canUseContentStudio: true,
    canUseStrategy: true,
    canUseAnalytics: true,
    canUseCampaigns: true,
    canUseSocialPublish: true,
    canUseVideoStudio: true,
    canExportData: true,
    canInviteTeam: true,
    canWhiteLabel: true,
    isUnlimited: true,
    monthlyPrice: 49900,
    planLabel: "Agency",
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
