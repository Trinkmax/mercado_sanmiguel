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
import { llamarAccion } from "@/lib/llamar-accion";

const ATAJOS = ["Se cargó dos veces", "Monto equivocado", "Cliente equivocado", "Medio de pago equivocado"];

/**
 * Anula un recibo COMPLETO (todas sus líneas: efectivo + transferencia + cheque),
 * con motivo obligatorio. El cliente vuelve a deber ese monto.
 */
export function BotonAnularCobro({
  pagoId,
  numero,
  cliente,
  total,
  medios,
}: {
  pagoId: string;
  numero: number;
  cliente: string;
  total: number;
  /** "efectivo + transferencia" */
  medios: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("Contá por qué anulás el recibo.");
      return;
    }
    startTransition(async () => {
      const res = await llamarAccion(() => anularCobro(pagoId, limpio));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Recibo N° ${numero} anulado. ${cliente} vuelve a deber ${formatARS(total)}.`);
      setAbierto(false);
      setMotivo("");
      setError(null);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (enviando) return;
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
          aria-label={`Anular el recibo N° ${numero}`}
        >
          <Ban className="size-5" strokeWidth={2} />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Anular el recibo N° {numero}</DialogTitle>
          <DialogDescription className="text-base">
            Se anula el recibo completo N° {numero} ({medios}) por {formatARS(total)}. Se revierte lo imputado
            y {cliente} vuelve a deber ese monto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor={`motivo-${pagoId}`} className="text-base">
            ¿Por qué lo anulás?
          </Label>
          <div className="flex flex-wrap gap-2">
            {ATAJOS.map((a) => (
              <Button
                key={a}
                type="button"
                variant={motivo === a ? "default" : "outline"}
                className="min-h-11 text-sm"
                onClick={() => {
                  setMotivo(a);
                  setError(null);
                }}
              >
                {a}
              </Button>
            ))}
          </div>
          <Textarea
            id={`motivo-${pagoId}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            placeholder="O escribilo con tus palabras"
            aria-invalid={Boolean(error)}
            className="min-h-20 text-base md:text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
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
            {enviando ? <Spinner className="size-5" /> : <Ban className="size-5" strokeWidth={2} />}
            Anular recibo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
