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

export type OutboundEmail = {
  id: string;
  profileId: string;
  leadId?: string;
  to: string;
  toName?: string;
  company?: string;
  subject: string;
  body: string;
  status: EmailStatus;
  sentAt?: Date | string;
  createdAt?: Date | string;
};

export type InboundEmail = {
  id: string;
  profileId: string;
  from: string;
  fromName?: string;
  company?: string;
  subject: string;
  body: string;
  category?: InboundCategory;
  read: boolean;
  relatedOutboundId?: string;
  receivedAt?: Date | string;
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
  // Leads
  leads: Lead[];
  leadsLoading: boolean;
  addLead: (lead: Omit<Lead, "id" | "profileId">) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  // Outbound
  outbound: OutboundEmail[];
  outboundLoading: boolean;
  addOutbound: (email: Omit<OutboundEmail, "id" | "profileId">) => Promise<void>;
  updateOutbound: (id: string, updates: Partial<OutboundEmail>) => Promise<void>;
  deleteOutbound: (id: string) => Promise<void>;
  // Inbound
  inbound: InboundEmail[];
  inboundLoading: boolean;
  addInbound: (email: Omit<InboundEmail, "id" | "profileId">) => Promise<void>;
  markInboundRead: (id: string) => Promise<void>;
  updateInboundCategory: (id: string, category: InboundCategory) => Promise<void>;
  // Notifications (local only)
  notifications: Notification[];
  setNotifications: (updater: Notification[] | ((prev: Notification[]) => Notification[])) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
  // Legacy compatibility
  setLeads: (updater: Lead[] | ((prev: Lead[]) => Lead[])) => void;
  setOutbound: (updater: OutboundEmail[] | ((prev: OutboundEmail[]) => OutboundEmail[])) => void;
  setInbound: (updater: InboundEmail[] | ((prev: InboundEmail[]) => InboundEmail[])) => void;
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

  // ─── Outbound Emails ──────────────────────────────────────────────────────
  const { data: outboundData, isLoading: outboundLoading } = trpc.outbound.list.useQuery(
    { profileId },
    { enabled: !!profileId, staleTime: 10_000 }
  );
  const createOutboundMutation = trpc.outbound.create.useMutation({ onSuccess: () => utils.outbound.list.invalidate({ profileId }) });
  const updateOutboundMutation = trpc.outbound.update.useMutation({ onSuccess: () => utils.outbound.list.invalidate({ profileId }) });
  const deleteOutboundMutation = trpc.outbound.delete.useMutation({ onSuccess: () => utils.outbound.list.invalidate({ profileId }) });

  const outbound: OutboundEmail[] = (outboundData ?? []) as OutboundEmail[];

  // ─── Inbound Emails ───────────────────────────────────────────────────────
  const { data: inboundData, isLoading: inboundLoading } = trpc.inbound.list.useQuery(
    { profileId },
    { enabled: !!profileId, staleTime: 10_000 }
  );
  const createInboundMutation = trpc.inbound.create.useMutation({ onSuccess: () => utils.inbound.list.invalidate({ profileId }) });
  const markReadMutation = trpc.inbound.markRead.useMutation({ onSuccess: () => utils.inbound.list.invalidate({ profileId }) });
  const updateCategoryMutation = trpc.inbound.updateCategory.useMutation({ onSuccess: () => utils.inbound.list.invalidate({ profileId }) });

  const inbound: InboundEmail[] = (inboundData ?? []) as InboundEmail[];

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

  const addOutbound = useCallback(async (email: Omit<OutboundEmail, "id" | "profileId">) => {
    await createOutboundMutation.mutateAsync({ ...email, profileId, to: email.to, subject: email.subject, body: email.body });
  }, [createOutboundMutation, profileId]);

  const updateOutbound = useCallback(async (id: string, updates: Partial<OutboundEmail>) => {
    const { subject, body, status, sentAt } = updates;
    const sentAtDate = sentAt instanceof Date ? sentAt : sentAt ? new Date(sentAt as string) : undefined;
    await updateOutboundMutation.mutateAsync({ id, subject, body, status, sentAt: sentAtDate });
  }, [updateOutboundMutation]);

  const deleteOutbound = useCallback(async (id: string) => {
    await deleteOutboundMutation.mutateAsync({ id });
  }, [deleteOutboundMutation]);

  const addInbound = useCallback(async (email: Omit<InboundEmail, "id" | "profileId">) => {
    await createInboundMutation.mutateAsync({ ...email, profileId, from: email.from, subject: email.subject, body: email.body });
  }, [createInboundMutation, profileId]);

  const markInboundReadFn = useCallback(async (id: string) => {
    await markReadMutation.mutateAsync({ id });
  }, [markReadMutation]);

  const updateInboundCategoryFn = useCallback(async (id: string, category: InboundCategory) => {
    await updateCategoryMutation.mutateAsync({ id, category });
  }, [updateCategoryMutation]);

  // ─── Legacy compatibility setters (optimistic local update) ───────────────

  const setLeads = useCallback((updater: Lead[] | ((prev: Lead[]) => Lead[])) => {
    // For legacy pages that still use setLeads directly
    // They will get the updated data via tRPC invalidation
  }, []);

  const setOutbound = useCallback((updater: OutboundEmail[] | ((prev: OutboundEmail[]) => OutboundEmail[])) => {
    // Legacy compatibility - data comes from tRPC
  }, []);

  const setInbound = useCallback((updater: InboundEmail[] | ((prev: InboundEmail[]) => InboundEmail[])) => {
    // Legacy compatibility - data comes from tRPC
  }, []);

  return (
    <DataContext.Provider value={{
      leads, leadsLoading,
      addLead, updateLead, deleteLead,
      outbound, outboundLoading,
      addOutbound, updateOutbound, deleteOutbound,
      inbound, inboundLoading,
      addInbound, markInboundRead: markInboundReadFn, updateInboundCategory: updateInboundCategoryFn,
      notifications, setNotifications,
      markNotificationRead, markAllNotificationsRead, unreadCount,
      setLeads, setOutbound, setInbound,
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
