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
  cookieSecret: _jwtSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // ─── LLM providers ─────────────────────────────────────────────────────
  // LLM_PROVIDER lehet: "anthropic" (Claude) vagy "openai".
  // Ha nincs megadva: OPENAI_API_KEY-vel "openai", csak ANTHROPIC_API_KEY-vel
  // "anthropic". Ismeretlen értékre (pl. a megszűnt "manus") az első AI-hívás
  // érthető hibát ad, és az induló log is jelzi.
  llmProvider: (
    process.env.LLM_PROVIDER ??
    (process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai")
  ).toLowerCase() as "openai" | "anthropic",
  llmModel: process.env.LLM_MODEL ?? "",
  // OpenAI (vagy bármilyen OpenAI-kompatibilis endpoint, pl. Together / Groq / Anyscale)
  openaiApiUrl: process.env.OPENAI_API_URL ?? "https://api.openai.com",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Anthropic (Claude) — LLM_PROVIDER=anthropic esetén aktív, az anthropicAdapter.ts
  // használja. A modellt a LLM_MODEL adja (alapért. claude-opus-5-5).
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
  // ─── Közösségi média OAuth (Meta + TikTok) ─────────────────────────────
  // A Meta egy App-pal lefedi a Facebook Page-eket ÉS az Instagram Business
  // accountokat (IG csak FB Page-en keresztül érhető el). A TikTok külön
  // Developer App-ot igényel. Mindkettő hosszú App Review folyamatot kér a
  // publishing scope-okhoz — production-ban valós ügyfél csak review után
  // tudja csatlakoztatni a sajat fiókját. Lásd: docs/social-oauth-setup.md
  facebookAppId: (process.env.FACEBOOK_APP_ID ?? "").trim(),
  facebookAppSecret: (process.env.FACEBOOK_APP_SECRET ?? "").trim(),
  // Opcionális: Facebook Login for Business konfiguráció azonosítója (config_id).
  facebookLoginConfigId: (process.env.FACEBOOK_LOGIN_CONFIG_ID ?? "").trim(),
  tiktokClientKey: (process.env.TIKTOK_CLIENT_KEY ?? "").trim(),
  tiktokClientSecret: (process.env.TIKTOK_CLIENT_SECRET ?? "").trim(),
  // APP_URL — production base URL minden OAuth callback redirectjéhez.
  // A LinkedIn OAuth biztonsági javításával lett bevezetve (audit #2 fix).
  appUrl: (process.env.APP_URL ?? "").trim().replace(/\/+$/, ""),

  // ─── Demo / teszt fiók (belső QA) ───────────────────────────────────────
  // Ha "true", a szerver induláskor létrehoz egy NEM-admin demo fiókot
  // (admin@growthengine.hu / admin), ami MINDEN belépéskor üresre resetel →
  // friss onboarding-élmény. Alapból KIKAPCSOLVA: a demo fiók csak akkor
  // létezik, ha ezt a Railway-en explicit bekapcsolod. Így NEM marad örökös
  // gyenge-jelszavú hátsó ajtó a production configban. A fiók sima "user"
  // jogkörű és reset-on-login, ezért a blast radius egy homokozó.
  enableDemoAccount: process.env.ENABLE_DEMO_ACCOUNT === "true",
};

/** A production Railway-domain — ha az APP_URL nincs beállítva, ez a biztonságos alapérték. */
export const DEFAULT_PRODUCTION_ORIGIN = "https://growthengine-production.up.railway.app";

/**
 * Az app nyilvános címe az OAuth callback- és visszairányító URL-ekhez.
 * Eddig APP_URL nélkül production-ben is `http://localhost:5173`-ra irányított
 * (LinkedIn/Facebook/TikTok redirect_uri) → a csatlakozás csendben elhasalt.
 * Kérésből (Origin/Host) SOHA nem vesszük — az open-redirect vektor lenne.
 */
export function getPublicAppOrigin(): string {
  return ENV.appUrl || (ENV.isProduction ? DEFAULT_PRODUCTION_ORIGIN : "http://localhost:5173");
}
