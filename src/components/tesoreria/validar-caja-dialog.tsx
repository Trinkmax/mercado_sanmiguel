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
import { Sello } from "@/components/shared/sello";

export type CajaParaValidar = {
  id: string;
  fecha: string;
  /** "Administración" | "Portería" */
  tipoLabel: string;
  cerradaPor: string;
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos: number;
  /** Solo caja de administración: rendiciones de portería integradas ese día. */
  rendidoEfectivo?: number;
  rendidoTransferencia?: number;
  /** Solo caja de portería ya integrada: fecha de la caja de administración que la absorbió. */
  integradaEnCajaDel?: string | null;
  /** Si hay un pedido de reapertura sin resolver, su motivo ("" si no lo dejaron); null si no hay pedido. */
  reaperturaMotivo?: string | null;
};

function FilaArqueo({ label, monto }: { label: string; monto: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-muted-foreground">{label}</span>
      <Money monto={monto} className="font-medium" />
    </div>
  );
}

/**
 * Botón "Validar" + diálogo de confirmación con el arqueo completo.
 * Validar es el cierre definitivo de la caja. Solo tesorería.
 */
export function ValidarCajaDialog({ caja }: { caja: CajaParaValidar }) {
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [pendiente, startTransition] = useTransition();

  const total = caja.efectivo + caja.transferencia + caja.cheques;
  const rendidoEfectivo = caja.rendidoEfectivo ?? 0;
  const rendidoTransferencia = caja.rendidoTransferencia ?? 0;
  const pideReapertura = typeof caja.reaperturaMotivo === "string";

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
      toast.success("Caja validada. El cierre es definitivo.");
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
            Cierre definitivo de la caja del {formatFecha(caja.fecha)}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {caja.tipoLabel} · La cerró {caja.cerradaPor}
          </DialogDescription>
        </DialogHeader>

        {caja.integradaEnCajaDel ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-accent px-3 py-2.5 text-accent-foreground">
            <Sello estado="integrada" />
            <span className="text-sm">
              Ya está en la caja de administración del{" "}
              {formatFecha(caja.integradaEnCajaDel)}: se valida junto con esa caja,
              pero también podés validarla ahora.
            </span>
          </div>
        ) : null}

        <div className="divide-y rounded-lg border px-4">
          <FilaArqueo label="Efectivo" monto={caja.efectivo} />
          {rendidoEfectivo > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span className="pl-4">Incluye rendido por portería</span>
              <Money monto={rendidoEfectivo} />
            </div>
          ) : null}
          <FilaArqueo label="Transferencias" monto={caja.transferencia} />
          {rendidoTransferencia > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span className="pl-4">Incluye rendido por portería</span>
              <Money monto={rendidoTransferencia} />
            </div>
          ) : null}
          <FilaArqueo label="Cheques" monto={caja.cheques} />
          {caja.canon > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span>Canon (ya incluido)</span>
              <Money monto={caja.canon} />
            </div>
          ) : null}
          {caja.gastos > 0 ? (
            <div className="flex items-baseline justify-between gap-4 py-2 text-muted-foreground">
              <span>Gastos pagados desde caja (ya restados)</span>
              <Money monto={-caja.gastos} />
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="font-semibold">Total de la caja</span>
            <Money monto={total} className="text-base font-bold" />
          </div>
        </div>

        {pideReapertura ? (
          <div className="space-y-1 rounded-md bg-parcial-suave px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Sello estado="reapertura_pedida" />
              <span className="font-medium text-parcial">
                Pidieron reabrir esta caja
              </span>
            </div>
            {caja.reaperturaMotivo ? (
              <p className="text-sm text-foreground/80">Motivo: {caja.reaperturaMotivo}</p>
            ) : null}
            <p className="text-sm text-foreground/80">
              Si la validás ahora, el pedido queda descartado.
            </p>
          </div>
        ) : null}

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
          Validar es el cierre definitivo: la caja ya no se puede reabrir y la
          responsabilidad pasa a tesorería.
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
            Confirmar cierre definitivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
