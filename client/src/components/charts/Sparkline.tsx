/*
 * G2A Growth Engine — Sparkline (könnyű inline SVG)
 *
 * A design handoff KPI-kártyáin és a hero insight-kártyán használt apró,
 * tengely nélküli vonaldiagram. Szándékosan NEM recharts — egy KPI-hez
 * túl nehéz lenne; a nagyobb chartokhoz (analitika) majd recharts jön.
 *
 * A `data` egy valós számsor (pl. heti tartalom-darabszám); ha üres vagy
 * csupa azonos érték, egy vízszintes alapvonalat rajzol (őszinte "nincs
 * trend" állapot, nem koholt emelkedés).
 */
import { useId } from "react";

interface SparklineProps {
  data: number[];
  /** vonalszín — alapértelmezés a teal akcent */
  color?: string;
  /** gradiens area-kitöltés a vonal alatt */
  fill?: boolean;
  strokeWidth?: number;
  /** megjelenített magasság px-ben (a szélesség 100%) */
  height?: number;
  className?: string;
}

const VW = 120; // viewBox szélesség
const VH = 32;  // viewBox magasság

export default function Sparkline({
  data,
  color = "var(--qa-accent)",
  fill = false,
  strokeWidth = 1.8,
  height = 32,
  className,
}: SparklineProps) {
  const gradId = useId();
  const pad = 2;

  // Legalább 2 pont kell egy vonalhoz; kevés adatnál lapos alapvonal.
  const series = data.length >= 2 ? data : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;

  const stepX = (VW - pad * 2) / (series.length - 1);
  const y = (v: number) => {
    if (range === 0) return VH / 2; // nincs szórás → középvonal
    // 0..1 normalizálás, felül kevés margó
    const t = (v - min) / range;
    return pad + (1 - t) * (VH - pad * 2);
  };

  const points = series.map((v, i) => `${pad + i * stepX},${y(v)}`);
  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${pad + (series.length - 1) * stepX},${VH - pad} L ${pad},${VH - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
