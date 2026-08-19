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
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await desactivarCircular({ id });
      if (!res.ok) {
        toast.error(res.error);
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
        onClick={() => setAbierto(true)}
      >
        <BellOff className="size-4" strokeWidth={2} />
        Desactivar
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              ¿Desactivar la circular N° {numero}?
            </DialogTitle>
            <DialogDescription className="text-sm">
              &ldquo;{titulo}&rdquo; deja de mostrarse en el portal y ya no le
              pide confirmación a nadie. Las confirmaciones que ya hubo quedan
              guardadas.
            </DialogDescription>
          </DialogHeader>
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
