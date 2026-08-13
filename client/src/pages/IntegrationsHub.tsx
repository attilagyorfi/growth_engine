/**
 * G2A Growth Engine — Integrations Hub (dedikált oldal)
 *
 * Az audit-agent talált: "Integrations hub — Settings/integrations tab helyett
 * külön oldal, kategória-szűrővel (Social, AI, Email, Analytics)."
 *
 * A Beállítások → Integrációk tab helyett egy dedikált `/integraciok` oldal.
 * Kategóriák:
 *   1. Közösségi média — LinkedIn, Facebook, Instagram, TikTok (működő OAuth)
 *   2. Analitika & Hirdetés — Google Ads, GA4, Search Console, Meta Ads
 *      (a Riportgenerátorhoz — OAuth review-függő, "Hamarosan")
 *   3. Email — a saját email-küldéshez (Gmail/Outlook)
 *
 * A social OAuth logika (start URL-ek, disconnect, config-check) áthúzva a
 * Settings-ből. A régi Settings tab egy redirect-kártyát mutat innen.
 */
import { useState, useEffect } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { useProfile } from "@/contexts/ProfileContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plug, X, Loader2, Search as SearchIcon, TrendingUp, Mail,
  BarChart3, CheckCircle2, Facebook,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

// ─── Integration definíciók ─────────────────────────────────────────────
type Category = "social" | "analytics" | "email";
const CATEGORY_LABEL: Record<Category, string> = {
  social: "Közösségi média",
  analytics: "Analitika & Hirdetés",
  email: "Email",
};

// SVG ikonok — social platformokhoz (a Settings-ből áthozva)
const ICONS: Record<string, React.ReactNode> = {
  linkedin: <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  facebook: <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" className="w-7 h-7"><defs><linearGradient id="ig-hub" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433"/><stop offset="25%" stopColor="#e6683c"/><stop offset="50%" stopColor="#dc2743"/><stop offset="75%" stopColor="#cc2366"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs><path fill="url(#ig-hub)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  tiktok: <svg viewBox="0 0 24 24" className="w-7 h-7" fill="var(--qa-fg)"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>,
  google_ads: <div style={{ color: "#4285F4" }}><SearchIcon size={26} /></div>,
  ga4: <div style={{ color: "#F9AB00" }}><TrendingUp size={26} /></div>,
  search_console: <div style={{ color: "#34A853" }}><SearchIcon size={26} /></div>,
  meta_ads: <Facebook size={26} style={{ color: "#1877F2" }} />,
  email: <Mail size={26} style={{ color: "var(--qa-accent)" }} />,
};

