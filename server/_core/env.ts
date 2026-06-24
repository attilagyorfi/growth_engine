export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // ─── LLM providers ─────────────────────────────────────────────────────
  // LLM_PROVIDER lehet: "openai", "manus" (régi Forge proxy), "anthropic" (TODO).
  // Alapértelmezés: ha LLM_PROVIDER nincs megadva, de van OPENAI_API_KEY, akkor
  // automatikusan "openai" (a Manusról lemigráltunk). Csak ha OPENAI_API_KEY sincs,
  // akkor esik vissza a régi "manus" (Forge) providerre — visszafelé kompatibilitásból.
  llmProvider: (
    process.env.LLM_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "manus")
  ).toLowerCase() as "manus" | "openai" | "anthropic",
  llmModel: process.env.LLM_MODEL ?? "",
  // Manus Forge (default) — auto-injected env-ek
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // OpenAI (vagy bármilyen OpenAI-kompatibilis endpoint, pl. Together / Groq / Anyscale)
  openaiApiUrl: process.env.OPENAI_API_URL ?? "https://api.openai.com",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Anthropic (még nincs implementálva)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // ─── Egyéb ─────────────────────────────────────────────────────────────
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  // INBOUND_IMAP_* + INBOUND_PROFILE_ID env-ek eltávolítva — az
  // értékesítés-modul (Gmail IMAP fetcher) törlésekor (2026-06).
};
