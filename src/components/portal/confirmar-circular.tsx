"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmarRecepcionCircular } from "@/lib/actions/circulares";
import { Spinner } from "@/components/ui/spinner";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/** Botón grande "Confirmo que la recibí" (circulares obligatorias, portal del socio). */
export function ConfirmarCircular({ circularId, numero }: { circularId: string; numero: number }) {
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
    <div className="flex flex-col gap-3">
      {error ? <AvisoError mensaje={error} /> : null}
      <button
        type="button"
        data-tour="socio-comunicaciones-confirmar"
        className="boton boton-primario min-h-[3.8rem] w-full"
        disabled={pendiente}
        onClick={confirmar}
      >
        {pendiente ? <Spinner className="size-5" /> : <CheckCircle2 aria-hidden strokeWidth={2.3} />}
        Confirmo que la recibí
      </button>
    </div>
  );
}
