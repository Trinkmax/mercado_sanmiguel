"use client";

import { cn } from "@/lib/utils";
import { formatFraccion, formatNumero } from "@/lib/format";
import { MAT, RAYAS_DEBE } from "./plano-svg";

export type Filtro = "al_dia" | "debe" | "vencido" | "libre";

/** Colores de la barra de ocupación. */
const BARRA: Record<Exclude<Filtro, "libre">, string> = {
  al_dia: "var(--pagado)",
  debe: "var(--pendiente)",
  vencido: "oklch(0.4 0.15 27)",
};

/** Rayas del frente de la muestra de "debe", inclinadas como en el plano. */
const RAYAS_MUESTRA = [1.5, 4.5, 7.5, 10.5, 13.5].map((x) => `M${x} 11h1.5l1 4h-1.5z`).join("");

/** Cada estado como se ve en el plano (se distinguen por forma, no solo por
 * color): faldón liso verde, faldón a rayas rojo, bloque rojo lleno y lote
 * punteado blanco. Un bloque en relieve chiquito: tapa, frente y costado. */
function MuestraEstado({ estado }: { estado: Filtro }) {
  const m = MAT[estado];
  const libre = estado === "libre";
  return (
    <svg aria-hidden viewBox="0 0 18 16" className="h-4 w-[18px] shrink-0">
      <path d="M15 1L16 5V15L15 11Z" fill={m.lado} />
      <path d="M1 11H15L16 15H2Z" fill={libre ? m.frente : m.faldon[1]} />
      {estado === "debe" ? <path d={RAYAS_MUESTRA} fill={RAYAS_DEBE} /> : null}
      <rect
        x={1}
        y={1}
        width={14}
        height={10}
        rx={2}
        fill={m.tapa[1]}
        stroke={m.bisel}
        strokeWidth={estado === "debe" ? 1.2 : 1}
      />
      {libre ? (
        <rect
          x={3.5}
          y={3.5}
          width={9}
          height={5}
          rx={1}
          fill="none"
          stroke={m.lote}
          strokeWidth={0.9}
          strokeDasharray="1.6 1.3"
        />
      ) : null}
    </svg>
  );
}

export type Resumen = {
  /** Unidades de puesto por estado (medio puesto = ½). */
  puestos: Record<Filtro, number>;
  totalPuestos: number;
  secundarios: { label: string; valor: string }[];
};

const LEYENDA: { filtro: Filtro; label: string }[] = [
  { filtro: "al_dia", label: "Al día" },
  { filtro: "debe", label: "Debe el mes" },
  { filtro: "vencido", label: "Deuda atrasada" },
  { filtro: "libre", label: "Libres" },
];

/** Ocupación de puestos (barra + leyenda que filtra el plano) y el resto del predio. */
export function ResumenMapa({
  resumen,
  filtro,
  onFiltro,
  className,
}: {
  resumen: Resumen;
  filtro: Filtro | null;
  onFiltro: (f: Filtro | null) => void;
  className?: string;
}) {
  const ocupados = resumen.totalPuestos - resumen.puestos.libre;
  const total = resumen.totalPuestos || 1;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
        <div className="min-w-0 space-y-1.5 md:w-56 md:shrink-0">
          <p className="text-sm">
            <span className="font-display text-lg font-bold tabular">{formatFraccion(ocupados)}</span>
            <span className="text-muted-foreground">
              {" "}
              de {formatFraccion(resumen.totalPuestos)} puestos ocupados
            </span>
          </p>
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/5"
            role="img"
            aria-label={`${formatFraccion(ocupados)} de ${formatFraccion(resumen.totalPuestos)} puestos ocupados`}
          >
            {(["al_dia", "debe", "vencido"] as const).map((f) =>
              resumen.puestos[f] > 0 ? (
                <span
                  key={f}
                  className="h-full transition-[width] duration-500"
                  style={{
                    width: `${(resumen.puestos[f] / total) * 100}%`,
                    background: BARRA[f],
                  }}
                />
              ) : null
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar el plano">
          {LEYENDA.map((l) => {
            const activo = filtro === l.filtro;
            return (
              <button
                key={l.filtro}
                type="button"
                aria-pressed={activo}
                onClick={() => onFiltro(activo ? null : l.filtro)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  activo
                    ? "border-primary bg-accent text-accent-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MuestraEstado estado={l.filtro} />
                {l.label}
                <span className="tabular font-semibold text-foreground">
                  {formatFraccion(resumen.puestos[l.filtro])}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {resumen.secundarios.length > 0 ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {resumen.secundarios.map((s) => (
            <span key={s.label} className="whitespace-nowrap">
              {s.label} <span className="font-semibold text-foreground tabular">{s.valor}</span>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** "3 de 23" */
export function deTotal(n: number, total: number): string {
  return `${formatNumero(n)} de ${formatNumero(total)}`;
}
