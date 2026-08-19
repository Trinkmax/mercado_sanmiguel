/** Tipo de cliente derivado de sus conceptos activos (no se guarda en la base:
 * se calcula siempre desde `cliente_conceptos`). Compartido server/client. */

import { formatFraccion } from "@/lib/format";

export type ConceptoDeCliente = {
  cantidad: number;
  activo: boolean;
  codigo: string;
};

export type TipoCliente =
  | "Quintero"
  | "Local"
  | "Puestero"
  | "Depósito"
  | "Otro"
  | "Sin conceptos";

/**
 * Prioridad de chequeo: quintero > local > puestero > depósito.
 * Con conceptos pero ninguno de esos códigos → "Otro" (ej.: solo cocheras).
 */
export function derivarTipoCliente(items: ConceptoDeCliente[]): TipoCliente {
  const activos = items.filter((i) => i.activo && Number(i.cantidad) > 0);
  const codigos = new Set(activos.map((i) => i.codigo));
  if (codigos.has("EXPQ")) return "Quintero";
  if (codigos.has("EXPL")) return "Local";
  if (codigos.has("EXPP")) return "Puestero";
  if (codigos.has("EXPG") || codigos.has("EXPE")) return "Depósito";
  if (activos.length > 0) return "Otro";
  return "Sin conceptos";
}

/** ¼ → "¼" · 0,5 → "½" · 1,25 → "1¼" · 2 → "2" (cuartos, como pide el cliente). */
export function formatCantidadCorta(n: number): string {
  return formatFraccion(n);
}

const EXTRAS: Array<[codigo: string, singular: string, plural: string]> = [
  ["EXPC", "cochera", "cocheras"],
  ["EXPG", "galpón", "galpones"],
  ["EXPE", "contéiner", "contéineres"],
];

/** Lo extra que alquila, ej.: "2 cocheras · 1 galpón". Null si no tiene. */
export function extrasCliente(items: ConceptoDeCliente[]): string | null {
  const partes: string[] = [];
  for (const [codigo, singular, plural] of EXTRAS) {
    const item = items.find(
      (i) => i.activo && i.codigo === codigo && Number(i.cantidad) > 0
    );
    if (!item) continue;
    const n = Number(item.cantidad);
    partes.push(`${formatCantidadCorta(n)} ${n >= 2 ? plural : singular}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Chips de filtro del listado. `valor` va a la URL como ?tipo=… */
export const FILTROS_CLIENTES: Array<{ valor?: string; label: string }> = [
  { label: "Todos" },
  { valor: "puesteros", label: "Puesteros" },
  { valor: "quinteros", label: "Quinteros" },
  { valor: "locales", label: "Locales" },
  { valor: "depositos", label: "Depósitos" },
  { valor: "deuda", label: "Con deuda" },
  { valor: "vencidos", label: "Vencidos" },
];

/** Filtro de la URL → tipo derivado que tiene que tener el cliente. */
export const TIPO_POR_FILTRO: Record<string, TipoCliente> = {
  puesteros: "Puestero",
  quinteros: "Quintero",
  locales: "Local",
  depositos: "Depósito",
};
