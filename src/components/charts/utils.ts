/** Helpers de formato para ejes y etiquetas de los gráficos (es-AR). */

/** Azul de serie (paleta validada CVD). Serie única = un solo tono, sin leyenda. */
export const AZUL_SERIE = "#4353c9";

const conUnDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Monto abreviado para ejes y etiquetas directas: $ 2,5 M · $ 850 mil · $ 900. */
export function abreviarARS(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$ ${conUnDecimal.format(n / 1_000_000)} M`;
  if (abs >= 1_000) return `$ ${entero.format(n / 1_000)} mil`;
  return `$ ${entero.format(n)}`;
}

/** "2026-08-05" → "05/08" (para ticks del eje X). */
export function diaMes(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}
