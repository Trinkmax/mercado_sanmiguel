"use client";

import { useTransition } from "react";
import { CajaRegistradora } from "@/components/shared/iconos";
import { toast } from "sonner";
import { abrirCaja } from "@/lib/actions/cajas";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Enums } from "@/lib/database.types";
import { llamarAccion } from "@/lib/llamar-accion";

/** Acción única de la pantalla cuando todavía no existe la caja de hoy. */
export function BotonAbrirCaja({ tipo }: { tipo: Enums<"tipo_caja"> }) {
  const [enviando, startTransition] = useTransition();

  function abrir() {
    startTransition(async () => {
      const res = await llamarAccion(() => abrirCaja(tipo));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        tipo === "guardia"
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
      className="h-13 px-8 text-base font-semibold"
      data-tour="caja-abrir"
    >
      {enviando ? <Spinner className="size-5" /> : <CajaRegistradora className="size-5" strokeWidth={2} />}
      {tipo === "guardia" ? "Abrir la caja de portería" : "Abrir caja"}
    </Button>
  );
}
