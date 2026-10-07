/**
 * Anthropic adapter — a fordító-logika és az újrapróbálási mag tesztje.
 * Nincs valódi SDK-hívás, hálózat vagy API-kulcs: a runAnthropic egy álhívást
 * (ModelCaller) kap, így a válasz-esetek determinisztikusan tesztelhetők.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildAnthropicRequest, mapAnthropicResponse, clampMaxTokens, normalizeSchema,
  extractJsonFromText, runAnthropic, STRUCT_TOOL, MAX_TOKENS_CAP,
  type AnthropicInvokeArgs,
} from "./_core/anthropicAdapter";
import type { Message, Tool } from "./_core/llm";

const base = { id: "msg_1", model: "claude-sonnet-5-5", usage: { input_tokens: 10, output_tokens: 20 } };
const reply = (content: any[], stop_reason = "end_turn"): any => ({ ...base, stop_reason, content });

const schema = { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false };
const structuredArgs: AnthropicInvokeArgs = {
  messages: [{ role: "user", content: "x" }],
  responseFormat: { type: "json_schema", json_schema: { name: "social_post", schema, strict: true } },
  maxTokens: 2000,
  model: "claude-sonnet-5-5",
};

describe("buildAnthropicRequest", () => {
  it("a system üzenetet top-level system-be teszi, a user/assistant a messages-be", () => {
    const messages: Message[] = [
      { role: "system", content: "Te egy magyar marketinges vagy." },
      { role: "user", content: "Írj egy posztot." },
    ];
    const { request } = buildAnthropicRequest({ messages, maxTokens: 2000, model: "claude-sonnet-5-5" });
    expect(request.system).toContain("marketinges");
    expect(request.messages).toEqual([{ role: "user", content: "Írj egy posztot." }]);
  });

  it("json_schema → egy strict provide_result tool + tool_choice auto + utasítás", () => {
    const { request, structured } = buildAnthropicRequest(structuredArgs);
    expect(structured).toBe(true);
    expect(request.tools).toHaveLength(1);
    expect(request.tools[0]).toMatchObject({ name: STRUCT_TOOL, strict: true, input_schema: schema });
    expect(request.tool_choice).toEqual({ type: "auto" });
    expect(request.system).toContain(STRUCT_TOOL);
  });

  it("OpenAI function tools → Anthropic tools + tool_choice", () => {
    const tools: Tool[] = [{
      type: "function",
      function: { name: "draft_post", description: "Vázlat mentése", parameters: { type: "object", properties: { id: { type: "string" } } } },
    }];
    const { request, structured } = buildAnthropicRequest({
      messages: [{ role: "user", content: "írj posztot" }], tools, toolChoice: "auto", maxTokens: 1200, model: "claude-sonnet-5-5",
    });
    expect(structured).toBe(false);
    expect(request.tools).toEqual([{ name: "draft_post", description: "Vázlat mentése", input_schema: { type: "object", properties: { id: { type: "string" } } } }]);
    expect(request.tool_choice).toEqual({ type: "auto" });
  });

  it("max_tokens: alsó korlát 8192, felső a streaming-keret", () => {
    expect(clampMaxTokens(1200)).toBe(8192);
    expect(clampMaxTokens(20000)).toBe(20000);
    expect(clampMaxTokens(200000)).toBe(MAX_TOKENS_CAP);
    expect(clampMaxTokens(0)).toBe(8192);
  });

  it("ha az első üzenet nem user, user-t szúr elé", () => {
    const { request } = buildAnthropicRequest({
      messages: [{ role: "assistant", content: "Helló" }, { role: "user", content: "szia" }], maxTokens: 2000, model: "claude-sonnet-5-5",
    });
    expect(request.messages[0].role).toBe("user");
  });
});

describe("normalizeSchema", () => {
  it('["string","null"] → anyOf, a leírás a külső szinten marad', () => {
    expect(normalizeSchema({ type: ["string", "null"], description: "határidő" })).toEqual({
      anyOf: [{ type: "string" }, { type: "null" }], description: "határidő",
    });
  });

  it('["array","null"] az items-szel együtt kerül a tömb-ágba, beágyazva is', () => {
    const out = normalizeSchema({
      type: "object",
      properties: { q1: { type: ["array", "null"], items: { type: "string" } } },
      required: ["q1"], additionalProperties: false,
    }) as any;
    expect(out.properties.q1).toEqual({ anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] });
    expect(out.required).toEqual(["q1"]);
    expect(out.additionalProperties).toBe(false);
  });

  it("a sima sémát változatlanul hagyja", () => {
    expect(normalizeSchema(schema)).toEqual(schema);
  });
});

describe("mapAnthropicResponse", () => {
  it("text blokkokból content string lesz, usage leképezve", () => {
    const r = mapAnthropicResponse(reply([{ type: "text", text: "Szia világ" }]), false);
    expect(r.choices[0].message.content).toBe("Szia világ");
    expect(r.choices[0].message.tool_calls).toBeUndefined();
    expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
  });

  it("structured: az eszközhívás utáni szöveg NEM kerül a JSON-ba", () => {
    const r = mapAnthropicResponse(reply([
      { type: "text", text: "Íme:" },
      { type: "tool_use", id: "t1", name: STRUCT_TOOL, input: { caption: "Helló!" } },
      { type: "text", text: "Remélem, segített." },
    ]), true);
    expect(JSON.parse(r.choices[0].message.content as string)).toEqual({ caption: "Helló!" });
  });

  it("nem-structured tool_use → OpenAI-stílusú tool_calls", () => {
    const r = mapAnthropicResponse(reply([{ type: "tool_use", id: "t2", name: "draft_post", input: { id: "p1" } }], "tool_use"), false);
    const tc = r.choices[0].message.tool_calls!;
    expect(tc[0].function.name).toBe("draft_post");
    expect(JSON.parse(tc[0].function.arguments)).toEqual({ id: "p1" });
  });
});

describe("extractJsonFromText", () => {
  it("```json kódblokkból kinyeri a JSON-t", () => {
    expect(extractJsonFromText('Íme:\n```json\n{"caption":"x"}\n```')).toBe('{"caption":"x"}');
  });
  it("értelmetlen szövegnél null", () => {
    expect(extractJsonFromText("Sajnos nem tudom.")).toBeNull();
  });
});

describe("runAnthropic — újrapróbálás és hibák", () => {
  it("eszközhívás nélküli első válasz után újrapróbál, erősebb utasítással", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(reply([{ type: "text", text: "Szívesen segítek!" }]))
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "t", name: STRUCT_TOOL, input: { caption: "OK" } }], "tool_use"));
    const r = await runAnthropic(structuredArgs, call);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[1][0].system).toContain("Az előző próbálkozás");
    expect(JSON.parse(r.choices[0].message.content as string)).toEqual({ caption: "OK" });
  });

  it("ha másodszorra sincs eredmény, érthető hibát dob (nem ment üres adatot)", async () => {
    const call = vi.fn().mockResolvedValue(reply([{ type: "text", text: "Nem megy." }]));
    await expect(runAnthropic(structuredArgs, call)).rejects.toThrowError(/nem adott teljes/i);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("levágott válasznál nagyobb kerettel próbál újra", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "t", name: STRUCT_TOOL, input: { caption: "fél" } }], "max_tokens"))
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "t", name: STRUCT_TOOL, input: { caption: "teljes" } }], "tool_use"));
    const r = await runAnthropic(structuredArgs, call);
    expect(call.mock.calls[1][0].max_tokens).toBe(MAX_TOKENS_CAP);
    expect(JSON.parse(r.choices[0].message.content as string)).toEqual({ caption: "teljes" });
  });

  it("elutasításnál (refusal) érthető hibát dob", async () => {
    const call = vi.fn().mockResolvedValue(reply([], "refusal"));
    await expect(runAnthropic(structuredArgs, call)).rejects.toThrowError(/elutasította/i);
  });

  it("nem-structured hívásnál nincs újrapróbálás", async () => {
    const call = vi.fn().mockResolvedValue(reply([{ type: "text", text: "Válasz" }]));
    const r = await runAnthropic({ messages: [{ role: "user", content: "kérdés" }], maxTokens: 1000, model: "claude-sonnet-5-5" }, call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(r.choices[0].message.content).toBe("Válasz");
  });
});
