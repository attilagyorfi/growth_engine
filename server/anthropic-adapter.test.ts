/**
 * Anthropic adapter — a TISZTA fordító-függvények tesztje (nincs SDK-hívás, nincs
 * hálózat, nincs API-kulcs). Azt igazolja, hogy az OpenAI-stílusú hívás helyesen
 * fordul Anthropic kérésre, és az Anthropic válasz vissza a jelenlegi
 * `choices[0].message` alakra — tehát a hívók viselkedése egyezik.
 */
import { describe, it, expect } from "vitest";
import {
  buildAnthropicRequest, mapAnthropicResponse, clampMaxTokens, STRUCT_TOOL,
} from "./_core/anthropicAdapter";
import type { Message, Tool } from "./_core/llm";

describe("anthropicAdapter — buildAnthropicRequest", () => {
  it("a system üzenetet top-level system-be teszi, a user/assistant a messages-be", () => {
    const messages: Message[] = [
      { role: "system", content: "Te egy magyar marketinges vagy." },
      { role: "user", content: "Írj egy posztot." },
    ];
    const { request } = buildAnthropicRequest({ messages, maxTokens: 2000, model: "claude-opus-5-5" });
    expect(request.system).toContain("marketinges");
    expect(request.messages).toEqual([{ role: "user", content: "Írj egy posztot." }]);
    expect(request.model).toBe("claude-opus-5-5");
  });

  it("json_schema response_format → egy strict provide_result tool + tool_choice auto + utasítás", () => {
    const schema = { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false };
    const { request, structured } = buildAnthropicRequest({
      messages: [{ role: "user", content: "x" }],
      responseFormat: { type: "json_schema", json_schema: { name: "social_post", schema, strict: true } },
      maxTokens: 2000,
      model: "claude-opus-5-5",
    });
    expect(structured).toBe(true);
    expect(request.tools).toHaveLength(1);
    expect(request.tools[0].name).toBe(STRUCT_TOOL);
    expect(request.tools[0].strict).toBe(true);
    expect(request.tools[0].input_schema).toEqual(schema);
    expect(request.tool_choice).toEqual({ type: "auto" });
    expect(request.system).toContain(STRUCT_TOOL);
  });

  it("OpenAI function tools → Anthropic tools (name/description/input_schema) + tool_choice", () => {
    const tools: Tool[] = [{
      type: "function",
      function: { name: "draft_post", description: "Vázlat mentése", parameters: { type: "object", properties: { id: { type: "string" } } } },
    }];
    const { request, structured } = buildAnthropicRequest({
      messages: [{ role: "user", content: "írj posztot" }],
      tools, toolChoice: "auto", maxTokens: 1200, model: "claude-sonnet-5-5",
    });
    expect(structured).toBe(false);
    expect(request.tools).toEqual([{ name: "draft_post", description: "Vázlat mentése", input_schema: { type: "object", properties: { id: { type: "string" } } } }]);
    expect(request.tool_choice).toEqual({ type: "auto" });
  });

  it("max_tokens clamp: alsó korlát 4096, felső 16384", () => {
    expect(clampMaxTokens(1200)).toBe(4096);
    expect(clampMaxTokens(8000)).toBe(8000);
    expect(clampMaxTokens(32768)).toBe(16384);
    expect(clampMaxTokens(0)).toBe(4096);
  });

  it("ha az első üzenet nem user, user-t szúr elé (Anthropic követelmény)", () => {
    const { request } = buildAnthropicRequest({
      messages: [{ role: "assistant", content: "Helló" }, { role: "user", content: "szia" }],
      maxTokens: 2000, model: "claude-opus-5-5",
    });
    expect(request.messages[0].role).toBe("user");
  });
});

describe("anthropicAdapter — mapAnthropicResponse", () => {
  const base = { id: "msg_1", model: "claude-opus-5-5", stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 20 } };

  it("text blokkokból content string lesz", () => {
    const resp: any = { ...base, content: [{ type: "text", text: "Szia világ" }] };
    const r = mapAnthropicResponse(resp, false);
    expect(r.choices[0].message.content).toBe("Szia világ");
    expect(r.choices[0].message.tool_calls).toBeUndefined();
    expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
  });

  it("structured: a provide_result tool_use input-ja JSON-stringként a content-be kerül", () => {
    const resp: any = { ...base, content: [{ type: "tool_use", id: "t1", name: STRUCT_TOOL, input: { caption: "Helló!" } }] };
    const r = mapAnthropicResponse(resp, true);
    expect(JSON.parse(r.choices[0].message.content as string)).toEqual({ caption: "Helló!" });
    expect(r.choices[0].message.tool_calls).toBeUndefined();
  });

  it("nem-structured tool_use → OpenAI-stílusú tool_calls", () => {
    const resp: any = { ...base, stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "draft_post", input: { id: "p1" } }] };
    const r = mapAnthropicResponse(resp, false);
    const tc = r.choices[0].message.tool_calls!;
    expect(tc).toHaveLength(1);
    expect(tc[0].function.name).toBe("draft_post");
    expect(JSON.parse(tc[0].function.arguments)).toEqual({ id: "p1" });
  });
});