export default function IntegrationsHub() {
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.id ?? "";
  const [category, setCategory] = useState<Category | "all">("all");
  const [oauthErrorModal, setOauthErrorModal] = useState<{ platform: string; reason: string } | null>(null);

  const { data: socialConnections = [], refetch: refetchSocial } = trpc.social.listConnections.useQuery(
    { profileId }, { enabled: !!profileId }
  );
  const { data: platformConfig } = trpc.social.isPlatformConfigured.useQuery();
  const disconnectSocial = trpc.social.disconnect.useMutation({
    onSuccess: () => { refetchSocial(); toast.success("Kapcsolat megszakítva"); },
  });

  // OAuth callback eredmény kezelése a URL paraméterekből. A server OAuth
  // flow-k ide (/integraciok) redirect-elnek a csatlakozás után:
  // ?linkedin=connected / ?facebook=connected&pages=N&instagram=M / ?tiktok=connected
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let cleaned = false;
    const handleStatus = (platform: string, label: string, extra?: () => string) => {
      const status = params.get(platform);
      if (status === "connected") {
        const username = params.get("username") ?? "";
        const extraMsg = extra ? extra() : "";
        toast.success(`${label} csatlakoztatva${username ? `: ${username}` : ""}${extraMsg}!`);
        refetchSocial();
        cleaned = true;
      } else if (status === "error") {
        const reason = params.get("reason") ?? "unknown";
        toast.error(`${label} csatlakoztatás sikertelen: ${reason}`);
        cleaned = true;
      }
    };
    handleStatus("linkedin", "LinkedIn");
    handleStatus("facebook", "Facebook + Instagram", () => {
      const pages = params.get("pages");
      const igs = params.get("instagram");
      if (pages || igs) return ` (${pages ?? 0} Page, ${igs ?? 0} IG)`;
      return "";
    });
    handleStatus("tiktok", "TikTok");
    if (cleaned) window.history.replaceState({}, "", window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Social platform kártyák definíciója ────────────────────────────────
  const socialCards = [
    {
      key: "linkedin", label: "LinkedIn",
      configured: !!platformConfig?.linkedin,
      startUrl: `/api/oauth/linkedin/start?profileId=${profileId}`,
      notConfiguredReason: "A LinkedIn OAuth credentialjei nincsenek beállítva. Az adminisztrátornak a LINKEDIN_CLIENT_ID és LINKEDIN_CLIENT_SECRET env változókat kell beállítania.",
    },
    {
      key: "facebook", label: "Facebook",
      configured: !!platformConfig?.facebook,
      startUrl: `/api/oauth/facebook/start?profileId=${profileId}`,
      notConfiguredReason: "A Meta App credentialjei nincsenek beállítva. Az adminisztrátornak a FACEBOOK_APP_ID és FACEBOOK_APP_SECRET env változókat kell beállítania Railway-en.",
    },
    {
      key: "instagram", label: "Instagram",
      configured: !!platformConfig?.facebook, // IG a FB-en keresztül
      startUrl: `/api/oauth/facebook/start?profileId=${profileId}`,
      notConfiguredReason: "Az Instagram a Facebook-on keresztül csatlakozik. Először a Meta App credentialjeit kell konfigurálni (FACEBOOK_APP_ID + FACEBOOK_APP_SECRET).",
      subLabel: "A Facebookkal együtt",
    },
    {
      key: "tiktok", label: "TikTok",
      configured: !!platformConfig?.tiktok,
      startUrl: `/api/oauth/tiktok/start?profileId=${profileId}`,
      notConfiguredReason: "A TikTok App credentialjei nincsenek beállítva. Az adminisztrátornak a TIKTOK_CLIENT_KEY és TIKTOK_CLIENT_SECRET env változókat kell beállítania Railway-en.",
    },
  ];

  // ── Analytics/Ads kártyák — a Riportgenerátorhoz (OAuth review-függő) ──
  const analyticsCards = [
    { key: "google_ads", label: "Google Ads" },
    { key: "ga4", label: "Google Analytics 4" },
    { key: "search_console", label: "Search Console" },
    { key: "meta_ads", label: "Meta Ads Insights" },
  ];

  const connectedCount = socialConnections.filter((c) => c.isActive).length;

  const showSocial = category === "all" || category === "social";
  const showAnalytics = category === "all" || category === "analytics";
  const showEmail = category === "all" || category === "email";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.6 0.2 255 / 15%)" }}>
            <Plug size={20} style={{ color: "var(--qa-accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}>Integrációk</h1>
            <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
              Csatlakoztasd a fiókjaidat — {connectedCount > 0 ? `${connectedCount} aktív kapcsolat` : "még nincs aktív kapcsolat"}
            </p>
          </div>
        </div>

        {/* Kategória-szűrő chip-ek */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipButton active={category === "all"} onClick={() => setCategory("all")}>Összes</ChipButton>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <ChipButton key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABEL[c]}
            </ChipButton>
          ))}
        </div>

        {/* Közösségi média */}
        {showSocial && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--qa-fg4)" }}>
              {CATEGORY_LABEL.social}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {socialCards.map((card) => {
                const conn = socialConnections.find((c) => c.isActive && c.platform === card.key);
                const handleClick = () => {
                  if (conn) return;
                  if (!card.configured) {
                    setOauthErrorModal({ platform: card.label, reason: card.notConfiguredReason });
                    return;
                  }
                  window.location.href = card.startUrl;
                };
                return (
                  <div
                    key={card.key}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all hover:opacity-90"
                    style={{
                      background: conn ? "oklch(0.6 0.2 255 / 8%)" : "var(--qa-surface2)",
                      borderColor: conn ? "oklch(0.6 0.2 255 / 40%)" : "var(--qa-border)",
                    }}
                    onClick={handleClick}
                  >
                    {ICONS[card.key]}
                    <span className="text-xs font-semibold" style={{ color: conn ? "var(--qa-accent)" : "var(--qa-fg3)" }}>
                      {card.label}
                    </span>
                    {conn ? (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: "oklch(0.72 0.19 145 / 15%)", color: "var(--qa-success)" }}>
                        <CheckCircle2 size={10} /> Csatlakozva
                      </span>
                    ) : (
                      <span className="text-xs text-center" style={{ color: "var(--qa-fg4)" }}>
                        {card.configured ? (card.subLabel ?? "Csatlakoztatás") : "Nincs konfigurálva"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Csatlakoztatott fiókok lista */}
            {connectedCount > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-semibold" style={{ color: "var(--qa-fg3)" }}>Csatlakoztatott fiókok</p>
                {socialConnections.filter((c) => c.isActive).map((conn) => (
                  <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ background: cardBg, borderColor: border }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--qa-surface2)" }}>
                        {ICONS[conn.platform] ?? <Plug size={16} style={{ color: "var(--qa-accent)" }} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--qa-fg2)" }}>{conn.platformUsername ?? conn.platform}</p>
                        <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                          {conn.platform} • <span style={{ color: "var(--qa-success)" }}>Csatlakozva</span>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => disconnectSocial.mutate({ connectionId: conn.id })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "oklch(0.65 0.22 25 / 15%)", color: "var(--qa-danger)" }}>
                      Lecsatlakoztatás
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Analitika & Hirdetés */}
        {showAnalytics && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--qa-fg4)" }}>
              {CATEGORY_LABEL.analytics}
            </h2>
            <div className="rounded-xl border p-4 mb-3" style={{ background: "oklch(0.76 0.17 68 / 8%)", borderColor: "oklch(0.76 0.17 68 / 20%)" }}>
              <div className="flex items-start gap-2.5">
                <BarChart3 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--qa-warning)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.85 0.1 68)" }}>
                  Az Ads/Analytics integrációk a <Link href="/riportok" className="underline">Riportgenerátorhoz</Link> tartoznak.
                  Éles használatuk a Google Cloud OAuth verification és Meta Ads Insights App Review lezárása után lesz elérhető (2-6 hét platformonként).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {analyticsCards.map((card) => (
                <div
                  key={card.key}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border opacity-70"
                  style={{ background: "var(--qa-surface2)", borderColor: "var(--qa-border)" }}
                >
                  {ICONS[card.key]}
                  <span className="text-xs font-semibold text-center" style={{ color: "var(--qa-fg3)" }}>{card.label}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: "oklch(0.75 0.18 75 / 18%)", color: "oklch(0.85 0.16 75)" }}>
                    Hamarosan
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Email */}
        {showEmail && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--qa-fg4)" }}>
              {CATEGORY_LABEL.email}
            </h2>
            <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--qa-surface2)" }}>
                  {ICONS.email}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--qa-fg2)" }}>Tranzakciós email</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--qa-fg4)" }}>
                    A platform a <strong style={{ color: "var(--qa-fg3)" }}>Resend</strong> szolgáltatáson keresztül küld emaileket
                    (jelszó-visszaállítás, jóváhagyás-értesítők, hírlevél). Ez központilag konfigurált — nincs teendőd.
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0"
                  style={{ background: "oklch(0.72 0.19 145 / 15%)", color: "var(--qa-success)" }}>
                  <CheckCircle2 size={11} /> Aktív
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Ha egyetlen szekció sincs (elvi eset) */}
        {!showSocial && !showAnalytics && !showEmail && (
          <EmptyState icon={<Plug size={22} />} title="Nincs ilyen kategória" description="Válaszd az 'Összes' opciót." />
        )}
      </div>

      {/* Not-configured modal */}
      {oauthErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOauthErrorModal(null)}>
          <div className="rounded-xl border p-6 max-w-md w-full" style={{ background: cardBg, borderColor: border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: "var(--qa-fg)" }}>{oauthErrorModal.platform} — még nem konfigurálva</h3>
              <button onClick={() => setOauthErrorModal(null)} style={{ color: "var(--qa-fg4)" }}><X size={18} /></button>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--qa-fg3)" }}>{oauthErrorModal.reason}</p>
            <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
              A részletes setup-leírás a <code style={{ background: "var(--qa-surface2)", padding: "2px 6px", borderRadius: "4px" }}>docs/social-oauth-setup.md</code> fájlban található.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setOauthErrorModal(null)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--qa-accent)", color: "white" }}>Értem</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: active ? "oklch(0.6 0.2 255 / 20%)" : "var(--qa-surface2)",
        color: active ? "var(--qa-accent)" : "var(--qa-fg3)",
      }}
    >
      {children}
    </button>
  );
}
