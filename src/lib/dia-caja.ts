import { fechaLocal, hoyISO } from "@/lib/format";

/**
 * Cajas de días anteriores (0048): se puede abrir y cargar la caja de un día que ya pasó,
 * hasta este tope hacia atrás (el mismo que controla abrir_caja en la base).
 */
export const DIAS_ATRAS_CAJA = 62;

function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** El día más viejo cuya caja todavía se puede abrir. */
export function primerDiaCaja(hoy: string = hoyISO()): string {
  const d = fechaLocal(hoy);
  d.setDate(d.getDate() - DIAS_ATRAS_CAJA);
  return aISO(d);
}

/**
 * "2026-10-05" si es un día ANTERIOR a hoy que todavía se puede cargar; si no (hoy, futuro,
 * muy viejo o mal escrito), null: se trabaja en la caja de hoy.
 */
export function diaAnteriorValido(valor: string | null | undefined, hoy: string = hoyISO()): string | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = fechaLocal(valor);
  if (Number.isNaN(d.getTime()) || aISO(d) !== valor) return null;
  if (valor >= hoy || valor < primerDiaCaja(hoy)) return null;
  return valor;
}
