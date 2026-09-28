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

/** Pestañas por link (`?tab=`): un camino por pantalla y el lugar sobrevive a recargar. */
export function PestanasTesoreria({
  activa,
  pendientes,
}: {
  activa: PestanaTesoreria;
  /** Contador ámbar por pestaña (lo que falta hacer ahí). */
  pendientes: Partial<Record<PestanaTesoreria, number>>;
}) {
  return (
    <nav aria-label="Secciones de Tesorería" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-1 rounded-xl border bg-muted/60 p-1">
        {PESTANAS_TESORERIA.map((p) => {
          const esActiva = p === activa;
          const n = pendientes[p] ?? 0;
          return (
            <li key={p}>
              <Link
                href={p === "hoy" ? "/tesoreria" : `/tesoreria?tab=${p}`}
                aria-current={esActiva ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-base font-medium transition-colors",
                  esActiva ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LABEL[p]}
                {n > 0 ? (
                  <span className="rounded-full bg-parcial-suave px-2 text-xs font-bold text-parcial tabular">
                    {n}
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
