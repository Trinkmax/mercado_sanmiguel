"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmarRecepcionCircular } from "@/lib/actions/circulares";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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

  function confirmar() {
    startTransition(async () => {
      const res = await confirmarRecepcionCircular({ circularId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Listo: confirmaste la circular N° ${numero}. ¡Gracias!`);
      router.refresh();
    });
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
      Confirmo que la recibí
    </Button>
  );
}
