"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, RefreshCw, TriangleAlert } from "lucide-react";
import { corregirCargo } from "@/lib/actions/clientes";
import { formatARS, labelPeriodo } from "@/lib/format";
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
import { DescripcionCargo } from "@/components/cobranza/descripcion-cargo";
import { llamarAccion } from "@/lib/llamar-accion";

/** Un cargo del mes que no coincide con la carpeta (cargos_para_corregir, 0054). */
export type CargoParaCorregir = {
  cargoId: string;
  periodo: string;
  descripcion: string;
  monto: number;
  montoPagado: number;
  /** false = según la carpeta ya no corresponde (concepto apagado, eximido…): se anula. */
  existe: boolean;
  descripcionNueva: string | null;
  montoNuevo: number | null;
};

/**
 * Debajo de un cargo del mes que se generó con otra cosa de lo que dice HOY la carpeta (la
 * cochera × 1,25 que tenía que ser × 1): lo dice en una línea y ofrece "Corregir". El diálogo
 * muestra antes → ahora, qué pasa con lo que ya pagó y pide un motivo (opcional). Lo hace
 * corregir_cargo: el cargo viejo queda anulado con su rastro y se genera el corregido.
 */
export function CorregirCargo({ clienteId, cargo }: { clienteId: string; cargo: CargoParaCorregir }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const mes = labelPeriodo(cargo.periodo).toLowerCase();
  const nuevo = cargo.existe ? (cargo.montoNuevo ?? 0) : 0;
  // Lo que ya pagó pasa al corregido; si el corregido es menor, lo que sobra le queda a favor.
  const sobra = Math.max(Math.round((cargo.montoPagado - nuevo) * 100) / 100, 0);

  function corregir() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() =>
        corregirCargo({ cargoId: cargo.cargoId, clienteId, motivo: motivo.trim() || undefined })
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const r = res.data;
      toast.success(
        r.montoNuevo === null
          ? `Cargo anulado: ya no le corresponde (${formatARS(r.montoAnterior)}).`
          : `Cargo corregido: ${formatARS(r.montoAnterior)} → ${formatARS(r.montoNuevo)}.`,
        r.liberado > 0.009
          ? {
              description:
                r.aplicado > 0.009
                  ? `${formatARS(r.liberado)} que ya había pagado quedaron a su favor y se aplicaron a sus otras deudas.`
                  : `${formatARS(r.liberado)} que ya había pagado quedaron como saldo a favor.`,
            }
          : r.pagado > 0.009
            ? { description: `Lo que ya había pagado (${formatARS(r.pagado)}) quedó en el cargo corregido.` }
            : undefined
      );
      setAbierto(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parcial bg-parcial-suave px-3 py-2.5">
      <p className="flex min-w-0 flex-1 basis-64 items-start gap-2 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
        <span>
          {cargo.existe ? (
            <>
              No coincide con la carpeta: hoy dice{" "}
              <span className="font-semibold">
                <DescripcionCargo texto={cargo.descripcionNueva ?? ""} />
              </span>{" "}
              ({formatARS(nuevo)}).
            </>
          ) : (
            <>Según la carpeta, este cargo ya no le corresponde (lo dejaron de facturar o lo eximieron).</>
          )}
        </span>
      </p>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (pendiente) return;
          setAbierto(v);
          if (!v) {
            setMotivo("");
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" className="h-11 bg-card px-4 text-sm font-semibold" data-tour="clientes-corregir-cargo">
            <RefreshCw className="size-4" strokeWidth={2} />
            {cargo.existe ? `Corregir a ${formatARS(nuevo)}` : "Anular este cargo"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">
              {cargo.existe ? `¿Corregir el cargo de ${mes}?` : `¿Anular el cargo de ${mes}?`}
            </DialogTitle>
            <DialogDescription className="text-base">
              Los cambios de la carpeta rigen desde el mes que viene. Si este cargo se generó mal, se rehace con
              lo que dice hoy la carpeta. Queda anotado quién lo corrigió y por qué.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg bg-muted/60 px-4 py-3 text-base">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-muted-foreground">
              <span className="min-w-0 break-words line-through">
                <DescripcionCargo texto={cargo.descripcion} />
              </span>
              <span className="tabular line-through">{formatARS(cargo.monto)}</span>
            </p>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
              <span className="flex min-w-0 items-baseline gap-1.5 break-words">
                <ArrowRight className="size-4 shrink-0 translate-y-0.5 text-primary" strokeWidth={2.2} />
                {cargo.existe ? <DescripcionCargo texto={cargo.descripcionNueva ?? ""} /> : "Sin cargo (anulado)"}
              </span>
              <span className="text-lg tabular">{formatARS(nuevo)}</span>
            </p>
          </div>

          {cargo.montoPagado > 0.009 ? (
            <p className="text-sm">
              Ya pagó <span className="font-semibold tabular">{formatARS(cargo.montoPagado)}</span> de este cargo:{" "}
              {sobra > 0.009
                ? `${cargo.existe ? `${formatARS(nuevo)} quedan en el cargo corregido y ` : ""}${formatARS(sobra)} le quedan a favor (se aplican solos a sus otras deudas).`
                : "pasan al cargo corregido. Sus recibos no cambian."}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`corregir-${cargo.cargoId}`} className="text-base">
              ¿Qué pasó? <span className="font-normal text-muted-foreground">(si querés)</span>
            </Label>
            <Textarea
              id={`corregir-${cargo.cargoId}`}
              rows={2}
              maxLength={300}
              placeholder="Ej.: se apretó de más la cantidad"
              className="text-base"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          {error ? <AlertaError error={error} titulo="No se pudo corregir" /> : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-12 px-5 text-base"
              onClick={() => setAbierto(false)}
              disabled={pendiente}
            >
              No, dejarlo
            </Button>
            <Button className="h-12 px-5 text-base font-semibold" onClick={corregir} disabled={pendiente}>
              {pendiente ? <Spinner className="size-5" /> : <RefreshCw className="size-5" strokeWidth={2} />}
              {cargo.existe ? `Sí, corregir a ${formatARS(nuevo)}` : "Sí, anularlo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
