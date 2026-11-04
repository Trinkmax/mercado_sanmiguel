import { cn } from "@/lib/utils";

/**
 * El abanico de azulejos del logo. Aparece en color cuando la cuenta está al día: es el premio.
 * Los azulejos se colocan de a uno (css: .abanico-azulejo).
 */

const COLORES = ["#e7302a", "#2b3990", "#3bb4f2", "#f4a11d", "#ffd93b", "#8a1f6b", "#17a673", "#3bb4f2", "#e7302a"];

function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${p(r0, a0)}L${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
}

/** Tres anillos de azulejos, como el abanico derecho del logo. */
const AZULEJOS: string[] = [
  sector(8, 92, 72, 104, -74, -48),
  sector(8, 92, 72, 104, -46, -20),
  sector(8, 92, 72, 104, -18, 8),
  sector(8, 92, 42, 70, -74, -48),
  sector(8, 92, 42, 70, -46, -20),
  sector(8, 92, 42, 70, -18, 8),
  sector(8, 92, 16, 40, -74, -48),
  sector(8, 92, 16, 40, -46, -20),
  sector(8, 92, 16, 40, -18, 8),
];

export function AbanicoAlDia({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" aria-hidden focusable="false" className={cn("abanico", className)}>
      {AZULEJOS.map((d, i) => (
        <path
          key={d}
          d={d}
          fill={COLORES[i]}
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinejoin="round"
          className="abanico-azulejo"
          style={{ animationDelay: `${220 + (8 - i) * 55}ms` }}
        />
      ))}
    </svg>
  );
}
