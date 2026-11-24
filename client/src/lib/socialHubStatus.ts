/** A poszt Social Hub-állapotának jelvénye a Content Studióban (G2). */
export type SocialHubStatus = "approved" | "changes_requested" | "published" | "failed";

export const SOCIAL_HUB_BADGE: Record<SocialHubStatus, { label: string; color: string }> = {
  approved: { label: "Jóváhagyva a Social Hubban", color: "var(--qa-success)" },
  changes_requested: { label: "Módosítást kértek", color: "var(--qa-warning)" },
  published: { label: "Megjelent", color: "var(--qa-success)" },
  failed: { label: "Nem sikerült megjelentetni", color: "var(--qa-danger)" },
};

export function socialHubBadge(states: readonly { postId: string; status: SocialHubStatus }[], postId: string) {
  const state = states.find((s) => s.postId === postId);
  return state ? SOCIAL_HUB_BADGE[state.status] : null;
}
