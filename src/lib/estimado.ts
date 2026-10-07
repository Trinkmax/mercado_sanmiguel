/**
 * El estimado del mes, con UNA sola definición para todas las pantallas (Inicio de cada rol,
 * Reportes, Facturación, la impresión para la contadora y el Excel), así cuadran al peso.
 *
 * Casi todos pagan en término (pedido de Administración, octubre de 2026): el número
 * principal es lo que se espera cobrar si quienes todavía están a tiempo pagan con el
 * beneficio, no el precio completo de los cargos. El beneficio DIVIDE (monto / 1,15 con 15 %,
 * private.monto_con_beneficio / centavosConBeneficio).
 *
 * Sale de las filas de `resumen_conceptos` (sin SQL nuevo):
 * - `estimado` de la RPC: Σ monto de los cargos, a precio completo.
 * - `cobrado`: lo que ya entró.
 * - `descuentos`: beneficios ya otorgados a quienes pagaron en término.
 * - `pendiente`: lo que se debe hoy (con el beneficio a quien sigue en término; completo a
 *   quien ya venció).
 *
 * Con eso:
 *   estimado (pagando en término) = cobrado + falta cobrar
 *   beneficio en término          = precio completo − cobrado − falta − otorgados
 *   si pagan fuera de término      = estimado + beneficio en término  (el tope: "hasta")
 *   precio completo                = estimado + beneficio en término + otorgados
 *
 * Antes del vencimiento, el estimado es Σ monto con beneficio (EXME 80.500.000 → 70.000.000);
 * después, lo vencido cuenta a precio completo y los beneficios ya otorgados no se cuentan.
 */
export type FilaEstimado = {
  estimado: number | string | null;
  cobrado: number | string | null;
  descuentos: number | string | null;
  pendiente: number | string | null;
};

export type MontosEstimado = {
  /** Lo que se espera cobrar si quienes están en término pagan en término: cobrado + falta. */
  estimado: number;
  /** Lo que ya entró. */
  cobrado: number;
  /** Lo que se debe hoy (la pista roja de las barras). */
  falta: number;
  /** Beneficio de quienes todavía no pagaron y siguen en término: se cobra solo si pagan tarde. */
  enTermino: number;
  /** El tope si los que están en término pagan tarde: estimado + beneficio en término. */
  fueraDeTermino: number;
  /** Beneficios ya descontados a quienes pagaron en término (solo informativo). */
  otorgados: number;
  /** Σ monto de los cargos a precio completo (lo que antes se llamaba "estimado"). */
  completo: number;
};

/** A centavos enteros: las sumas de muchos cargos no arrastran errores de coma flotante. */
function centavos(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Los montos del estimado de varias filas de `resumen_conceptos` sumadas (un total). */
export function sumarEstimado(filas: readonly FilaEstimado[]): MontosEstimado {
  let completo = 0;
  let cobrado = 0;
  let otorgados = 0;
  let falta = 0;
  let enTermino = 0;
  for (const f of filas) {
    const c = centavos(f.estimado);
    const co = centavos(f.cobrado);
    const o = centavos(f.descuentos);
    const p = centavos(f.pendiente);
    completo += c;
    cobrado += co;
    otorgados += o;
    falta += p;
    enTermino += Math.max(c - co - p - o, 0);
  }
  const estimado = cobrado + falta;
  return {
    estimado: estimado / 100,
    cobrado: cobrado / 100,
    falta: falta / 100,
    enTermino: enTermino / 100,
    fueraDeTermino: (estimado + enTermino) / 100,
    otorgados: otorgados / 100,
    completo: completo / 100,
  };
}

/** Los montos del estimado de una fila de `resumen_conceptos` (un concepto). */
export function montosEstimado(fila: FilaEstimado): MontosEstimado {
  return sumarEstimado([fila]);
}

/** Porcentaje cobrado del estimado, de 0 a 100 (100 si no hay nada por cobrar). */
export function porcentajeCobrado(m: Pick<MontosEstimado, "estimado" | "cobrado">): number {
  if (m.estimado <= 0) return 100;
  return Math.min(Math.max((m.cobrado / m.estimado) * 100, 0), 100);
}
