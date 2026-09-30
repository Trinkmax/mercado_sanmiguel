"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { adjuntarFacturaGasto } from "@/lib/actions/gastos";
import { formatARS } from "@/lib/format";
import { comprimirImagen } from "@/lib/imagen";
import { MIME_PERMITIDOS, TAMANO_MAX_SUBIDA } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  mensajePesoAdjunto,
} from "@/components/comunicaciones/adjuntos";

/**
 * Botón "Adjuntar factura" + subformulario corto para un gasto cargado sin
 * comprobante. Después tesorería la valida desde Tesorería. La foto se achica
 * antes de subirla (una foto de tablet pesa varios MB) y lo que se manda no puede pasar de
 * 4 MB (TAMANO_MAX_SUBIDA): un PDF más pesado se avisa al elegirlo.
 */
export function AdjuntarFactura({
  gasto,
}: {
  gasto: { id: string; etiqueta: string; monto: number };
}) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function elegir(f: File | null) {
    setError(null);
    if (f && !MIME_PERMITIDOS.includes(f.type)) {
      setArchivo(null);
      setError("La factura tiene que ser un PDF o una foto (JPG, PNG o WEBP). Elegí otro archivo.");
      return;
    }
    const pesado = errorPesoAdjunto(f);
    if (pesado) {
      setArchivo(null);
      setError(pesado);
      return;
    }
    setArchivo(f);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!archivo) {
      setError("Elegí el archivo de la factura (PDF o foto).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const chico = await comprimirImagen(archivo);
      if (chico.size > TAMANO_MAX_SUBIDA) {
        setError(mensajePesoAdjunto(chico.size));
        return;
      }
      const fd = new FormData();
      fd.set("id", gasto.id);
      fd.set("factura", chico, chico.name);
      const res = await llamarAccion(() => adjuntarFacturaGasto(fd));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Guardaste la factura de ${gasto.etiqueta}.`);
      setAbierto(false);
      setArchivo(null);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) {
          setArchivo(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 px-3 text-sm font-medium"
          aria-label={`Adjuntar factura: ${gasto.etiqueta}`}
          data-tour="gastos-adjuntar-factura"
        >
          <Paperclip className="size-4" strokeWidth={2} />
          Adjuntar factura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle>Adjuntar factura</DialogTitle>
          <DialogDescription className="break-words">
            {gasto.etiqueta} · {formatARS(gasto.monto)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`factura-${gasto.id}`} className="text-base">
              Factura <span className="font-normal text-muted-foreground">(PDF o foto)</span>
            </Label>
            <Input
              id={`factura-${gasto.id}`}
              name="factura"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="h-11 pt-2.5"
              onChange={(e) => elegir(e.target.files?.[0] ?? null)}
            />
            <p className="text-sm text-muted-foreground">
              {AYUDA_PESO_ADJUNTO} Después tesorería la revisa y la valida.
            </p>
          </div>
          {error ? <AlertaError error={error} titulo="No se pudo guardar la factura" /> : null}
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base font-semibold"
            disabled={pendiente || !archivo}
          >
            {pendiente ? <Spinner /> : null}
            Guardar factura
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
