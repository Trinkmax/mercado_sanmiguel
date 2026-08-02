"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { cerrarCaja } from "@/lib/actions/cajas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/**
 * Acción primaria del final del día. Confirma en un diálogo y al cerrar
 * la página se refresca sola mostrando el arqueo.
 */
export function BotonCerrarCaja({ cajaId }: { cajaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await cerrarCaja(cajaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Caja cerrada. Arriba tenés el arqueo del día.");
      setAbierto(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5 sm:p-6">
      <div>
        <p className="text-lg font-semibold">¿Terminaste el día?</p>
        <p className="text-sm text-muted-foreground">
          Cerrá la caja y el sistema te dice cuánto tenés que tener.
        </p>
      </div>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger asChild>
          <Button size="lg" className="h-13 px-8 text-base font-semibold">
            <Lock className="size-5" strokeWidth={2} />
            Cerrar caja
          </Button>
        </DialogTrigger>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Cerrar la caja</DialogTitle>
            <DialogDescription className="text-base">
              Al cerrar, el sistema te dice cuánto tenés que tener. No se
              pueden cargar más cobros.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-5 text-base"
              onClick={() => setAbierto(false)}
              disabled={enviando}
            >
              Todavía no
            </Button>
            <Button
              size="lg"
              className="h-12 px-5 text-base font-semibold"
              onClick={confirmar}
              disabled={enviando}
            >
              {enviando ? (
                <Spinner className="size-5" />
              ) : (
                <Lock className="size-5" strokeWidth={2} />
              )}
              Cerrar caja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
