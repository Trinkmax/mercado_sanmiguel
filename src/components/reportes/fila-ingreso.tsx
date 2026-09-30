import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/** Gris de los beneficios, opaco: sobre la pista roja de una barra no se tiñe de rosa. */
export const GRIS_BENEFICIO = "bg-[color-mix(in_oklch,var(--muted-foreground)_30%,var(--card))]";

/** Rayado del beneficio en término (sobre bg-muted): todavía puede cambiar si pagan tarde. */
export const RAYADO_EN_TERMINO: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 45%, transparent) 0 2px, transparent 2px 5px)",
};

/**
 * Muestra de color de cada beneficio, la misma en todas las pantallas: gris liso los
 * otorgados, gris rayado el beneficio en término. El tamaño y el margen van en `className`.
 */
export function MuestraBeneficio({
  tipo,
  className,
}: {
  tipo: "otorgados" | "en-termino";
  className?: string;
}) {
  return tipo === "otorgados" ? (
    <span aria-hidden className={cn("inline-block rounded-full", GRIS_BENEFICIO, className)} />
  ) : (
    <span
      aria-hidden
      className={cn("inline-block rounded-full bg-muted ring-1 ring-muted-foreground/40", className)}
      style={RAYADO_EN_TERMINO}
    />
  );
}

/** Los cuatro montos de un concepto (estimado = cobrado + otorgados + en término + pendiente). */
function montosDe(fila: ResumenConcepto) {
  return {
    estimado: Number(fila.estimado),
    cobrado: Number(fila.cobrado),
    otorgados: Number(fila.descuentos),
    enTermino: beneficioEnTerminoDe(fila),
    pendiente: Number(fila.pendiente),
  };
}

/**
 * Barra de un concepto contra su estimado: verde lo cobrado, gris los beneficios otorgados,
 * rayado el beneficio en término y la pista roja suave lo que falta. La usan Reportes y el
 * Inicio (Tesorería, Administración y Líder), así el mismo concepto se ve igual en todos lados.
 */
export function BarraIngreso({ fila }: { fila: ResumenConcepto }) {
  const { estimado, cobrado, otorgados, enTermino, pendiente } = montosDe(fila);
  const porcentaje = (monto: number) => (estimado > 0 ? Math.max((monto / estimado) * 100, 0) : 0);
  const pct = estimado > 0 ? Math.min(porcentaje(cobrado), 100) : 100;
  const pctOtorgados = Math.min(porcentaje(otorgados), 100 - pct);
  const pctEnTermino = Math.min(porcentaje(enTermino), 100 - pct - pctOtorgados);
  return (
    <div
      className="flex h-3 overflow-hidden rounded-full bg-pendiente-suave"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        `${fila.nombre}: cobrado ${formatARS(cobrado)} de ${formatARS(estimado)} estimados` +
        (otorgados > 0.5 ? `, beneficios otorgados ${formatARS(otorgados)}` : "") +
        (enTermino > 0.5 ? `, beneficio en término ${formatARS(enTermino)}` : "") +
        (pendiente > 0.009 ? `, faltan ${formatARS(pendiente)}` : ", completo")
      }
    >
      <div
        className={cn("h-full bg-pagado transition-[width]", pctOtorgados + pctEnTermino === 0 && "rounded-full")}
        style={{ width: `${pct}%` }}
      />
      {pctOtorgados > 0 ? (
        <div className={cn("h-full", GRIS_BENEFICIO)} style={{ width: `${pctOtorgados}%` }} />
      ) : null}
      {pctEnTermino > 0 ? (
        <div className="h-full bg-muted" style={{ width: `${pctEnTermino}%`, ...RAYADO_EN_TERMINO }} />
      ) : null}
    </div>
  );
}

/**
 * Los montos de debajo de la barra: los beneficios que haya (cada uno con su muestra y su
 * nombre) y, a la derecha, "Faltan $X" o "Completo". `antes` va primero (el Inicio pone ahí
 * "$ cobrado de $ estimado"). Cada dato baja entero; en un celular angosto, el monto puede ir
 * debajo de su nombre.
 */
export function MontosIngreso({ fila, antes }: { fila: ResumenConcepto; antes?: React.ReactNode }) {
  const { otorgados, enTermino, pendiente } = montosDe(fila);
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 pt-0.5 text-sm text-muted-foreground tabular">
      {antes}
      {otorgados > 0.5 ? (
        <span>
          <MuestraBeneficio tipo="otorgados" className="mr-1.5 size-2.5" />
          <span className="whitespace-nowrap">Beneficios otorgados</span>{" "}
          <span className="whitespace-nowrap">{formatARS(otorgados)}</span>
        </span>
      ) : null}
      {enTermino > 0.5 ? (
        <span>
          <MuestraBeneficio tipo="en-termino" className="mr-1.5 size-2.5" />
          <span className="whitespace-nowrap">Beneficio en término</span>{" "}
          <span className="whitespace-nowrap">{formatARS(enTermino)}</span>
        </span>
      ) : null}
      {pendiente > 0.009 ? (
        <span className="ml-auto font-medium whitespace-nowrap text-pendiente">Faltan {formatARS(pendiente)}</span>
      ) : (
        <span className="ml-auto font-medium text-pagado">Completo</span>
      )}
    </div>
  );
}

/**
 * Fila de ingresos por concepto, contra su estimado (el mismo de Facturación y del Inicio):
 * el nombre y "$ cobrado de $ estimado", la barra y debajo cada tramo con su monto. La cuenta
 * cierra en el renglón (cobrado + otorgados + en término + faltan = estimado).
 * `descuentos` es el nombre de la columna de la RPC; en pantalla (y en la impresión y el
 * Excel) es "Beneficios otorgados": los que ya se descontaron a quienes pagaron en término.
 */
export function FilaIngreso({ fila }: { fila: ResumenConcepto }) {
  const { estimado, cobrado } = montosDe(fila);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 py-4 sm:grid-cols-[5rem_minmax(0,1fr)]">
      <Codigo codigo={fila.codigo} className="mt-0.5" />
      <div className="min-w-0 space-y-1.5">
        {/* El nombre entero; si no entran juntos, los montos bajan enteros y a la derecha. */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-sm font-medium break-words">{fila.nombre}</p>
          <p className="ml-auto text-sm text-muted-foreground tabular">
            <span className="font-semibold whitespace-nowrap text-pagado">{formatARS(cobrado)}</span>{" "}
            <span className="whitespace-nowrap">de {formatARS(estimado)}</span>
          </p>
        </div>
        <BarraIngreso fila={fila} />
        <MontosIngreso fila={fila} />
      </div>
    </div>
  );
}
