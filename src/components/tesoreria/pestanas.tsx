import Link from "next/link";
import { cn } from "@/lib/utils";

export type PestanaTesoreria = "hoy" | "movimientos" | "conciliar" | "saldos";

export const PESTANAS_TESORERIA: PestanaTesoreria[] = ["hoy", "movimientos", "conciliar", "saldos"];

const LABEL: Record<PestanaTesoreria, string> = {
  hoy: "Hoy",
  movimientos: "Movimientos",
  conciliar: "Conciliar",
  saldos: "Saldos iniciales",
};

/**
 * Pestañas por link (`?tab=`): un camino por pantalla y el lugar sobrevive a recargar.
 * En el celular van de a dos por renglón (sin tira con scroll de costado: las cuatro
 * se ven siempre, con su contador); desde 640 px, en una sola fila.
 */
export function PestanasTesoreria({
  activa,
  pendientes,
}: {
  activa: PestanaTesoreria;
  /** Contador ámbar por pestaña (lo que falta hacer ahí). */
  pendientes: Partial<Record<PestanaTesoreria, number>>;
}) {
  return (
    <nav aria-label="Secciones de Tesorería" data-tour="tesoreria-pestanas">
      <ul className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/60 p-1 sm:flex sm:w-fit sm:max-w-full sm:flex-wrap">
        {PESTANAS_TESORERIA.map((p) => {
          const esActiva = p === activa;
          const n = pendientes[p] ?? 0;
          return (
            <li key={p} className="min-w-0">
              <Link
                href={p === "hoy" ? "/tesoreria" : `/tesoreria?tab=${p}`}
                aria-current={esActiva ? "page" : undefined}
                scroll={false}
                data-tour={`tesoreria-pestana-${p}`}
                className={cn(
                  "flex h-full min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-center text-base leading-tight font-medium transition-colors pointer-coarse:min-h-[44px] sm:px-4",
                  esActiva ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LABEL[p]}
                {n > 0 ? (
                  <span className="shrink-0 rounded-full bg-parcial-suave px-2 text-xs font-bold text-parcial tabular">
                    {n}
                    <span className="sr-only"> {n === 1 ? "pendiente" : "pendientes"}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
