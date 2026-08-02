"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { borrarCanon } from "@/lib/actions/cajas";
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

/** Borra una entrada de canon (solo con la caja abierta). Pide confirmación. */
export function BotonBorrarCanon({
  id,
  cantidad,
  monto,
}: {
  id: string;
  cantidad: number;
  monto: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await borrarCanon(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrada de canon borrada.");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Borrar entrada de canon"
        >
          <Trash2 className="size-5" strokeWidth={2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Borrar entrada de canon</DialogTitle>
          <DialogDescription className="text-base">
            {cantidad} {cantidad === 1 ? "camión" : "camiones"} por{" "}
            {formatARS(monto)}. Se descuenta del total del día.
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
            Volver
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmar}
            disabled={enviando}
          >
            {enviando ? (
              <Spinner className="size-5" />
            ) : (
              <Trash2 className="size-5" strokeWidth={2} />
            )}
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
