"use client";

import { useTransition } from "react";
import { PlugZap } from "lucide-react";
import { toast } from "sonner";
import { generarPeriodo } from "@/lib/actions/facturacion";
import { formatNumero } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Medidores que se agregaron después de generar el mes (I1, §1.2-11): esos clientes todavía
 * no tienen el abono. Un toque vuelve a generar el mes, que es idempotente y solo suma lo
 * que falta. Solo para el mes en curso (en un mes viejo sería un abono retroactivo).
 */
export function SumarAbonos({
  periodo,
  mes,
  clientes,
}: {
  periodo: string;
  /** "septiembre 2026" */
  mes: string;
  /** Nombres de los clientes con medidor que todavía no tienen el abono del mes. */
  clientes: string[];
}) {
  const [pendiente, startTransition] = useTransition();
  const faltan = clientes.length;
  const nombres =
    faltan <= 3 ? clientes.join(", ") : `${clientes.slice(0, 2).join(", ")} y ${formatNumero(faltan - 2)} más`;

  function sumar() {
    startTransition(async () => {
      const res = await llamarAccion(() => generarPeriodo({ periodo }));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const abonos = Number(res.data.abonos ?? 0);
      const otros = Number(res.data.cargos ?? 0) + Number(res.data.energia ?? 0);
      toast.success(
        abonos > 0
          ? `Listo: se ${abonos === 1 ? "sumó 1 abono" : `sumaron ${formatNumero(abonos)} abonos`} de energía a ${mes}.`
          : `Ya estaba todo: ${mes} no tenía abonos pendientes.`,
        otros > 0
          ? { description: `También se ${otros === 1 ? "sumó 1 cargo que faltaba" : `sumaron ${formatNumero(otros)} cargos que faltaban`} del mes.` }
          : undefined
      );
    });
  }

  return (
    <section
      aria-label="Abonos que faltan"
      className="flex flex-wrap items-center gap-4 rounded-xl bg-parcial-suave px-4 py-3.5 sm:px-5"
    >
      <PlugZap className="size-6 shrink-0 text-parcial" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium">
          {faltan === 1
            ? "1 cliente con medidor todavía no tiene el abono de este mes"
            : `${formatNumero(faltan)} clientes con medidor todavía no tienen el abono de este mes`}
        </p>
        <p className="text-sm text-muted-foreground">
          {nombres}. Se les agregó el medidor después de generar {mes}.
        </p>
      </div>
      <Button size="lg" className="h-12 w-full px-5 text-base font-semibold sm:w-auto" onClick={sumar} disabled={pendiente}>
        {pendiente ? <Spinner className="size-5" /> : <PlugZap className="size-5" strokeWidth={2} />}
        {faltan === 1 ? "Sumarle el abono" : `Sumar los ${formatNumero(faltan)} abonos`}
      </Button>
    </section>
  );
}
