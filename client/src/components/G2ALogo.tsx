/**
 * G2A Growth Engine — hivatalos brand logó komponens
 *
 * Egyetlen forrás minden logó megjelenítéshez (sidebar, login/register/forgot
 * fejlécek, landing header/footer, privacy). Az assetek a `client/public/brand/`
 * alól érhetők el a build során abszolút URL-en (Vite a public/ tartalmát
 * gyökérre szervírozza).
 *
 * Változatok:
 *   - "mark": csak a jel (square logo) — sidebar, kompakt CTA fejléc
 *   - "lockup-h": vízszintes teljes logó (jel + szöveg) — login/landing
 *   - "lockup-s": álló (stacked) teljes logó — speciális helyek (jelenleg nincs használva)
 *
 * Variáns színek:
 *   - "blue": színes (világos/fehér háttéren)
 *   - "white": fehér (sötét/színes háttéren) — csak a marknál van
 *   - "black": fekete (egyszínű nyomtatás) — csak a marknál van
 */
import { Link } from "wouter";

type Variant = "mark" | "lockup-h" | "lockup-s";
type Color = "blue" | "white" | "black";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface G2ALogoProps {
  variant?: Variant;
  color?: Color;
  size?: Size;
  /** Ha igaz, automatikusan link a "/" útvonalra. Default: false. */
  asLink?: boolean;
  /** Egyéb className-ek a wrappere. */
  className?: string;
  /** Egyéni alt szöveg. Default: "G2A Growth Engine". */
  alt?: string;
}

// Méretek pixelben — magasság szerint, a szélesség arányos.
const HEIGHT: Record<Size, number> = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 72,
};

function srcFor(variant: Variant, color: Color): string {
  if (variant === "lockup-h") return "/brand/lockup-horizontal-color.png";
  if (variant === "lockup-s") return "/brand/lockup-stacked-color.png";
  // mark
  if (color === "white") return "/brand/mark-white.png";
  if (color === "black") return "/brand/mark-black.png";
  return "/brand/mark-blue.png";
}

export function G2ALogo({
  variant = "mark",
  color = "blue",
  size = "md",
  asLink = false,
  className = "",
  alt = "G2A Growth Engine",
}: G2ALogoProps) {
  const height = HEIGHT[size];
  // A teljes logók szélesebb képarányúak (~3.6:1 horizontális, ~1.4:1 stacked),
  // a markok négyzetesek. A width auto-számítást a böngészőre bízzuk az
  // intrinsic képarány alapján — csak a magasságot rögzítjük.
  const img = (
    <img
      src={srcFor(variant, color)}
      alt={alt}
      style={{ height, width: "auto", display: "block" }}
      className={className}
      decoding="async"
    />
  );
  if (asLink) {
    return (
      <Link href="/" className="inline-block cursor-pointer">
        {img}
      </Link>
    );
  }
  return img;
}

export default G2ALogo;
