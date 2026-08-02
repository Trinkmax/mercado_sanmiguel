"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { anularCobro } from "@/lib/actions/cajas";
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

/** Botón de anulación con motivo obligatorio. Solo se muestra con caja abierta. */
export function BotonAnularCobro({
  pagoId,
  numero,
  cliente,
  monto,
}: {
  pagoId: string;
  numero: number;
  cliente: string;
  monto: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("Contá por qué anulás el cobro.");
      return;
    }
    startTransition(async () => {
      const res = await anularCobro(pagoId, limpio);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cobro N° ${numero} anulado.`);
      setAbierto(false);
      setMotivo("");
      setError(null);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Anular cobro N° ${numero}`}
        >
          <Ban className="size-5" strokeWidth={2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Anular cobro</DialogTitle>
          <DialogDescription className="text-base">
            Recibo N° {numero} de {cliente} por {formatARS(monto)}. Se revierte
            lo imputado y el cliente vuelve a deber ese monto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`motivo-${pagoId}`} className="text-base">
            ¿Por qué lo anulás?
          </Label>
          <Textarea
            id={`motivo-${pagoId}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej.: se cargó dos veces"
            className="min-h-24 text-base md:text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
            Anular cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
