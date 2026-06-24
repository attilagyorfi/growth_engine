/**
 * G2A Growth Engine – DataContext (tRPC-backed)
 * All data (leads, emails, content) is persisted in the database via tRPC.
 * Seed data is inserted on first load if the profile has no data.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useProfile } from "./ProfileContext";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "researched" | "email_draft" | "approved" | "sent" | "replied" | "meeting" | "closed_won" | "closed_lost";
export type EmailStatus = "draft" | "approved" | "sent" | "opened" | "replied" | "bounced";
export type InboundCategory = "interested" | "not_interested" | "question" | "meeting_request" | "out_of_office" | "unsubscribe" | "other";
export type ContentStatus = "draft" | "approved" | "scheduled" | "published" | "rejected";

export type Lead = {
  id: string;
  profileId: string;
  company: string;
  contact: string;
  email: string;
  phone?: string;
  position?: string;
  industry?: string;
  website?: string;
  source?: string;
  status: LeadStatus;
  score?: number;
  notes?: string;
  createdAt?: Date | string;
};

export type ContentPost = {
  id: string;
  profileId: string;
  title: string;
  platform: "linkedin" | "facebook" | "instagram" | "twitter" | "tiktok";
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  hashtags?: string[];
  status: ContentStatus;
  scheduledAt?: Date | string;
  publishedAt?: Date | string;
  pillar?: string;
  weekNumber?: number;
  createdAt?: Date | string;
};

export type Notification = {
  id: string;
  type: "email_reply" | "approval_needed" | "scheduled" | "info";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────

type DataContextType = {
  // Leads — a hírlevél-feliratkozók is itt tárolódnak (newsletterConsent
  // bejelölésekor). Az értékesítés-modul törlésével az outbound + inbound
  // email mezők kivéve, de a leads tábla megmaradt.
  leads: Lead[];
  leadsLoading: boolean;
  addLead: (lead: Omit<Lead, "id" | "profileId">) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  // Notifications (local only)
  notifications: Notification[];
  setNotifications: (updater: Notification[] | ((prev: Notification[]) => Notification[])) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
  // Legacy compatibility
  setLeads: (updater: Lead[] | ((prev: Lead[]) => Lead[])) => void;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfile();
  const profileId = activeProfile.id;
  const utils = trpc.useUtils();

  // ─── Notifications (local only, no DB) ────────────────────────────────────────────────────────
  const [notifications, setNotificationsState] = useState<Notification[]>([]);

  const setNotifications = useCallback((updater: Notification[] | ((prev: Notification[]) => Notification[])) => {
    setNotificationsState(prev => typeof updater === "function" ? updater(prev) : updater);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotificationsState(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotificationsState(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ─── Leads ────────────────────────────────────────────────────────────────
  const { data: leadsData, isLoading: leadsLoading } = trpc.leads.list.useQuery(
    { profileId },
    { enabled: !!profileId, staleTime: 10_000 }
  );
  const createLeadMutation = trpc.leads.create.useMutation({ onSuccess: () => utils.leads.list.invalidate({ profileId }) });
  const updateLeadMutation = trpc.leads.update.useMutation({ onSuccess: () => utils.leads.list.invalidate({ profileId }) });
  const deleteLeadMutation = trpc.leads.delete.useMutation({ onSuccess: () => utils.leads.list.invalidate({ profileId }) });

  const leads: Lead[] = (leadsData ?? []) as Lead[];

  // ─── CRUD helpers ─────────────────────────────────────────────────────────

  const addLead = useCallback(async (lead: Omit<Lead, "id" | "profileId">) => {
    await createLeadMutation.mutateAsync({ ...lead, profileId, company: lead.company, contact: lead.contact, email: lead.email });
  }, [createLeadMutation, profileId]);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    await updateLeadMutation.mutateAsync({ id, ...updates });
  }, [updateLeadMutation]);

  const deleteLead = useCallback(async (id: string) => {
    await deleteLeadMutation.mutateAsync({ id });
  }, [deleteLeadMutation]);

  // Legacy no-op setter — néhány régi page még hívja közvetlenül.
  const setLeads = useCallback((_updater: Lead[] | ((prev: Lead[]) => Lead[])) => {
    /* tRPC invalidate gondoskodik a frissítésről */
  }, []);

  return (
    <DataContext.Provider value={{
      leads, leadsLoading,
      addLead, updateLead, deleteLead,
      notifications, setNotifications,
      markNotificationRead, markAllNotificationsRead, unreadCount,
      setLeads,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
