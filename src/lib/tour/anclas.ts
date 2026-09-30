import { NAVEGACION, type GrupoNav } from "@/lib/navegacion";

/**
 * Cómo encuentra el tour lo que tiene que señalar: los elementos llevan `data-tour`
 * (uno o varios nombres separados por espacio) y se elige el primero que esté a la
 * vista. Los links del menú son `nav:/ruta`; si el link no se ve (grupo plegado en la
 * barra lateral, o está dentro de «Menú» en la tablet), se señala por dónde se llega.
 */

export type Resolucion = {
  el: HTMLElement;
  /** El nombre que se pidió (clave de `variantes`). */
  nombre: string;
  /** Por dónde se llega cuando el link del menú no está a la vista. */
  via: null | { tipo: "grupo"; grupo: GrupoNav } | { tipo: "menu" };
};

/** Atributo de lo que no cuenta como pantalla real (la capa y la tarjeta del tour). */
export const ATRIBUTO_CAPA = "data-tour-capa";

export function selectorAncla(nombre: string): string {
  return `[data-tour~="${nombre.replace(/["\\]/g, "\\$&")}"]`;
}

function esVisible(el: HTMLElement): boolean {
  if (el.closest(`[${ATRIBUTO_CAPA}]`)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const chequeo = (el as HTMLElement & {
    checkVisibility?: (o?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
  }).checkVisibility;
  if (typeof chequeo === "function") {
    return chequeo.call(el, { checkOpacity: true, checkVisibilityCSS: true });
  }
  const cs = window.getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.opacity !== "0";
}

/** Los contenedores que recortan al elemento (listas con scroll, paneles): lo señalado es
 * solo la parte que se ve adentro de ellos. */
export function ancestrosQueRecortan(el: HTMLElement): HTMLElement[] {
  const lista: HTMLElement[] = [];
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const cs = window.getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(`${cs.overflowX} ${cs.overflowY}`)) lista.push(p);
    if (cs.position === "fixed") break;
    p = p.parentElement;
  }
  return lista;
}

/** La parte visible de un rectángulo dentro de esos contenedores (null si no se ve nada). */
export function recortar(
  r: { top: number; left: number; width: number; height: number },
  ancestros: HTMLElement[]
): { top: number; left: number; width: number; height: number } | null {
  let top = r.top;
  let left = r.left;
  let right = r.left + r.width;
  let bottom = r.top + r.height;
  for (const a of ancestros) {
    const ar = a.getBoundingClientRect();
    top = Math.max(top, ar.top);
    left = Math.max(left, ar.left);
    right = Math.min(right, ar.right);
    bottom = Math.min(bottom, ar.bottom);
  }
  if (bottom - top < 2 || right - left < 2) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/** El primer elemento visible con ese nombre de ancla. */
export function primeraVisible(nombre: string): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(selectorAncla(nombre));
  for (const el of todos) {
    if (esVisible(el)) return el;
  }
  return null;
}

function grupoDeRuta(ruta: string): GrupoNav | null {
  return NAVEGACION.find((i) => i.href === ruta)?.grupo ?? null;
}

/** Busca la primera ancla visible de la lista; para los links del menú, por dónde se llega. */
export function resolverAnclas(nombres: string[]): Resolucion | null {
  for (const nombre of nombres) {
    const el = primeraVisible(nombre);
    if (el) return { el, nombre, via: null };
  }
  for (const nombre of nombres) {
    if (!nombre.startsWith("nav:/")) continue;
    const grupo = grupoDeRuta(nombre.slice(4));
    if (grupo) {
      const cabecera = primeraVisible(`nav-grupo:${grupo}`);
      if (cabecera) return { el: cabecera, nombre, via: { tipo: "grupo", grupo } };
    }
    const menu = primeraVisible("nav:menu");
    if (menu) return { el: menu, nombre, via: { tipo: "menu" } };
  }
  return null;
}

/** La ruta (sin query) a la que lleva un link señalado, si es un link interno. */
export function rutaDeLink(el: HTMLElement): string | null {
  const a = el instanceof HTMLAnchorElement ? el : el.querySelector<HTMLAnchorElement>("a[href]") ?? el.closest<HTMLAnchorElement>("a[href]");
  if (!a) return null;
  try {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/** Carpetas fijas que conviven con un `[id]` ("/clientes/nuevo" no es la ficha de un cliente). */
const SEGMENTOS_FIJOS = new Set(["nuevo", "nueva", "editar", "registros", "imprimir", "guia"]);

/**
 * ¿La ubicación actual (pathname + query) es la pantalla del paso?
 * - "/clientes/[id]" coincide con "/clientes/0b3…" (no con "/clientes/nuevo").
 * - "/configuracion?tab=usuarios": la ruta igual y esos parámetros con ese valor.
 * - Sin "[…]" ni "?": la ruta exacta (la query de la ubicación no importa).
 */
export function coincideRuta(ubicacion: string, ruta: string): boolean {
  const [pathActual, queryActual = ""] = ubicacion.split("?");
  const [pathRuta, queryRuta] = ruta.split("?");
  if (pathRuta.includes("[")) {
    const a = pathActual.split("/");
    const b = pathRuta.split("/");
    const iguales =
      a.length === b.length &&
      b.every((seg, i) => (/^\[[^\]]+\]$/.test(seg) ? a[i] !== "" && !SEGMENTOS_FIJOS.has(a[i]) : seg === a[i]));
    if (!iguales) return false;
  } else if (pathActual !== pathRuta) {
    return false;
  }
  if (!queryRuta) return true;
  const actual = new URLSearchParams(queryActual);
  for (const [clave, valor] of new URLSearchParams(queryRuta)) {
    if (actual.get(clave) !== valor) return false;
  }
  return true;
}

export function esPatron(ruta: string): boolean {
  return ruta.includes("[");
}

/** Dónde está la persona: pathname + query ("/configuracion?tab=usuarios"). */
export function ubicacionActual(): string {
  return window.location.pathname + window.location.search;
}
