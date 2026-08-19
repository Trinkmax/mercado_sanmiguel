import { CalendarClock, TriangleAlert } from "lucide-react";
import { formatARS, formatFecha, saldoCargo } from "@/lib/format";
import { cn } from "@/lib/utils";

type CargoBanner = {
  estado: string;
  monto: number;
  monto_pagado: number;
  descuento_pronto_pago: number;
  vencimiento: string;
};

/** Lo que hay que decirle al cliente sobre su deuda activa y el beneficio. */
export function resumenDeudaActiva(cargos: CargoBanner[], hoy: string) {
  const pendientes = cargos.filter(
    (c) => c.estado === "pendiente" || c.estado === "parcial"
  );
  const vencidos = pendientes.filter((c) => c.vencimiento < hoy);
  const enTermino = pendientes.filter((c) => c.vencimiento >= hoy);

  const deudaVencida = vencidos.reduce((acc, c) => acc + saldoCargo(c), 0);
  // Beneficio que todavía se puede mantener: lo que se ahorra pagando en término.
  const beneficio = enTermino.reduce((acc, c) => {
    const completo = Math.max(Number(c.monto) - Number(c.monto_pagado), 0);
    return acc + Math.max(completo - saldoCargo(c), 0);
  }, 0);
  const proximoVencimiento = enTermino
    .filter((c) => Number(c.descuento_pronto_pago) > 0)
    .map((c) => c.vencimiento)
    .sort()[0];

  return {
    deudaVencida: Math.round(deudaVencida * 100) / 100,
    vencidoDesde: vencidos.map((c) => c.vencimiento).sort()[0] ?? null,
    beneficio: Math.round(beneficio * 100) / 100,
    proximoVencimiento: proximoVencimiento ?? null,
  };
}

/**
 * Aviso de deuda activa con la regla del beneficio por pago en término:
 * en término → cuánto mantiene pagando antes del vencimiento;
 * vencido → perdió el beneficio y debe el importe completo.
 */
export function BannerDeuda({
  cargos,
  hoy,
  className,
}: {
  cargos: CargoBanner[];
  hoy: string;
  className?: string;
}) {
  const r = resumenDeudaActiva(cargos, hoy);
  if (r.deudaVencida <= 0 && r.beneficio <= 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {r.deudaVencida > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-pendiente/30 bg-pendiente-suave px-4 py-3 text-pendiente"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="text-sm leading-snug">
            <p className="font-semibold">
              Perdió el beneficio por mora: debe el importe completo.
            </p>
            <p className="text-pendiente/90">
              {formatARS(r.deudaVencida)} vencidos
              {r.vencidoDesde ? ` desde el ${formatFecha(r.vencidoDesde)}` : ""}.
            </p>
          </div>
        </div>
      ) : null}
      {r.beneficio > 0 && r.proximoVencimiento ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-parcial/30 bg-parcial-suave px-4 py-3 text-parcial"
        >
          <CalendarClock className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <p className="text-sm leading-snug">
            <span className="font-semibold">
              Pagando hasta el {formatFecha(r.proximoVencimiento)} mantiene el
              beneficio por pago en término ({formatARS(r.beneficio)}).
            </span>{" "}
            Después vence y debe el importe completo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
