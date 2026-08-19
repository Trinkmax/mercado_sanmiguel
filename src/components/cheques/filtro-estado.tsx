import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Filtros de la cartera. "listos" no es un estado de la DB: son los cheques
 * en cartera cuya fecha de cobro ya llegó (se filtra en memoria en la page).
 */
export const FILTROS_CHEQUES = [
  { valor: "listos", label: "Listos para depositar" },
  { valor: "en_cartera", label: "En cartera" },
  { valor: "depositado", label: "Depositados" },
  { valor: "acreditado", label: "Acreditados" },
  { valor: "rechazado", label: "Rechazados" },
  { valor: "todos", label: "Todos" },
] as const;

export type FiltroCheque = (typeof FILTROS_CHEQUES)[number]["valor"];

/** Href de cada filtro: "en cartera" es la vista por defecto (sin query). */
export function hrefFiltroCheque(filtro: FiltroCheque): string {
  return filtro === "en_cartera" ? "/cheques" : `/cheques?estado=${filtro}`;
}

/** Filtros por estado de la cartera, como pestañas grandes (targets ≥ 44 px). */
export function FiltroEstado({
  activo,
  conteos,
}: {
  activo: FiltroCheque;
  conteos: Record<FiltroCheque, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTROS_CHEQUES.map((f) => {
        const esActivo = activo === f.valor;
        return (
          <Link
            key={f.valor}
            href={hrefFiltroCheque(f.valor)}
            aria-current={esActivo ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
              esActivo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {f.label}
            <span
              className={cn(
                "tabular text-xs font-semibold",
                esActivo ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {conteos[f.valor]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
