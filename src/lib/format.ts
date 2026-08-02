/** Formato de moneda, fechas y períodos — es-AR en todo el sistema.
 * La fecha "de negocio" es SIEMPRE la del huso argentino, igual que en las
 * funciones SQL (private.hoy_ar): el server puede correr en UTC. */

export const TZ_AR = "America/Argentina/Cordoba";

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const arsConCentavos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** $ 1.234.567 — sin centavos cuando el monto es entero. */
export function formatARS(monto: number | string | null | undefined): string {
  const n = Number(monto ?? 0);
  return Number.isInteger(n) ? ars.format(n) : arsConCentavos.format(n);
}

/** Número plano con separador de miles: 1.234.567 */
export function formatNumero(n: number | string | null | undefined): string {
  return new Intl.NumberFormat("es-AR").format(Number(n ?? 0));
}

/** Interpreta "YYYY-MM-DD" como fecha local (sin corrimiento de zona horaria). */
export function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 28/07/2026 */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  return fechaLocal(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** martes 28 de julio */
export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return "—";
  return fechaLocal(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** 28/07 14:30 — para timestamps, en hora argentina. */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    timeZone: TZ_AR,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 28/07/2026 — para valores timestamptz (usa el huso argentino).
 * Para fechas puras "YYYY-MM-DD" usá formatFecha. */
export function formatFechaTS(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: TZ_AR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "2026-08-01" → "Agosto 2026" */
export function labelPeriodo(periodo: string): string {
  const d = fechaLocal(periodo);
  const label = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Primer día del mes actual (huso argentino) como "YYYY-MM-DD". */
export function periodoActual(): string {
  return `${hoyISO().slice(0, 7)}-01`;
}

/** Suma meses a un período "YYYY-MM-01". */
export function sumarMeses(periodo: string, meses: number): string {
  const d = fechaLocal(periodo);
  d.setMonth(d.getMonth() + meses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Hoy en el huso argentino como "YYYY-MM-DD" (idéntico a private.hoy_ar en SQL). */
export function hoyISO(): string {
  // en-CA formatea YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Saldo exigible hoy de un cargo (aplica descuento por pronto pago vigente).
 * Calcula en centavos enteros con redondeo half-up para dar EXACTAMENTE lo
 * mismo que `round(numeric, 2)` en Postgres — nunca recalcular con floats.
 */
export function saldoCargo(cargo: {
  estado: string;
  monto: number;
  monto_pagado: number;
  descuento_pronto_pago: number;
  vencimiento: string;
}): number {
  if (cargo.estado === "pagado" || cargo.estado === "anulado") return 0;
  const enTermino = hoyISO() <= cargo.vencimiento;
  const montoCents = Math.round(cargo.monto * 100);
  const descCentesimas = Math.round(cargo.descuento_pronto_pago * 100); // % con 2 decimales
  const objetivoCents = enTermino
    ? Math.floor((montoCents * (10000 - descCentesimas) + 5000) / 10000)
    : montoCents;
  const pagadoCents = Math.round(cargo.monto_pagado * 100);
  return Math.max((objetivoCents - pagadoCents) / 100, 0);
}

export const MEDIOS_PAGO = [
  { valor: "efectivo", label: "Efectivo" },
  { valor: "transferencia", label: "Transferencia" },
  { valor: "cheque", label: "Cheque" },
] as const;

/** Gastos y canon no admiten cheque: quedarían fuera del arqueo y del flujo. */
export const MEDIOS_SIN_CHEQUE = [
  { valor: "efectivo", label: "Efectivo" },
  { valor: "transferencia", label: "Transferencia" },
] as const;
