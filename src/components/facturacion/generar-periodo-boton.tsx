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

/** Botón primario de Facturación: confirma y dispara la generación del mes. */
export function GenerarPeriodoBoton({
  periodo,
  label,
  cargosEstimados,
  totalEstimado,
}: {
  periodo: string;
  label: string;
  cargosEstimados: number;
  totalEstimado: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  /** Resultado de la última generación hecha desde esta pantalla (queda a la vista). */
  const [ultimo, setUltimo] = useState<(ResultadoGeneracion & { label: string }) | null>(
    null
  );

  function confirmar() {
    startTransition(async () => {
      const res = await generarPeriodo({ periodo });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAbierto(false);
      const saldoAplicado = Number(res.data.saldo_favor_aplicado ?? 0);
      setUltimo({ ...res.data, saldo_favor_aplicado: saldoAplicado, label });
      toast.success(
        `Listo: se generaron ${formatNumero(res.data.cargos)} cargos y ${formatNumero(res.data.energia)} de energía para ${label}.`,
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
              {ultimo.label} quedó generado: {formatNumero(ultimo.cargos)} cargos y{" "}
              {formatNumero(ultimo.energia)} de energía. Vence el{" "}
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
          <Button size="lg" className="h-13 w-full px-6 text-base font-semibold sm:w-auto">
            <CalendarCheck className="size-5" strokeWidth={2} />
            Generar {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">¿Generar {label}?</DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              Se van a crear aprox. {formatNumero(cargosEstimados)} cargos por{" "}
              {formatARS(totalEstimado)}. Si algún cliente tiene saldo a favor, se
              le descuenta solo. Esto se hace una vez por mes. Quedate tranquilo:
              si se corre dos veces, no se duplica nada.
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
