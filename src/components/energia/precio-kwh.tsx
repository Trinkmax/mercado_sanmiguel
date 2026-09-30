"use client";

import { useState, useTransition } from "react";
import { Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/format";
import { cambiarPrecioConcepto, type ConceptoEnergia } from "@/lib/actions/energia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sello } from "@/components/shared/sello";
import { llamarAccion } from "@/lib/llamar-accion";

/** Textos de cada concepto de energía editable desde /energia. */
const TEXTOS: Record<
  ConceptoEnergia,
  { etiqueta: string; titulo: string; campo: string; unidad: string; rige: string; nombre: string }
> = {
  ENER: {
    etiqueta: "Precio del kWh",
    titulo: "Cambiar precio del kWh",
    campo: "Precio por kWh, en pesos",
    unidad: "por kWh",
    rige: "vale para las próximas lecturas; las ya cargadas no cambian",
    nombre: "del kWh",
  },
  ABEN: {
    etiqueta: "Abono mensual",
    titulo: "Cambiar el abono mensual de energía",
    campo: "Abono por mes, en pesos",
    unidad: "por mes",
    rige: "rige desde la próxima generación del mes; lo ya generado no cambia",
    nombre: "del abono",
  },
};

/**
 * Precio vigente de un concepto de energía (kWh o abono mensual) como dato grande, con
 * edición en un Dialog corto. Si quien lo cambia no es el Líder, queda esperando su
 * aprobación y se ve el precio propuesto junto al vigente.
 */
export function PrecioConcepto({
  codigo,
  precio,
  propuesto = null,
  aplicaDirecto,
  className,
}: {
  codigo: ConceptoEnergia;
  precio: number;
  /** Precio que espera la aprobación del Líder (null si no hay ninguno). */
  propuesto?: number | null;
  /** true = Líder de Procesos: el cambio se aplica en el acto. */
  aplicaDirecto: boolean;
  className?: string;
}) {
  const t = TEXTOS[codigo];
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
      const res = await llamarAccion(() => cambiarPrecioConcepto({ codigo, precio: numero }));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data.estado === "sin_cambios") {
        toast.info(`Ese ya es el precio vigente ${t.nombre}.`);
      } else if (res.data.estado === "pendiente") {
        toast.success("Enviado al Líder de Procesos para su aprobación.", {
          description: `Precio propuesto: ${formatARS(res.data.precio)} ${t.unidad}.`,
        });
      } else {
        toast.success(`Listo: ${t.etiqueta.toLowerCase()} quedó en ${formatARS(res.data.precio)} ${t.unidad}.`);
      }
      setAbierto(false);
    });
  }

  return (
    <div
      data-tour={codigo === "ENER" ? "energia-precio-kwh" : "energia-abono"}
      className={cn("flex items-center gap-2 rounded-lg border bg-card py-2 pr-2 pl-4", className)}
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">{t.etiqueta}</p>
        <p className="text-2xl leading-tight font-bold tabular">{formatARS(precio)}</p>
        {propuesto !== null ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Sello estado="pendiente_aprobacion" />
            <span className="text-sm text-muted-foreground">
              Propuesto: <strong className="text-foreground tabular">{formatARS(propuesto)}</strong>
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
          <Button variant="ghost" size="icon-lg" className="size-11" aria-label={t.titulo}>
            <Pencil className="size-5" strokeWidth={2} />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">{t.titulo}</DialogTitle>
            <DialogDescription className="text-sm">
              {aplicaDirecto
                ? `El precio nuevo ${t.rige}.`
                : `El cambio lo aprueba el Líder de Procesos. Una vez aprobado, ${t.rige}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`precio-${codigo}`} className="text-base">
                {t.campo}
              </Label>
              <Input
                id={`precio-${codigo}`}
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
                  Queda en <strong className="tabular">{formatARS(numero)}</strong> {t.unidad}. Hoy:{" "}
                  <span className="tabular">{formatARS(precio)}</span>.
                </p>
              ) : null}
            </div>
          </div>
          {/* Su propia salida, además de la X: Cancelar deja el precio como estaba. */}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente}>
                Cancelar
              </Button>
            </DialogClose>
            <Button className="h-12 px-5 text-base font-semibold" onClick={guardar} disabled={pendiente}>
              {aplicaDirecto ? null : <Send className="size-5" strokeWidth={2} />}
              {pendiente
                ? aplicaDirecto
                  ? "Guardando…"
                  : "Enviando…"
                : aplicaDirecto
                  ? "Guardar precio"
                  : "Enviar a aprobación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Precio vigente del kWh (ENER). Misma pieza que el abono. */
export function PrecioKwh(props: { precio: number; propuesto?: number | null; aplicaDirecto: boolean }) {
  return <PrecioConcepto codigo="ENER" {...props} />;
}
