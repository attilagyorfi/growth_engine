/**
 * G2A Growth Engine — Anthropic (Claude) adapter
 *
 * Az `invokeLLM` (server/_core/llm.ts) egyetlen seam-je a teljes AI-nak. Ez az
 * adapter az OpenAI-stílusú hívás-paramétereket (messages / tools /
 * response_format json_schema / max_tokens) lefordítja az Anthropic Messages
 * API formátumára a hivatalos `@anthropic-ai/sdk`-val, majd a választ
 * visszafordítja a projekt által mindenhol használt
 * `{ choices: [{ message: { content, tool_calls } }] }` alakra. Így minden hívó
 * (generateSocialPost, ideas, intelligence, strategy, assistant, stb.) változatlan.
 *
 * Kulcs-leképezések:
 *  - system üzenet(ek)  → Anthropic top-level `system` (a messages csak user/assistant)
 *  - response_format json_schema → egy `strict: true` eszköz + `tool_choice: auto`
 *    + utasítás; a tool `input`-ja a JSON-eredmény. (A kényszerített tool_choice a
 *    legújabb modelleken 400-at ad, ezért `auto` + utasítás.)
 *  - OpenAI function tools → Anthropic tools; a `tool_use` blokkok vissza `tool_calls`-ra.
 *
 * Robusztusság (2026-10 audit):
 *  - Streaming + `finalMessage()`: hosszú kimenetnél (teljes stratégia, havi terv)
 *    nincs HTTP-időkorlát, ezért nagyobb kimeneti keret adható.
 *  - Strukturált módban csak az eszköz-input számít; az eszközhívás körüli szöveg
 *    nem kerül a JSON-ba. Ha nincs eszközhívás, a szövegben lévő JSON-t is elfogadjuk.
 *  - Ha nincs értelmezhető eredmény vagy a válasz levágódott, egyszer újrapróbáljuk;
 *    ha akkor sincs, érthető hibát dobunk (nem mentünk csendben üres adatot).
 *  - `refusal` leállás érthető hibát ad; Opus/Sonnet 5.x-en szerver-oldali tartalék
 *    modell (`fallbacks: "default"`) van bekapcsolva.
 *  - A `type: ["x","null"]` séma-típusokat `anyOf` alakra hozzuk (a strict mód
 *    dokumentált formája).
 *
 * Aktiválás: LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY. Modell: LLM_MODEL.
 */
import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import type {
  InvokeResult, Message, MessageContent, Tool, ToolChoice, ToolCall, JsonSchema,
} from "./llm";

export type NormalizedResponseFormat =
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined;

export type AnthropicInvokeArgs = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  responseFormat?: NormalizedResponseFormat;
  maxTokens: number;
  model: string;
};

/** A strukturált (json_schema) kimenethez használt szintetikus eszköz neve. */
export const STRUCT_TOOL = "provide_result";

const MAX_TOKENS_FLOOR = 8192;
/** Streaming mellett nincs HTTP-időkorlát, ezért bőven adhatunk keretet. */
export const MAX_TOKENS_CAP = 64000;

/** Modellek, ahol a szerver-oldali tartalék modell (fallbacks: "default") elérhető. */
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Kimeneti token-keret. Alsó korlát: a gondolkodási tokenek is a max_tokens-be
 * számítanak, egy túl alacsony hívói érték (pl. a Copilot 1200-a) kiéheztetné a
 * választ. Felső korlát: streaming mellett a skill-ajánlás szerinti bő keret.
 */
export function clampMaxTokens(requested: number): number {
  const n = Number.isFinite(requested) && requested > 0 ? requested : MAX_TOKENS_FLOOR;
  return Math.min(Math.max(n, MAX_TOKENS_FLOOR), MAX_TOKENS_CAP);
}

/**
 * JSON-séma normalizálás: a `type: ["string","null"]` tömb-formát `anyOf`-ra
 * alakítja (rekurzívan), mert a strict mód az `anyOf`-ot dokumentáltan támogatja.
 * Minden más kulcsszó változatlan.
 */
