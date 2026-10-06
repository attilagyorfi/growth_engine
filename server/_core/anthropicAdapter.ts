/**
 * G2A Growth Engine — Anthropic (Claude) adapter
 *
 * Az `invokeLLM` (server/_core/llm.ts) egyetlen seam-je a teljes AI-nak. Ez az
 * adapter az OpenAI-stílusú hívás-paramétereket (messages / tools /
 * response_format json_schema / max_tokens) lefordítja az Anthropic Messages
 * API (`/v1/messages`) formátumára a HIVATALOS `@anthropic-ai/sdk`-val, majd a
 * választ VISSZAfordítja a projekt által mindenhol használt
 * `{ choices: [{ message: { content, tool_calls } }] }` alakra. Így MINDEN hívó
 * (generateSocialPost, ideas, intelligence, assistant, stb.) változatlan marad.
 *
 * Kulcs-leképezések (a viselkedés egyezik a jelenlegi OpenAI-úttal):
 *  - system üzenet(ek)  → Anthropic top-level `system` (a messages csak user/assistant)
 *  - response_format json_schema → EGY `strict: true` eszköz + `tool_choice: auto`
 *    + utasítás; a tool `input`-ja a JSON-eredmény. (A kényszerített tool_choice a
 *    legújabb modelleken — Opus/Sonnet 5.5, Fable — 400-at ad, ezért `auto` + utasítás,
 *    ami MINDEN modellen megy.)
 *  - OpenAI function tools → Anthropic tools; a `tool_use` blokkok vissza `tool_calls`-ra.
 *
 * Aktiválás: LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY. Modell: LLM_MODEL
 * (alapért. claude-opus-5-5). OpenAI marad a default, amíg ezt nem állítod be.
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

/**
 * Kimeneti token-cap a NEM-streaming híváshoz. Alsó korlát: a Claude reasoning/
 * thinking tokenjei is a max_tokens-be számítanak (az Opus/Sonnet 5.x alapból
 * gondolkodhat), egy túl alacsony hívói cap kiéheztetné a választ — ezért min.
 * 4096. Felső korlát: 16384, hogy a nem-streaming kérés HTTP-timeout alatt maradjon.
 */
export function clampMaxTokens(requested: number): number {
  const n = Number.isFinite(requested) && requested > 0 ? requested : 4096;
  return Math.min(Math.max(n, 4096), 16384);
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

  if (structured) {
    const js = (args.responseFormat as { type: "json_schema"; json_schema: JsonSchema }).json_schema;
    tools = [{
      name: STRUCT_TOOL,
      description: "Add vissza a választ pontosan a megadott JSON-séma szerint.",
      strict: true,
      input_schema: js.schema,
    }];
    toolChoice = { type: "auto" };
    system = (system ? system + "\n\n" : "")
      + `FONTOS: a teljes válaszodat KIZÁRÓLAG a(z) "${STRUCT_TOOL}" eszköz EGYSZERI meghívásával add meg, `
      + "a megadott JSON-sémának pontosan megfelelve. Ne írj mellé szabad szöveget.";
  } else if (args.tools && args.tools.length > 0) {
    tools = args.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
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

/** TISZTA függvény: Anthropic válasz → OpenAI-stílusú InvokeResult. */
export function mapAnthropicResponse(resp: Anthropic.Message, structured: boolean): InvokeResult {
  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of resp.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "tool_use") {
      if (structured && block.name === STRUCT_TOOL) {
        text = JSON.stringify(block.input ?? {});
      } else {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }
  }
  // Structured módban garantáljunk parse-olható JSON-t a hívónak (parseLLMJson).
  if (structured && !text) text = "{}";

  return {
    id: resp.id,
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: text,
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

/** Az adapter belépési pontja — ENV-kulcs + SDK-hívás + leképezés. */
export async function invokeAnthropic(args: AnthropicInvokeArgs): Promise<InvokeResult> {
  if (!ENV.anthropicApiKey) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "LLM_PROVIDER=anthropic, de az ANTHROPIC_API_KEY nincs beállítva a környezetben.",
    });
  }
  const client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  const { request, structured } = buildAnthropicRequest(args);

  let resp: Anthropic.Message;
  try {
    resp = (await client.messages.create(request as any)) as Anthropic.Message;
  } catch (err: any) {
    const status = err?.status ?? "?";
    const msg = typeof err?.message === "string" ? err.message : String(err);
    // A globális sanitizeErrors a BAD_GATEWAY-t átengedi, így a kliens a valódi okot kapja.
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `AI szolgáltatás hiba (anthropic, HTTP ${status}): ${String(msg).slice(0, 400)}`,
    });
  }
  return mapAnthropicResponse(resp, structured);
}
