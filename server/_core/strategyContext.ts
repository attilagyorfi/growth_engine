/**
 * Az aktív stratégia tömör, AI-nak szóló összefoglalója (Copilot, napi teendők).
 *
 * Élő teszt (2026-10-13): a Copilot azt válaszolta, hogy „az aktív stratégiád
 * csatornáit nem látom” — a system prompt csak a cégadatokat kapta meg, a
 * stratégiát nem. A napi teendők pedig csak a stratégia CÍMÉT ismerték.
 */

type ChannelLike = { channel?: string; priority?: number; rationale?: string };
type MonthLike = { month?: string; priorities?: string[] };
type ActionLike = { title?: string; dueDate?: string | null; urgency?: string };

export type StrategyLike = {
  title?: string | null;
  executiveSummary?: string | null;
  channelStrategy?: unknown;
  monthlyPriorities?: unknown;
  nextActions?: unknown;
};

function clip(text: string | null | undefined, max: number): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Csatornák fontossági sorrendben (5 = legfontosabb, ahogy a Stratégia oldal is mutatja). */
export function rankedChannels(strategy: StrategyLike): ChannelLike[] {
  return asArray<ChannelLike>(strategy.channelStrategy)
    .filter((c) => c?.channel)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.priority ?? 0) - (a.c.priority ?? 0) || a.i - b.i)
    .map(({ c }) => c);
}

function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Részletes blokk a Copilot system promptjába. */
export function formatStrategyForAssistant(strategy: StrategyLike | null | undefined, now = new Date()): string {
  if (!strategy) return "";
  const lines: string[] = [`Aktív marketingstratégia: „${clip(strategy.title, 120)}"`];
  if (strategy.executiveSummary) lines.push(`Összefoglaló: ${clip(strategy.executiveSummary, 700)}`);

  const channels = rankedChannels(strategy).slice(0, 6);
  if (channels.length) {
    lines.push("Csatornák fontossági sorrendben (prioritás 1–5, 5 = legfontosabb):");
    channels.forEach((c, i) => lines.push(`${i + 1}. ${c.channel} (${c.priority ?? "?"}/5)${c.rationale ? ` — ${clip(c.rationale, 160)}` : ""}`));
  }

  const month = asArray<MonthLike>(strategy.monthlyPriorities).find((m) => m?.month === monthKey(now));
  if (month?.priorities?.length) {
    lines.push(`E havi (${month.month}) prioritások: ${month.priorities.slice(0, 5).map((p) => clip(p, 120)).join("; ")}`);
  }

  const next = asArray<ActionLike>(strategy.nextActions).filter((a) => a?.title).slice(0, 5);
  if (next.length) {
    lines.push(`Következő lépések: ${next.map((a) => `${clip(a.title, 100)}${a.dueDate ? ` (határidő: ${a.dueDate})` : ""}`).join("; ")}`);
  }
  return lines.join("\n");
}

/** Rövid, egysoros változat a napi teendők generálásához. */
export function formatStrategyForDailyTasks(strategy: StrategyLike | null | undefined, now = new Date()): string {
  if (!strategy) return "Nincs aktív stratégia.";
  const title = clip(strategy.title, 120);
  const parts = [`Aktív stratégia: ${title}${/[.!?…]$/.test(title) ? "" : "."}`];
  const top = rankedChannels(strategy).slice(0, 3).map((c) => c.channel);
  if (top.length) parts.push(`Fő csatornák: ${top.join(", ")}.`);
  const month = asArray<MonthLike>(strategy.monthlyPriorities).find((m) => m?.month === monthKey(now));
  if (month?.priorities?.length) parts.push(`E havi prioritások: ${month.priorities.slice(0, 5).map((p) => clip(p, 100)).join("; ")}.`);
  return parts.join(" ");
}
