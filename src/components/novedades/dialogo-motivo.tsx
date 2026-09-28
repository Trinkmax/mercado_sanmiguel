"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AlertaError } from "@/components/cobranza/alerta-error";

/**
 * Diálogo corto para lo que necesita un motivo (rechazar, anular) o una confirmación
 * (borrar). `onConfirmar` devuelve un error para mostrar inline, o null si salió bien.
 */
export function DialogoMotivo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  conMotivo = true,
  placeholder,
  sugerencias,
  confirmar,
  destructiva = false,
  onConfirmar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion: string;
  conMotivo?: boolean;
  placeholder?: string;
  /** Chips que completan el motivo con un toque. */
  sugerencias?: string[];
  confirmar: string;
  destructiva?: boolean;
  onConfirmar: (motivo: string) => Promise<string | null>;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    if (pendiente) return;
    setMotivo("");
    setError(null);
    onCerrar();
  }

  function enviar() {
    const m = motivo.trim();
    if (conMotivo && !m) {
      setError("Contá el motivo: queda registrado y lo ve quien la cargó.");
      return;
    }
    startTransition(async () => {
      const err = await onConfirmar(m);
      if (err) {
        setError(err);
        return;
      }
      setMotivo("");
      setError(null);
    });
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{titulo}</DialogTitle>
          <DialogDescription className="text-sm">{descripcion}</DialogDescription>
        </DialogHeader>

        {conMotivo ? (
          <div className="space-y-2">
            <Label htmlFor="dialogo-motivo" className="text-base">
              Motivo
            </Label>
            {sugerencias?.length ? (
              <div className="flex flex-wrap gap-2">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setMotivo(s);
                      setError(null);
                    }}
                    className="inline-flex min-h-11 items-center rounded-full border bg-card px-4 text-sm font-medium hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              id="dialogo-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={placeholder}
              aria-invalid={Boolean(error)}
              className="min-h-24 text-base md:text-base"
              autoFocus
            />
          </div>
        ) : null}
        {error ? <AlertaError error={error} titulo={conMotivo && !motivo.trim() ? "Falta el motivo" : "No se pudo hacer"} /> : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-12" disabled={pendiente} onClick={cerrar}>
            Volver
          </Button>
          <Button
            size="lg"
            variant={destructiva ? "destructive" : "default"}
            className="h-12 font-semibold"
            disabled={pendiente}
            onClick={enviar}
          >
            {pendiente ? <Spinner /> : null}
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
