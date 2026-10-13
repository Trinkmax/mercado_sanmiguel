"use client";

import { useTransition } from "react";
import { CajaRegistradora } from "@/components/shared/iconos";
import { toast } from "sonner";
import { abrirCaja } from "@/lib/actions/cajas";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Enums } from "@/lib/database.types";
import { formatFecha } from "@/lib/format";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Acción única de la pantalla cuando todavía no existe la caja: la de hoy o, con `fecha`, la
 * de un día anterior (carga atrasada).
 */
export function BotonAbrirCaja({ tipo, fecha }: { tipo: Enums<"tipo_caja">; fecha?: string }) {
  const [enviando, startTransition] = useTransition();

  function abrir() {
    startTransition(async () => {
      const res = await llamarAccion(() => abrirCaja(tipo, fecha));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        fecha
          ? `Caja del ${formatFecha(fecha)} abierta. Ya podés cargar lo de ese día.`
          : tipo === "guardia"
            ? "Caja de portería abierta. Ya podés cobrar a quinteros y ambulantes."
            : "Caja abierta. Ya podés registrar cobros."
      );
    });
  }

  return (
    <Button
      size="lg"
      onClick={abrir}
      disabled={enviando}
      className="h-auto min-h-13 px-8 py-2 text-base font-semibold whitespace-normal"
      data-tour="caja-abrir"
    >
      {enviando ? <Spinner className="size-5" /> : <CajaRegistradora className="size-5" strokeWidth={2} />}
      {fecha
        ? `Abrir la caja${tipo === "guardia" ? " de portería" : ""} del ${formatFecha(fecha)}`
        : tipo === "guardia"
          ? "Abrir la caja de portería"
          : "Abrir caja"}
    </Button>
  );
}
