/**
 * G2A Growth Engine – LLM provider router tests
 *
 * Tests for the resolveProvider behavior — env-driven provider választás
 * az OpenAI és az Anthropic között (a régi Manus Forge proxy megszűnt). A
 * tényleges HTTP hívást nem mockoljuk; ezek a tesztek csak a provider
 * routing logikát fedik le.
 *
 * Mivel a provider az ENV objektumból olvas (ami modul-szinten init-elődik),
 * minden teszt előtt töröljük a modul-cache-t (vi.resetModules), így az import
 * az aktuális process.env értékekkel fut.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("LLM provider routing – alapértelmezés", () => {
  it("LLM_PROVIDER nélkül OPENAI_API_KEY-vel openai", async () => {
    delete process.env.LLM_PROVIDER;
    process.env.OPENAI_API_KEY = "test-openai-key";
    const { ENV } = await import("./_core/env");
    expect(ENV.llmProvider).toBe("openai");
  });

  it("LLM_PROVIDER nélkül, csak ANTHROPIC_API_KEY-vel anthropic", async () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    const { ENV } = await import("./_core/env");
    expect(ENV.llmProvider).toBe("anthropic");
  });
});

describe("LLM provider type definitions", () => {
  it("exports invokeLLM", async () => {
    const llm = await import("./_core/llm");
    expect(typeof llm.invokeLLM).toBe("function");
  });
});

describe("LLM provider error messages", () => {
  it("throws a clear error when LLM_PROVIDER=openai but no OPENAI_API_KEY", async () => {
    process.env.LLM_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    // Az env-hiba hamarabb dob, mint a fetch hívás.
    const { invokeLLM } = await import("./_core/llm");
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("a megszűnt manus (vagy bármi ismeretlen) provider érthető hibát ad", async () => {
    process.env.LLM_PROVIDER = "manus";
    const { invokeLLM } = await import("./_core/llm");
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow(/Ismeretlen LLM_PROVIDER/);
  });

  it("throws for Anthropic provider with an invalid key", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "fake-key";
    // Hálózat nélkül: az API 401-es válaszát helyben adjuk vissza (a 401-et az
    // SDK nem próbálja újra, így a teszt gyors és nem függ a hálózattól).
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
      { status: 401, headers: { "content-type": "application/json" } },
    )));

    const { invokeLLM } = await import("./_core/llm");
    // A primary assertion: hibát dob
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow();
  });
});

describe("LLM ENV defaults", () => {
  it("ENV.llmProvider is always lowercase", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.llmProvider).toBe(ENV.llmProvider.toLowerCase());
  });

  it("ENV.openaiApiUrl has a sensible default", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.openaiApiUrl).toMatch(/^https?:\/\//);
  });

  it("ENV.llmProvider is one of the two known values", async () => {
    const { ENV } = await import("./_core/env");
    expect(["openai", "anthropic"]).toContain(ENV.llmProvider);
  });
});
