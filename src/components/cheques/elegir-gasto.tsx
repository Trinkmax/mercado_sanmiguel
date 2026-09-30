"use client";

import { useMemo, useState } from "react";
import { Check, Scissors, Search, Banknote, HandCoins } from "lucide-react";
import type { DiferenciaCheque } from "@/lib/actions/cheques";
import { formatARS, formatFecha, redondear2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Codigo } from "@/components/shared/codigo";
import type { GastoPendiente } from "@/components/gastos/tipos";

function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Cuántos gastos se ven a la vez: sin scroll propio dentro del diálogo (el diálogo ya se desplaza). */
const VISIBLES = 6;

/**
 * Nombre del rubro, si el gasto lo trae ("[SEGUV] Seguros Varios"): el código solo no se
 * entiende. GastoPendiente todavía no lo tiene; cuando lo sume, aparece solo.
 */
type ConRubro = { rubroNombre?: string | null };

/** Gastos pendientes ordenados para un cheque: primero los que nombran al proveedor, después por monto parecido. */
export function ordenarParaCheque(
  gastos: GastoPendiente[],
  proveedor: string,
  montoCheque: number
): (GastoPendiente & ConRubro & { sugerido: boolean })[] {
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
      rubroNombre: (g as GastoPendiente & ConRubro).rubroNombre ?? null,
      monto: g.monto,
      vencimiento: g.vencimiento,
      periodo: g.periodo,
      sugerido: g.sugerido,
    }));
}

/**
 * Lista corta de gastos pendientes para elegir cuál pagó el cheque (con búsqueda).
 * Muestra el monto de cada uno para compararlo con el del cheque, y dice en qué
 * orden van (los más parecidos al cheque primero).
 */
export function ElegirGasto({
  gastos,
  proveedor,
  montoCheque,
  valor,
  onCambiar,
  idBase,
  hoy,
}: {
  gastos: GastoPendiente[];
  proveedor: string;
  montoCheque: number;
  valor: string | null;
  onCambiar: (id: string | null) => void;
  idBase: string;
  /** "YYYY-MM-DD" de negocio: los ya vencidos dicen "Venció". */
  hoy: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda);
  const { lista, sinResultados } = useMemo(() => {
    const ordenados = ordenarParaCheque(gastos, proveedor, montoCheque);
    const filtrados = q
      ? ordenados.filter(
          (g) => normalizar(g.etiqueta).includes(q) || normalizar(g.rubroNombre ?? "").includes(q)
        )
      : ordenados;
    const visibles = filtrados.slice(0, VISIBLES);
    // El elegido no desaparece de la vista al cambiar el proveedor o la búsqueda.
    const elegido = valor ? ordenados.find((g) => g.id === valor) : undefined;
    return {
      lista: elegido && !visibles.some((g) => g.id === elegido.id) ? [elegido, ...visibles] : visibles,
      sinResultados: filtrados.length === 0,
    };
  }, [gastos, proveedor, montoCheque, q, valor]);

  if (gastos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No hay gastos pendientes. Cargalo primero en Gastos y después volvé a este cheque.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Primero los que nombran al proveedor o tienen un monto parecido al del cheque.
        {gastos.length > VISIBLES ? " Si no está, buscalo." : ""}
      </p>
      {gastos.length > VISIBLES ? (
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
      <ul className="divide-y overflow-hidden rounded-xl border" aria-label="Gastos pendientes">
        {lista.map((g) => {
          const activo = g.id === valor;
          const vencido = g.vencimiento !== null && g.vencimiento < hoy;
          const rubro = g.rubroNombre && g.rubroNombre !== g.etiqueta ? g.rubroNombre : null;
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
                  <span className="min-w-0">
                    <span className="block text-base font-medium break-words">{g.etiqueta}</span>
                    <span
                      className={cn(
                        "block text-sm break-words",
                        activo ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      {g.rubroCodigo ? <Codigo codigo={g.rubroCodigo} className="mr-1.5 align-middle" /> : null}
                      {rubro ? `${rubro} · ` : ""}
                      <span className={cn(vencido && !activo && "font-semibold text-pendiente")}>
                        {g.vencimiento
                          ? `${vencido ? "Venció" : g.vencimiento === hoy ? "Vence hoy" : "Vence"} ${formatFecha(g.vencimiento).slice(0, 5)}`
                          : "Sin vencimiento"}
                      </span>
                      {g.sugerido ? " · parecido al cheque" : ""}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-base font-semibold tabular">{formatARS(g.monto)}</span>
              </button>
            </li>
          );
        })}
        {sinResultados ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">No encontramos un gasto con eso.</li>
        ) : null}
      </ul>
    </div>
  );
}

/** ¿El cheque y el gasto son de distinto monto? (al centavo) */
export function montosDistintos(montoCheque: number, montoGasto: number): boolean {
  return Math.abs(redondear2(montoCheque - montoGasto)) >= 0.01;
}

function Opcion({
  activo,
  onClick,
  icono: Icono,
  titulo,
  ayuda,
}: {
  activo: boolean;
  onClick: () => void;
  icono: typeof Banknote;
  titulo: string;
  ayuda: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        activo ? "border-primary bg-accent" : "border-input bg-card hover:bg-accent/60"
      )}
    >
      <Icono className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.9} />
      <span className="min-w-0">
        <span className="block text-base font-semibold break-words">{titulo}</span>
        <span className="block text-sm text-muted-foreground">{ayuda}</span>
      </span>
      {activo ? <Check className="ml-auto size-5 shrink-0 text-primary" strokeWidth={2.2} /> : null}
    </button>
  );
}

