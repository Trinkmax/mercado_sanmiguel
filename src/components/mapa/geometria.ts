import { formatFraccion } from "@/lib/format";
import type { ClienteMapa, ElementoPlano, Espacio, EstadoCobro, Rect, TipoEspacio } from "./tipos";

/** Dos puestos de la misma fila con menos de esto entre sí se tocan. */
const TOLERANCIA_CONTIGUO = 8;

/** Bloque del plano: uno o varios espacios contiguos que se dibujan como una
 * sola pieza (los puestos seguidos de un mismo puestero, o un grupo del plano
 * original que sigue libre). Espacios de izquierda a derecha. */
export type Bloque = {
  clave: string;
  tipo: TipoEspacio;
  espacios: Espacio[];
  rect: Rect;
  clienteId: string | null;
};

function contiguos(a: Espacio, b: Espacio): boolean {
  return (
    a.y === b.y &&
    a.h === b.h &&
    b.x - (a.x + a.w) >= 0 &&
    b.x - (a.x + a.w) <= TOLERANCIA_CONTIGUO
  );
}

function seFunden(a: Espacio, b: Espacio): boolean {
  if (a.tipo !== "puesto" || b.tipo !== "puesto" || !contiguos(a, b)) return false;
  if (a.clienteId || b.clienteId) return a.clienteId === b.clienteId;
  // Libres: se muestran juntos si el plano original los dibuja como grupo.
  return a.grupo !== null && a.grupo === b.grupo;
}

