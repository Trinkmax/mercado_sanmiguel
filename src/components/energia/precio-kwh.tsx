"use client";

import { useState, useTransition } from "react";
import { Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { formatARS } from "@/lib/format";
import { cambiarPrecioKwh } from "@/lib/actions/energia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sello } from "@/components/shared/sello";

/**
 * Precio vigente del kWh como dato grande, con edición en Dialog corto.
 * El precio nuevo vale para las próximas lecturas; las cargadas no cambian.
 * Si el que lo cambia no es el Líder, queda esperando aprobación y acá se ve
 * el precio propuesto junto al vigente.
 */
export function PrecioKwh({
  precio,
  propuesto = null,
  aplicaDirecto,
}: {
  precio: number;
  /** Precio que espera la aprobación del Líder (null si no hay ninguno). */
  propuesto?: number | null;
  /** true = Líder de Procesos: el cambio se aplica en el acto. */
  aplicaDirecto: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(String(precio));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const numero = /^\d+$/.test(valor) ? Number(valor) : null;

  function guardar() {
    if (numero === null || numero <= 0) {
      setError("Poné el precio en pesos, solo números.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cambiarPrecioKwh({ precio: numero });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.estado === "sin_cambios") {
        toast.info("Ese ya es el precio vigente del kWh.");
      } else if (res.data.estado === "pendiente") {
        toast.success("Enviado al Líder de Procesos para su aprobación.", {
          description: `Precio propuesto: ${formatARS(res.data.precio)} por kWh.`,
        });
      } else {
        toast.success(`Precio del kWh actualizado a ${formatARS(res.data.precio)}`);
      }
      setAbierto(false);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card py-2 pr-2 pl-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Precio del kWh
        </p>
        <p className="text-2xl font-bold tabular leading-tight">
          {formatARS(precio)}
        </p>
        {propuesto !== null ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Sello estado="pendiente_aprobacion" />
            <span className="text-xs text-muted-foreground">
              Propuesto:{" "}
              <strong className="tabular text-foreground">{formatARS(propuesto)}</strong>
            </span>
          </div>
        ) : null}
      </div>
      <Dialog
        open={abierto}
        onOpenChange={(open) => {
          setAbierto(open);
          if (open) {
            setValor(String(propuesto ?? precio));
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-11"
            aria-label="Cambiar precio del kWh"
          >
            <Pencil className="size-5" strokeWidth={2} />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">Cambiar precio del kWh</DialogTitle>
            <DialogDescription className="text-sm">
              {aplicaDirecto
                ? "El precio nuevo vale para las próximas lecturas. Las que ya cargaste no cambian."
                : "El cambio lo aprueba el Líder de Procesos. Una vez aprobado, vale para las próximas lecturas; las ya cargadas no cambian."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="precio-kwh" className="text-base">
                Precio por kWh, en pesos
              </Label>
              <Input
                id="precio-kwh"
                inputMode="numeric"
                autoComplete="off"
                className="h-12 text-lg tabular"
                value={valor}
                onChange={(e) => {
                  setValor(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    guardar();
                  }
                }}
                aria-invalid={error ? true : undefined}
              />
              {error ? (
                <p className="text-sm font-medium text-pendiente">{error}</p>
              ) : numero !== null ? (
                <p className="text-sm text-muted-foreground">
                  Queda en <strong className="tabular">{formatARS(numero)}</strong>{" "}
                  por kWh. Hoy: <span className="tabular">{formatARS(precio)}</span>.
                </p>
              ) : null}
            </div>
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold"
              onClick={guardar}
              disabled={pendiente}
            >
              {aplicaDirecto ? null : <Send className="size-5" strokeWidth={2} />}
              {pendiente
                ? aplicaDirecto
                  ? "Guardando…"
                  : "Enviando…"
                : aplicaDirecto
                  ? "Guardar precio"
                  : "Enviar a aprobación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
