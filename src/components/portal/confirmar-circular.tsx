"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmarRecepcionCircular } from "@/lib/actions/circulares";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Botón grande "Confirmo que recibí esta circular" (portal del socio). */
export function ConfirmarCircular({
  circularId,
  numero,
  variante = "obligatoria",
}: {
  circularId: string;
  numero: number;
  /** "leida": circular informativa — botón chico "Marcar como leída". */
  variante?: "obligatoria" | "leida";
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await confirmarRecepcionCircular({ circularId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        variante === "leida"
          ? `Circular N° ${numero} marcada como leída.`
          : `Circular N° ${numero} confirmada. ¡Gracias!`
      );
      router.refresh();
    });
  }

  if (variante === "leida") {
    return (
      <Button
        variant="outline"
        className="mt-1 min-h-11 px-5"
        disabled={pendiente}
        onClick={confirmar}
      >
        {pendiente ? (
          <Spinner className="size-4" />
        ) : (
          <CheckCircle2 className="size-4" strokeWidth={2} />
        )}
        Marcar como leída
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="h-14 w-full text-base font-semibold"
      disabled={pendiente}
      onClick={confirmar}
    >
      {pendiente ? (
        <Spinner className="size-5" />
      ) : (
        <CheckCircle2 className="size-5" strokeWidth={2} />
      )}
      Confirmo que recibí esta circular
    </Button>
  );
}
