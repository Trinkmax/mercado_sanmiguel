import { Check } from "lucide-react";
import { labelPeriodo } from "@/lib/format";
import type { ResultadoCobro } from "@/lib/actions/cobranza";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { ICONO_MEDIO, LABEL_MEDIO } from "@/components/cobranza/tipos";

/**
 * Confirmación de un cobro: el sello se estampa, el N° de recibo grande, cómo pagó (una fila
 * por medio), a qué se imputó y el saldo a favor. Las acciones las pone quien la usa.
 */
export function ReciboRegistrado({
  resultado,
  destacado,
  children,
}: {
  resultado: ResultadoCobro;
  /** Línea grande debajo del N° (p. ej. "Pagó hasta el mié 30/09"). */
  destacado?: React.ReactNode;
  children: React.ReactNode;
}) {
  const vigentes = resultado.pagos.filter((p) => !p.anulado);
  return (
    <section
      aria-live="polite"
      className="space-y-6 rounded-lg border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Sello grande estado="pagado" texto="Cobro registrado" className="animar-estampado" />
        <p className="text-lg">
          Recibo{" "}
          <span className="font-display text-2xl font-bold tabular">N° {resultado.numero}</span>
        </p>
        {destacado ? <div className="text-lg font-semibold">{destacado}</div> : null}
      </div>

      <div className="divide-y rounded-md border">
        {vigentes.map((p) => {
          const Icono = ICONO_MEDIO[p.medio];
          return (
            <div key={p.pago_id} className="flex items-center gap-3 px-4 py-3">
              <Icono className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} />
              <p className="min-w-0 flex-1 font-medium">{LABEL_MEDIO[p.medio]}</p>
              <Money monto={p.monto} className="shrink-0 font-semibold" />
            </div>
          );
        })}
        {vigentes.length > 1 ? (
          <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3">
            <p className="font-semibold">Total</p>
            <Money monto={resultado.total} className="text-lg font-bold" />
          </div>
        ) : null}
      </div>

      {resultado.imputaciones.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Se aplicó a</p>
          <div className="divide-y rounded-md border">
            {resultado.imputaciones.map((imp) => (
              <div key={imp.cargo_id} className="flex items-center gap-3 px-4 py-3">
                <Codigo codigo={imp.codigo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{imp.descripcion}</p>
                  {/* "Saldado" va debajo, junto al período: en un celular angosto no le come
                      el lugar a la descripción. */}
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    {labelPeriodo(imp.periodo)}
                    {imp.saldado ? (
                      <span className="inline-flex items-center gap-1 font-medium text-pagado">
                        <Check className="size-4" strokeWidth={2.2} />
                        Saldado
                      </span>
                    ) : null}
                  </p>
                </div>
                <Money monto={imp.monto} className="shrink-0 font-semibold" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {resultado.saldo_favor > 0.009 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-pagado/40 bg-pagado-suave px-4 py-3">
          <Sello estado="saldo_favor" />
          <p className="min-w-0 flex-1 text-sm">
            Quedan <Money monto={resultado.saldo_favor} className="font-semibold text-foreground" /> a
            favor del cliente. Se aplican solos a lo próximo que deba.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">{children}</div>
    </section>
  );
}
