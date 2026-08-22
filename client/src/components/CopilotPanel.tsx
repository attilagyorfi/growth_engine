/**
 * G2A Growth Engine – AI Copilot panel (asszisztens) — Fázis 1
 *
 * Kontextus-tudatos chat: tudja, melyik oldalon áll a user + az aktív ügyfél
 * adatait (a szerver injektálja). READ-ONLY: válaszol/magyaráz/javasol, de nem
 * hajt végre műveletet (az a Fázis 2 lesz). Asztali: 344px in-flow oszlop;
 * mobilon jobbról becsúszó, teljes szélességű overlay.
 */
import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Loader2, Trash2, Check, PenLine, CalendarClock, ThumbsUp } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProposedAction = { type: "draft_post" | "approve_post" | "schedule_post"; params: Record<string, any>; summary: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  action?: ProposedAction | null;
  actionState?: "pending" | "done" | "cancelled";
};

const ACTION_ICON = { draft_post: PenLine, approve_post: ThumbsUp, schedule_post: CalendarClock } as const;

interface CopilotPanelProps {
  open: boolean;
  onClose: () => void;
  /** Ember-olvasható oldalcím (kontextus), pl. "Irányítópult". */
  page?: string;
  /** Aktív ügyfél-profil (kontextus + ownership). */
  profileId?: string;
}

const SUGGESTED = [
  "Miről posztoljak ezen a héten?",
  "Mit jelentenek a számok az irányítópulton?",
  "Adj egy LinkedIn poszt-ötletet a cégemhez",
  "Hogyan kezdjek neki a stratégiának?",
];