export function unir(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Arma los bloques del plano a partir de los espacios (ya con su cliente). */
export function armarBloques(espacios: Espacio[]): Bloque[] {
  const orden = [...espacios].sort((a, b) => a.y - b.y || a.x - b.x);
  const bloques: Bloque[] = [];
  let actual: Espacio[] = [];
  const cerrar = () => {
    if (actual.length === 0) return;
    bloques.push({
      clave: actual[0].id,
      tipo: actual[0].tipo,
      espacios: actual,
      rect: unir(actual),
      clienteId: actual[0].clienteId,
    });
    actual = [];
  };
  for (const e of orden) {
    const previo = actual[actual.length - 1];
    if (previo && seFunden(previo, e)) {
      actual.push(e);
    } else {
      cerrar();
      actual = [e];
    }
  }
  cerrar();
  return bloques;
}

/** Límites del contenido del plano, con margen. */
export function limitesPlano(elementos: ElementoPlano[], espacios: Espacio[]): Rect {
  const todo: Rect[] = [...elementos, ...espacios];
  if (todo.length === 0) return { x: 0, y: 0, w: 1000, h: 500 };
  const r = unir(todo);
  const m = 28;
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}

// ---------- Relieve: alturas de cada bloque ----------

/** Estado visual de un bloque: el de cobro de su cliente, o libre. */
export type EstadoBloque = EstadoCobro | "libre" | "ocupado";
/** Pintura de un bloque: la de su estado, o "neutro" si quedó atenuado. */
export type Material = EstadoBloque | "neutro";
/** Por qué se destaca un bloque: seleccionado, pincel de asignar o aviso. */
export type Marca = "seleccion" | "pincel" | "aviso" | null;

/** Alturas del plano en relieve (unidades del plano). */
export const ALT = {
  puesto: 14, // puesto, bar y local ocupados
  libre: 8, // cualquier espacio libre (lote bajo)
  contenedor: 16, // tambor ocupado
  atenuado: 5, // lo que no coincide con la selección o el filtro
  realce: 4, // hover y foco de teclado: el bloque despega 4 u
  despegue: 10, // seleccionado: la base se separa del piso
  marca: 0, // pincel y aviso no levantan (la fila de números queda alineada)
  faldon: 4.5, // hasta dónde baja el faldón (vista completa)
  faldonDetalle: 8.5, // …y con zoom (deja ver la mercadería)
  mostrador: 4.5,
  cantero: 6,
  ficha: 4,
  fichaSel: 6,
  zocalo: 8,
  muroNorte: 30,
  muroBajo: 6,
  antepecho: 4,
  cabriada: 12,
  adminPared: 16,
  adminCumbrera: 24,
  invernadero: 30,
  cerco: 10,
  arbol: 18,
  cordon: 3,
} as const;

/** Una fila se lee en una línea: ocupado (14) → número a 11; libre (8) → a 11. */
export const COMP_TEXTO = 3;

export type Alturas = {
  /** Traslación del bloque (despega sin cambiar su forma). */
  z0: number;
  /** Altura de la tapa (con la traslación incluida). */
  zTop: number;
  /** Altura a la que van los números. */
  zTexto: number;
  material: Material;
  pintado: boolean;
  libre: boolean;
};

/** Sin hover ni foco de teclado. */
export const REPOSO = { hover: false, foco: false } as const;

/** La ÚNICA función de altura: la usan el cuerpo, las sombras, las huellas, los
 * anillos, las zonas táctiles y la pastilla. */
export function alturaDe(
  b: Pick<Bloque, "tipo">,
  e: { estado: EstadoBloque; atenuado: boolean; marca: Marca },
  i: { hover: boolean; foco: boolean }
): Alturas {
  const libre = e.estado === "libre";
  const hTipo = libre ? ALT.libre : b.tipo === "contenedor" ? ALT.contenedor : ALT.puesto;
  let z0 = 0;
  let zTop: number = hTipo;
  if (e.atenuado) zTop = ALT.atenuado; // el atenuado manda
  else if (e.marca === "seleccion") {
    z0 = ALT.despegue; // flota
    zTop = z0 + hTipo;
  } else if (i.hover || i.foco) {
    z0 = ALT.realce;
    zTop = z0 + hTipo;
  } // pincel y aviso: altura normal
  const enFila = b.tipo === "puesto" || b.tipo === "bar";
  const zTexto = enFila && !e.atenuado ? zTop + (libre ? COMP_TEXTO : -COMP_TEXTO) : zTop;
  const material: Material = e.atenuado ? "neutro" : e.estado;
  return { z0, zTop, zTexto, material, pintado: !libre && !e.atenuado, libre };
}

/** Radio de las esquinas de la tapa (el tambor es una elipse). */
export function radioTapa(b: Pick<Bloque, "tipo" | "rect">): number {
  if (b.tipo === "contenedor") return 0;
  if (b.tipo === "local") return 3;
  return Math.min(4, b.rect.w / 5);
}

/** Unidades de puesto: un medio puesto cuenta 0,5. */
export function unidades(espacios: Espacio[]): number {
  return espacios.reduce((acc, e) => acc + (e.tipo === "puesto" ? (e.medio ? 0.5 : 1) : 0), 0);
}

export const NOMBRE_TIPO: Record<TipoEspacio, string> = {
  puesto: "Puesto",
  bar: "Bar",
  local: "Local",
  contenedor: "Contenedor",
};

const NOMBRE_TIPO_PLURAL: Record<TipoEspacio, string> = {
  puesto: "Puestos",
  bar: "Bar",
  local: "Locales",
  contenedor: "Contenedores",
};

/** "58", "34½", "?" — el número tal como se lee en el plano. */
export function numeroVisible(e: Pick<Espacio, "numero" | "medio" | "tipo">): string {
  if (e.tipo === "bar") return e.numero ?? "Bar";
  const n = e.numero ?? "?";
  return e.medio ? `${n}½` : n;
}

/** Orden natural de números de puesto ("2" < "10" < "Bar"). */
export function compararNumero(a: string | null, b: string | null): number {
  const na = a !== null && /^\d+$/.test(a) ? Number(a) : Number.POSITIVE_INFINITY;
  const nb = b !== null && /^\d+$/.test(b) ? Number(b) : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  return (a ?? "").localeCompare(b ?? "");
}

/** "Puesto 52", "Puestos 52 · 50 · 48", "Local 3" — para una lista del mismo tipo. */
export function etiquetaEspacios(espacios: Pick<Espacio, "tipo" | "numero" | "medio">[]): string {
  if (espacios.length === 0) return "";
  const tipo = espacios[0].tipo;
  if (tipo === "bar") return "Bar";
  const nombres = espacios.map(numeroVisible).join(" · ");
  return `${espacios.length > 1 ? NOMBRE_TIPO_PLURAL[tipo] : NOMBRE_TIPO[tipo]} ${nombres}`;
}

/** Los espacios de un cliente agrupados por tipo, en el orden del plano. */
export function espaciosPorTipo<T extends Pick<Espacio, "tipo" | "x" | "y">>(
  espacios: T[]
): { tipo: TipoEspacio; espacios: T[] }[] {
  const orden: TipoEspacio[] = ["puesto", "bar", "local", "contenedor"];
  return orden
    .map((tipo) => ({
      tipo,
      espacios: espacios
        .filter((e) => e.tipo === tipo)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    }))
    .filter((g) => g.espacios.length > 0);
}

/** Diferencia entre lo que el plano le asigna a un cliente y lo que factura. */
export type Diferencia = {
  tipo: "puesto" | "local" | "contenedor";
  enPlano: number;
  facturado: number;
};

/** Lo que el plano puede mostrar: puestos enteros o medios; locales y
 * contenedores enteros. Una expensa facturada en cuartos (1¼) se compara
 * contra lo representable más cercano. */
export function objetivoPlano(facturado: number, tipo: Diferencia["tipo"]): number {
  return tipo === "puesto" ? Math.round(facturado * 2) / 2 : Math.round(facturado);
}

export function diferencias(cliente: ClienteMapa, suyos: Espacio[]): Diferencia[] {
  const enPlano = {
    puesto: unidades(suyos),
    // El bar se concesiona como un local.
    local: suyos.filter((e) => e.tipo === "local" || e.tipo === "bar").length,
    contenedor: suyos.filter((e) => e.tipo === "contenedor").length,
  };
  const facturado = {
    puesto: cliente.facturado.puestos,
    local: cliente.facturado.locales,
    contenedor: cliente.facturado.contenedores,
  };
  return (["puesto", "local", "contenedor"] as const)
    .filter((t) => Math.abs(enPlano[t] - objetivoPlano(facturado[t], t)) > 0.001)
    .map((t) => ({ tipo: t, enPlano: enPlano[t], facturado: facturado[t] }));
}

const PALABRA: Record<Diferencia["tipo"], [string, string]> = {
  puesto: ["puesto", "puestos"],
  local: ["local", "locales"],
  contenedor: ["contenedor", "contenedores"],
};

export function cantidad(n: number, tipo: Diferencia["tipo"]): string {
  const [uno, varios] = PALABRA[tipo];
  return `${formatFraccion(n)} ${n > 0 && n <= 1 ? uno : varios}`;
}

/** "Factura 3½ puestos y tiene 2 en el plano." */
export function textoDiferencia(d: Diferencia): string {
  return `Factura ${cantidad(d.facturado, d.tipo)} y tiene ${formatFraccion(d.enPlano)} en el plano.`;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
