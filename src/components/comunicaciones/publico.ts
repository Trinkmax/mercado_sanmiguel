/**
 * Público de una circular y "quién la vio" (D1, D2). Client-safe, sin acceso a datos.
 * El público se calcula SIEMPRE con clienteEnPublico() (espejo de private.cliente_en_publico)
 * sobre las filas de v_clientes_segmentos: "socios" es un filtro, no un segmento más.
 */
import {
  CATEGORIAS,
  clienteEnPublico,
  LABEL_CATEGORIA,
  LABEL_CATEGORIA_PLURAL,
  type CategoriaCliente,
} from "@/lib/segmentos";

/** Fila de v_clientes_segmentos que usan Comunicaciones (formulario, detalle y ficha). */
export type ClientePublico = {
  cliente_id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  categoria: CategoriaCliente;
  segmentos: string[];
  tiene_portal: boolean;
  activo: boolean;
};

/** Normaliza una fila de la vista (todas sus columnas son nullable en los tipos). */
export function aClientePublico(r: {
  cliente_id: string | null;
  codigo: number | null;
  nombre: string | null;
  apodo: string | null;
  categoria: string | null;
  segmentos: string[] | null;
  tiene_portal: boolean | null;
  activo: boolean | null;
}): ClientePublico | null {
  if (!r.cliente_id || !r.categoria) return null;
  return {
    cliente_id: r.cliente_id,
    codigo: r.codigo ?? 0,
    nombre: r.nombre ?? "",
    apodo: r.apodo,
    categoria: r.categoria as CategoriaCliente,
    segmentos: r.segmentos ?? [],
    tiene_portal: Boolean(r.tiene_portal),
    activo: Boolean(r.activo),
  };
}

export type Lector = ClientePublico & { vio_en: string | null };

export type ResumenLectura = {
  /** Clientes activos del público + cualquiera que ya la haya visto. */
  lectores: Lector[];
  total: number;
  vieron: number;
  /** Del total, los que no la vieron y no tienen usuario del portal. */
  sinPortal: number;
};

export function resumenLectura(
  publico: string[] | null,
  clientes: ClientePublico[],
  recepciones: Map<string, string>
): ResumenLectura {
  const lectores: Lector[] = [];
  for (const c of clientes) {
    const vio = recepciones.get(c.cliente_id) ?? null;
    if (vio || (c.activo && clienteEnPublico(c, publico))) lectores.push({ ...c, vio_en: vio });
  }
  const vieron = lectores.filter((l) => l.vio_en).length;
  const sinPortal = lectores.filter((l) => !l.vio_en && !l.tiene_portal).length;
  return { lectores, total: lectores.length, vieron, sinPortal };
}

/**
 * "4 puesteros y 2 quinteros": de qué categorías sale el total. Sirve para que "La vieron 1 de 6"
 * cierre con lo que Administración ve en Clientes (solo sus puesteros). null si hay una sola.
 */
export function desgloseCategorias(lectores: { categoria: CategoriaCliente }[]): string | null {
  const cuenta = new Map<CategoriaCliente, number>();
  for (const l of lectores) cuenta.set(l.categoria, (cuenta.get(l.categoria) ?? 0) + 1);
  if (cuenta.size < 2) return null;
  const partes = CATEGORIAS.filter((c) => cuenta.has(c)).map((c) => {
    const n = cuenta.get(c) ?? 0;
    return `${n} ${(n === 1 ? LABEL_CATEGORIA[c] : LABEL_CATEGORIA_PLURAL[c]).toLowerCase()}`;
  });
  return partes.length === 2 ? partes.join(" y ") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/** Cuántos del público lo ven en el portal y cuántos no (formulario de circular). */
export function contarPublico(
  publico: string[] | null,
  clientes: ClientePublico[]
): { total: number; conPortal: number; sinPortal: number } {
  let total = 0;
  let conPortal = 0;
  for (const c of clientes) {
    if (!c.activo || !clienteEnPublico(c, publico)) continue;
    total += 1;
    if (c.tiene_portal) conPortal += 1;
  }
  return { total, conPortal, sinPortal: total - conPortal };
}
