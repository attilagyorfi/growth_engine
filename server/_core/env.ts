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
  // ─── Bejövő email (IMAP) ───────────────────────────────────────────────
  // Az info@g2amarketing.hu Gmail fiókhoz IMAP-pal kapcsolódunk, az új
  // (UNSEEN) leveleket lefetcheljük, AI-vel kategorizáljuk, és az
  // `inbound_emails` táblába mentjük. Gmail-hez APP-PASSWORD kell (NEM a
  // sima Gmail jelszó!), a 2FA-val védett fiókokon:
  // https://myaccount.google.com/apppasswords
  inboundImapHost: process.env.INBOUND_IMAP_HOST ?? "imap.gmail.com",
  inboundImapPort: parseInt(process.env.INBOUND_IMAP_PORT ?? "993", 10),
  inboundImapUser: process.env.INBOUND_IMAP_USER ?? "",
  inboundImapPassword: process.env.INBOUND_IMAP_PASSWORD ?? "",
  // Melyik clientProfile-hoz csatoljuk a bejövő leveleket. Ha üres, a
  // super_admin első profilját használjuk (lásd inboundFetcher.ts fallback).
  inboundProfileId: process.env.INBOUND_PROFILE_ID ?? "",
};
