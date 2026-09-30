import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Filtros de la cartera. "listos" (por cobrar con la fecha ya cumplida) y
 * "sin_gasto" (entregados a un proveedor sin decir qué gasto pagaron) no son
 * estados de la base: se calculan en la página.
 */
export const FILTROS_CHEQUES = [
  { valor: "listos", label: "Listos para depositar" },
  { valor: "en_cartera", label: "Por cobrar" },
  { valor: "sin_gasto", label: "Entregados sin gasto" },
  { valor: "entregado", label: "Entregados a proveedor" },
  { valor: "depositado", label: "Depositados" },
  { valor: "acreditado", label: "Acreditados" },
  { valor: "rechazado", label: "Rechazados" },
  { valor: "todos", label: "Todos" },
] as const;

export type FiltroCheque = (typeof FILTROS_CHEQUES)[number]["valor"];

/** Href de cada filtro ("Por cobrar" es la vista por defecto). Conserva la búsqueda. */
export function hrefFiltroCheque(filtro: FiltroCheque, q?: string): string {
  const params = new URLSearchParams();
  if (filtro !== "en_cartera") params.set("estado", filtro);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/cheques?${qs}` : "/cheques";
}

/** Filtros por estado, como chips grandes (≥ 44 px). Los que requieren atención van en ámbar. */
export function FiltroEstado({
  activo,
  conteos,
  q,
}: {
  activo: FiltroCheque;
  conteos: Record<FiltroCheque, number>;
  q?: string;
}) {
  return (
    <nav aria-label="Filtrar cheques" className="flex flex-wrap gap-2" data-tour="cheques-filtros">
      {FILTROS_CHEQUES.map((f) => {
        const esActivo = activo === f.valor;
        const atencion = (f.valor === "listos" || f.valor === "sin_gasto") && conteos[f.valor] > 0;
        if (f.valor === "sin_gasto" && conteos.sin_gasto === 0 && !esActivo) return null;
        return (
          <Link
            key={f.valor}
            href={hrefFiltroCheque(f.valor, q)}
            aria-current={esActivo ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors pointer-coarse:min-h-[44px]",
              esActivo
                ? "border-primary bg-primary text-primary-foreground"
                : atencion
                  ? "border-parcial/50 bg-parcial-suave text-foreground hover:bg-parcial-suave/70"
                  : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {f.label}
            <span
              className={cn(
                "tabular text-xs font-semibold",
                esActivo ? "text-primary-foreground/80" : atencion ? "text-parcial" : "text-muted-foreground"
              )}
            >
              {conteos[f.valor]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
