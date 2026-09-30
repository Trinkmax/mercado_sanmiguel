import Link from "next/link";
import { cn } from "@/lib/utils";

export type FiltroTipoGasto = "todos" | "fijo" | "variable";

const OPCIONES: { valor: FiltroTipoGasto; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "fijo", label: "Fijos" },
  { valor: "variable", label: "Variables" },
];

/** Chips Todos · Fijos · Variables (links: el filtro sobrevive a recargar). */
export function FiltroTipo({
  activo,
  conteos,
  hrefBase,
}: {
  activo: FiltroTipoGasto;
  conteos: Record<FiltroTipoGasto, number>;
  /** Query sin `tipo` (ej. "periodo=2026-09-01&caja=…"). */
  hrefBase: string;
}) {
  return (
    <nav aria-label="Filtrar por tipo" data-tour="gastos-filtro" className="flex flex-wrap gap-2">
      {OPCIONES.map((o) => {
        const esActivo = o.valor === activo;
        const qs = [hrefBase, o.valor === "todos" ? "" : `tipo=${o.valor}`].filter(Boolean).join("&");
        return (
          <Link
            key={o.valor}
            href={`/gastos${qs ? `?${qs}` : ""}`}
            aria-current={esActivo ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              esActivo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent"
            )}
          >
            {o.label}
            <span
              className={cn(
                "tabular text-xs font-semibold",
                esActivo ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {conteos[o.valor]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
