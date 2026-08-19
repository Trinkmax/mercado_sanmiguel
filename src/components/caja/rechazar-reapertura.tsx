"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { rechazarReaperturaCaja } from "@/lib/actions/cajas";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/** Rechaza un pedido de reapertura; el motivo es opcional y queda en la bitácora. */
export function BotonRechazarReapertura({
  cajaId,
  descripcion,
}: {
  cajaId: string;
  descripcion: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await rechazarReaperturaCaja(cajaId, motivo.trim() || undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pedido de reapertura rechazado. La caja sigue cerrada.");
      setAbierto(false);
      setMotivo("");
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setMotivo("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-5 text-base">
          <Ban className="size-5" strokeWidth={2} />
          Rechazar
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Rechazar el pedido de reapertura</DialogTitle>
          <DialogDescription className="text-base">{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`rechazo-${cajaId}`} className="text-base">
            Motivo{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id={`rechazo-${cajaId}`}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: ya está en la caja mayor, lo corregimos mañana"
            className="min-h-20 text-base md:text-base"
          />
        </div>
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
              <Ban className="size-5" strokeWidth={2} />
            )}
            Rechazar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
