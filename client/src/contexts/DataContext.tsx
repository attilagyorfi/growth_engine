/*
 * G2A Growth Engine – DataContext
 * Shared state for leads, outbound emails, inbound emails, content, notifications
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

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

// ─── Initial Data ─────────────────────────────────────────────────────────────

const initialLeads: Lead[] = [
  { id: "1", company: "TechVision Kft.", contact: "Kovács Péter", title: "CEO", email: "kovacs.peter@techvision.hu", industry: "IT Services", size: "200-500", status: "pending_approval", added: "2026-03-18" },
  { id: "2", company: "Nexus Solutions Zrt.", contact: "Nagy Andrea", title: "Marketing Director", email: "nagy.andrea@nexussolutions.hu", industry: "Manufacturing", size: "500-1000", status: "pending_approval", added: "2026-03-18" },
];

const initialOutbound: OutboundEmail[] = [
  {
    id: "1", company: "TechVision Kft.", contact: "Kovács Péter", email: "kovacs.peter@techvision.hu",
    subject: "Hatékonyabb LinkedIn jelenléttel a TechVision növekedéséért",
    body: `Kovács Úr,\n\nA TechVision dinamikus bővülése az IT szolgáltatások terén figyelemre méltó, ugyanakkor a LinkedIn jelenlétük fejlesztésével jelentősen növelhető lenne a B2B ügyfélszerzés hatékonysága.\n\nA G2A Marketing AI-alapú tartalomoptimalizálással és célzott social media stratégiával támogatja, hogy a TechVision erőteljesebb márkaismertséget építsen és releváns vállalati döntéshozókhoz jusson el.\n\nSzívesen megosztanék néhány konkrét javaslatot egy rövid, informális beszélgetés során.\n\nÜdvözlettel,\nG2A Marketing`,
    date: "2026-03-18", status: "pending_approval",
  },
  {
    id: "2", company: "Nexus Solutions Zrt.", contact: "Nagy Andrea", email: "nagy.andrea@nexussolutions.hu",
    subject: "Friss tartalom és AI-alapú social media a Nexus Solutions számára",
    body: `Kedves Andrea,\n\nÉszrevettem, hogy a Nexus Solutions weboldalán aktív termékkommunikáció zajlik, azonban a blog és tartalommarketing terén kevés friss anyag található. Ez a terület jelentős lehetőséget rejt a szakmai hitelesség és SEO erősítésére.\n\nA G2A Marketing AI-alapú tartalomstratégia és social media kampányok segítségével támogatni tudja a Nexus Solutions-t abban, hogy hatékonyabban érje el a célpiac döntéshozóit.\n\nSzívesen beszélnék Önnel erről – lenne rá egy rövid időpontja a héten?\n\nÜdvözlettel,\nG2A Marketing`,
    date: "2026-03-18", status: "pending_approval",
  },
];

const initialInbound: InboundEmail[] = [
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
];

const initialNotifications: Notification[] = [
  { id: "n1", type: "email_reply", title: "Új válasz érkezett", message: "Kovács Péter (TechVision Kft.) válaszolt az outbound emailre – meeting kérés!", time: "Ma, 10:30", read: false, link: "/inbound" },
  { id: "n2", type: "email_reply", title: "Új válasz érkezett", message: "Nagy Andrea (Nexus Solutions) válaszolt – nem érdekli.", time: "Ma, 11:15", read: false, link: "/inbound" },
  { id: "n3", type: "approval_needed", title: "Jóváhagyás szükséges", message: "2 outbound email piszkozat vár jóváhagyásra.", time: "Ma, 08:15", read: true, link: "/outbound" },
];

// ─── Context ──────────────────────────────────────────────────────────────────

type DataContextType = {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  outbound: OutboundEmail[];
  setOutbound: React.Dispatch<React.SetStateAction<OutboundEmail[]>>;
  inbound: InboundEmail[];
  setInbound: React.Dispatch<React.SetStateAction<InboundEmail[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadCount: number;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [outbound, setOutbound] = useState<OutboundEmail[]>(initialOutbound);
  const [inbound, setInbound] = useState<InboundEmail[]>(initialInbound);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DataContext.Provider value={{ leads, setLeads, outbound, setOutbound, inbound, setInbound, notifications, setNotifications, markNotificationRead, markAllNotificationsRead, unreadCount }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
