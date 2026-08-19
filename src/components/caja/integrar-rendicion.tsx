"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { integrarCajaPorteria } from "@/lib/actions/cajas";
import { formatARS, formatFecha } from "@/lib/format";
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
import { Money } from "@/components/shared/money";

/**
 * Administración recibe la plata de portería y la integra en la caja mayor.
 * Confirmación con el detalle de lo que se recibe y observaciones opcionales.
 */
export function BotonIntegrarRendicion({
  cajaId,
  fecha,
  efectivo,
  transferencia,
  canon,
  cheques,
}: {
  cajaId: string;
  fecha: string;
  efectivo: number;
  transferencia: number;
  canon: number;
  cheques: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await integrarCajaPorteria(cajaId, observaciones.trim() || undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Rendición del ${formatFecha(fecha)} recibida: ${formatARS(res.data.efectivo)} en efectivo ya están en la caja mayor.`
      );
      setAbierto(false);
      setObservaciones("");
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setObservaciones("");
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 px-5 text-base font-semibold">
          <ArrowDownToLine className="size-5" strokeWidth={2} />
          Recibir e integrar a la caja mayor
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Recibir la rendición del {formatFecha(fecha)}
          </DialogTitle>
          <DialogDescription className="text-base">
            Contá lo que te entrega portería y confirmá. Entra en tu caja de
            hoy y tesorería lo valida todo junto.
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-md border text-base">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="font-medium">Efectivo a recibir</dt>
            <dd>
              <Money monto={efectivo} className="text-xl font-bold" />
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">Transferencias</dt>
            <dd>
              <Money monto={transferencia} className="font-semibold" />
            </dd>
          </div>
          {cheques > 0 ? (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">Cheques</dt>
              <dd>
                <Money monto={cheques} className="font-semibold" />
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <dt className="text-muted-foreground">Incluye canon del día</dt>
            <dd>
              <Money monto={canon} className="font-semibold" />
            </dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor={`obs-${cajaId}`} className="text-base">
            Observaciones{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id={`obs-${cajaId}`}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej.: faltaban $ 500, se repone mañana"
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
              <ArrowDownToLine className="size-5" strokeWidth={2} />
            )}
            Recibí {formatARS(efectivo)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
