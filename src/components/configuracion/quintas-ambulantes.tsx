"use client";

import { useState, useTransition } from "react";
import { Footprints, Loader2, Send, Tractor } from "lucide-react";
import { toast } from "sonner";
import {
  actualizarConcepto,
  guardarCuotasQuinteros,
} from "@/lib/actions/configuracion";
import { formatARS, OPCIONES_CUOTAS_MES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

export type PrecioPorteria = {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  /** Resumen del cambio que espera la aprobación del Líder, si hay. */
  pendiente: string | null;
};

function soloDigitos(v: string): string {
  return v.replace(/\D+/g, "").slice(0, 10);
}

/**
 * Configuración del Jefe de Portería (G7): en cuántos pagos se cobra la quinta
 * y los precios de la quinta (EXPQ, por mes) y del ambulante (AMB, por día).
 * Las cuotas se guardan al tocar (con "Deshacer"); los precios los aprueba el Líder.
 */
export function QuintasAmbulantes({
  quinta,
  ambulante,
  cuotasDefault,
  aplicaDirecto,
}: {
  quinta: PrecioPorteria | null;
  ambulante: PrecioPorteria | null;
  cuotasDefault: number;
  /** Líder: los precios se aplican en el acto. */
  aplicaDirecto: boolean;
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <CuotasQuinta cuotasDefault={cuotasDefault} precioQuinta={quinta?.precio ?? 0} />
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Precios</h2>
          <p className="text-sm text-muted-foreground">
            {aplicaDirecto
              ? "Rigen desde el próximo mes que se genere (la quinta) y desde el próximo cobro (el ambulante)."
              : "Los cambios los aprueba el Líder de Procesos. Hasta que los apruebe, se sigue cobrando el precio de ahora."}
          </p>
        </div>
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {quinta ? (
            <FilaPrecio
              concepto={quinta}
              icono={Tractor}
              titulo="Quinta"
              unidad="por mes"
              ejemplo={(precio) =>
                cuotasDefault > 1
                  ? `En ${cuotasDefault} pagos: ${formatARS(Math.round(precio / cuotasDefault))} cada uno`
                  : "Se cobra en un solo pago"
              }
              aplicaDirecto={aplicaDirecto}
            />
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Falta el concepto de la quinta (EXPQ). Pedile al Líder de Procesos que lo cargue.
            </p>
          )}
          {ambulante ? (
            <FilaPrecio
              concepto={ambulante}
              icono={Footprints}
              titulo="Ambulante"
              unidad="por día"
              ejemplo={(precio) => `3 días = ${formatARS(precio * 3)}`}
              aplicaDirecto={aplicaDirecto}
            />
          ) : (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Falta el concepto de los ambulantes (AMB). Pedile al Líder de Procesos que lo cargue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ¿En cuántos pagos cobrás la quinta? ---------- */

function CuotasQuinta({ cuotasDefault, precioQuinta }: { cuotasDefault: number; precioQuinta: number }) {
  const [elegida, setElegida] = useState(cuotasDefault);
  const [guardando, startTransition] = useTransition();
  // Un valor fuera de 1..4 (lo puso el Líder por otra vía) se muestra aparte.
  const esEstandar = OPCIONES_CUOTAS_MES.some((o) => o.valor === elegida);

  function guardar(cuotas: number, anterior: number, avisar = true) {
    setElegida(cuotas);
    startTransition(async () => {
      const res = await guardarCuotasQuinteros({ cuotas });
      if (!res.ok) {
        setElegida(anterior);
        toast.error(res.error);
        return;
      }
      if (!avisar) return;
      toast.success(
        cuotas === 1
          ? "Listo: los quinteros nuevos pagan la quinta en un solo pago."
          : `Listo: los quinteros nuevos pagan la quinta en ${cuotas} pagos.`,
        {
          action: {
            label: "Deshacer",
            onClick: () => guardar(anterior, cuotas, false),
          },
        }
      );
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="font-display text-lg font-bold">¿En cuántos pagos cobrás la quinta?</h2>
        <p className="text-sm text-muted-foreground">
          Es lo que se propone al dar de alta un quintero. Rige para los quinteros nuevos:
          los que ya están siguen como estaban (se cambia desde su carpeta).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Pagos por mes">
        {OPCIONES_CUOTAS_MES.map((o) => {
          const activa = elegida === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              disabled={guardando}
              onClick={() => activa || guardar(o.valor, elegida)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-colors",
                activa
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary/40 hover:bg-accent",
                guardando && !activa && "opacity-60"
              )}
            >
              <span className="font-display text-xl font-bold">
                {o.valor === 1 ? "1 pago" : `${o.valor} pagos`}
              </span>
              <span className={cn("text-sm", activa ? "text-primary-foreground/85" : "text-muted-foreground")}>
                {o.ayuda}
              </span>
            </button>
          );
        })}
      </div>
      <p className="flex min-h-6 items-center gap-2 text-base" aria-live="polite">
        {guardando ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        {!esEstandar ? (
          <span>
            Ahora está en <strong>{elegida} pagos</strong>. Tocá una opción para cambiarlo.
          </span>
        ) : precioQuinta > 0 ? (
          elegida === 1 ? (
            <span>
              La quinta entera: <strong className="tabular">{formatARS(precioQuinta)}</strong> en un pago.
            </span>
          ) : (
            <span>
              Son {elegida} pagos de ≈{" "}
              <strong className="tabular">{formatARS(Math.round(precioQuinta / elegida))}</strong>{" "}
              <span className="text-muted-foreground">(quinta de {formatARS(precioQuinta)})</span>
            </span>
          )
        ) : null}
      </p>
    </section>
  );
}

/* ---------- Precio de un concepto de Portería ---------- */

function FilaPrecio({
  concepto,
  icono: Icono,
  titulo,
  unidad,
  ejemplo,
  aplicaDirecto,
}: {
  concepto: PrecioPorteria;
  icono: typeof Tractor;
  titulo: string;
  unidad: string;
  ejemplo: (precio: number) => string;
  aplicaDirecto: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(Math.round(concepto.precio)));
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const nuevo = Number(valor || 0);
  const cambia = nuevo !== Math.round(concepto.precio);

  function enviar() {
    if (!valor || nuevo <= 0) {
      setError("Poné el precio nuevo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await actualizarConcepto({ id: concepto.id, precio: nuevo });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data.estado === "pendiente") {
        toast.success(`Enviado al Líder de Procesos: ${titulo.toLowerCase()} a ${formatARS(nuevo)} ${unidad}.`);
      } else if (res.data.estado === "aplicado") {
        toast.success(`Listo: ${titulo.toLowerCase()} a ${formatARS(nuevo)} ${unidad}.`);
      } else {
        toast.info("No había nada para cambiar.");
      }
      setEditando(false);
    });
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Icono className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {titulo} <Codigo codigo={concepto.codigo} />
            {concepto.pendiente ? <Sello estado="pendiente_aprobacion" /> : null}
          </p>
          <p className="text-sm text-muted-foreground">{ejemplo(concepto.precio)}</p>
        </div>
        <p className="text-right">
          <Money monto={concepto.precio} className="font-display text-2xl font-bold" />
          <span className="block text-sm text-muted-foreground">{unidad}</span>
        </p>
      </div>
      {concepto.pendiente ? (
        <p className="rounded-lg bg-parcial-suave px-3 py-2 text-sm">
          Esperando al Líder: {concepto.pendiente}
        </p>
      ) : null}

      {editando ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <Label htmlFor={`precio-${concepto.id}`} className="text-base font-semibold">
            Precio nuevo {unidad}
          </Label>
          <Input
            id={`precio-${concepto.id}`}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={valor}
            onChange={(e) => setValor(soloDigitos(e.target.value))}
            aria-invalid={error ? true : undefined}
            className="h-14 max-w-xs bg-card text-2xl font-semibold tabular md:text-2xl"
          />
          <p className="text-base tabular">
            <strong>{formatARS(nuevo)}</strong> {unidad}
            <span className="text-muted-foreground"> · {ejemplo(nuevo)}</span>
          </p>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              onClick={enviar}
              disabled={enviando || !cambia}
            >
              {enviando ? <Loader2 className="size-5 animate-spin" /> : aplicaDirecto ? null : <Send className="size-5" strokeWidth={2} />}
              {aplicaDirecto ? "Guardar precio" : "Enviar al Líder"}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-12 px-4 text-base"
              onClick={() => {
                setEditando(false);
                setValor(String(Math.round(concepto.precio)));
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="min-h-11 px-4 text-sm" onClick={() => setEditando(true)}>
          Cambiar el precio
        </Button>
      )}
    </div>
  );
}
