"use client";

import { cn } from "@/lib/utils";
import { formatFraccion, formatNumero } from "@/lib/format";
import { ASPECTO, type EstadoBloque } from "./plano-svg";

export type Filtro = "al_dia" | "debe" | "vencido" | "libre";

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
                    background: ASPECTO[f].stroke,
                  }}
                />
              ) : null
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar el plano">
          {LEYENDA.map((l) => {
            const activo = filtro === l.filtro;
            const a = ASPECTO[l.filtro as EstadoBloque];
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
                <span
                  aria-hidden
                  className="size-3 rounded-[4px]"
                  style={{
                    background: a.fill,
                    boxShadow: `inset 0 0 0 1.5px ${a.stroke}`,
                  }}
                />
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
