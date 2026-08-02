"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Stamp } from "lucide-react";
import { validarCaja } from "@/lib/actions/tesoreria";
import { formatFecha } from "@/lib/format";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";

export type CajaParaValidar = {
  id: string;
  fecha: string;
  tipoLabel: string;
  cerradaPor: string;
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos: number;
};

function FilaArqueo({ label, monto }: { label: string; monto: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <Money monto={monto} className="font-medium" />
    </div>
  );
}

/** Botón "Validar" + diálogo de confirmación con el arqueo completo. Solo tesorería. */
export function ValidarCajaDialog({ caja }: { caja: CajaParaValidar }) {
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [pendiente, startTransition] = useTransition();

  const total = caja.efectivo + caja.transferencia + caja.cheques;

  function confirmar() {
    startTransition(async () => {
      const res = await validarCaja(
        caja.id,
        observaciones.trim() || undefined
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Caja validada. La responsabilidad pasó a tesorería.");
      setObservaciones("");
      setAbierto(false);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 px-6 text-base font-semibold">
          <Stamp className="size-5" strokeWidth={2} />
          Validar
        </Button>
      </DialogTrigger>
      <DialogContent className="text-sm sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Validar caja del {formatFecha(caja.fecha)}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {caja.tipoLabel} · La cerró {caja.cerradaPor}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y rounded-lg border px-4">
          <FilaArqueo label="Efectivo" monto={caja.efectivo} />
          <FilaArqueo label="Transferencias" monto={caja.transferencia} />
          <FilaArqueo label="Cheques" monto={caja.cheques} />
          {caja.canon > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span>Canon camiones (ya incluido)</span>
              <Money monto={caja.canon} />
            </div>
          ) : null}
          {caja.gastos > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span>Gastos pagados desde caja (ya descontados)</span>
              <Money monto={-caja.gastos} />
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="font-semibold">Total de la caja</span>
            <Money monto={total} className="text-base font-bold" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`obs-${caja.id}`} className="text-sm">
            Observaciones (opcional)
          </Label>
          <Textarea
            id={`obs-${caja.id}`}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Por ejemplo: faltó un comprobante de transferencia"
            className="min-h-20 text-base"
            maxLength={500}
          />
        </div>

        <p className="rounded-md bg-parcial-suave px-3 py-2.5 font-medium text-parcial">
          Al validar, la responsabilidad pasa a tesorería.
        </p>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-11 px-5 text-base">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={confirmar}
            disabled={pendiente}
            className="h-11 px-6 text-base font-semibold"
          >
            {pendiente ? <Spinner className="size-5" /> : null}
            Validar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
