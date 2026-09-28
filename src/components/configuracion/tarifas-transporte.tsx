"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Truck, X } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarActivoTarifaTransporte,
  guardarTarifaTransporte,
} from "@/lib/actions/porteria";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { Codigo } from "@/components/shared/codigo";
import { EmptyState } from "@/components/shared/empty-state";
import { DibujoTarifa } from "@/components/porteria/dibujo-tarifa";
import {
  ICONOS_TARIFA,
  LABEL_UNIDAD,
  type IconoTarifa,
  type TarifaTransporte,
  type UnidadTarifa,
} from "@/components/porteria/tarifas";
import { llamarAccion } from "@/lib/llamar-accion";

type Borrador = { nombre: string; precio: string; unidad: UnidadTarifa; icono: IconoTarifa };

function aBorrador(t: TarifaTransporte): Borrador {
  return { nombre: t.nombre, precio: String(Math.round(t.precio)), unidad: t.unidad, icono: t.icono };
}

const BORRADOR_NUEVO: Borrador = { nombre: "", precio: "", unidad: "vehiculo", icono: "camion" };

/**
 * Tarifas del canon de transporte (H1: "configurables; las edita el Líder"). La monta
 * Configuración (M8) en la pestaña `?tab=tarifas`. El Líder edita nombre, precio (con vista
 * previa), unidad, dibujo y si está activa; los demás la ven en lectura. Un precio nuevo rige
 * desde el próximo cobro: cada cobro guarda su copia del precio.
 */
