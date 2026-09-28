/**
 * El arqueo de una caja, tal como lo devuelven `arqueo_caja` y `cerrar_caja`
 * (fórmula única en SQL: private.calcular_arqueo, contrato §4.5).
 * TS puro: sirve en server y client. Lo importan M6 (ValidarCajaDialog) y M8 (inicio).
 *
 *   JUNTASTE (cobros + bono camioneros + caja de portería recibida)
 *   − gastos pagados desde la caja
 *   − cheques entregados a un proveedor en el mismo cobro
 *   ± ajustes de tesorería
 *   = TENÉS QUE TENER: efectivo (cajón) + transferencia (banco) + cheques (en cartera)
 */

export type ChequeEntregadoEnCobro = {
  numero: string;
  monto: number;
  proveedor: string | null;
};

export type Arqueo = {
  /** Cobros vigentes (sin anulados) por medio y total. */
  cobros_efectivo: number;
  cobros_transferencia: number;
  cobros_cheques: number;
  cobros: number;
  /** Cheques que se entregaron a un proveedor en el mismo acto del cobro (no están en la caja). */
  cheques_entregados: number;
  /** Caja de portería: cobrado a quinteros / ambulantes (todos los medios). 0 en administración. */
  quintas: number;
  ambulantes: number;
  /** Bono camioneros (canon de transporte) vigente. */
  canon_efectivo: number;
  canon_transferencia: number;
  canon: number;
  /** Cajas de portería recibidas e integradas en esta caja (solo administración). */
  rendido_efectivo: number;
  rendido_transferencia: number;
  rendido: number;
  rendido_quintas: number;
  rendido_ambulantes: number;
  rendido_canon: number;
  /** cobros + canon + rendido. */
  juntado: number;
  gastos_pagados: number;
  /** Ajustes de tesorería sobre la caja, con signo (+ sobrante, − faltante). */
  ajustes_efectivo: number;
  ajustes_transferencia: number;
  ajustes: number;
  /** Lo que tiene que haber: en el cajón, en el banco y en cheques en cartera. */
  efectivo: number;
  transferencia: number;
  cheques: number;
  cheques_entregados_detalle: ChequeEntregadoEnCobro[];
  /** Datos de la caja (arqueo_caja y cerrar_caja los mandan). */
  caja_id?: string;
  tipo?: "administracion" | "guardia";
  fecha?: string;
  estado?: "abierta" | "cerrada" | "integrada" | "validada";
  /** "vivo" = calculado ahora (caja abierta); "cierre" = lo persistido al cerrar. */
  fuente?: "vivo" | "cierre";
};

const CLAVES_NUMERICAS = [
  "cobros_efectivo",
  "cobros_transferencia",
  "cobros_cheques",
  "cobros",
  "cheques_entregados",
  "quintas",
  "ambulantes",
  "canon_efectivo",
  "canon_transferencia",
  "canon",
  "rendido_efectivo",
  "rendido_transferencia",
  "rendido",
  "rendido_quintas",
  "rendido_ambulantes",
  "rendido_canon",
  "juntado",
  "gastos_pagados",
  "ajustes_efectivo",
  "ajustes_transferencia",
  "ajustes",
  "efectivo",
  "transferencia",
  "cheques",
] as const satisfies readonly (keyof Arqueo)[];

type ClaveNumerica = (typeof CLAVES_NUMERICAS)[number];

/** Un arqueo en cero (caja sin movimientos o dato que no llegó). */
export const ARQUEO_VACIO: Arqueo = {
  ...(Object.fromEntries(CLAVES_NUMERICAS.map((k) => [k, 0])) as Record<ClaveNumerica, number>),
  cheques_entregados_detalle: [],
};

const TIPOS = new Set(["administracion", "guardia"]);
const ESTADOS = new Set(["abierta", "cerrada", "integrada", "validada"]);

/** JSON de `arqueo_caja` / `cerrar_caja` → Arqueo (números como number, faltantes en 0). */
export function parsearArqueo(data: unknown): Arqueo {
  const r = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const numeros = Object.fromEntries(
    CLAVES_NUMERICAS.map((k) => {
      const n = Number(r[k] ?? 0);
      return [k, Number.isFinite(n) ? n : 0];
    })
  ) as Record<ClaveNumerica, number>;
  const detalle = Array.isArray(r.cheques_entregados_detalle)
    ? (r.cheques_entregados_detalle as Record<string, unknown>[]).map((c) => ({
        numero: String(c?.numero ?? ""),
        monto: Number(c?.monto ?? 0),
        proveedor: c?.proveedor ? String(c.proveedor) : null,
      }))
    : [];
  return {
    ...numeros,
    cheques_entregados_detalle: detalle,
    caja_id: typeof r.caja_id === "string" ? r.caja_id : undefined,
    tipo: typeof r.tipo === "string" && TIPOS.has(r.tipo) ? (r.tipo as Arqueo["tipo"]) : undefined,
    fecha: typeof r.fecha === "string" ? r.fecha : undefined,
    estado:
      typeof r.estado === "string" && ESTADOS.has(r.estado) ? (r.estado as Arqueo["estado"]) : undefined,
    fuente: r.fuente === "vivo" || r.fuente === "cierre" ? r.fuente : undefined,
  };
}

/** Lo que tiene que haber en total (cajón + banco + cheques en cartera). */
export function totalTenesQueTener(a: Arqueo): number {
  return a.efectivo + a.transferencia + a.cheques;
}

/** Cobros de la caja de portería que no son de quinteros ni ambulantes (no debería haber). */
export function otrosCobrosPorteria(a: Arqueo): number {
  const resto = a.cobros - a.quintas - a.ambulantes;
  return Math.abs(resto) < 0.01 ? 0 : resto;
}
