"use client";

import { useState, useTransition } from "react";
import { Footprints, Tractor, Truck } from "lucide-react";
import { toast } from "sonner";
import { cargarCanon } from "@/lib/actions/cajas";
import { cn } from "@/lib/utils";
import { formatARS, hoyISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { PreciosCanon, TipoCanon } from "@/components/caja/datos";

export const TIPOS_CANON: {
  valor: TipoCanon;
  label: string;
  ayuda: string;
  Icono: typeof Truck;
}[] = [
  { valor: "camion", label: "Camión", ayuda: "por ingreso", Icono: Truck },
  { valor: "ambulante", label: "Ambulante", ayuda: "por día", Icono: Footprints },
  { valor: "quintero", label: "Quintero", ayuda: "por día", Icono: Tractor },
];

export function labelTipoCanon(tipo: TipoCanon): string {
  return TIPOS_CANON.find((t) => t.valor === tipo)?.label ?? tipo;
}

function soloDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Carga del canon del día en dos toques: qué entró (chip) y cuánto se cobró
 * (monto precargado con el precio configurado). Fecha = la de la caja, hoy
 * como máximo. Cada entrada es un ingreso (cantidad 1).
 */
export function FormCanon({
  cajaId,
  fechaCaja,
  precios,
}: {
  cajaId: string;
  /** Fecha de la caja que se está cargando (hoy, o la reabierta de otro día). */
  fechaCaja: string;
  precios: PreciosCanon;
}) {
  const hoy = hoyISO();
  const fechaInicial = fechaCaja <= hoy ? fechaCaja : hoy;
  const [tipo, setTipo] = useState<TipoCanon>("camion");
  const [fecha, setFecha] = useState(fechaInicial);
  const [monto, setMonto] = useState(precios.camion > 0 ? String(precios.camion) : "");
  const [transferencia, setTransferencia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function elegirTipo(t: TipoCanon) {
    setTipo(t);
    const precio = precios[t];
    setMonto(precio > 0 ? String(precio) : "");
    setError(null);
  }

  function reiniciar() {
    setMonto(precios[tipo] > 0 ? String(precios[tipo]) : "");
    setTransferencia(false);
    setError(null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const nMonto = Number(monto || 0);
    if (!fecha) {
      setError("Poné la fecha del canon.");
      return;
    }
    if (fecha > hoy) {
      setError("La fecha no puede ser futura.");
      return;
    }
    if (nMonto <= 0) {
      setError("Poné el monto cobrado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cargarCanon({
        cajaId,
        tipo,
        fecha,
        monto: nMonto,
        medio: transferencia ? "transferencia" : "efectivo",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Canon cargado: ${labelTipoCanon(tipo)} por ${formatARS(nMonto)}.`);
      reiniciar();
    });
  }

  const precioActual = precios[tipo];

  return (
    <form
      onSubmit={enviar}
      className="space-y-4 rounded-lg border border-dashed p-4"
    >
      <div className="space-y-2">
        <Label className="text-base font-medium">¿Qué entró?</Label>
        <div role="radiogroup" aria-label="Tipo de canon" className="grid grid-cols-3 gap-2">
          {TIPOS_CANON.map(({ valor, label, ayuda, Icono }) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={tipo === valor}
              onClick={() => elegirTipo(valor)}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                tipo === valor
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Icono className="size-5" strokeWidth={2} />
              <span>{label}</span>
              <span
                className={cn(
                  "text-xs tabular",
                  tipo === valor ? "text-primary/80" : "text-muted-foreground"
                )}
              >
                {precios[valor] > 0 ? `${formatARS(precios[valor])} ${ayuda}` : ayuda}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="canon-fecha" className="text-base font-medium">
            Fecha
          </Label>
          <Input
            id="canon-fecha"
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => {
              setFecha(e.target.value);
              setError(null);
            }}
            className="h-12 text-base md:text-base tabular"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="canon-monto" className="text-base font-medium">
            Monto
          </Label>
          <Input
            id="canon-monto"
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              setMonto(soloDigitos(e.target.value));
              setError(null);
            }}
            placeholder="0"
            aria-invalid={Boolean(error && Number(monto || 0) <= 0)}
            className="h-12 text-lg font-semibold md:text-lg tabular"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={enviando}
          className="h-12 px-6 text-base font-semibold"
        >
          {enviando ? (
            <Spinner className="size-5" />
          ) : (
            <Truck className="size-5" strokeWidth={2} />
          )}
          Cargar canon
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {Number(monto || 0) > 0 ? (
              <>
                Vas a cargar {formatARS(Number(monto))} de{" "}
                {labelTipoCanon(tipo).toLowerCase()}
                {transferencia ? " por transferencia" : " en efectivo"}.
              </>
            ) : precioActual > 0 ? (
              <>
                El canon de {labelTipoCanon(tipo).toLowerCase()} es{" "}
                {formatARS(precioActual)}.
              </>
            ) : (
              <>Sin precio configurado: poné el monto cobrado.</>
            )}
          </p>
        )}
        <div className="flex min-h-11 items-center gap-3">
          <Label htmlFor="canon-transferencia" className="text-sm font-medium">
            Fue por transferencia
          </Label>
          <Switch
            id="canon-transferencia"
            checked={transferencia}
            onCheckedChange={setTransferencia}
          />
        </div>
      </div>
    </form>
  );
}
