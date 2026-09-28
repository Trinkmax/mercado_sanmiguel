"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellOff } from "lucide-react";
import { desactivarCircular } from "@/lib/actions/circulares";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { llamarAccion } from "@/lib/llamar-accion";
import { AvisoError } from "./aviso-error";

/** Da de baja una circular (deja de verse y de bloquear en el portal). */
export function DesactivarCircular({
  id,
  numero,
  titulo,
}: {
  id: string;
  numero: number;
  titulo: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => desactivarCircular({ id }));
      if (!res.ok) {
        // Queda a la vista dentro del cartel (un toast se va solo). Repetirlo no hace daño.
        setError(res.error);
        return;
      }
      toast.success(`Circular N° ${numero} desactivada`);
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="min-h-11 text-destructive hover:text-destructive"
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
      >
        <BellOff className="size-4" strokeWidth={2} />
        Desactivar
      </Button>
      <Dialog open={abierto} onOpenChange={(v) => !pendiente && setAbierto(v)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            {/* pr-8: el título no pasa por debajo de la X de cerrar. */}
            <DialogTitle className="pr-8 text-lg">¿Desactivar la circular N° {numero}?</DialogTitle>
            <DialogDescription className="text-sm break-words">
              &ldquo;{titulo}&rdquo; deja de mostrarse en el portal y ya no le pide confirmación a
              nadie. Las lecturas y confirmaciones que ya hubo quedan guardadas.
            </DialogDescription>
          </DialogHeader>
          {error ? <AvisoError mensaje={error} /> : null}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-12"
              disabled={pendiente}
              onClick={() => setAbierto(false)}
            >
              No, volver
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="h-12 font-semibold"
              disabled={pendiente}
              onClick={confirmar}
            >
              {pendiente ? <Spinner /> : null}
              Desactivar circular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
