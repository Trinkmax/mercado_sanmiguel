"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Undo2, UserCheck, UserMinus } from "lucide-react";
import { darDeBaja, reincorporar } from "@/lib/actions/personal";
import { formatFecha, hoyISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { sumarDias } from "@/components/novedades/constantes";
import { llamarAccion } from "@/lib/llamar-accion";

type ComoVuelve = "vuelve" | "error";

/**
 * Baja lógica del empleado (con fecha de egreso) o reincorporación. Al reincorporar se elige:
 * "Vuelve a trabajar desde [fecha]" (el tiempo afuera no cuenta en las planillas) o "Fue un
 * error, deshacer la baja" (como si nunca se hubiera ido).
 */
export function DarDeBaja({
  empleadoId,
  nombre,
  activo,
  fechaIngreso = null,
  fechaEgreso = null,
}: {
  empleadoId: string;
  nombre: string;
  activo: boolean;
  fechaIngreso?: string | null;
  fechaEgreso?: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const hoy = hoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [como, setComo] = useState<ComoVuelve | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const minimoVuelta = fechaEgreso ? sumarDias(fechaEgreso, 1) : undefined;

  function abrir(o: boolean) {
    if (pendiente) return;
    setAbierto(o);
    if (o) {
      setError(null);
      setComo(null);
      // Al reincorporar, la vuelta no puede ser antes del día siguiente al egreso. Al dar de
      // baja se propone hoy (un egreso futuro ya cargado, p. ej. fin de contrato, no corre la fecha).
      setFecha(!activo && minimoVuelta && minimoVuelta > hoy ? minimoVuelta : hoy);
    }
  }

  function confirmarBaja() {
    if (!fecha) {
      setError("Elegí la fecha de egreso.");
      return;
    }
    if (fechaIngreso && fecha < fechaIngreso) {
      setError(`La fecha de egreso no puede ser anterior al ingreso (${formatFecha(fechaIngreso)}).`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => darDeBaja({ id: empleadoId, fecha_egreso: fecha }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${nombre} dado de baja`);
      setAbierto(false);
      router.refresh();
    });
  }

  function confirmarAlta() {
    if (fechaEgreso && !como) {
      setError("Elegí una de las dos opciones.");
      return;
    }
    const desde = fechaEgreso && como === "vuelve" ? fecha : null;
    if (fechaEgreso && como === "vuelve") {
      if (!fecha) {
        setError("Elegí desde qué día vuelve a trabajar.");
        return;
      }
      if (minimoVuelta && fecha < minimoVuelta) {
        setError(`La vuelta tiene que ser después de la baja (${formatFecha(fechaEgreso)}).`);
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => reincorporar({ id: empleadoId, desde }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`${nombre} vuelve a estar activo`);
      setAbierto(false);
      router.refresh();
    });
  }

  if (!activo) {
    return (
      <Dialog open={abierto} onOpenChange={abrir}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="lg" className="h-12 px-5 text-base">
            <UserCheck className="size-5" strokeWidth={2} />
            Reincorporar
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Reincorporar a {nombre}</DialogTitle>
            <DialogDescription className="text-sm">
              {fechaEgreso
                ? `Está dado de baja desde el ${formatFecha(fechaEgreso)}. ¿Qué pasó?`
                : "Vuelve a figurar como activo y Portería lo encuentra de nuevo en el padrón."}
            </DialogDescription>
          </DialogHeader>

          {fechaEgreso ? (
            <div className="space-y-3" role="radiogroup" aria-label="Cómo vuelve">
              <Opcion
                activa={como === "vuelve"}
                onClick={() => {
                  setComo("vuelve");
                  setError(null);
                }}
                icono={<UserCheck className="size-5" strokeWidth={2} />}
                titulo="Vuelve a trabajar"
                detalle="El tiempo que estuvo afuera no cuenta en las planillas de novedades."
              />
              {como === "vuelve" ? (
                <div className="space-y-2 pl-1">
                  <Label htmlFor="fecha_vuelta" className="text-base">
                    ¿Desde qué día vuelve?
                  </Label>
                  <Input
                    id="fecha_vuelta"
                    type="date"
                    value={fecha}
                    min={minimoVuelta}
                    onChange={(e) => {
                      setFecha(e.target.value);
                      setError(null);
                    }}
                    className="h-12 max-w-xs text-base md:text-base"
                  />
                </div>
              ) : null}
              <Opcion
                activa={como === "error"}
                onClick={() => {
                  setComo("error");
                  setError(null);
                }}
                icono={<Undo2 className="size-5" strokeWidth={2} />}
                titulo="Fue un error: deshacer la baja"
                detalle="Queda como si nunca se hubiera ido."
              />
            </div>
          ) : null}

          {error ? <AlertaError error={error} titulo="No se pudo reincorporar" /> : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 px-5 text-base"
              onClick={() => abrir(false)}
              disabled={pendiente}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              onClick={confirmarAlta}
              disabled={pendiente}
            >
              {pendiente ? <Spinner className="size-5" /> : <UserCheck className="size-5" strokeWidth={2} />}
              Reincorporar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 px-5 text-base text-pendiente hover:text-pendiente"
        >
          <UserMinus className="size-5" strokeWidth={2} />
          Dar de baja
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Dar de baja a {nombre}</DialogTitle>
          <DialogDescription className="text-sm">
            Deja de figurar como activo y Portería ya no lo va a encontrar en el
            padrón. Sus ingresos anteriores se conservan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="fecha_egreso_baja" className="text-base">
            Fecha de egreso
          </Label>
          <Input
            id="fecha_egreso_baja"
            type="date"
            value={fecha}
            min={fechaIngreso ?? undefined}
            onChange={(e) => {
              setFecha(e.target.value);
              setError(null);
            }}
            className="h-12 text-base md:text-base"
          />
        </div>
        {error ? <AlertaError error={error} titulo="No se pudo dar de baja" /> : null}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => abrir(false)}
            disabled={pendiente}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmarBaja}
            disabled={pendiente}
          >
            {pendiente ? <Spinner className="size-5" /> : <UserMinus className="size-5" strokeWidth={2} />}
            Confirmar la baja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tarjeta de opción grande (radio) del diálogo de reincorporación. */
function Opcion({
  activa,
  onClick,
  icono,
  titulo,
  detalle,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cn(
        "flex min-h-16 w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        activa ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border bg-card hover:bg-accent/60"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
          activa ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {activa ? <Check className="size-4" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="flex items-center gap-2 font-semibold">
          {icono}
          {titulo}
        </span>
        <span className="block text-sm text-muted-foreground">{detalle}</span>
      </span>
    </button>
  );
}
