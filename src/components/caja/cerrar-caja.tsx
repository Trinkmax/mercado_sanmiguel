"use client";

import { useState, useTransition } from "react";
import { HandCoins, Lock } from "lucide-react";
import { toast } from "sonner";
import { cerrarCaja } from "@/lib/actions/cajas";
import { formatARS } from "@/lib/format";
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
 * `rinde`: la caja de portería no se "cierra", se rinde a administración.
 */
export function BotonCerrarCaja({
  cajaId,
  rinde = false,
}: {
  cajaId: string;
  rinde?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, startTransition] = useTransition();
  const Icono = rinde ? HandCoins : Lock;
  const verbo = rinde ? "Rendir caja" : "Cerrar caja";

  function confirmar() {
    startTransition(async () => {
      const res = await cerrarCaja(cajaId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        rinde
          ? `Caja rendida. Entregá ${formatARS(res.data.efectivo)} en efectivo a administración.`
          : "Caja cerrada. Arriba tenés el arqueo del día."
      );
      setAbierto(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5 sm:p-6">
      <div>
        <p className="text-lg font-semibold">¿Terminaste el día?</p>
        <p className="text-sm text-muted-foreground">
          {rinde
            ? "Rendí la caja y el sistema te dice cuánto efectivo entregar a administración."
            : "Cerrá la caja y el sistema te dice cuánto tenés que tener."}
        </p>
      </div>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger asChild>
          <Button size="lg" className="h-13 px-8 text-base font-semibold">
            <Icono className="size-5" strokeWidth={2} />
            {verbo}
          </Button>
        </DialogTrigger>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {rinde ? "Rendir la caja a administración" : "Cerrar la caja"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {rinde
                ? "Al rendir, el sistema te dice cuánto efectivo tenés que entregar. No se pueden cargar más cobros ni canon; si hubo un error, después podés pedir la reapertura."
                : "Al cerrar, el sistema te dice cuánto tenés que tener. No se pueden cargar más cobros."}
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
                <Icono className="size-5" strokeWidth={2} />
              )}
              {verbo}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
