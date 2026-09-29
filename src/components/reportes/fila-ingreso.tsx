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
 * Beneficio en término de un concepto: el de quienes todavía no pagaron y siguen en término
 * (su deuda de hoy ya viene con el descuento). Si pagan después del vencimiento, lo pierden y
 * pasa a "Falta cobrar". Con él, estimado = cobrado + beneficios otorgados + beneficio en
 * término + falta cobrar, y la cuenta cierra en pantalla.
 */
export function beneficioEnTerminoDe(fila: ResumenConcepto): number {
  return Math.max(
    Number(fila.estimado) - Number(fila.cobrado) - Number(fila.pendiente) - Number(fila.descuentos),
    0
  );
}

/**
 * Fila de ingresos por concepto: barra verde (cobrado) sobre fondo rojo suave
 * (lo que falta), con el detalle de estimado, beneficios y pendiente.
 * `descuentos` es el nombre de la columna de la RPC; en pantalla (y en la impresión y el
 * Excel) es "Beneficios otorgados": los que ya se descontaron a quienes pagaron en término.
 */
export function FilaIngreso({ fila }: { fila: ResumenConcepto }) {
  const cobrado = Number(fila.cobrado);
  const pendiente = Number(fila.pendiente);
  const objetivo = cobrado + pendiente;
  const enTermino = beneficioEnTerminoDe(fila);
  const pct = objetivo > 0 ? Math.min((cobrado / objetivo) * 100, 100) : 100;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 py-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <Codigo codigo={fila.codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1.5">
        {/* El nombre entero; si no entran juntos, los montos bajan enteros y a la derecha. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-sm font-medium break-words">{fila.nombre}</p>
          <p className="ml-auto text-sm text-muted-foreground tabular">
            <span className="font-semibold whitespace-nowrap text-pagado">{formatARS(cobrado)}</span>{" "}
            <span className="whitespace-nowrap">de {formatARS(objetivo)}</span>
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
        {/* Cada dato baja entero; en un celular angosto, el monto puede ir debajo de su nombre. */}
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 pt-0.5 text-sm text-muted-foreground tabular">
          <span className="whitespace-nowrap">Estimado {formatARS(fila.estimado)}</span>
          <span>
            <span className="whitespace-nowrap">Beneficios otorgados</span>{" "}
            <span className="whitespace-nowrap">{formatARS(fila.descuentos)}</span>
          </span>
          {enTermino > 0.5 ? (
            <span>
              <span className="whitespace-nowrap">Beneficio en término</span>{" "}
              <span className="whitespace-nowrap">{formatARS(enTermino)}</span>
            </span>
          ) : null}
          {pendiente > 0 ? (
            <span className="font-medium whitespace-nowrap text-pendiente">
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
