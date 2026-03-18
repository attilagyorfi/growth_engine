/*
 * G2A Growth Engine – DataContext
 * Per-profile data separation: each client profile has its own leads, emails, content, notifications
 */

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from "react";
import { useProfile } from "./ProfileContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "pending_approval" | "sent" | "replied" | "rejected";
export type EmailStatus = "pending_approval" | "approved" | "sent" | "rejected";
export type InboundCategory = "interested" | "not_interested" | "request_info" | "meeting_request" | "out_of_office" | "uncategorized";
export type ContentStatus = "draft" | "pending_approval" | "approved" | "scheduled" | "published";

export type Lead = {
  id: string;
  company: string;
  contact: string;
  title: string;
  email: string;
  industry: string;
  size: string;
  status: LeadStatus;
  added: string;
};

export type OutboundEmail = {
  id: string;
  company: string;
  contact: string;
  email: string;
  subject: string;
  body: string;
  date: string;
  status: EmailStatus;
};

export type InboundEmail = {
  id: string;
  from: string;
  company: string;
  subject: string;
  body: string;
  date: string;
  category: InboundCategory;
  read: boolean;
  relatedLeadId?: string;
};

export type ContentPost = {
  id: string;
  title: string;
  platform: "linkedin" | "facebook" | "instagram";
  text: string;
  imagePrompt: string;
  imageUrl: string;
  status: ContentStatus;
  scheduledAt?: string;
  createdAt: string;
  weekRef: string;
  pillar: string;
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

// ─── Per-Profile Data Store ───────────────────────────────────────────────────

type ProfileData = {
  leads: Lead[];
  outbound: OutboundEmail[];
  inbound: InboundEmail[];
  notifications: Notification[];
};

// Seed data for G2A Marketing profile
const g2aData: ProfileData = {
  leads: [
    { id: "1", company: "TechVision Kft.", contact: "Kovács Péter", title: "CEO", email: "kovacs.peter@techvision.hu", industry: "IT Services", size: "200-500", status: "pending_approval", added: "2026-03-18" },
    { id: "2", company: "Nexus Solutions Zrt.", contact: "Nagy Andrea", title: "Marketing Director", email: "nagy.andrea@nexussolutions.hu", industry: "Manufacturing", size: "500-1000", status: "pending_approval", added: "2026-03-18" },
  ],
  outbound: [
    {
      id: "1", company: "TechVision Kft.", contact: "Kovács Péter", email: "kovacs.peter@techvision.hu",
      subject: "Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért",
      body: `Kovács Úr,\n\nA TechVision dinamikus bővülése az IT szolgáltatások terén figyelemre méltó, ugyanakkor a LinkedIn jelenlétük fejlesztésével jelentősen növelhető lenne a B2B ügyfélszerzés hatékonysága.\n\nA G2A Marketing AI-alapú tartalomoptimalizálással és célzott social media stratégiával támogatja, hogy a TechVision erőteljesebb márkaismertséget építsen és releváns vállalati döntéshozókhoz jusson el.\n\nSzívesen megosztanék néhány konkrét javaslatot egy rövid, informális beszélgetés során.\n\nÜdvözlettel,\nG2A Marketing`,
      date: "2026-03-18", status: "pending_approval",
    },
    {
      id: "2", company: "Nexus Solutions Zrt.", contact: "Nagy Andrea", email: "nagy.andrea@nexussolutions.hu",
      subject: "Friss tartalom és AI-alapú social media a Nexus Solutions számára",
      body: `Kedves Andrea,\n\nÉszrevettem, hogy a Nexus Solutions weboldalán aktív termékkommunikáció zajlik, azonban a blog és tartalommarketing terén kevés friss anyag található.\n\nA G2A Marketing AI-alapú tartalomstratégia és social media kampányok segítségével támogatni tudja a Nexus Solutions-t abban, hogy hatékonyabban érje el a célpiac döntéshozóit.\n\nSzívesen beszélnék Önnel erről – lenne rá egy rövid időpontja a héten?\n\nÜdvözlettel,\nG2A Marketing`,
      date: "2026-03-18", status: "pending_approval",
    },
  ],
  inbound: [
    {
      id: "i1", from: "Kovács Péter", company: "TechVision Kft.", subject: "Re: Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért",
      body: "Kedves G2A Marketing,\n\nKöszönöm az üzenetét! Valóban érdekel a téma. Tudna ajánlani egy konkrét időpontot a héten egy rövid egyeztetésre?\n\nÜdvözlettel,\nKovács Péter",
      date: "2026-03-18", category: "meeting_request", read: false, relatedLeadId: "1",
    },
    {
      id: "i2", from: "Nagy Andrea", company: "Nexus Solutions Zrt.", subject: "Re: Friss tartalom és AI-alapú social media",
      body: "Köszönöm a megkeresést, de jelenleg nem áll módunkban ilyen együttműködést indítani. Talán egy későbbi időpontban.\n\nÜdvözlettel,\nNagy Andrea",
      date: "2026-03-18", category: "not_interested", read: false, relatedLeadId: "2",
    },
  ],
  notifications: [
    { id: "n1", type: "email_reply", title: "Új válasz érkezett", message: "Kovács Péter (TechVision Kft.) válaszolt az outbound emailre – meeting kérés!", time: "Ma, 10:30", read: false, link: "/inbound" },
    { id: "n2", type: "email_reply", title: "Új válasz érkezett", message: "Nagy Andrea (Nexus Solutions) válaszolt – nem érdekli.", time: "Ma, 11:15", read: false, link: "/inbound" },
    { id: "n3", type: "approval_needed", title: "Jóváhagyás szükséges", message: "2 outbound email piszkozat vár jóváhagyásra.", time: "Ma, 08:15", read: true, link: "/outbound" },
  ],
};

// Seed data for TechVision profile
const techvisionData: ProfileData = {
  leads: [
    { id: "tv1", company: "Digitech Zrt.", contact: "Szabó Gábor", title: "IT Director", email: "szabo.gabor@digitech.hu", industry: "Finance", size: "100-200", status: "new", added: "2026-03-15" },
    { id: "tv2", company: "CloudBase Kft.", contact: "Fekete Éva", title: "CTO", email: "fekete.eva@cloudbase.hu", industry: "SaaS", size: "50-100", status: "new", added: "2026-03-16" },
  ],
  outbound: [
    {
      id: "tv-o1", company: "Digitech Zrt.", contact: "Szabó Gábor", email: "szabo.gabor@digitech.hu",
      subject: "Digitális transzformáció a Digitech számára – TechVision megoldások",
      body: `Kedves Szabó Úr,\n\nA Digitech Zrt. pénzügyi szektorbeli tevékenységét figyelemmel kísérve úgy látjuk, hogy egy korszerű IT infrastruktúra fejlesztés jelentős versenyelőnyt biztosíthatna.\n\nA TechVision Kft. vállalati IT megoldásai segítségével biztonságos, skálázható és hatékony rendszereket tudunk kiépíteni.\n\nSzívesen egyeztetnénk erről részletesen.\n\nÜdvözlettel,\nTechVision Kft.`,
      date: "2026-03-16", status: "pending_approval",
    },
  ],
  inbound: [],
  notifications: [
    { id: "tv-n1", type: "approval_needed", title: "Jóváhagyás szükséges", message: "1 outbound email piszkozat vár jóváhagyásra.", time: "2026-03-16, 09:00", read: false, link: "/outbound" },
  ],
};

const initialAllData: Record<string, ProfileData> = {
  g2a: g2aData,
  techvision: techvisionData,
};

// ─── Context ──────────────────────────────────────────────────────────────────

type DataContextType = {
  leads: Lead[];
  setLeads: (updater: Lead[] | ((prev: Lead[]) => Lead[])) => void;
  outbound: OutboundEmail[];
  setOutbound: (updater: OutboundEmail[] | ((prev: OutboundEmail[]) => OutboundEmail[])) => void;
  inbound: InboundEmail[];
  setInbound: (updater: InboundEmail[] | ((prev: InboundEmail[]) => InboundEmail[])) => void;
  notifications: Notification[];
  setNotifications: (updater: Notification[] | ((prev: Notification[]) => Notification[])) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfile();
  const profileId = activeProfile.id;

  // Store all profiles' data in one map
  const [allData, setAllData] = useState<Record<string, ProfileData>>(() => {
    const base: Record<string, ProfileData> = { ...initialAllData };
    return base;
  });

  // Helper to get current profile's data, with fallback empty arrays
  const currentData = useMemo((): ProfileData => {
    return allData[profileId] ?? { leads: [], outbound: [], inbound: [], notifications: [] };
  }, [allData, profileId]);

  // Generic setter factory for per-profile data
  const makeSetField = useCallback(<K extends keyof ProfileData>(field: K) => {
    return (updater: ProfileData[K] | ((prev: ProfileData[K]) => ProfileData[K])) => {
      setAllData((prev) => {
        const current = prev[profileId] ?? { leads: [], outbound: [], inbound: [], notifications: [] };
        const newVal = typeof updater === "function"
          ? (updater as (prev: ProfileData[K]) => ProfileData[K])(current[field])
          : updater;
        return { ...prev, [profileId]: { ...current, [field]: newVal } };
      });
    };
  }, [profileId]);

  const setLeads = useMemo(() => makeSetField("leads"), [makeSetField]);
  const setOutbound = useMemo(() => makeSetField("outbound"), [makeSetField]);
  const setInbound = useMemo(() => makeSetField("inbound"), [makeSetField]);
  const setNotifications = useMemo(() => makeSetField("notifications"), [makeSetField]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => (prev as Notification[]).map((n) => n.id === id ? { ...n, read: true } : n));
  }, [setNotifications]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => (prev as Notification[]).map((n) => ({ ...n, read: true })));
  }, [setNotifications]);

  const unreadCount = currentData.notifications.filter((n) => !n.read).length;

  return (
    <DataContext.Provider value={{
      leads: currentData.leads,
      setLeads: setLeads as DataContextType["setLeads"],
      outbound: currentData.outbound,
      setOutbound: setOutbound as DataContextType["setOutbound"],
      inbound: currentData.inbound,
      setInbound: setInbound as DataContextType["setInbound"],
      notifications: currentData.notifications,
      setNotifications: setNotifications as DataContextType["setNotifications"],
      markNotificationRead,
      markAllNotificationsRead,
      unreadCount,
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
