"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmarRecepcionCircular } from "@/lib/actions/circulares";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/** Botón grande "Confirmo que la recibí" (circulares obligatorias, portal del socio). */
export function ConfirmarCircular({
  circularId,
  numero,
}: {
  circularId: string;
  numero: number;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => confirmarRecepcionCircular({ circularId }));
      if (!res.ok) {
        // Queda a la vista (un toast se va solo). Confirmar dos veces no duplica nada.
        setError(res.error);
        return;
      }
      toast.success(`Listo: confirmaste la circular N° ${numero}. ¡Gracias!`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error ? <AvisoError mensaje={error} /> : null}
      <Button
        size="lg"
        data-tour="socio-comunicaciones-confirmar"
        className="h-14 w-full text-base font-semibold"
        disabled={pendiente}
        onClick={confirmar}
      >
        {pendiente ? (
          <Spinner className="size-5" />
        ) : (
          <CheckCircle2 className="size-5" strokeWidth={2} />
        )}
        Confirmo que la recibí
      </Button>
    </div>
  );
}
