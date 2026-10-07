import { formatARS } from "@/lib/format";
import { montosEstimado, porcentajeCobrado, type MontosEstimado } from "@/lib/estimado";
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
 * Barra de un concepto contra su estimado (lo que se espera cobrar pagando en término,
 * `montosEstimado` en src/lib/estimado.ts): verde lo cobrado y la pista roja suave lo que
 * falta. Cobrado + falta = estimado, así la barra nunca muestra plata que no va a entrar. La
 * usan Reportes y el Inicio (Tesorería, Administración y Líder): el mismo concepto se ve
 * igual en todos lados.
 */
export function BarraIngreso({ fila }: { fila: ResumenConcepto }) {
  const m = montosEstimado(fila);
  const pct = porcentajeCobrado(m);
  return (
    <div
      className="flex h-3 overflow-hidden rounded-full bg-pendiente-suave"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={
        `${fila.nombre}: cobrado ${formatARS(m.cobrado)} de ${formatARS(m.estimado)} estimados pagando en término` +
        (m.falta > 0.009 ? `, faltan ${formatARS(m.falta)}` : ", completo") +
        (m.enTermino > 0.5 ? `; si pagan fuera de término, hasta ${formatARS(m.fueraDeTermino)}` : "")
      }
    >
      <div className="h-full rounded-full bg-pagado transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Lo que queda fuera del estimado, en chico y sin barra: el tope si quienes están en término
 * pagan tarde («Si pagan fuera de término: hasta $X») y los beneficios ya otorgados. Cada
 * dato baja entero. Sin nada que decir, no muestra nada.
 */
export function ExtrasEstimado({ montos }: { montos: MontosEstimado }) {
  return (
    <>
      {montos.enTermino > 0.5 ? (
        <span>
          <span className="whitespace-nowrap">Si pagan fuera de término:</span>{" "}
          <span className="whitespace-nowrap">hasta {formatARS(montos.fueraDeTermino)}</span>
        </span>
      ) : null}
      {montos.otorgados > 0.5 ? (
        <span>
          <span className="whitespace-nowrap">Beneficios otorgados</span>{" "}
          <span className="whitespace-nowrap">{formatARS(montos.otorgados)}</span>
        </span>
      ) : null}
    </>
  );
}

/**
 * Los montos de debajo de la barra: lo que queda fuera del estimado (si pagan fuera de
 * término, beneficios otorgados) y, a la derecha, "Faltan $X" o "Completo". `antes` va
 * primero (el Inicio pone ahí "$ cobrado de $ estimado"). Cada dato baja entero; en un
 * celular angosto, el monto puede ir debajo de su nombre.
 */
export function MontosIngreso({ fila, antes }: { fila: ResumenConcepto; antes?: React.ReactNode }) {
  const m = montosEstimado(fila);
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 pt-0.5 text-sm text-muted-foreground tabular">
      {antes}
      <ExtrasEstimado montos={m} />
      {m.falta > 0.009 ? (
        <span className="ml-auto font-medium whitespace-nowrap text-pendiente">Faltan {formatARS(m.falta)}</span>
      ) : (
        <span className="ml-auto font-medium text-pagado">Completo</span>
      )}
    </div>
  );
}

/**
 * Fila de ingresos por concepto, contra su estimado pagando en término (el mismo de
 * Facturación y del Inicio): el nombre y "$ cobrado de $ estimado", la barra y debajo lo que
 * falta. La cuenta cierra en el renglón (cobrado + faltan = estimado); el tope si pagan
 * fuera de término y los beneficios otorgados van aparte, en chico.
 * `descuentos` es el nombre de la columna de la RPC; en pantalla (y en la impresión y el
 * Excel) es "Beneficios otorgados": los que ya se descontaron a quienes pagaron en término.
 */
export function FilaIngreso({ fila }: { fila: ResumenConcepto }) {
  const { estimado, cobrado } = montosEstimado(fila);
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
