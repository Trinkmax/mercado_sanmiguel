import { ChevronDown, History } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import type { EventoCaja } from "@/components/caja/datos";
import { montosSinCortar } from "@/components/caja/texto";

export const LABEL_EVENTO: Record<string, string> = {
  apertura: "Apertura",
  cierre: "Cierre",
  cierre_forzado: "Cerrada por Tesorería",
  solicitud_reapertura: "Pedido de reapertura",
  reapertura: "Reapertura",
  rechazo_reapertura: "Reapertura rechazada",
  integracion: "Integrada a la caja mayor",
  recibe_rendicion: "Recibe la caja de portería",
  validacion: "Validación de Tesorería",
  cobro_anulado: "Recibo anulado",
  gasto_imputado: "Gasto pagado desde la caja",
  gasto_revertido: "Pago de gasto deshecho",
  ajuste: "Ajuste de tesorería",
  ajuste_borrado: "Ajuste borrado",
  canon_anulado: "Ingreso de transporte anulado",
  arqueo_recalculado: "Arqueo recalculado",
};

/** Correcciones de plata: se marcan en la bitácora para que salten a la vista. */
const CORRECCIONES = new Set([
  "cobro_anulado",
  "gasto_revertido",
  "ajuste",
  "ajuste_borrado",
  "canon_anulado",
  "arqueo_recalculado",
  "cierre_forzado",
]);

/**
 * Bitácora de la caja (caja_eventos), plegada al pie: quién hizo qué y cuándo.
 * Es consulta, no tarea: va en un <details> y no compite con el arqueo.
 */
export function HistorialCaja({ eventos }: { eventos: EventoCaja[] }) {
  if (eventos.length === 0) return null;
  const correcciones = eventos.filter((e) => CORRECCIONES.has(e.tipo)).length;

  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 font-medium select-none [&::-webkit-details-marker]:hidden">
        <History className="size-5 text-muted-foreground" strokeWidth={2} />
        <span>
          Historial de la caja{" "}
          <span className="text-muted-foreground">
            ({eventos.length} {eventos.length === 1 ? "movimiento" : "movimientos"}
            {correcciones > 0 ? ` · ${correcciones} ${correcciones === 1 ? "corrección" : "correcciones"}` : ""})
          </span>
        </span>
        <ChevronDown
          className="ml-auto size-5 text-muted-foreground transition-transform group-open:rotate-180"
          strokeWidth={2}
        />
      </summary>
      <ol className="divide-y border-t">
        {eventos.map((e) => (
          <li key={e.id} className="px-5 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              <span className="w-28 shrink-0 text-muted-foreground tabular">{formatFechaHora(e.creado_en)}</span>
              <span className={CORRECCIONES.has(e.tipo) ? "font-semibold" : "font-medium"}>
                {LABEL_EVENTO[e.tipo] ?? e.tipo}
              </span>
              {e.usuario ? <span className="ml-auto shrink-0 text-muted-foreground">{e.usuario}</span> : null}
            </div>
            {e.detalle ? (
              <p className="mt-0.5 break-words text-muted-foreground sm:pl-32">{montosSinCortar(e.detalle)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
