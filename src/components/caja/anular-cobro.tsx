"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion, SIN_RESPUESTA } from "@/lib/llamar-accion";

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
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [enviando, startTransition] = useTransition();
  // Un intento anterior se quedó sin respuesta (corte de red): si ahora la base dice que ya
  // estaba anulado, fue ese intento el que lo anuló. No es un error para quien lo pidió.
  const huboCorte = useRef(false);

  function terminar() {
    huboCorte.current = false;
    setAbierto(false);
    setMotivo("");
    setError(null);
  }

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setFaltaMotivo(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => anularCobro(pagoId, limpio));
      if (!res.ok) {
        if (huboCorte.current && res.error.startsWith("El cobro ya está anulado")) {
          toast.info(`Ya había quedado anulado: ${cliente} vuelve a deber ${formatARS(total)}.`);
          terminar();
          router.refresh();
          return;
        }
        if (res.error === SIN_RESPUESTA) huboCorte.current = true;
        setError(res.error);
        return;
      }
      toast.success(`Recibo N° ${numero} anulado. ${cliente} vuelve a deber ${formatARS(total)}.`);
      terminar();
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
          setFaltaMotivo(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Anular el recibo N° ${numero}`}
        >
          <Ban className="size-4" strokeWidth={2} />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
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
                  setFaltaMotivo(false);
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
              setFaltaMotivo(false);
            }}
            placeholder="O escribilo con tus palabras"
            aria-invalid={faltaMotivo}
            className="min-h-20 text-base md:text-base"
          />
          {faltaMotivo ? (
            <p className="text-sm font-medium text-destructive">Contá por qué anulás el recibo.</p>
          ) : null}
          {error ? <AlertaError error={error} titulo="No se pudo anular" /> : null}
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