export default function CopilotPanel({ open, onClose, page, profileId }: CopilotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { data: history } = trpc.assistant.getMessages.useQuery(
    { profileId },
    { enabled: open, staleTime: 10_000 }
  );
  const { data: aiUsage } = trpc.aiUsage.status.useQuery(undefined, { enabled: open, staleTime: 30_000 });

  // A szerver-előzményt CSAK egyszer töltjük be (üres állapotból) — így egy
  // háttér-refetch nem írja felül az élő beszélgetést / a függő javaslat-kártyát.
  useEffect(() => {
    if (history && history.length > 0) {
      setMessages((prev) => (prev.length === 0 ? history.map((m) => ({ role: m.role, content: m.content })) : prev));
    }
  }, [history]);

  const sendMutation = trpc.assistant.send.useMutation({
    onSuccess: (res: any) => setMessages((prev) => [...prev, {
      role: "assistant",
      content: res.reply,
      action: res.proposedAction ?? null,
      actionState: res.proposedAction ? "pending" : undefined,
    }]),
    onError: (e) => {
      // A már megjelenített user-üzenetet visszaléptetjük, hogy újra tudja próbálni.
      setMessages((prev) => (prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev));
      toast.error(e.message);
    },
  });

  const clearMutation = trpc.assistant.clear.useMutation({
    onSuccess: () => { setMessages([]); toast.success("Beszélgetés törölve"); },
    onError: (e) => toast.error(e.message),
  });

  // Egy javaslat megerősített végrehajtása (az idx a per-hívás callbackben zár be).
  const [execIdx, setExecIdx] = useState<number | null>(null);
  const executeMutation = trpc.assistant.executeAction.useMutation();

  const confirmAction = (idx: number, action: ProposedAction) => {
    setExecIdx(idx);
    executeMutation.mutate(
      { profileId, action: { type: action.type, params: action.params } },
      {
        onSuccess: (res: any) => {
          setMessages((prev) => prev
            .map((m, i) => (i === idx ? { ...m, actionState: "done" as const } : m))
            .concat([{ role: "assistant", content: `✓ ${res.message}` }]));
          setExecIdx(null);
        },
        onError: (e: any) => { toast.error(e.message); setExecIdx(null); },
      }
    );
  };
  const cancelAction = (idx: number) => {
    setMessages((prev) => prev.map((m, i) => (i === idx ? { ...m, actionState: "cancelled" as const } : m)));
  };

  const isPending = sendMutation.isPending;

  // Auto-scroll a legújabb üzenethez
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isPending]);

  const submit = (text: string) => {
    const msg = text.trim();
    if (!msg || isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    sendMutation.mutate({ message: msg, page, profileId });
  };

  const remaining = aiUsage && !aiUsage.unlimited && aiUsage.limit !== -1
    ? Math.max(0, aiUsage.limit - aiUsage.used)
    : null;

  if (!open) return null;

  return (
    <>
      {/* Mobil backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />

      <aside
        className={cn(
          "flex flex-col z-50 border-l",
          "fixed inset-y-0 right-0 w-full sm:w-[344px]",
          "lg:static lg:z-auto lg:w-[344px] lg:flex-shrink-0"
        )}
        style={{ background: "var(--qa-bg-nav)", borderColor: "var(--qa-border)" }}
        role="complementary"
        aria-label="AI asszisztens"
      >
        {/* Fejléc */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--qa-border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--qa-accent)" }}>
            <Sparkles size={15} style={{ color: "var(--qa-accent-on)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none" style={{ fontFamily: "var(--font-heading)", color: "var(--qa-fg)" }}>Asszisztens</p>
            <p className="text-xs leading-none mt-1" style={{ color: "var(--qa-fg4)" }}>
              {page ? `látja: ${page}` : "látja, min dolgozol"}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => clearMutation.mutate({ profileId })}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "var(--qa-fg4)" }}
              title="Beszélgetés törlése"
              aria-label="Beszélgetés törlése"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
            style={{ color: "var(--qa-fg3)" }}
            aria-label="Panel bezárása"
          >
            <X size={16} />
          </button>
        </div>

        {/* Üzenetek */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
          {messages.length === 0 && !isPending ? (
            <div className="pt-2">
              {/* Kontextus-kártya */}
              <div className="rounded-xl p-3 mb-4" style={{ background: "var(--qa-accent-soft)", border: "1px solid var(--qa-accent-ring)" }}>
                <p className="qa-eyebrow qa-eyebrow-accent mb-1">Ehhez az oldalhoz</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--qa-fg2)" }}>
                  Kérdezz bátran — segítek ötletekkel, magyarázatokkal és a következő lépéssel.
                  {page ? ` Épp a(z) „${page}" oldalt nézed.` : ""}
                </p>
              </div>
              <p className="qa-eyebrow mb-2">Próbáld ezt</p>
              <div className="space-y-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg transition-colors"
                    style={{ background: "var(--qa-surface)", color: "var(--qa-fg2)", border: "1px solid var(--qa-border)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <div
                      className="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap"
                      style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)", borderRadius: "14px 14px 4px 14px" }}
                    >
                      {m.content}
                    </div>
                  ) : (
                    <div
                      className="max-w-[92%] px-3 py-2 text-sm copilot-md"
                      style={{ background: "var(--qa-surface)", color: "var(--qa-fg)", border: "1px solid var(--qa-border)", borderRadius: "14px 14px 14px 4px" }}
                    >
                      <Streamdown>{m.content}</Streamdown>
                    </div>
                  )}
                </div>

                {/* Megerősítő kártya (Fázis 2) — az asszisztens javaslata */}
                {m.role === "assistant" && m.action && (() => {
                  const ActIcon = ACTION_ICON[m.action.type];
                  const st = m.actionState ?? "pending";
                  return (
                    <div className="flex justify-start">
                      <div className="max-w-[92%] rounded-xl p-3" style={{ background: "var(--qa-inset)", border: "1px solid var(--qa-accent-ring)" }}>
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "var(--qa-accent-soft)" }}>
                            <ActIcon size={13} style={{ color: "var(--qa-accent-purple)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="qa-eyebrow qa-eyebrow-accent mb-0.5">Javasolt művelet</p>
                            <p className="text-xs" style={{ color: "var(--qa-fg2)" }}>{m.action.summary}</p>
                            {m.action.type === "draft_post" && m.action.params?.content && (
                              <p className="text-xs mt-1.5 whitespace-pre-wrap" style={{ color: "var(--qa-fg4)" }}>
                                {String(m.action.params.content).slice(0, 240)}{String(m.action.params.content).length > 240 ? "…" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        {st === "pending" ? (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => confirmAction(i, m.action!)}
                              disabled={execIdx !== null}
                              className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-50"
                              style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)" }}
                            >
                              {execIdx === i ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              Megerősítés
                            </button>
                            <button
                              onClick={() => cancelAction(i)}
                              disabled={execIdx !== null}
                              className="h-8 px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              style={{ background: "var(--qa-surface)", color: "var(--qa-fg3)", border: "1px solid var(--qa-border)" }}
                            >
                              Mégse
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: st === "done" ? "var(--qa-success)" : "var(--qa-fg4)" }}>
                            {st === "done" ? <><Check size={12} /> Végrehajtva</> : "Elvetve"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))
          )}
          {isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-3 py-2 text-sm" style={{ background: "var(--qa-surface)", color: "var(--qa-fg3)", border: "1px solid var(--qa-border)", borderRadius: "14px 14px 14px 4px" }}>
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--qa-accent)" }} />
                gondolkodik…
              </div>
            </div>
          )}
        </div>

        {/* Beviteli sor */}
        <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: "var(--qa-border)" }}>
          <div className="flex items-end gap-2 rounded-xl p-2" style={{ background: "var(--qa-inset)", border: "1px solid var(--qa-border)" }}>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
              }}
              rows={1}
              placeholder="Írj egy kérdést…"
              className="flex-1 bg-transparent resize-none outline-none text-sm max-h-28"
              style={{ color: "var(--qa-fg)" }}
            />
            <button
              onClick={() => submit(input)}
              disabled={!input.trim() || isPending}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
              style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)" }}
              aria-label="Küldés"
            >
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "var(--qa-fg4)" }}>
            {remaining !== null
              ? `Minden válasz 1 AI kreditet használ · ${remaining} maradt`
              : "Minden válasz 1 AI kreditet használ"}
          </p>
        </div>
      </aside>
    </>
  );
}