export function normalizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (!node || typeof node !== "object") return node;
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if ((k === "properties" || k === "$defs" || k === "definitions") && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [pk, normalizeSchema(pv)]));
    } else if (["items", "anyOf", "allOf", "oneOf", "not", "additionalProperties"].includes(k) && v && typeof v === "object") {
      out[k] = normalizeSchema(v);
    } else {
      out[k] = v;
    }
  }
  if (Array.isArray(out.type)) {
    const types = out.type as string[];
    const { type: _type, description, title, ...rest } = out;
    const annotations: Record<string, unknown> = {};
    if (description !== undefined) annotations.description = description;
    if (title !== undefined) annotations.title = title;
    if (types.length === 1) return { ...rest, type: types[0], ...annotations };
    const variants = types.map((t) => (t === "null" ? { type: "null" } : { ...rest, type: t }));
    return { anyOf: variants, ...annotations };
  }
  return out;
}

function contentToText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((p) => (typeof p === "string" ? p : p.type === "text" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
}

function mapToolChoice(tc: ToolChoice | undefined): Record<string, unknown> | undefined {
  if (!tc) return undefined;
  if (tc === "auto") return { type: "auto" };
  if (tc === "none") return { type: "none" };
  if (tc === "required") return { type: "any" };
  if (typeof tc === "object" && "name" in tc) return { type: "tool", name: tc.name };
  if (typeof tc === "object" && "function" in tc) return { type: "tool", name: tc.function.name };
  return { type: "auto" };
}

const STRUCT_INSTRUCTION =
  `FONTOS: a teljes válaszodat KIZÁRÓLAG a(z) "${STRUCT_TOOL}" eszköz EGYSZERI meghívásával add meg, `
  + "a megadott JSON-sémának pontosan megfelelve. Ne írj mellé szabad szöveget.";

const STRUCT_RETRY_INSTRUCTION =
  `Az előző próbálkozás nem adott eszközhívást. Most kizárólag a(z) "${STRUCT_TOOL}" eszköz `
  + "meghívásával válaszolj, teljes és a sémának megfelelő adatokkal, szöveg nélkül.";

/** TISZTA függvény (nincs I/O): OpenAI-stílusú args → Anthropic kérés + structured flag. */
export function buildAnthropicRequest(args: AnthropicInvokeArgs): { request: Record<string, any>; structured: boolean } {
  const systemParts: string[] = [];
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of args.messages) {
    const text = contentToText(m.content);
    if (m.role === "system") {
      if (text) systemParts.push(text);
      continue;
    }
    if (m.role === "user" || m.role === "assistant") {
      messages.push({ role: m.role, content: text });
    }
    // 'tool'/'function' szerepű üzeneteket a projekt nem küld az invokeLLM-nek — kihagyjuk.
  }
  if (messages.length === 0) messages.push({ role: "user", content: "." });
  // Anthropic: az első üzenetnek 'user'-nek kell lennie.
  if (messages[0].role !== "user") messages.unshift({ role: "user", content: "." });

  let system = systemParts.join("\n\n");

  const structured = args.responseFormat?.type === "json_schema";
  let tools: any[] | undefined;
  let toolChoice: Record<string, unknown> | undefined;

  // Szándékosan NINCS `eager_input_streaming`: a választ nem eseményenként olvassuk,
  // hanem a finalMessage()-ből, és a strict séma-ellenőrzést meg akarjuk tartani
  // (eager streaming mellett az API nem validálja az eszköz-inputot).
  if (structured) {
    const js = (args.responseFormat as { type: "json_schema"; json_schema: JsonSchema }).json_schema;
    tools = [{
      name: STRUCT_TOOL,
      description: "Add vissza a választ pontosan a megadott JSON-séma szerint.",
      strict: true,
      input_schema: normalizeSchema(js.schema),
    }];
    toolChoice = { type: "auto" };
    system = (system ? system + "\n\n" : "") + STRUCT_INSTRUCTION;
  } else if (args.tools && args.tools.length > 0) {
    tools = args.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: normalizeSchema(t.function.parameters ?? { type: "object", properties: {} }),
    }));
    toolChoice = mapToolChoice(args.toolChoice);
  }

  const request: Record<string, any> = {
    model: args.model,
    max_tokens: clampMaxTokens(args.maxTokens),
    messages,
  };
  if (system) request.system = system;
  if (tools) request.tools = tools;
  if (toolChoice) request.tool_choice = toolChoice;

  return { request, structured };
}

type AnyMessage = Anthropic.Message | Anthropic.Beta.BetaMessage;

/** JSON kinyerése szabad szövegből (```json kódblokk vagy az első {...} szakasz). */
export function extractJsonFromText(text: string): string | null {
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v = JSON.parse(c.trim());
      if (v && typeof v === "object") return JSON.stringify(v);
    } catch { /* következő jelölt */ }
  }
  return null;
}

