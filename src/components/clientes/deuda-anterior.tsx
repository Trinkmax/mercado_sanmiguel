"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FilePlus2 } from "lucide-react";
import { registrarDeudaAnterior } from "@/lib/actions/clientes";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

/**
 * Reconocimiento de deuda (RD): deuda anterior al sistema.
 * Queda exigible de inmediato y se cobra desde Cobranza como cualquier cargo.
 */
export function DeudaAnterior({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [pendiente, startTransition] = useTransition();

  const montoNumero = Number(monto.replace(/\./g, "").replace(",", "."));

  function guardar() {
    startTransition(async () => {
      const res = await registrarDeudaAnterior({
        clienteId,
        monto: montoNumero,
        detalle,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Deuda anterior registrada. Ya se puede cobrar.");
      setAbierto(false);
      setMonto("");
      setDetalle("");
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 text-base">
          <FilePlus2 className="size-5" strokeWidth={1.8} />
          Deuda anterior
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar deuda anterior</DialogTitle>
          <DialogDescription>
            Deuda de antes de usar el sistema (Reconocimiento de Deuda). Queda
            pendiente de cobro desde hoy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="rd-monto" className="text-base">
              ¿Cuánto debe?
            </Label>
            <Input
              id="rd-monto"
              inputMode="numeric"
              placeholder="0"
              className="h-12 text-lg tabular"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            {montoNumero > 0 ? (
              <p className="text-sm text-muted-foreground">
                Vas a registrar {formatARS(montoNumero)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rd-detalle" className="text-base">
              ¿De qué es la deuda?
            </Label>
            <Input
              id="rd-detalle"
              placeholder="Ej.: expensas de 2025"
              className="h-11"
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            size="lg"
            className="h-12 w-full font-semibold"
            disabled={pendiente || !(montoNumero > 0) || detalle.trim().length < 3}
            onClick={guardar}
          >
            {pendiente ? <Spinner /> : null}
            Registrar deuda de {montoNumero > 0 ? formatARS(montoNumero) : "…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
