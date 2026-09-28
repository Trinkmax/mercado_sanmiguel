"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CopyPlus } from "lucide-react";
import { formatARS, labelPeriodo } from "@/lib/format";
import { traerGastosFijos } from "@/lib/actions/gastos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Codigo } from "@/components/shared/codigo";

export type FijoParaTraer = {
  id: string;
  etiqueta: string;
  /** Descripción original (null = se ve el rubro). */
  descripcion: string | null;
  rubroCodigo: string | null;
  monto: number;
  /** Vencimiento del mes anterior + 1 mes (editable). */
  vencimientoSugerido: string | null;
};

type Fila = { incluir: boolean; monto: string; vencimiento: string };

/** "agosto" a partir de "2026-08-01". */
function mesMinuscula(periodo: string): string {
  return (labelPeriodo(periodo).split(" ")[0] ?? "").toLowerCase();
}

/**
 * Traer los fijos del mes anterior (E3): cada uno con su monto editable (el
 * anterior tachado y la diferencia), vencimiento +1 mes y casillero para dejar
 * alguno afuera. Un solo botón carga todo. Repetir no duplica (lo cuida la base).
 */
export function TraerFijos({
  items,
  mesOrigen,
  mesDestino,
  abiertoInicial = false,
}: {
  items: FijoParaTraer[];
  mesOrigen: string;
  mesDestino: string;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        { incluir: true, monto: String(Math.round(i.monto)), vencimiento: i.vencimientoSugerido ?? "" },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const filaDe = (i: FijoParaTraer): Fila =>
    filas[i.id] ?? {
      incluir: true,
      monto: String(Math.round(i.monto)),
      vencimiento: i.vencimientoSugerido ?? "",
    };

  const origen = mesMinuscula(mesOrigen);
  const destino = mesMinuscula(mesDestino);

  const elegidos = items.filter((i) => filaDe(i).incluir);
  const total = elegidos.reduce((acc, i) => acc + Number(filaDe(i).monto || 0), 0);
  const hayMontoInvalido = elegidos.some((i) => Number(filaDe(i).monto || 0) <= 0);
  const todos = elegidos.length === items.length;

  function cambiar(i: FijoParaTraer, cambio: Partial<Fila>) {
    setFilas((f) => ({ ...f, [i.id]: { ...filaDe(i), ...f[i.id], ...cambio } }));
    setError(null);
  }

  function traer() {
    setError(null);
    startTransition(async () => {
      const res = await traerGastosFijos({
        desde: mesOrigen,
        hasta: mesDestino,
        items: elegidos.map((i) => ({
          origenId: i.id,
          monto: Number(filaDe(i).monto),
          vencimiento: filaDe(i).vencimiento || null,
          descripcion: i.descripcion,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { creados, omitidos } = res.data;
      toast.success(
        `Trajiste ${creados} ${creados === 1 ? "gasto fijo" : "gastos fijos"} a ${destino}` +
          (omitidos > 0 ? ` (${omitidos} ya ${omitidos === 1 ? "estaba" : "estaban"}).` : ".")
      );
      setAbierto(false);
    });
  }

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <CopyPlus className="mt-0.5 size-6 shrink-0 text-primary" strokeWidth={1.9} />
          <div>
            <p className="text-base font-semibold">
              {items.length === 1
                ? `Hay 1 gasto fijo de ${origen} para traer`
                : `Hay ${items.length} gastos fijos de ${origen} para traer`}
            </p>
            <p className="text-sm text-muted-foreground">
              Revisás los montos y los cargás en {destino} con un solo toque.
            </p>
          </div>
        </div>
        <Button className="h-12 px-5 text-base font-semibold" onClick={() => setAbierto(true)}>
          {items.length === 1 ? `Traer el gasto fijo de ${origen}` : `Traer los ${items.length} gastos fijos de ${origen}`}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label={`Gastos fijos de ${origen} para traer a ${destino}`}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">
            Fijos de {origen} → {destino}
          </h2>
          <p className="text-sm text-muted-foreground">
            Cambiá los montos que subieron o bajaron. Los que destildes no se traen.
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
          <Checkbox
            checked={todos}
            onCheckedChange={(v) =>
              setFilas(Object.fromEntries(items.map((i) => [i.id, { ...filaDe(i), incluir: v === true }])))
            }
            className="size-5"
          />
          {todos ? "Destildar todos" : "Tildar todos"}
        </label>
      </div>

      <ul className="divide-y">
        {items.map((i) => {
          const fila = filaDe(i);
          const nuevo = Number(fila.monto || 0);
          const diferencia = nuevo - i.monto;
          const cambio = fila.monto !== "" && Math.abs(diferencia) >= 0.5;
          return (
            <li
              key={i.id}
              className={cn(
                "grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center",
                !fila.incluir && "opacity-55"
              )}
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <Checkbox
                  checked={fila.incluir}
                  onCheckedChange={(v) => cambiar(i, { incluir: v === true })}
                  className="size-5"
                  aria-label={`Traer ${i.etiqueta}`}
                />
                {i.rubroCodigo ? <Codigo codigo={i.rubroCodigo} /> : null}
                <span className="text-base font-medium">{i.etiqueta}</span>
              </label>

              <div className="flex items-center gap-3 pl-8 md:pl-0">
                <div className="w-24 text-right text-sm leading-tight tabular">
                  <span className={cn("block text-muted-foreground", cambio && "line-through")}>
                    {formatARS(i.monto)}
                  </span>
                  {cambio ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 font-semibold",
                        diferencia > 0 ? "text-pendiente" : "text-pagado"
                      )}
                    >
                      {diferencia > 0 ? (
                        <ArrowUp className="size-3.5" strokeWidth={2.4} />
                      ) : (
                        <ArrowDown className="size-3.5" strokeWidth={2.4} />
                      )}
                      {formatARS(Math.abs(diferencia))}
                    </span>
                  ) : null}
                </div>
                <Input
                  inputMode="numeric"
                  aria-label={`Monto de ${i.etiqueta} en ${destino}`}
                  value={fila.monto}
                  disabled={!fila.incluir}
                  onChange={(e) => cambiar(i, { monto: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                  className={cn(
                    "h-12 w-36 text-right text-base font-semibold tabular",
                    fila.incluir && nuevo <= 0 && "border-pendiente"
                  )}
                />
              </div>

              <div className="flex items-center gap-2 pl-8 md:pl-0">
                <span className="text-sm text-muted-foreground md:sr-only">Vence</span>
                <Input
                  type="date"
                  aria-label={`Vencimiento de ${i.etiqueta}`}
                  value={fila.vencimiento}
                  disabled={!fila.incluir}
                  onChange={(e) => cambiar(i, { vencimiento: e.target.value })}
                  className="h-12 w-44 text-base"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 space-y-2 border-t bg-card/95 px-4 py-3 backdrop-blur">
        {error ? (
          <p role="alert" className="text-sm font-medium text-pendiente">
            {error}
          </p>
        ) : hayMontoInvalido ? (
          <p className="text-sm font-medium text-pendiente">Hay un gasto tildado sin monto: completalo o destildalo.</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            className="h-12 px-5 text-base"
            disabled={pendiente}
            onClick={() => setAbierto(false)}
          >
            Ahora no
          </Button>
          <Button
            className="h-13 flex-1 px-5 text-base font-semibold sm:flex-none"
            disabled={pendiente || elegidos.length === 0 || hayMontoInvalido}
            onClick={traer}
          >
            {pendiente ? <Spinner className="size-5" /> : <CopyPlus className="size-5" strokeWidth={2} />}
            {elegidos.length === 0
              ? "Elegí al menos uno"
              : `Cargar ${elegidos.length} ${elegidos.length === 1 ? "gasto" : "gastos"} en ${destino} — total ${formatARS(total)}`}
          </Button>
        </div>
      </div>
    </section>
  );
}
