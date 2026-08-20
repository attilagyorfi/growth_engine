/**
 * G2A Growth Engine — TERMÉK-logó (a `bars` variáns)
 *
 * A design_handoff szerinti termék-jel: kitöltött teal lekerekített tile,
 * benne három emelkedő oszlop + egy halvány növekedési vonal. Ez az appon
 * BELÜL használt jel (sidebar); a G2A CÉG-logó (G2ALogo, PNG) csak a
 * login/landing felületen marad.
 *
 * Spec (32×32 viewBox):
 *   - tile rx=9, teal (#14B8A6) — a tile színe SOHA nem változik
 *   - oszlopok #04211D, x=8/14/20, w=4, rx=1.4, emelkedő magasság
 *   - növekedési vonal 45% opacitás, M9 13.5 → 15.5 9 → 21 11 → 26 6
 *   - glyph mindig #04211D (var(--qa-accent-on))
 */
interface GrowthEngineLogoProps {
  /** px méret (a viewBox négyzetes). Sidebarban 30. */
  size?: number;
  className?: string;
}

export default function GrowthEngineLogo({ size = 32, className }: GrowthEngineLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Growth Engine"
    >
      <rect width="32" height="32" rx="9" fill="var(--qa-accent)" />
      {/* Emelkedő oszlopok — bottomjuk y=24-nél igazítva */}
      <rect x="8"  y="18" width="4" height="6"  rx="1.4" fill="var(--qa-accent-on)" />
      <rect x="14" y="14" width="4" height="10" rx="1.4" fill="var(--qa-accent-on)" />
      <rect x="20" y="8"  width="4" height="16" rx="1.4" fill="var(--qa-accent-on)" />
      {/* Növekedési vonal — halvány */}
      <path
        d="M9 13.5 15.5 9 21 11 26 6"
        stroke="var(--qa-accent-on)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
        fill="none"
      />
    </svg>
  );
}
