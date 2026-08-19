import { ChevronDown, History } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import type { EventoCaja } from "@/components/caja/datos";

const LABEL_EVENTO: Record<string, string> = {
  apertura: "Apertura",
  cierre: "Cierre",
  solicitud_reapertura: "Pedido de reapertura",
  reapertura: "Reapertura",
  rechazo_reapertura: "Reapertura rechazada",
  integracion: "Integrada a la caja mayor",
  recibe_rendicion: "Recibe rendición de portería",
  validacion: "Validación de tesorería",
};

/**
 * Bitácora de la caja (caja_eventos), plegada al pie: quién hizo qué y cuándo.
 * Es consulta, no tarea: por eso va en un <details> y no compite con el arqueo.
 */
export function HistorialCaja({ eventos }: { eventos: EventoCaja[] }) {
  if (eventos.length === 0) return null;

  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 py-3 font-medium select-none [&::-webkit-details-marker]:hidden">
        <History className="size-5 text-muted-foreground" strokeWidth={2} />
        <span>
          Historial de la caja{" "}
          <span className="text-muted-foreground">
            ({eventos.length} {eventos.length === 1 ? "movimiento" : "movimientos"})
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
              <span className="w-32 shrink-0 text-muted-foreground tabular">
                {formatFechaHora(e.creado_en)}
              </span>
              <span className="font-medium">{LABEL_EVENTO[e.tipo] ?? e.tipo}</span>
              {e.usuario ? (
                <span className="ml-auto shrink-0 text-muted-foreground">{e.usuario}</span>
              ) : null}
            </div>
            {e.detalle ? (
              <p className="mt-0.5 text-muted-foreground sm:pl-36">{e.detalle}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
