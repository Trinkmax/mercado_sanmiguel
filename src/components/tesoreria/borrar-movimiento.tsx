"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { borrarMovimiento } from "@/lib/actions/tesoreria";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** Botón de borrado con confirmación para un movimiento bancario. Solo tesorería. */
export function BorrarMovimiento({
  id,
  descripcion,
  monto,
}: {
  id: string;
  descripcion: string;
  monto: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await borrarMovimiento(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Movimiento borrado.");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-muted-foreground hover:text-destructive"
          aria-label={`Borrar movimiento: ${descripcion}`}
        >
          <Trash2 className="size-5" strokeWidth={1.8} />
        </Button>
      </DialogTrigger>
      <DialogContent className="text-sm sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">¿Borrar este movimiento?</DialogTitle>
          <DialogDescription className="text-sm">
            {descripcion} · {formatARS(monto)}. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11 px-5 text-base">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={pendiente}
            className="h-11 px-6 text-base font-semibold"
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            Borrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
