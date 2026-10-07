"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  generarPeriodo,
  type ResultadoGeneracion,
} from "@/lib/actions/facturacion";
import { formatARS, formatFecha, formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { llamarAccion } from "@/lib/llamar-accion";

/** Botón primario de Facturación: confirma y dispara la generación del mes. */
/** "12 cargos, 8 abonos de energía y 3 consumos" */
function textoResultado(r: ResultadoGeneracion): string {
  const cargos = Number(r.cargos ?? 0);
  const abonos = Number(r.abonos ?? 0);
  const energia = Number(r.energia ?? 0);
  const partes = [
    `${formatNumero(cargos)} ${cargos === 1 ? "cargo" : "cargos"}`,
    `${formatNumero(abonos)} ${abonos === 1 ? "abono de energía" : "abonos de energía"}`,
    `${formatNumero(energia)} ${energia === 1 ? "consumo" : "consumos"}`,
  ];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

export function GenerarPeriodoBoton({
  periodo,
  label,
  cargosEstimados,
  totalEstimado,
  totalCompleto,
  abonosEstimados = 0,
}: {
  periodo: string;
  label: string;
  cargosEstimados: number;
  /** Lo que se espera cobrar si pagan en término (con el beneficio de cada concepto). */
  totalEstimado: number;
  /** El mismo total a precio completo: el tope si pagan fuera de término. */
  totalCompleto: number;
  /** Cuántos abonos de energía se van a generar (clientes con medidor, sin exentos). */
  abonosEstimados?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  /** Resultado de la última generación hecha desde esta pantalla (queda a la vista). */
  const [ultimo, setUltimo] = useState<(ResultadoGeneracion & { label: string }) | null>(
    null
  );

  function confirmar() {
    startTransition(async () => {
      const res = await llamarAccion(() => generarPeriodo({ periodo }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAbierto(false);
      const saldoAplicado = Number(res.data.saldo_favor_aplicado ?? 0);
      setUltimo({ ...res.data, saldo_favor_aplicado: saldoAplicado, label });
      toast.success(
        `Listo: se generaron ${textoResultado(res.data)} para ${label}.`,
        saldoAplicado > 0
          ? { description: `Saldo a favor aplicado: ${formatARS(saldoAplicado)}.` }
          : undefined
      );
    });
  }

  const saldoUltimo = Number(ultimo?.saldo_favor_aplicado ?? 0);

  return (
    <div className="space-y-4">
      {ultimo ? (
        <div
          role="status"
          className="flex flex-wrap items-start gap-3 rounded-lg bg-pagado-suave px-4 py-3 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-pagado" strokeWidth={2} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">
              {ultimo.label} quedó generado: {textoResultado(ultimo)}. Vence el{" "}
              {formatFecha(ultimo.vencimiento)}.
            </p>
            {saldoUltimo > 0 ? (
              <p className="flex flex-wrap items-center gap-2">
                <Sello estado="saldo_favor" />
                <span>
                  Saldo a favor aplicado:{" "}
                  <Money monto={saldoUltimo} className="font-semibold" />. Se
                  descontó de los cargos nuevos de los clientes que tenían crédito.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          if (!pendiente) setAbierto(v);
        }}
      >
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="h-13 w-full px-6 text-base font-semibold sm:w-auto"
            data-tour="facturacion-generar"
          >
            <CalendarCheck className="size-5" strokeWidth={2} />
            Generar {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Generar {label}?</DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              Se van a crear aprox. {formatNumero(cargosEstimados)} cargos
              {abonosEstimados > 0
                ? ` (incluye ${formatNumero(abonosEstimados)} ${abonosEstimados === 1 ? "abono" : "abonos"} de energía)`
                : ""}{" "}
              por {formatARS(totalEstimado)}
              {totalCompleto - totalEstimado > 0.5
                ? ` pagando en término (hasta ${formatARS(totalCompleto)} si pagan fuera de término)`
                : ""}
              . Si algún cliente tiene saldo a favor, se le descuenta solo. Esto se
              hace una vez por mes. Quedate tranquilo: si se corre dos veces, no se
              duplica nada (solo suma lo que falte, como un medidor nuevo).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-12 px-5 text-base" disabled={pendiente}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={confirmar}
              disabled={pendiente}
              className="h-12 px-5 text-base font-semibold"
            >
              {pendiente ? (
                <Spinner className="size-5" />
              ) : (
                <CalendarCheck className="size-5" strokeWidth={2} />
              )}
              Sí, generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
