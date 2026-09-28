"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { anularMovimiento } from "@/lib/actions/tesoreria";
import { formatMoneda, type Moneda } from "@/lib/format";
import { cn } from "@/lib/utils";
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

const MOTIVOS = ["Se cargó dos veces", "El monto estaba mal", "Era de otra cuenta", "No pasó"];

/**
 * Anular un movimiento de Tesorería (con motivo). No se borra: queda tachado con quién
 * y por qué, deja de contar en el flujo y lo ve el Líder en Correcciones.
 * - Depósito con comisión: se anulan los dos (se avisa el monto de la comisión).
 * - La comisión de un depósito: se anula sola; el depósito queda.
 */
export function AnularMovimiento({
  id,
  descripcion,
  monto,
  moneda,
  comisionDelGrupo = null,
  esComisionDeDeposito = false,
}: {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  /** Depósito que tiene comisión (mismo grupo): monto de esa comisión. */
  comisionDelGrupo?: number | null;
  /** La fila es la comisión de un depósito. */
  esComisionDeDeposito?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => anularMovimiento({ id, motivo: motivo.trim() }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      toast.success(
        res.data.comision
          ? `Anulaste ${descripcion} y su comisión de ${formatMoneda(res.data.comision, moneda)}.`
          : `Anulaste ${descripcion}.`
      );
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (v) {
          setMotivo("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-1.5 px-3 text-sm text-muted-foreground hover:text-destructive"
          aria-label={`Anular movimiento: ${descripcion}`}
        >
          <Ban className="size-4" strokeWidth={2} />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">¿Anular este movimiento?</DialogTitle>
          <DialogDescription className="text-base break-words">
            {descripcion} · {formatMoneda(Math.abs(monto), moneda)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-lg bg-muted/60 px-4 py-3 text-sm">
          {comisionDelGrupo ? (
            <p className="font-medium">
              También se anula la comisión de {formatMoneda(comisionDelGrupo, moneda)} que va con
              este depósito.
            </p>
          ) : null}
          {esComisionDeDeposito ? (
            <p className="font-medium">Solo se anula esta comisión: el depósito queda como está.</p>
          ) : null}
          <p className="text-muted-foreground">
            No se borra: queda tachado en la lista con tu nombre y el motivo, y el flujo se
            recalcula solo.
          </p>
        </div>
        <div className="space-y-3">
          <Label htmlFor={`motivo-mov-${id}`} className="text-base">
            ¿Por qué lo anulás?
          </Label>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMotivo(m);
                  setError(null);
                }}
                aria-pressed={motivo === m}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium",
                  motivo === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea
            id={`motivo-mov-${id}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError(null);
            }}
            placeholder="O contalo con tus palabras"
            className="min-h-20 text-base"
            maxLength={300}
          />
        </div>
        {error ? <AlertaError error={error} titulo="No se pudo anular" /> : null}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-12 px-5 text-base"
            disabled={pendiente}
            onClick={() => setAbierto(false)}
          >
            No, volver
          </Button>
          <Button
            variant="destructive"
            onClick={confirmar}
            disabled={pendiente || motivo.trim().length < 3}
            className="h-12 px-5 text-base font-semibold"
          >
            {pendiente ? <Spinner className="size-5" /> : <Ban className="size-5" strokeWidth={2} />}
            Anular movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
