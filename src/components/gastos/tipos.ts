import { fechaLocal, formatFecha, formatFechaLarga } from "@/lib/format";

/* Tipos y helpers de Gastos (client-safe). */

/** Una caja de administración donde se puede imputar un gasto (no validada). */
export type CajaElegible = {
  /** null = la caja de hoy todavía no existe: se abre al pagar (Administración y el Líder). */
  id: string | null;
  fecha: string;
  estado: "abierta" | "cerrada" | "nueva";
  /** Efectivo que tiene que tener ahora según el arqueo. null si no se pudo calcular. */
  efectivo: number | null;
};

/** De dónde sale la plata de un gasto (selector de origen). */
export type OrigenPago = {
  origen: "caja" | "tesoreria";
  /** Caja elegida (solo si origen = caja). */
  caja: CajaElegible | null;
  medio: "efectivo" | "transferencia";
  /** Fecha del pago desde Tesorería ("YYYY-MM-DD", no futura). */
  fecha: string;
};

/** Un gasto pendiente para elegir (pagar con un cheque, vincular, pagar desde Tesorería). */
export type GastoPendiente = {
  id: string;
  etiqueta: string;
  rubroCodigo: string | null;
  monto: number;
  vencimiento: string | null;
  periodo: string;
};

export type Rubro = { id: string; codigo: string; nombre: string };

/** Días entre dos fechas "YYYY-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((fechaLocal(b).getTime() - fechaLocal(a).getTime()) / 86_400_000);
}

/** "Hoy" · "Ayer 27/09" · "Jue 25/09". */
export function diaCorto(fecha: string, hoy: string): string {
  const dif = diasEntre(fecha, hoy);
  const ddmm = formatFecha(fecha).slice(0, 5);
  if (dif === 0) return "Hoy";
  if (dif === 1) return `Ayer ${ddmm}`;
  const dia = formatFechaLarga(fecha).split(" ")[0] ?? "";
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1, 3)} ${ddmm}`;
}

/** "de hoy" · "del 27/09" — para frases ("la caja de hoy", "la caja del 27/09"). */
export function delDia(fecha: string, hoy: string): string {
  return fecha === hoy ? "de hoy" : `del ${formatFecha(fecha).slice(0, 5)}`;
}

/** Chip de una caja: "Hoy · abierta", "Hoy · se abre al pagar", "Ayer 27/09 · cerrada". */
export function etiquetaCaja(c: CajaElegible, hoy: string): string {
  const estado =
    c.estado === "nueva" ? "se abre al pagar" : c.estado === "abierta" ? "abierta" : "cerrada";
  return `${diaCorto(c.fecha, hoy)} · ${estado}`;
}

/** Nombre visible de un gasto: la descripción o, si está vacía, el rubro (E3). */
export function etiquetaGasto(descripcion: string | null | undefined, rubroNombre: string | null | undefined): string {
  const d = descripcion?.trim();
  return d ? d : rubroNombre?.trim() || "Gasto";
}

/** Suma un mes a una fecha "YYYY-MM-DD" (fin de mes seguro: 31/01 → 28/02). */
export function sumarUnMes(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const ultimo = new Date(y, m + 1, 0).getDate();
  const nueva = new Date(y, m, Math.min(d, ultimo));
  return `${nueva.getFullYear()}-${String(nueva.getMonth() + 1).padStart(2, "0")}-${String(nueva.getDate()).padStart(2, "0")}`;
}

export const LABEL_MEDIO_GASTO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Banco",
  cheque: "Cheque",
};
