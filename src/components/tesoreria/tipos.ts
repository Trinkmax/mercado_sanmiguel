import type { Moneda } from "@/lib/format";

/* Tipos y helpers de Tesorería (client-safe). */

/** Forma de `flujo_caja()` (contrato §4.9). */
export type Flujo = {
  pesos: { efectivo: number; efectivo_en_cajas: number; banco: number; total: number };
  dolares: { efectivo: number; banco: number; total: number };
  cheques: { por_cobrar: number; listos: number; depositados: number; total: number };
  total_pesos: number;
};

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Normaliza la respuesta de flujo_caja. Tolera la forma vieja de fase 2
 * ({efectivo, banco, cheques_en_cartera, total}) mientras no esté aplicada 0018.
 */
export function normalizarFlujo(raw: unknown): Flujo {
  const r = obj(raw);
  const pesos = obj(r.pesos);
  const dolares = obj(r.dolares);
  const cheques = obj(r.cheques);
  const efectivo = n(pesos.efectivo ?? r.efectivo);
  const banco = n(pesos.banco ?? r.banco);
  const porCobrar = n(cheques.por_cobrar ?? r.cheques_en_cartera);
  const depositados = n(cheques.depositados);
  return {
    pesos: {
      efectivo,
      efectivo_en_cajas: n(pesos.efectivo_en_cajas),
      banco,
      total: n(pesos.total ?? efectivo + banco),
    },
    dolares: {
      efectivo: n(dolares.efectivo),
      banco: n(dolares.banco),
      total: n(dolares.total),
    },
    cheques: {
      por_cobrar: porCobrar,
      listos: n(cheques.listos),
      depositados,
      total: n(cheques.total ?? porCobrar + depositados),
    },
    total_pesos: n(r.total_pesos ?? r.total),
  };
}

export type TipoMovimiento =
  | "deposito"
  | "extraccion"
  | "comision"
  | "impuesto"
  | "debito_fiscal"
  | "ajuste"
  | "ingreso"
  | "egreso";

export type Cuenta = "efectivo" | "banco";

export const LABEL_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  deposito: "Depósito",
  extraccion: "Extracción",
  comision: "Comisión",
  impuesto: "Impuesto",
  debito_fiscal: "Débito fiscal (IVA)",
  ajuste: "Ajuste",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

/** Descripción por defecto cuando no se escribió ninguna. */
export const DESCRIPCION_TIPO: Record<TipoMovimiento, string> = {
  deposito: "Depósito de efectivo en el banco",
  extraccion: "Extracción del banco",
  comision: "Comisión del banco",
  impuesto: "Impuesto",
  debito_fiscal: "IVA que cobró el banco",
  ajuste: "Ajuste de saldo",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const LABEL_CUENTA: Record<Cuenta, string> = { efectivo: "Efectivo", banco: "Banco" };

/**
 * Pie de los diálogos largos (Tesorería y Cheques): queda pegado abajo mientras se
 * desplaza el contenido, así el botón principal siempre se ve aunque la ventana sea
 * baja. DialogContent tiene p-4: los márgenes negativos lo llevan hasta los bordes.
 */
export const PIE_DIALOGO_FIJO = "sticky bottom-0 z-10 -mx-4 -mb-4 border-t bg-popover px-4 pt-3 pb-4";

/**
 * `onOpenAutoFocus` de un diálogo: el foco va al diálogo y no al primer botón. Si no,
 * el primer motivo o gasto de la lista aparece con el anillo de foco y parece elegido.
 */
export function enfocarDialogo(e: Event) {
  e.preventDefault();
  if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
}

export type Movimiento = {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  descripcion: string | null;
  monto: number;
  moneda: Moneda;
  cuenta: Cuenta;
  cuentaDestino: Cuenta | null;
  grupoId: string | null;
  cajaFecha: string | null;
  /** Nombre de quien lo cargó. */
  cargadoPor: string | null;
  /** Anulado (no cuenta en el flujo; queda a la vista con el rastro). */
  anulado: { por: string; en: string; motivo: string } | null;
  /** Es el vuelto en efectivo de este cheque (N°): se corrige desde Cheques, no se anula suelto. */
  vueltoDeCheque: string | null;
};

/**
 * Efecto de un movimiento en cada cuenta (misma regla que flujo_caja):
 * ajuste (con signo) e ingreso suman; comisión, impuesto, débito fiscal y egreso
 * restan; depósito / extracción pasan plata de una cuenta a la otra.
 */
export function efectoMovimiento(m: {
  tipo: TipoMovimiento;
  monto: number;
  cuenta: Cuenta;
  cuentaDestino: Cuenta | null;
}): Record<Cuenta, number> {
  const e: Record<Cuenta, number> = { efectivo: 0, banco: 0 };
  if (m.tipo === "ajuste" || m.tipo === "ingreso") e[m.cuenta] += m.monto;
  else e[m.cuenta] -= m.monto;
  if ((m.tipo === "deposito" || m.tipo === "extraccion") && m.cuentaDestino) {
    e[m.cuentaDestino] += m.monto;
  }
  return e;
}
