import { formatARS } from "@/lib/format";
import { Codigo } from "@/components/shared/codigo";

export type ResumenConcepto = {
  codigo: string;
  nombre: string;
  estimado: number;
  cobrado: number;
  descuentos: number;
  pendiente: number;
};

/**
 * Fila de ingresos por concepto: barra verde (cobrado) sobre fondo rojo suave
 * (lo que falta), con el detalle de estimado, descuentos y pendiente.
 */
export function FilaIngreso({ fila }: { fila: ResumenConcepto }) {
  const cobrado = Number(fila.cobrado);
  const pendiente = Number(fila.pendiente);
  const objetivo = cobrado + pendiente;
  const pct = objetivo > 0 ? Math.min((cobrado / objetivo) * 100, 100) : 100;

  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 py-4 sm:grid-cols-[5rem_1fr]">
      <Codigo codigo={fila.codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{fila.nombre}</p>
          <p className="shrink-0 text-sm text-muted-foreground tabular">
            <span className="font-semibold text-pagado">{formatARS(cobrado)}</span>
            {" de "}
            {formatARS(objetivo)}
          </p>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-pendiente-suave"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${fila.nombre}: cobrado ${formatARS(cobrado)} de ${formatARS(objetivo)}`}
        >
          <div
            className="h-full rounded-full bg-pagado transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 pt-0.5 text-sm text-muted-foreground tabular">
          <span>Estimado {formatARS(fila.estimado)}</span>
          <span>Descuentos {formatARS(fila.descuentos)}</span>
          {pendiente > 0 ? (
            <span className="font-medium text-pendiente">
              Faltan {formatARS(pendiente)}
            </span>
          ) : (
            <span className="font-medium text-pagado">Completo</span>
          )}
        </div>
      </div>
    </div>
  );
}
