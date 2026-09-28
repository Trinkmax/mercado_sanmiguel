"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { formatARS, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Codigo } from "@/components/shared/codigo";
import type { GastoPendiente } from "@/components/gastos/tipos";

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Gastos pendientes ordenados para un cheque: primero los que nombran al proveedor, después por monto parecido. */
export function ordenarParaCheque(
  gastos: GastoPendiente[],
  proveedor: string,
  montoCheque: number
): (GastoPendiente & { sugerido: boolean })[] {
  const palabras = normalizar(proveedor)
    .split(/\s+/)
    .filter((p) => p.length >= 3);
  return gastos
    .map((g) => {
      const texto = normalizar(g.etiqueta);
      const coincide = palabras.length > 0 && palabras.some((p) => texto.includes(p));
      const mismoMonto = Math.abs(g.monto - montoCheque) < 0.5;
      return { ...g, sugerido: coincide || mismoMonto, puntaje: (coincide ? 2 : 0) + (mismoMonto ? 1 : 0) };
    })
    .sort(
      (a, b) =>
        b.puntaje - a.puntaje ||
        Math.abs(a.monto - montoCheque) - Math.abs(b.monto - montoCheque)
    )
    .map((g) => ({
      id: g.id,
      etiqueta: g.etiqueta,
      rubroCodigo: g.rubroCodigo,
      monto: g.monto,
      vencimiento: g.vencimiento,
      periodo: g.periodo,
      sugerido: g.sugerido,
    }));
}

/**
 * Lista corta de gastos pendientes para elegir cuál pagó el cheque (con búsqueda).
 * Muestra el monto de cada uno para compararlo con el del cheque.
 */
export function ElegirGasto({
  gastos,
  proveedor,
  montoCheque,
  valor,
  onCambiar,
  idBase,
}: {
  gastos: GastoPendiente[];
  proveedor: string;
  montoCheque: number;
  valor: string | null;
  onCambiar: (id: string | null) => void;
  idBase: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda);
  const lista = useMemo(() => {
    const ordenados = ordenarParaCheque(gastos, proveedor, montoCheque);
    const filtrados = q ? ordenados.filter((g) => normalizar(g.etiqueta).includes(q)) : ordenados;
    return filtrados.slice(0, 8);
  }, [gastos, proveedor, montoCheque, q]);
  const elegido = valor ? gastos.find((g) => g.id === valor) ?? null : null;

  if (gastos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No hay gastos pendientes. Cargalo primero en Gastos y después volvé a este cheque.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {gastos.length > 8 ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.9}
          />
          <Input
            id={`${idBase}-buscar`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscá el gasto"
            aria-label="Buscar gasto"
            className="h-12 pl-10 text-base"
          />
        </div>
      ) : null}
      <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border" aria-label="Gastos pendientes">
        {lista.map((g) => {
          const activo = g.id === valor;
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => onCambiar(activo ? null : g.id)}
                aria-pressed={activo}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                  activo ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {activo ? <Check className="size-5 shrink-0" strokeWidth={2.2} /> : null}
                  {g.rubroCodigo ? <Codigo codigo={g.rubroCodigo} /> : null}
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{g.etiqueta}</span>
                    <span className={cn("block text-sm", activo ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {g.vencimiento ? `Vence ${formatFecha(g.vencimiento).slice(0, 5)}` : "Sin vencimiento"}
                      {g.sugerido ? " · sugerido" : ""}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold tabular">{formatARS(g.monto)}</span>
              </button>
            </li>
          );
        })}
        {lista.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">No encontramos un gasto con eso.</li>
        ) : null}
      </ul>
      {elegido && Math.abs(elegido.monto - montoCheque) >= 0.5 ? (
        <p className="rounded-lg bg-parcial-suave px-4 py-2.5 text-sm font-medium text-parcial">
          El cheque es de {formatARS(montoCheque)} y el gasto de {formatARS(elegido.monto)}: el gasto queda
          pagado completo igual.
        </p>
      ) : null}
    </div>
  );
}
