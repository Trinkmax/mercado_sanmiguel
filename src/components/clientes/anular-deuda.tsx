"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CircleAlert } from "lucide-react";
import { anularCargoManual } from "@/lib/actions/clientes";
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * "Anular (cargado por error)" de una deuda anterior (RD) en la ficha: pide el motivo y
 * confirma, porque no se deshace. Queda "Anulado" con quién, cuándo y por qué
 * (anular_cargo_manual). Si ya se cobró en caja, la base pide anular primero ese cobro.
 */
export function AnularDeuda({
  cargoId,
  clienteId,
  descripcion,
  monto,
}: {
  cargoId: string;
  clienteId: string;
  descripcion: string;
  monto: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [toco, setToco] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const motivoOk = motivo.trim().length >= 3;

  function anular() {
    setToco(true);
    if (!motivoOk) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => anularCargoManual({ cargoId, clienteId, motivo }));
      if (!res.ok) {
        // Lo cargado queda en el diálogo: se puede reintentar (anular dos veces no hace nada).
        setError(res.error);
        return;
      }
      toast.success(
        res.data.repetido ? "Esa deuda ya estaba anulada." : `Deuda de ${formatARS(monto)} anulada.`,
        res.data.creditoDevuelto > 0
          ? { description: `Los ${formatARS(res.data.creditoDevuelto)} que la cubrían volvieron a su saldo a favor.` }
          : undefined
      );
      setAbierto(false);
      setMotivo("");
      setToco(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setToco(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="min-h-11 px-3 text-sm text-destructive hover:text-destructive">
          <Ban className="size-4" strokeWidth={2} />
          Anular (cargado por error)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">¿Anular esta deuda de {formatARS(monto)}?</DialogTitle>
          <DialogDescription className="text-base break-words">
            {descripcion}. Deja de sumar en su cuenta y queda anotado quién la anuló y por qué. No se
            puede deshacer: si hacía falta, cargala de nuevo con el monto correcto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`anular-${cargoId}`} className="text-base">
            ¿Por qué se anula?
          </Label>
          <Textarea
            id={`anular-${cargoId}`}
            rows={3}
            maxLength={300}
            placeholder="Ej.: se tipeó un cero de más"
            className="text-base"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setToco(true)}
            aria-invalid={toco && !motivoOk}
          />
          {toco && !motivoOk ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
              <CircleAlert className="size-4 shrink-0" strokeWidth={2} />
              Contá por qué se anula (queda en la cuenta del cliente).
            </p>
          ) : null}
        </div>
        {error ? <AlertaError error={error} titulo="No se pudo anular" /> : null}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-12 px-5 text-base"
            onClick={() => setAbierto(false)}
            disabled={pendiente}
          >
            No, dejarla
          </Button>
          <Button
            variant="destructive"
            className="h-12 px-5 text-base font-semibold"
            onClick={anular}
            disabled={pendiente}
          >
            {pendiente ? <Spinner className="size-5" /> : <Ban className="size-5" strokeWidth={2} />}
            Sí, anularla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
