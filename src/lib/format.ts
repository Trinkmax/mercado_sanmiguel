/** Formato de moneda, fechas, períodos y fracciones — es-AR en todo el sistema.
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
    hourCycle: "h23",
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

/** Cantidad de un concepto en fracciones de cuarto: 0,25 → "¼", 1,5 → "1½",
 * 2,75 → "2¾", 3 → "3". Se aceptan cuartos (pedido del cliente). */
export function formatFraccion(cantidad: number | string | null | undefined): string {
  const n = Number(cantidad ?? 0);
  const entero = Math.floor(n);
  const resto = Math.round((n - entero) * 4); // en cuartos
  const frac = resto === 1 ? "¼" : resto === 2 ? "½" : resto === 3 ? "¾" : "";
  if (resto === 4) return String(entero + 1);
  if (entero === 0) return frac || "0";
  return `${entero}${frac}`;
}

/** Redondea al cuarto más cercano (mínimo 0). */
export function redondearCuarto(n: number): number {
  return Math.max(0, Math.round(n * 4) / 4);
}

/** Paso mínimo de cantidad de un concepto. */
export const PASO_CANTIDAD = 0.25;

/** Opciones de "paga el mes en N veces" (frecuencia de pagos parciales). */
export const OPCIONES_CUOTAS_MES: { valor: number; label: string; ayuda: string }[] = [
  { valor: 1, label: "1 vez", ayuda: "Todo junto" },
  { valor: 2, label: "2 veces", ayuda: "Quincenal" },
  { valor: 3, label: "3 veces", ayuda: "Cada 10 días" },
  { valor: 4, label: "4 veces", ayuda: "Semanal" },
];

/** Días de la semana (ISO: 1 = lunes … 7 = domingo), para horarios de personal. */
export const DIAS_SEMANA: { valor: number; label: string; corto: string }[] = [
  { valor: 1, label: "Lunes", corto: "Lun" },
  { valor: 2, label: "Martes", corto: "Mar" },
  { valor: 3, label: "Miércoles", corto: "Mié" },
  { valor: 4, label: "Jueves", corto: "Jue" },
  { valor: 5, label: "Viernes", corto: "Vie" },
  { valor: 6, label: "Sábado", corto: "Sáb" },
  { valor: 7, label: "Domingo", corto: "Dom" },
];

/** "08:30:00" → "08:30" */
export function formatHora(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

/** Hora local argentina "14:05" de un timestamptz. */
export function formatSoloHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: TZ_AR,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Días que faltan (o pasaron, negativo) desde hoy (huso AR) hasta una fecha "YYYY-MM-DD". */
export function diasHasta(iso: string): number {
  const a = fechaLocal(hoyISO()).getTime();
  const b = fechaLocal(iso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Saldo exigible hoy de un cargo (aplica el beneficio por pago en término vigente;
 * en la DB la columna sigue llamándose descuento_pronto_pago).
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
