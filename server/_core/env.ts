// JWT_SECRET fail-fast guard: production-ban a session-token aláíró kulcs
// MUSZÁJ minimum 32 karakter, különben bárki üres kulccsal érvényes
// session-tokent gyárthatna. A jwt.sign üres kulccsal hibát dob, de a
// fail-fast itt segít hogy a deploy-pillanatban derüljön ki, ne a
// első bejelentkezésnél.
const _jwtSecret = process.env.JWT_SECRET ?? "";
if (process.env.NODE_ENV === "production" && _jwtSecret.length < 32) {
  throw new Error(
    `[FATAL] JWT_SECRET túl rövid vagy hiányzik (${_jwtSecret.length} karakter). ` +
    `Production-ban legalább 32 karakteres random érték kell. Generálás: ` +
    `\`openssl rand -base64 48\` vagy \`node -p "require('crypto').randomBytes(48).toString('base64url')"\``
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: _jwtSecret,
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
  // ─── Google PageSpeed Insights API (opcionális) ────────────────────────
  // Az SEO audit a https://pagespeedonline.googleapis.com endpoint-ot hívja
  // a valódi Core Web Vitals (LCP, FID, CLS) lekéréséhez. API key nélkül is
  // megy (anonim ~25 req/nap), de éles használathoz key ajánlott:
  // https://developers.google.com/speed/docs/insights/v5/get-started
  pagespeedApiKey: (process.env.PAGESPEED_API_KEY ?? "").trim(),
};