/** A strukturált eredmény: a provide_result eszköz inputja, vagy a szövegben lévő JSON. */
export function extractStructured(resp: AnyMessage): string | null {
  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === STRUCT_TOOL) {
      return JSON.stringify(block.input ?? {});
    }
  }
  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  return text ? extractJsonFromText(text) : null;
}

/** TISZTA függvény: Anthropic válasz → OpenAI-stílusú InvokeResult. */
export function mapAnthropicResponse(resp: AnyMessage, structured: boolean): InvokeResult {
  let content = "";
  const toolCalls: ToolCall[] = [];
  if (structured) {
    // Csak az eszköz-input számít; az eszközhívás körüli szöveg nem kerül a JSON-ba.
    content = extractStructured(resp) ?? "{}";
  } else {
    for (const block of resp.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }
  }

  return {
    id: resp.id,
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: (resp.stop_reason as string | null) ?? null,
    }],
    usage: resp.usage
      ? {
          prompt_tokens: resp.usage.input_tokens,
          completion_tokens: resp.usage.output_tokens,
          total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
        }
      : undefined,
  };
}

function assertNotRefused(resp: AnyMessage): void {
  if (resp.stop_reason === "refusal") {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Az AI biztonsági okból elutasította ezt a kérést. Fogalmazd át, és próbáld újra.",
    });
  }
}

export type ModelCaller = (request: Record<string, any>) => Promise<AnyMessage>;

/**
 * Tesztelhető mag: egy hívás, ellenőrzés, strukturált módban legfeljebb egy
 * újrapróbálás. A `call` a valódi SDK-hívást (vagy tesztben egy álhívást) végzi.
 */
export async function runAnthropic(args: AnthropicInvokeArgs, call: ModelCaller): Promise<InvokeResult> {
  const { request, structured } = buildAnthropicRequest(args);
  let resp = await call(request);
  assertNotRefused(resp);
  if (!structured) return mapAnthropicResponse(resp, false);

  const truncated = resp.stop_reason === "max_tokens";
  let json = truncated ? null : extractStructured(resp);
  if (json === null) {
    // Levágott válasz: csak akkor érdemes újra, ha van még hova növelni a keretet.
    if (truncated && request.max_tokens >= MAX_TOKENS_CAP) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Az AI válasza túl hosszú lett és megszakadt. Kérlek próbáld újra, vagy szűkítsd a kérést.",
      });
    }
    const retryRequest = {
      ...request,
      max_tokens: truncated ? MAX_TOKENS_CAP : request.max_tokens,
      system: `${request.system ?? ""}\n\n${STRUCT_RETRY_INSTRUCTION}`.trim(),
    };
    resp = await call(retryRequest);
    assertNotRefused(resp);
    json = resp.stop_reason === "max_tokens" ? null : extractStructured(resp);
  }
  if (json === null) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "Az AI nem adott teljes, értelmezhető választ. Kérlek próbáld újra.",
    });
  }
  return mapAnthropicResponse(resp, true);
}

/** Az adapter belépési pontja — ENV-kulcs + streaming SDK-hívás + leképezés. */
export async function invokeAnthropic(args: AnthropicInvokeArgs): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "LLM_PROVIDER=anthropic, de az ANTHROPIC_API_KEY nincs beállítva a környezetben.",
    });
  }
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  let useFallback = FALLBACK_MODELS.test(args.model);

  const call: ModelCaller = async (request) => {
    try {
      if (useFallback) {
        try {
          return await client.beta.messages
            .stream({ ...request, betas: [FALLBACK_BETA], fallbacks: "default" } as any)
            .finalMessage();
        } catch (err) {
          // Ha az API nem fogadja el a tartalék-modell paramétert, ne álljon le az AI:
          // innentől nélküle megyünk tovább.
          if (err instanceof Anthropic.BadRequestError && /fallback|beta/i.test(err.message)) {
            console.warn("[anthropic] fallbacks paraméter elutasítva, nélküle folytatom:", err.message);
            useFallback = false;
          } else {
            throw err;
          }
        }
      }
      return await client.messages.stream(request as any).finalMessage();
    } catch (err: any) {
      const status = err?.status ?? "?";
      const msg = typeof err?.message === "string" ? err.message : String(err);
      // A globális sanitizeErrors a BAD_GATEWAY-t átengedi, így a kliens a valódi okot kapja.
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `AI szolgáltatás hiba (anthropic, HTTP ${status}): ${String(msg).slice(0, 400)}`,
      });
    }
  };

  return runAnthropic(args, call);
}