export function TarifasTransporte({
  tarifas,
  puedeEditar,
}: {
  tarifas: TarifaTransporte[];
  puedeEditar: boolean;
}) {
  const [agregando, setAgregando] = useState(false);

  return (
    <Card id="tarifas-transporte" className="text-base">
      <CardHeader className="gap-1.5">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
          Tarifas de transporte <Codigo codigo="BC" />
        </CardTitle>
        <CardDescription className="text-sm">
          Lo que cobra Portería por cada vehículo que entra (bono camioneros).{" "}
          {puedeEditar
            ? "Un precio nuevo rige desde el próximo cobro: los cobros ya hechos no cambian."
            : "Las edita el Líder de Procesos."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tarifas.length === 0 && !agregando ? (
          <EmptyState
            icono={Truck}
            titulo="Todavía no hay tarifas"
            descripcion={
              puedeEditar
                ? "Agregá la primera (por ejemplo, Camioneta $6.000 por vehículo) para que Portería pueda cobrar."
                : "Pedile al Líder de Procesos que las cargue."
            }
          />
        ) : null}

        {puedeEditar ? (
          <div className="space-y-3">
            {tarifas.map((t) => (
              <FilaEditable key={t.id} tarifa={t} />
            ))}
            {agregando ? (
              <FilaEditable tarifa={null} onListo={() => setAgregando(false)} />
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 px-5 text-base font-semibold"
                onClick={() => setAgregando(true)}
              >
                <Plus className="size-5" strokeWidth={2} />
                Agregar tarifa
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tarifas.map((t) => {
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <DibujoTarifa icono={t.icono} className="size-7 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 font-semibold">{t.nombre}</span>
                  <span className="text-base">
                    <Money monto={t.precio} className="font-semibold" />{" "}
                    <span className="text-muted-foreground">{LABEL_UNIDAD[t.unidad]}</span>
                  </span>
                  <Sello estado={t.activo ? "activo" : "inactivo"} texto={t.activo ? "Se cobra" : "Pausada"} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Una tarifa editable (o el alta, con `tarifa = null`). */
function FilaEditable({
  tarifa,
  onListo,
}: {
  tarifa: TarifaTransporte | null;
  onListo?: () => void;
}) {
  const original = tarifa ? aBorrador(tarifa) : BORRADOR_NUEVO;
  const [b, setB] = useState<Borrador>(original);
  const [error, setError] = useState<string | null>(null);
  const [activo, setActivo] = useState(tarifa?.activo ?? true);
  const [guardando, startGuardar] = useTransition();
  const [cambiandoActivo, startActivo] = useTransition();
  const [iconosAbiertos, setIconosAbiertos] = useState(false);

  const precio = Number(b.precio || 0);
  const sucio =
    !tarifa ||
    b.nombre.trim() !== original.nombre ||
    b.precio !== original.precio ||
    b.unidad !== original.unidad ||
    b.icono !== original.icono;
  const problema = !b.nombre.trim()
    ? "Poné el nombre (ej.: Camioneta)."
    : precio <= 0
      ? "Poné el precio: sin precio Portería no la puede cobrar."
      : null;
  const idBase = tarifa?.id ?? "nueva";

  function cambiar(p: Partial<Borrador>) {
    setB((prev) => ({ ...prev, ...p }));
    setError(null);
  }

  function guardar() {
    if (problema) {
      setError(problema);
      return;
    }
    startGuardar(async () => {
      const res = await llamarAccion(() => guardarTarifaTransporte({
        id: tarifa?.id,
        nombre: b.nombre.trim(),
        precio,
        unidad: b.unidad,
        icono: b.icono,
      }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (tarifa) {
        toast.success("Tarifa guardada. Rige desde el próximo cobro.");
      } else {
        toast.success(`Tarifa ${b.nombre.trim()} agregada: Portería ya la ve.`);
        setB(BORRADOR_NUEVO);
        onListo?.();
      }
    });
  }

  function cambiarActivo(v: boolean) {
    if (!tarifa) return;
    const anterior = activo;
    setActivo(v);
    startActivo(async () => {
      const res = await llamarAccion(() => cambiarActivoTarifaTransporte({ id: tarifa.id, activo: v }));
      if (!res.ok) {
        setActivo(anterior);
        toast.error(res.error);
        return;
      }
      toast.success(
        v ? `${tarifa.nombre} se cobra de nuevo.` : `${tarifa.nombre} pausada: Portería ya no la ve.`
      );
    });
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3 sm:p-4",
        !tarifa && "border-dashed border-primary/50 bg-primary/[0.03]",
        tarifa && !activo && "bg-muted/40"
      )}
    >
      <div className="grid items-end gap-3 sm:grid-cols-[auto_minmax(0,1fr)_10rem] lg:grid-cols-[auto_minmax(0,1fr)_10rem_auto]">
        {/* Dibujo */}
        <Popover open={iconosAbiertos} onOpenChange={setIconosAbiertos}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-14 items-center justify-center rounded-lg border-2 border-border bg-card text-primary transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/40"
              aria-label={`Dibujo de la tarifa: ${ICONOS_TARIFA.find((i) => i.valor === b.icono)?.label ?? ""}. Tocá para cambiarlo`}
            >
              <DibujoTarifa icono={b.icono} className="size-8" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Elegí el dibujo">
              {ICONOS_TARIFA.map(({ valor, label, Icono: I }) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={b.icono === valor}
                  onClick={() => {
                    cambiar({ icono: valor });
                    setIconosAbiertos(false);
                  }}
                  className={cn(
                    "flex w-16 flex-col items-center gap-1 rounded-md border-2 px-1 py-2 text-[0.7rem] leading-tight font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    b.icono === valor ? "border-primary bg-primary/[0.06] text-primary" : "border-transparent hover:bg-muted"
                  )}
                >
                  <I className="size-7" strokeWidth={1.9} />
                  {label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Nombre */}
        <div className="space-y-1.5">
          <Label htmlFor={`tarifa-nombre-${idBase}`} className="text-sm">
            Nombre
          </Label>
          <Input
            id={`tarifa-nombre-${idBase}`}
            value={b.nombre}
            maxLength={40}
            onChange={(e) => cambiar({ nombre: e.target.value })}
            placeholder="Ej.: Camioneta"
            className="h-12 text-base font-semibold md:text-base"
          />
        </div>

        {/* Precio */}
        <div className="space-y-1.5">
          <Label htmlFor={`tarifa-precio-${idBase}`} className="text-sm">
            Precio
          </Label>
          <Input
            id={`tarifa-precio-${idBase}`}
            inputMode="numeric"
            value={b.precio}
            onChange={(e) => cambiar({ precio: e.target.value.replace(/\D/g, "").slice(0, 9) })}
            placeholder="0"
            aria-describedby={`tarifa-precio-ayuda-${idBase}`}
            className="h-12 text-lg font-semibold tabular md:text-lg"
          />
        </div>

        {/* Unidad */}
        <div className="space-y-1.5 sm:col-span-3 lg:col-span-1">
          <p className="text-sm font-medium" id={`tarifa-unidad-${idBase}`}>
            Se cobra
          </p>
          <div role="radiogroup" aria-labelledby={`tarifa-unidad-${idBase}`} className="grid grid-cols-2 gap-1.5">
            {(["vehiculo", "dia"] as UnidadTarifa[]).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={b.unidad === u}
                onClick={() => cambiar({ unidad: u })}
                className={cn(
                  "h-12 rounded-lg border-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  b.unidad === u
                    ? "border-primary bg-primary/[0.08] text-primary"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                {LABEL_UNIDAD[u]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={`tarifa-precio-ayuda-${idBase}`} className="text-sm text-muted-foreground">
          {precio > 0 ? (
            <>
              Portería va a cobrar{" "}
              <span className="font-semibold text-foreground tabular">{formatARS(precio)}</span>{" "}
              {LABEL_UNIDAD[b.unidad]}
              {b.unidad === "dia" ? ` (3 días = ${formatARS(precio * 3)})` : ` (2 vehículos = ${formatARS(precio * 2)})`}.
            </>
          ) : (
            "Sin precio, Portería no la puede cobrar."
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {tarifa ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-medium">
              <Switch
                checked={activo}
                onCheckedChange={cambiarActivo}
                disabled={cambiandoActivo}
                aria-label={activo ? `Pausar ${tarifa.nombre}` : `Volver a cobrar ${tarifa.nombre}`}
              />
              {activo ? "Se cobra" : "Pausada"}
            </label>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11 px-3 text-sm"
              onClick={() => onListo?.()}
              disabled={guardando}
            >
              <X className="size-4" strokeWidth={2} />
              Cancelar
            </Button>
          )}
          {sucio ? (
            <Button
              type="button"
              size="lg"
              className="h-11 px-4 text-sm font-semibold"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? <Spinner className="size-4" /> : tarifa ? <Save className="size-4" strokeWidth={2} /> : <Plus className="size-4" strokeWidth={2} />}
              {tarifa ? "Guardar cambios" : "Agregar tarifa"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
