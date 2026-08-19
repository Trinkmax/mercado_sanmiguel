"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Stamp } from "lucide-react";
import { validarComprobanteGasto } from "@/lib/actions/tesoreria";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Botón "Validar comprobante": tesorería da el OK a la factura de un gasto pagado. */
export function ValidarComprobanteGasto({
  id,
  descripcion,
}: {
  id: string;
  descripcion: string;
}) {
  const [pendiente, startTransition] = useTransition();

  function validar() {
    startTransition(async () => {
      const res = await validarComprobanteGasto(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Comprobante validado.");
    });
  }

  return (
    <Button
      className="min-h-11 px-4 font-semibold"
      disabled={pendiente}
      onClick={validar}
      aria-label={`Validar comprobante: ${descripcion}`}
    >
      {pendiente ? <Spinner className="size-4" /> : <Stamp className="size-4" strokeWidth={2} />}
      Validar comprobante
    </Button>
  );
}