/**
 * El cheque y el gasto no son del mismo monto: hay que decir qué pasó con la
 * diferencia (así ningún peso queda sin registrar). Cheque menor → el resto queda
 * como otro gasto por pagar. Cheque mayor → vuelto en efectivo o saldo a favor.
 */
export function ElegirDiferencia({
  montoCheque,
  montoGasto,
  proveedor,
  valor,
  onCambiar,
}: {
  montoCheque: number;
  montoGasto: number;
  proveedor: string;
  valor: DiferenciaCheque | null;
  onCambiar: (v: DiferenciaCheque) => void;
}) {
  if (!montosDistintos(montoCheque, montoGasto)) return null;
  const dif = redondear2(montoCheque - montoGasto);
  const quien = proveedor.trim() || "el proveedor";
  return (
    <fieldset className="space-y-2 rounded-xl border border-parcial/40 bg-parcial-suave/50 p-3">
      <legend className="sr-only">¿Qué pasó con la diferencia?</legend>
      <p className="text-sm font-medium">
        El cheque es de {formatARS(montoCheque)} y el gasto de {formatARS(montoGasto)}.{" "}
        {dif < 0 ? `Faltan ${formatARS(-dif)}.` : `Sobran ${formatARS(dif)}.`} ¿Qué pasó con la diferencia?
      </p>
      {dif < 0 ? (
        <>
          <Opcion
            activo={valor === "dividir"}
            onClick={() => onCambiar("dividir")}
            icono={Scissors}
            titulo={`Quedan ${formatARS(-dif)} por pagar`}
            ayuda={`El cheque paga ${formatARS(montoCheque)} y el resto queda como otro gasto en Por pagar. Si ya lo pagaste, después tocá Pagar en ese gasto.`}
          />
        </>
      ) : (
        <>
          <Opcion
            activo={valor === "vuelto_efectivo"}
            onClick={() => onCambiar("vuelto_efectivo")}
            icono={Banknote}
            titulo={`Me dio ${formatARS(dif)} de vuelto en efectivo`}
            ayuda="Entra al efectivo de Tesorería."
          />
          <Opcion
            activo={valor === "a_favor"}
            onClick={() => onCambiar("a_favor")}
            icono={HandCoins}
            titulo={`Quedan ${formatARS(dif)} a favor con ${quien}`}
            ayuda="Para descontar en la próxima compra."
          />
        </>
      )}
    </fieldset>
  );
}
