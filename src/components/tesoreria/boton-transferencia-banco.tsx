"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import {
  conciliarCanon,
  conciliarGastos,
  conciliarIngresos,
  conciliarTransferencias,
  desconciliarCanon,
  desconciliarGasto,
  desconciliarIngreso,
  desconciliarTransferencia,
} from "@/lib/actions/tesoreria";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { llamarAccion } from "@/lib/llamar-accion";

export type ClaseTransferencia = "cobro" | "canon" | "ingreso" | "gasto";

const CONCILIAR = {
  cobro: conciliarTransferencias,
  canon: conciliarCanon,
  ingreso: conciliarIngresos,
  gasto: conciliarGastos,
} as const;

const DESCONCILIAR = {
  cobro: desconciliarTransferencia,
  canon: desconciliarCanon,
  ingreso: desconciliarIngreso,
  gasto: desconciliarGasto,
} as const;

/**
 * "Está en el banco" de UNA transferencia (un cobro, un bono camioneros, una venta sin cliente o un gasto pagado
 * por banco), o "Deshacer" si ya estaba marcada. Es la misma marca de Tesorería →
 * Conciliar: se usa también en la caja del día (Tesorería y el Líder).
 */
export function BotonTransferenciaBanco({
  clase,
  id,
  conciliada,
  nombre,
}: {
  clase: ClaseTransferencia;
  id: string;
  conciliada: boolean;
  /** Para el lector de pantalla y el aviso: "Recibo N° 12", "Luz de septiembre". */
  nombre: string;
}) {
  const [pendiente, startTransition] = useTransition();

  function marcar() {
    startTransition(async () => {
      const res = await llamarAccion(() => CONCILIAR[clase]([id]));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombre}: conciliada con el banco.`);
    });
  }

  function deshacer() {
    startTransition(async () => {
      const res = await llamarAccion(() => DESCONCILIAR[clase](id));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${nombre}: vuelve a "sin conciliar".`);
    });
  }

  if (conciliada) {
    return (
      <Button
        variant="ghost"
        className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
        disabled={pendiente}
        onClick={deshacer}
        aria-label={`Deshacer la conciliación: ${nombre}`}
      >
        {pendiente ? <Spinner className="size-4" /> : <Undo2 className="size-4" strokeWidth={2} />}
        Deshacer
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="h-11 px-4 text-sm font-semibold"
      disabled={pendiente}
      onClick={marcar}
      aria-label={`Está en el banco: ${nombre}`}
    >
      {pendiente ? <Spinner className="size-4" /> : <Check className="size-4" strokeWidth={2.2} />}
      Está en el banco
    </Button>
  );
}
