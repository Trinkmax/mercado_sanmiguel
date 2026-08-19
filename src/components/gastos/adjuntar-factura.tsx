"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { adjuntarFacturaGasto } from "@/lib/actions/gastos";
import { formatARS } from "@/lib/format";
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

/**
 * Botón "Adjuntar factura" + subformulario corto para un gasto cargado sin
 * comprobante. Después tesorería la valida desde Tesorería.
 */
export function AdjuntarFactura({
  gasto,
}: {
  gasto: { id: string; descripcion: string; monto: number };
}) {
  const [abierto, setAbierto] = useState(false);
  const [tieneArchivo, setTieneArchivo] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", gasto.id);
    startTransition(async () => {
      const res = await adjuntarFacturaGasto(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Factura adjuntada.");
      setAbierto(false);
      setTieneArchivo(false);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setTieneArchivo(false);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-3 font-medium"
          aria-label={`Adjuntar factura: ${gasto.descripcion}`}
        >
          <Paperclip className="size-4" strokeWidth={2} />
          Adjuntar factura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjuntar factura</DialogTitle>
          <DialogDescription>
            {gasto.descripcion} · {formatARS(gasto.monto)}
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
              onChange={(e) => setTieneArchivo((e.target.files?.length ?? 0) > 0)}
              required
            />
            <p className="text-sm text-muted-foreground">
              Hasta 20 MB. Después tesorería la revisa y la valida.
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full text-base font-semibold"
            disabled={pendiente || !tieneArchivo}
          >
            {pendiente ? <Spinner /> : null}
            Guardar factura
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
