"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CopyPlus } from "lucide-react";
import {
  formatARS,
  formatNumero,
  labelPeriodo,
  parseMonto,
  redondear2,
  sanitizarMonto,
} from "@/lib/format";
import { traerGastosFijos } from "@/lib/actions/gastos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Codigo } from "@/components/shared/codigo";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

export type FijoParaTraer = {
  id: string;
  etiqueta: string;
  /** Descripción original (null = se ve el rubro). */
  descripcion: string | null;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  monto: number;
  /** Vencimiento del mes anterior + 1 mes (editable). */
  vencimientoSugerido: string | null;
};

type Fila = { incluir: boolean; monto: string; vencimiento: string };

/** "agosto" a partir de "2026-08-01". */
function mesMinuscula(periodo: string): string {
  return (labelPeriodo(periodo).split(" ")[0] ?? "").toLowerCase();
}

/** Monto → texto del campo, con los puntos de miles ("385.000"): se lee igual que el
 * monto de al lado y parseMonto lo entiende. 0 → "". */
function montoParaCampo(n: number): string {
  return n > 0 ? formatNumero(redondear2(n)) : "";
}

/**
 * Traer los fijos del mes anterior (E3): cada uno con su monto editable (debajo, lo
 * que se pagó el mes anterior y la diferencia), vencimiento +1 mes (avisa si ya
 * pasó) y casillero para dejar alguno afuera. Un solo botón carga todo. Repetir no
 * duplica (lo cuida la base).
 */
