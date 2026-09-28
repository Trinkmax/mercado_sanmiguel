"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { borrarMovimiento } from "@/lib/actions/tesoreria";
import { formatMoneda, type Moneda } from "@/lib/format";
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

/** Borrar un movimiento (con confirmación). Si tiene comisión asociada, se borran los dos. */
export function BorrarMovimiento({
  id,
  descripcion,
  monto,
  moneda,
  enGrupo,
}: {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  /** Depósito + su comisión (mismo grupo): se borran juntos. */
  enGrupo: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await borrarMovimiento(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      toast.success(
        res.data.borrados > 1
          ? `Borraste ${descripcion} y su comisión.`
          : `Borraste ${descripcion}.`
      );
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !pendiente && setAbierto(v)}>
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">¿Borrar este movimiento?</DialogTitle>
          <DialogDescription className="text-base">
            {descripcion} · {formatMoneda(Math.abs(monto), moneda)}.
            {enGrupo ? " También se borra la comisión que va con este depósito." : ""} El flujo
            se recalcula solo.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm font-medium text-pendiente">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-12 px-5 text-base">
              No, volver
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={pendiente}
            className="h-12 px-5 text-base font-semibold"
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            Borrar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
