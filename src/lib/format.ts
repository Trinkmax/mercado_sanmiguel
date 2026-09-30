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

// ---------------------------------------------------------------------------
// Montos tipeados en un input (coma decimal, es-AR). El texto queda como se tipeó
// (con sus puntos) y parseMonto lo interpreta:
//   "1234,56" · "1.234,56" → 1234.56   (con coma, los puntos son de miles)
//   "1.500" · "1.234.567"  → 1500 · 1234567   (punto seguido de 3 dígitos: miles)
//   "1234.5" · "1234.50"   → 1234.5   (sin coma, un punto final con 1 o 2 dígitos es
//                                      la coma decimal: el teclado de la tablet a veces
//                                      solo ofrece el punto)
// Debajo del campo siempre se muestra el monto ya interpretado ("$ 1.234,50").

/** Texto tipeado → número (ver arriba). Vacío o inválido → 0. */
export function parseMonto(texto: string): number {
  if (!texto) return 0;
  const limpio = texto.replace(/[^\d.,]/g, "");
  let normal: string;
  const coma = limpio.indexOf(",");
  if (coma >= 0) {
    normal = `${limpio.slice(0, coma).replace(/\./g, "") || "0"}.${limpio.slice(coma + 1).replace(/\D/g, "")}`;
  } else {
    const decimal = /^(.*)\.(\d{1,2})$/.exec(limpio);
    normal = decimal ? `${decimal[1].replace(/\./g, "") || "0"}.${decimal[2]}` : limpio.replace(/\./g, "");
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Deja dígitos, puntos y una única coma decimal (hasta 2 decimales después de la coma).
 * Los puntos se conservan para que parseMonto decida si son de miles o la coma decimal.
 */
export function sanitizarMonto(texto: string): string {
  const limpio = texto.replace(/[^\d.,]/g, "");
  const [entero, ...resto] = limpio.split(",");
  return resto.length > 0 ? `${entero},${resto.join("").replace(/\D/g, "").slice(0, 2)}` : entero;
}

/** Número → texto del input (coma decimal). 0 → "". */
export function montoATexto(n: number): string {
  if (!(n > 0)) return "";
  return String(redondear2(n)).replace(".", ",");
}

export function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
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

/** Porcentaje de un concepto del cliente: "70 %", "33,33 %" (100 = entero). */
export function formatPorcentaje(porcentaje: number | string | null | undefined): string {
  const n = Number(porcentaje ?? 100);
  return `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}

/** Monto mensual de un concepto: cantidad × precio × porcentaje (redondeado a centavos). */
export function montoConcepto(cantidad: number, precio: number, porcentaje = 100): number {
  return Math.round(cantidad * precio * porcentaje) / 100;
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
  { valor: 30, label: "Todos los días", ayuda: "Paga por día" },
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

// ---------------------------------------------------------------------------
// Fase 3 (docs/FASE3-CONTRATO.md §5.4)
// ---------------------------------------------------------------------------

/** Moneda de tesorería (enum `moneda` en la base). Los dólares NUNCA se suman a los pesos. */
export type Moneda = "ARS" | "USD";

export const LABEL_MONEDA: Record<Moneda, string> = { ARS: "Pesos", USD: "Dólares" };

const usd = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdConCentavos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$ 1.234" (pesos, igual que formatARS) o "US$ 1.234" (dólares). */
export function formatMoneda(
  monto: number | string | null | undefined,
  moneda: Moneda = "ARS"
): string {
  if (moneda === "ARS") return formatARS(monto);
  const n = Number(monto ?? 0);
  return Number.isInteger(n) ? usd.format(n) : usdConCentavos.format(n);
}

/** DNI: solo dígitos ("12.345.678" → "12345678"). */
export function normalizarDni(v: string): string {
  return v.replace(/\D/g, "");
}

/** DNI de login: 7 u 8 dígitos (mismo check que perfiles.dni en la base). */
export function esDniValido(v: string): boolean {
  return /^[0-9]{7,8}$/.test(normalizarDni(v));
}

/** "12345678" → "12.345.678". Si no es un DNI válido lo devuelve tal cual. */
export function formatDni(dni: string | null | undefined): string {
  if (!dni) return "—";
  const d = normalizarDni(dni);
  if (!/^[0-9]{7,8}$/.test(d)) return dni;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** CUIT: solo dígitos ("20-12345678-3" → "20123456783"). */
export function limpiarCuit(v: string): string {
  return v.replace(/\D/g, "");
}

/** Lo que exige la base (cheques.cuit): 11 dígitos. */
export function cuitTieneOnceDigitos(v: string): boolean {
  return /^[0-9]{11}$/.test(limpiarCuit(v));
}

/**
 * 11 dígitos y dígito verificador correcto (módulo 11). En la UI es un AVISO, nunca un
 * bloqueo: un CUIT atípico o mal leído no traba el cobro ("Está bien así, seguir").
 */
export function esCuitValido(v: string): boolean {
  const c = limpiarCuit(v);
  if (!/^[0-9]{11}$/.test(c)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(c[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto;
  if (verificador === 10) return false;
  return verificador === Number(c[10]);
}

/** "20123456783" → "20-12345678-3". Si no tiene 11 dígitos lo devuelve tal cual. */
export function formatCuit(cuit: string | null | undefined): string {
  if (!cuit) return "—";
  const c = limpiarCuit(cuit);
  if (c.length !== 11) return cuit;
  return `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}`;
}

/** Semáforo de deuda (B3): verde al día · ámbar debe pero en término · rojo algo vencido. */
export type NivelDeuda = "al_dia" | "en_termino" | "vencido";

/**
 * deuda y deudaVencida salen de v_deuda_clientes (deuda, deuda_vencida); saldoFavor de
 * v_saldo_favor. Un cliente sin fila en v_deuda_clientes está al día.
 */
export function nivelDeuda(d: {
  deuda: number;
  deudaVencida: number;
  saldoFavor?: number;
}): NivelDeuda {
  const neta = Number(d.deuda ?? 0) - Number(d.saldoFavor ?? 0);
  if (neta <= 0.009) return "al_dia";
  if (Number(d.deudaVencida ?? 0) > 0.009) return "vencido";
  return "en_termino";
}

/** Clave de <Sello> para cada nivel. */
export const SELLO_NIVEL_DEUDA: Record<NivelDeuda, "al_dia" | "en_termino" | "vencido"> = {
  al_dia: "al_dia",
  en_termino: "en_termino",
  vencido: "vencido",
};

export const TEXTO_NIVEL_DEUDA: Record<NivelDeuda, string> = {
  al_dia: "Al día",
  en_termino: "Debe, en término",
  vencido: "Vencido",
};

/** Cuotas por mes "Todos los días" (C5): se guarda 30 en clientes.cuotas_mes. */
export const CUOTAS_TODOS_LOS_DIAS = 30;
