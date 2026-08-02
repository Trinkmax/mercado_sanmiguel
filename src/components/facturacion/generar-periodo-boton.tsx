"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { generarPeriodo } from "@/lib/actions/facturacion";
import { formatARS, formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Botón primario de Facturación: confirma y dispara la generación del mes. */
export function GenerarPeriodoBoton({
  periodo,
  label,
  cargosEstimados,
  totalEstimado,
}: {
  periodo: string;
  label: string;
  cargosEstimados: number;
  totalEstimado: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await generarPeriodo({ periodo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAbierto(false);
      toast.success(
        `Listo: se generaron ${formatNumero(res.data.cargos)} cargos y ${formatNumero(res.data.energia)} de energía para ${label}.`
      );
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (!pendiente) setAbierto(v);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="h-13 w-full px-6 text-base font-semibold sm:w-auto">
          <CalendarCheck className="size-5" strokeWidth={2} />
          Generar {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">¿Generar {label}?</DialogTitle>
          <DialogDescription className="text-sm/relaxed">
            Se van a crear aprox. {formatNumero(cargosEstimados)} cargos por{" "}
            {formatARS(totalEstimado)}. Esto se hace una vez por mes. Quedate
            tranquilo: si se corre dos veces, no se duplica nada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={confirmar}
            disabled={pendiente}
            className="h-12 px-5 text-base font-semibold"
          >
            {pendiente ? (
              <Spinner className="size-5" />
            ) : (
              <CalendarCheck className="size-5" strokeWidth={2} />
            )}
            Sí, generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