export function TraerFijos({
  items,
  mesOrigen,
  mesDestino,
  hoy,
  abiertoInicial = false,
}: {
  items: FijoParaTraer[];
  mesOrigen: string;
  mesDestino: string;
  /** "YYYY-MM-DD" de hoy (Argentina): para avisar los vencimientos que ya pasaron. */
  hoy: string;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [filas, setFilas] = useState<Record<string, Fila>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        { incluir: true, monto: montoParaCampo(i.monto), vencimiento: i.vencimientoSugerido ?? "" },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const filaDe = (i: FijoParaTraer): Fila =>
    filas[i.id] ?? {
      incluir: true,
      monto: montoParaCampo(i.monto),
      vencimiento: i.vencimientoSugerido ?? "",
    };

  const origen = mesMinuscula(mesOrigen);
  const destino = mesMinuscula(mesDestino);

  const elegidos = items.filter((i) => filaDe(i).incluir);
  const total = elegidos.reduce((acc, i) => acc + parseMonto(filaDe(i).monto), 0);
  const sinMonto = elegidos.filter((i) => parseMonto(filaDe(i).monto) <= 0).length;
  const hayMontoInvalido = sinMonto > 0;
  const todos = elegidos.length === items.length;
  const yaVencio = (fecha: string | null) => fecha !== null && fecha !== "" && fecha < hoy;
  const vencidosElegidos = elegidos.filter((i) => yaVencio(filaDe(i).vencimiento)).length;
  const vencidosSugeridos = items.filter((i) => yaVencio(i.vencimientoSugerido)).length;

  function cambiar(i: FijoParaTraer, cambio: Partial<Fila>) {
    setFilas((f) => ({ ...f, [i.id]: { ...filaDe(i), ...f[i.id], ...cambio } }));
    setError(null);
  }

  function traer() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => traerGastosFijos({
        desde: mesOrigen,
        hasta: mesDestino,
        items: elegidos.map((i) => ({
          origenId: i.id,
          monto: parseMonto(filaDe(i).monto),
          vencimiento: filaDe(i).vencimiento || null,
          descripcion: i.descripcion,
        })),
      }));
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
      <div
        data-tour="gastos-traer-fijos"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-accent/60 px-5 py-4"
      >
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
            {vencidosSugeridos > 0 ? (
              <p className="text-sm font-medium text-pendiente">
                {vencidosSugeridos === items.length
                  ? vencidosSugeridos === 1
                    ? "Ya venció: traelo hoy."
                    : `Ya vencieron los ${vencidosSugeridos}: traelos hoy.`
                  : vencidosSugeridos === 1
                    ? "1 ya venció: traelo hoy."
                    : `${vencidosSugeridos} ya vencieron: traelos hoy.`}
              </p>
            ) : null}
          </div>
        </div>
        <Button
          className="h-auto min-h-12 px-5 py-2.5 text-base leading-snug font-semibold whitespace-normal"
          onClick={() => setAbierto(true)}
        >
          {items.length === 1 ? `Traer el gasto fijo de ${origen}` : `Traer los ${items.length} gastos fijos de ${origen}`}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label={`Gastos fijos de ${origen} para traer a ${destino}`}
      className="rounded-xl border bg-card"
    >
      {/* Sin overflow-hidden: si no, el pie no queda pegado abajo al bajar por la lista. */}
      <div
        data-tour="gastos-fijos-lista"
        className="flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b bg-muted/40 px-4 py-3"
      >
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="font-display text-lg font-bold tracking-tight">
            Fijos de {origen} → {destino}
          </h2>
          <p className="text-sm text-muted-foreground">
            Cambiá los montos que subieron o bajaron. Los que destildes no se traen.
          </p>
          {/* Arriba y no en el pie pegado: en el celular el pie tiene que ser bajo. */}
          {vencidosElegidos > 0 ? (
            <p className="mt-1 text-sm font-medium text-pendiente">
              {vencidosElegidos === 1
                ? "1 ya venció y entra vencido. Si ya se pagó, después tocá Pagar."
                : `${vencidosElegidos} ya vencieron y entran vencidos. Si ya se pagaron, después tocá Pagar en cada uno.`}
            </p>
          ) : null}
        </div>
        {/* El rótulo dice lo que significa el tilde (no la acción de tocarlo). */}
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium">
          <Checkbox
            checked={todos}
            onCheckedChange={(v) =>
              setFilas(Object.fromEntries(items.map((i) => [i.id, { ...filaDe(i), incluir: v === true }])))
            }
            className="size-6 [&_svg]:size-4"
          />
          Traer todos
        </label>
      </div>

      <ul className="divide-y">
        {items.map((i) => {
          const fila = filaDe(i);
          const nuevo = parseMonto(fila.monto);
          const diferencia = nuevo - i.monto;
          const cambio = fila.monto !== "" && Math.abs(diferencia) >= 0.005;
          // Solo avisa en los que se traen: uno destildado no "entra vencido".
          const vencido = fila.incluir && yaVencio(fila.vencimiento);
          const venceHoy = fila.incluir && fila.vencimiento === hoy;
          // Rubro con su nombre (el código solo no se entiende); si no hay descripción,
          // el nombre del rubro ya es el título.
          const rubro = i.descripcion?.trim() ? i.rubroNombre : null;
          return (
            <li
              key={i.id}
              className={cn(
                "grid gap-x-5 gap-y-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_11rem_11rem]",
                !fila.incluir && "opacity-55"
              )}
            >
              {/* En tablet y escritorio el nombre baja a la altura de los campos (debajo de sus rótulos). */}
              <label className="flex min-h-11 cursor-pointer items-start gap-3 md:pt-9">
                <Checkbox
                  checked={fila.incluir}
                  onCheckedChange={(v) => cambiar(i, { incluir: v === true })}
                  className="mt-0.5 size-6 [&_svg]:size-4"
                  aria-label={`Traer ${i.etiqueta}`}
                />
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-medium break-words">{i.etiqueta}</span>
                  {i.rubroCodigo || rubro ? (
                    <span className="block text-sm text-muted-foreground">
                      {i.rubroCodigo ? <Codigo codigo={i.rubroCodigo} className="mr-1.5 align-middle" /> : null}
                      {rubro}
                    </span>
                  ) : null}
                </span>
              </label>

              {/* Celular: debajo del nombre. Tablet y escritorio: dos columnas más de la fila. */}
              <div className="grid gap-3 pl-9 sm:grid-cols-2 md:contents">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`fijo-monto-${i.id}`} className="text-sm">
                    Monto en {destino}
                  </Label>
                  <Input
                    id={`fijo-monto-${i.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    aria-describedby={`fijo-antes-${i.id}`}
                    value={fila.monto}
                    disabled={!fila.incluir}
                    onChange={(e) => cambiar(i, { monto: sanitizarMonto(e.target.value).slice(0, 15) })}
                    className={cn(
                      "h-12 w-full text-right text-base font-semibold tabular",
                      fila.incluir && nuevo <= 0 && "border-pendiente"
                    )}
                  />
                  <p id={`fijo-antes-${i.id}`} className="text-sm leading-snug tabular text-muted-foreground">
                    En {origen}: {formatARS(i.monto)}
                    {fila.incluir && nuevo <= 0 ? (
                      <span className="block font-semibold text-pendiente">Falta el monto</span>
                    ) : cambio ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 font-semibold",
                          diferencia > 0 ? "text-pendiente" : "text-pagado"
                        )}
                      >
                        {diferencia > 0 ? (
                          <ArrowUp className="size-3.5 shrink-0" strokeWidth={2.4} />
                        ) : (
                          <ArrowDown className="size-3.5 shrink-0" strokeWidth={2.4} />
                        )}
                        {formatARS(Math.abs(diferencia))} {diferencia > 0 ? "más" : "menos"}
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`fijo-vence-${i.id}`} className="text-sm">
                    Vence
                  </Label>
                  <Input
                    id={`fijo-vence-${i.id}`}
                    type="date"
                    aria-describedby={vencido || venceHoy ? `fijo-aviso-${i.id}` : undefined}
                    value={fila.vencimiento}
                    disabled={!fila.incluir}
                    onChange={(e) => cambiar(i, { vencimiento: e.target.value })}
                    className={cn("h-12 w-full text-base", vencido && "border-pendiente")}
                  />
                  {vencido ? (
                    <p id={`fijo-aviso-${i.id}`} className="text-sm leading-snug font-medium text-pendiente">
                      Ya venció: entra vencido
                    </p>
                  ) : venceHoy ? (
                    <p id={`fijo-aviso-${i.id}`} className="text-sm leading-snug font-medium text-parcial">
                      Vence hoy
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pegado abajo mientras se revisa la lista (en celular y tablet, arriba de la barra de
          navegación). En el celular tiene que ser bajo para que se vea una fila entera: solo
          el botón, con el texto corto; los vencidos se avisan arriba y en cada fila, y
          "Ahora no" va al final, fuera del pie. Mide ~77 px a 360. */}
      <div className="sticky bottom-[var(--nav-inferior)] z-10 space-y-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:rounded-b-xl">
        {error ? (
          <AlertaError error={error} titulo="No se pudieron traer los gastos" />
        ) : hayMontoInvalido ? (
          <p className="text-sm font-medium text-pendiente">
            {sinMonto === 1
              ? "Falta un monto: completalo o destildá ese gasto."
              : `Faltan ${sinMonto} montos: completalos o destildá esos gastos.`}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            className="hidden h-12 px-5 text-base sm:inline-flex"
            disabled={pendiente}
            onClick={() => setAbierto(false)}
          >
            Ahora no
          </Button>
          <Button
            className="h-auto min-h-13 w-full min-w-0 shrink px-4 py-2.5 text-base leading-snug font-semibold whitespace-normal sm:w-auto sm:px-5"
            disabled={pendiente || elegidos.length === 0 || hayMontoInvalido}
            onClick={traer}
          >
            {pendiente ? (
              <Spinner className="size-5" />
            ) : (
              <CopyPlus className="hidden size-5 sm:block" strokeWidth={2} />
            )}
            {elegidos.length === 0 ? (
              "Elegí al menos uno"
            ) : (
              <>
                <span className="sm:hidden">
                  Cargar {elegidos.length} {elegidos.length === 1 ? "gasto" : "gastos"} · {formatARS(total)}
                </span>
                <span className="hidden sm:inline">
                  Cargar {elegidos.length} {elegidos.length === 1 ? "gasto" : "gastos"} en {destino} — total{" "}
                  {formatARS(total)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
      {/* Celular: después del botón y sin quedar pegado (el pie queda más bajo). */}
      <div className="px-4 pb-4 sm:hidden">
        <Button
          variant="outline"
          className="h-12 w-full text-base"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Ahora no
        </Button>
      </div>
    </section>
  );
}
