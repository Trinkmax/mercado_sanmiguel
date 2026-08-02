import { formatFecha, formatFechaHora } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type { Caja, TotalesCaja } from "@/components/caja/datos";

/**
 * El arqueo automático: lo que reemplaza la suma a mano al final del día.
 * Marco de etiqueta de cajón porque es la superficie protagonista.
 */
export function ArqueoCaja({
  caja,
  totales,
  validadaPorNombre,
}: {
  caja: Caja;
  totales: TotalesCaja;
  validadaPorNombre: string | null;
}) {
  const validada = caja.estado === "validada";
  return (
    <div className="etiqueta">
      <div className="etiqueta-interior space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Arqueo — {formatFecha(caja.fecha)}
          </h2>
          <Sello grande estado={caja.estado} />
        </div>

        <div>
          <p className="text-lg font-medium">Tenés que tener:</p>
          <div className="mt-3 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Efectivo
              </p>
              <Money
                monto={totales.efectivo}
                className="mt-1 block text-4xl font-bold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Transferencias
              </p>
              <Money
                monto={totales.transferencia}
                className="mt-1 block text-2xl font-semibold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Cheques
              </p>
              <Money
                monto={totales.cheques}
                className="mt-1 block text-2xl font-semibold"
              />
            </div>
          </div>
        </div>

        {totales.canon > 0 || totales.gastos > 0 ? (
          <div className="space-y-1 border-t border-dashed pt-4 text-sm text-muted-foreground">
            {totales.canon > 0 ? (
              <p>
                Incluye <Money monto={totales.canon} className="font-medium text-foreground" /> de
                canon de camiones.
              </p>
            ) : null}
            {totales.gastos > 0 ? (
              <p>
                Ya se descontaron{" "}
                <Money monto={totales.gastos} className="font-medium text-foreground" /> de gastos
                pagados en efectivo desde esta caja.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t pt-4">
          {validada ? (
            <p className="text-sm text-muted-foreground">
              Validada por {validadaPorNombre ?? "tesorería"} el{" "}
              {formatFechaHora(caja.validada_en)}.
            </p>
          ) : (
            <>
              <p className="font-medium">
                Contá la plata y verificá que coincida. Mañana tesorería la
                controla y valida.
              </p>
              {caja.cerrada_en ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Cerrada el {formatFechaHora(caja.cerrada_en)}.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
