/**
 * 404 – Az oldal nem található
 *
 * Az audit-agent kiemelte: "NotFound.tsx bland — 404 a márka-hangulat egyik
 * teszthelye". A polírozás:
 *   - Nagy, feltűnő "404" szám a Sora font-tal
 *   - Meaning-ful magyar üzenet (nem sablon)
 *   - 3 kontextuális gyorslink kártyaként: Vezérlőpult, SEO Audit, Support
 *   - QA-token használat végig, gradient nélkül (a Register.tsx bal panelje
 *     őrzi a violet gradient-et, ide már nem kell)
 */
import { Button } from "@/components/ui/button";
import { Home, Compass, Search, Mail, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAppAuth } from "@/hooks/useAppAuth";
import { G2ALogoOnDark } from "@/components/G2ALogo";

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function QuickLink({ href, icon, label, description }: QuickLinkProps) {
  return (
    <Link href={href}>
      <a
        className="group flex items-center gap-3 p-3 rounded-xl border transition-all hover:opacity-90"
        style={{
          background: "var(--qa-surface)",
          borderColor: "var(--qa-border)",
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--qa-surface2)", color: "var(--qa-accent)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold" style={{ color: "var(--qa-fg)" }}>
            {label}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--qa-fg3)" }}>
            {description}
          </p>
        </div>
        <ArrowRight
          className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--qa-fg4)" }}
        />
      </a>
    </Link>
  );
}

export default function NotFound() {
  const [location, setLocation] = useLocation();
  const { user } = useAppAuth();
  const isAuthed = !!user;

  // Kontextuális gyorslinkek — bejelentkezett usernek app-célok, kijelentkezettnek marketing/support
  const quickLinks: QuickLinkProps[] = isAuthed
    ? [
        { href: "/iranyitopult", icon: <Home size={16} />, label: "Vezérlőpult", description: "A napi feladatok és KPI-ok" },
        { href: "/seo", icon: <Search size={16} />, label: "SEO Audit", description: "Weboldal-elemzés indítása" },
        { href: "/beallitasok", icon: <Compass size={16} />, label: "Beállítások", description: "Fiók, integrációk, brand" },
      ]
    : [
        { href: "/", icon: <Home size={16} />, label: "Főoldal", description: "Vissza a Landing oldalra" },
        { href: "/bejelentkezes", icon: <Compass size={16} />, label: "Bejelentkezés", description: "Fiókod eléréséhez" },
        { href: "/regisztracio", icon: <Search size={16} />, label: "Regisztráció", description: "Kezdd ingyen a próbát" },
      ];

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "var(--qa-bg)" }}
    >
      {/* Logo felül — vissza a főoldalra */}
      <div className="mb-10">
        <G2ALogoOnDark size="md" asLink />
      </div>

      {/* Fő tartalom */}
      <div className="w-full max-w-lg text-center">
        {/* Nagy 404 */}
        <h1
          className="font-bold mb-2 leading-none tracking-tighter"
          style={{
            color: "var(--qa-fg)",
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(96px, 20vw, 160px)",
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <div
          className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6"
          style={{
            background: "var(--qa-accent-soft)",
            color: "var(--qa-accent)",
          }}
        >
          Az oldal nem található
        </div>

        <p
          className="text-base leading-relaxed mb-3"
          style={{ color: "var(--qa-fg2)" }}
        >
          A keresett oldal nem létezik, vagy már elköltözött.
        </p>
        {location && location !== "/" && (
          <p
            className="text-xs font-mono mb-8 break-all px-2 py-1 rounded inline-block"
            style={{ color: "var(--qa-fg4)", background: "var(--qa-surface)" }}
          >
            {location}
          </p>
        )}
      </div>

      {/* Gyorslinkek */}
      <div className="w-full max-w-md space-y-2 mt-6">
        <p className="text-xs uppercase tracking-wider mb-2 px-1" style={{ color: "var(--qa-fg4)" }}>
          Gyors ugrás
        </p>
        {quickLinks.map((link) => (
          <QuickLink key={link.href} {...link} />
        ))}
      </div>

      {/* Vissza-gomb + support kontakt */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <Button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          variant="outline"
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Vissza az előző oldalra
        </Button>
        <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
          Segítségre van szükséged?{" "}
          <a
            href="mailto:info@g2amarketing.hu"
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--qa-accent)" }}
          >
            <Mail size={11} /> info@g2amarketing.hu
          </a>
        </p>
      </div>
    </div>
  );
}
