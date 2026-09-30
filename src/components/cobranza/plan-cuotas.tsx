"use client";

import { CalendarRange, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS, labelPeriodo } from "@/lib/format";
import type { AvanceMes } from "@/lib/segmentos";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

function nombreMes(periodo: string): string {
  return labelPeriodo(periodo).split(" ")[0].toLowerCase();
}

/**
 * Barra del mes: relleno verde sobre pista roja suave (DESIGN §6). Hasta 10 cuotas va
 * segmentada (una celda por cuota, llenada según la plata); más ("Todos los días") es continua.
 */
export function BarraAvance({
  avance,
  className,
  alta = "h-4",
}: {
  avance: AvanceMes;
  className?: string;
  alta?: string;
}) {
  const total = Number(avance.total ?? 0);
  const falta = Number(avance.falta ?? 0);
  const cuotas = Math.max(1, Number(avance.cuotas ?? 1));
  // Solo para dibujar: la cuenta de cuotas cubiertas la hace v_avance_mes.
  const frac = falta <= 0.009 ? 1 : total > 0 ? Math.min(1, Math.max(0, (total - falta) / total)) : 0;

  if (cuotas > 10) {
    return (
      <div
        className={cn("w-full overflow-hidden rounded-full bg-pendiente-suave", alta, className)}
        aria-hidden
      >
        <div className="h-full rounded-full bg-pagado transition-[width]" style={{ width: `${frac * 100}%` }} />
      </div>
    );
  }
  return (
    <div className={cn("flex w-full gap-1", alta, className)} aria-hidden>
      {Array.from({ length: cuotas }).map((_, i) => {
        const lleno = Math.min(1, Math.max(0, frac * cuotas - i));
        return (
          <div key={i} className="h-full flex-1 overflow-hidden rounded-sm bg-pendiente-suave">
            <div className="h-full bg-pagado transition-[width]" style={{ width: `${lleno * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Plan del mes (G5) para quien paga en cuotas: "Cubrió 2 de 4 cuotas", pagó / falta y la cuota
 * sugerida (la última = lo que falta exacto). Todos los números salen de v_avance_mes.
 */
export function PlanCuotas({
  avance,
  periodo,
  esQuintero,
  atrasado,
  onCobrar,
  deshabilitado = false,
}: {
  /** Fila de v_avance_mes del período actual (null = el mes no se generó). */
  avance: AvanceMes | null;
  periodo: string;
  esQuintero: boolean;
  /** Deuda de meses anteriores: la imputación la cobra primero. */
  atrasado: { meses: string[]; monto: number } | null;
  onCobrar: (monto: number) => void;
  deshabilitado?: boolean;
}) {
  const mes = nombreMes(periodo);
  const titulo = esQuintero ? `Quinta de ${mes}` : `Cuenta de ${mes}`;
  const hayAtrasado = atrasado !== null && atrasado.monto > 0.009;
  const mesesAtrasados = atrasado?.meses.map(nombreMes).join(" y ") ?? "";

  if (!avance) {
    return (
      <section className="space-y-3 rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-5 text-muted-foreground" strokeWidth={2} />
          <p className="font-medium">{titulo}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          El mes todavía no se generó: cuando Administración genere {mes} vas a ver las cuotas acá.
        </p>
        {hayAtrasado ? (
          <p className="text-sm">
            Debe de {mesesAtrasados}: <Money monto={atrasado.monto} className="font-semibold" />.
          </p>
        ) : null}
      </section>
    );
  }

  const cuotas = Math.max(1, Number(avance.cuotas));
  const cubiertas = Number(avance.cuotas_cubiertas);
  const falta = Number(avance.falta);
  const sugerida = Number(avance.cuota_sugerida);
  const alDia = falta <= 0.009;
  const esUltima = cuotas - cubiertas <= 1;
  const porDia = cuotas > 10;

  return (
    <section data-tour="cobranza-plan" className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <CalendarRange className="size-5 text-muted-foreground" strokeWidth={2} />
          {titulo}
        </p>
        <Money monto={avance.total} className="text-2xl font-bold" />
      </div>

      <div className="space-y-2">
        <BarraAvance avance={avance} alta="h-5" />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-semibold">
            {porDia
              ? `Pagó ${cubiertas} de ${cuotas} días`
              : `Cubrió ${cubiertas} de ${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"}`}
          </p>
          <p className="text-sm text-muted-foreground">
            Pagó <Money monto={avance.pagado} className="font-medium text-foreground" /> · Falta{" "}
            <Money
              monto={falta}
              className={cn("font-semibold", alDia ? "text-pagado" : "text-pendiente")}
            />
          </p>
        </div>
      </div>

      {alDia ? (
        <div className="flex items-center gap-3 rounded-lg bg-pagado-suave px-4 py-3">
          <Sello estado="al_dia" />
          <p className="text-sm">{esQuintero ? "La quinta de este mes está paga." : "Este mes está pago."}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-parcial/50 bg-parcial-suave px-4 py-3">
          {hayAtrasado ? (
            <p className="flex items-start gap-2 text-sm">
              <History className="mt-0.5 size-4 shrink-0 text-parcial" strokeWidth={2} />
              <span>
                Primero se cobra {mesesAtrasados} (
                <Money monto={atrasado.monto} className="font-semibold" />
                ): la plata va siempre a lo más viejo.
              </span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="text-sm text-muted-foreground">
                {esUltima ? "Última cuota (lo que falta)" : porDia ? "Por día" : "Cuota sugerida"}
              </span>
              <br />
              <Money monto={sugerida} className="text-xl font-bold" />
            </p>
            <div className="flex flex-wrap gap-2">
              {hayAtrasado ? (
                <Button
                  type="button"
                  className="h-auto min-h-12 max-w-full px-4 py-2 text-base font-semibold whitespace-normal"
                  disabled={deshabilitado}
                  onClick={() => onCobrar(Math.round((sugerida + atrasado.monto) * 100) / 100)}
                >
                  Cuota + lo atrasado ({formatARS(sugerida + atrasado.monto)})
                </Button>
              ) : null}
              <Button
                type="button"
                variant={hayAtrasado ? "outline" : "default"}
                className={cn("h-12 px-4 text-base font-semibold", hayAtrasado && "bg-card")}
                disabled={deshabilitado}
                onClick={() => onCobrar(sugerida)}
              >
                Cobrar la cuota
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
