"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleAlert, FilePlus2 } from "lucide-react";
import { registrarDeudaAnterior } from "@/lib/actions/clientes";
import { formatARS, formatFecha, labelPeriodo } from "@/lib/format";
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
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion, SIN_RESPUESTA } from "@/lib/llamar-accion";

/**
 * Reconocimiento de deuda (RD): deuda anterior al sistema.
 * Se registra con la fecha de la deuda: queda en el período de ese mes y
 * vence ese día (si ya pasó, nace vencida). Se cobra desde Cobranza como
 * cualquier cargo.
 */
export function DeudaAnterior({
  clienteId,
  fechaHoy,
}: {
  clienteId: string;
  /** Hoy en huso argentino ("YYYY-MM-DD"), calculado en el server. */
  fechaHoy: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState(fechaHoy);
  const [tocoFecha, setTocoFecha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const montoNumero = Number(monto.replace(/\./g, "").replace(",", "."));
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= fechaHoy;
  const errorFecha = !fecha
    ? "Poné de qué fecha es la deuda"
    : fecha > fechaHoy
      ? "La fecha no puede ser futura"
      : null;
  const yaVencida = fechaValida && fecha < fechaHoy;

  function limpiar() {
    setMonto("");
    setDetalle("");
    setFecha(fechaHoy);
    setTocoFecha(false);
    setError(null);
  }

  function guardar() {
    setTocoFecha(true);
    if (!fechaValida) return;
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => registrarDeudaAnterior({
        clienteId,
        monto: montoNumero,
        detalle,
        fecha,
      }));
      if (!res.ok) {
        // Lo cargado queda en el diálogo. Sin respuesta no sabemos si se registró: que se fije
        // antes de repetirla (si quedó dos veces, se anula desde la cuenta).
        setError(
          res.error === SIN_RESPUESTA
            ? "Se cortó la conexión y no sabemos si se registró. Cerrá esta ventana y fijate en la cuenta antes de cargarla de nuevo; si quedó dos veces, anulá una."
            : res.error
        );
        return;
      }
      toast.success(
        yaVencida
          ? "Deuda anterior registrada como vencida. Ya se puede cobrar."
          : "Deuda anterior registrada. Ya se puede cobrar.",
        { description: "Si hubo un error, anulala desde la cuenta con “Anular (cargado por error)”." }
      );
      setAbierto(false);
      limpiar();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) limpiar();
      }}
    >
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
            en el mes de la fecha que pongas y se cobra como cualquier cargo.
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
          <div className="space-y-2">
            <Label htmlFor="rd-fecha" className="text-base">
              Fecha de la deuda
            </Label>
            <Input
              id="rd-fecha"
              type="date"
              max={fechaHoy}
              required
              className="h-12 text-base"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                setTocoFecha(true);
              }}
              onBlur={() => setTocoFecha(true)}
              aria-invalid={tocoFecha && !!errorFecha}
            />
            {tocoFecha && errorFecha ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-pendiente">
                <CircleAlert className="size-4 shrink-0" strokeWidth={2} />
                {errorFecha}
              </p>
            ) : fechaValida ? (
              <p className="text-sm text-muted-foreground">
                Queda en {labelPeriodo(`${fecha.slice(0, 7)}-01`)}
                {yaVencida
                  ? `, vencida desde el ${formatFecha(fecha)} (se cobra el importe completo).`
                  : ", vence hoy."}
              </p>
            ) : null}
          </div>
        </div>
        {error ? <AlertaError error={error} titulo="No se pudo registrar" /> : null}
        <DialogFooter>
          <Button
            size="lg"
            className="h-12 w-full font-semibold"
            disabled={
              pendiente ||
              !(montoNumero > 0) ||
              detalle.trim().length < 3 ||
              !fechaValida
            }
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
