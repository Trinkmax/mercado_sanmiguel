import { formatFraccion } from "@/lib/format";
import type { ClienteMapa, CodigoPlano, ElementoPlano, Espacio, EstadoCobro, Rect, TipoEspacio } from "./tipos";

/** Dos puestos de la misma fila con menos de esto entre sí se tocan. */
const TOLERANCIA_CONTIGUO = 8;

/** Eje de las filas de puestos: "x" en el plano tal cual (filas este-oeste); "y" en
 * el plano girado para una pantalla vertical (orientacion.ts: las filas quedan
 * norte-sur, en columnas). */
export type Eje = "x" | "y";

/** Bloque del plano: uno o varios espacios contiguos que se dibujan como una
 * sola pieza (los puestos seguidos de un mismo puestero, o un grupo del plano
 * original que sigue libre). Espacios de izquierda a derecha (eje "x") o de
 * arriba a abajo (eje "y"). */
export type Bloque = {
  clave: string;
  tipo: TipoEspacio;
  espacios: Espacio[];
  rect: Rect;
  clienteId: string | null;
  /** Eje de la fila del plano: en "y" los puestos del bloque van uno debajo del otro. */
  eje: Eje;
};

function contiguos(a: Espacio, b: Espacio, eje: Eje): boolean {
  if (eje === "y") {
    const hueco = b.y - (a.y + a.h);
    return a.x === b.x && a.w === b.w && hueco >= 0 && hueco <= TOLERANCIA_CONTIGUO;
  }
  return (
    a.y === b.y &&
    a.h === b.h &&
    b.x - (a.x + a.w) >= 0 &&
    b.x - (a.x + a.w) <= TOLERANCIA_CONTIGUO
  );
}

function seFunden(a: Espacio, b: Espacio, eje: Eje): boolean {
  if (a.tipo !== "puesto" || b.tipo !== "puesto" || !contiguos(a, b, eje)) return false;
  if (a.clienteId || b.clienteId) return a.clienteId === b.clienteId;
  // Libres: se muestran juntos si el plano original los dibuja como grupo.
  return a.grupo !== null && a.grupo === b.grupo;
}

/** Orden de recorrido: fila por fila de norte a sur (eje "x"), o columna por columna
 * de derecha a izquierda y de arriba a abajo (eje "y": la imagen girada del mismo
 * orden, así los bloques salen iguales en las dos orientaciones). */
function ordenar(espacios: Espacio[], eje: Eje): Espacio[] {
  return eje === "y"
    ? [...espacios].sort((a, b) => b.x + b.w - (a.x + a.w) || a.y - b.y)
    : [...espacios].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Hacia dónde corren las filas de puestos: el eje en el que hay más puestos
 * pegados uno al lado del otro (el plano girado tiene sus filas en "y"). */
function ejeDeFilas(espacios: Espacio[]): Eje {
  const puestos = espacios.filter((e) => e.tipo === "puesto");
  const pegados = (eje: Eje) =>
    ordenar(puestos, eje).reduce((n, e, i, lista) => (i > 0 && contiguos(lista[i - 1], e, eje) ? n + 1 : n), 0);
  return pegados("y") > pegados("x") ? "y" : "x";
}

/** Los puestos pegados a `e` en su fila, a un costado o al otro (con el plano tal cual o
 * girado): los que, con el mismo dueño, se dibujan unidos en un solo bloque. */
export function vecinosEnFila(e: Espacio, plano: Espacio[]): Espacio[] {
  if (e.tipo !== "puesto") return [];
  const eje = ejeDeFilas(plano);
  return plano.filter(
    (o) => o.id !== e.id && o.tipo === "puesto" && (contiguos(e, o, eje) || contiguos(o, e, eje))
  );
}

export function unir(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

/** Arma los bloques del plano a partir de los espacios (ya con su cliente). Se
 * funden los puestos contiguos a lo largo de la fila: en horizontal (misma y y h)
 * con el plano tal cual, en vertical (misma x y w) con el plano girado. */
export function armarBloques(espacios: Espacio[]): Bloque[] {
  const eje = ejeDeFilas(espacios);
  const orden = ordenar(espacios, eje);
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
      eje,
    });
    actual = [];
  };
  for (const e of orden) {
    const previo = actual[actual.length - 1];
    if (previo && seFunden(previo, e, eje)) {
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
  // El muro norte de la nave (y del galpón) y sus cabriadas se levantan sobre la placa:
  // en el plano girado la nave toca el borde de arriba y hay que dejarles lugar.
  const naves = elementos.filter((e) => e.tipo === "nave" || e.tipo === "galpon");
  const tope = Math.min(...naves.map((n) => n.y - (ALT.muroNorte + ALT.cabriada)));
  if (tope < r.y) return { x: r.x - m, y: tope - m, w: r.w + 2 * m, h: r.y + r.h - tope + 2 * m };
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}

// ---------- Relieve: alturas de cada bloque ----------

/** Estado visual de un bloque: el de cobro de su cliente, o libre. "anonimo" = el
 * Jefe de Portería (G11): se ve el puesto con su número, sin libre/ocupado ni cobro. */
export type EstadoBloque = EstadoCobro | "libre" | "ocupado" | "anonimo";
/** Pintura de un bloque: la de su estado, o "neutro" si quedó atenuado. */
export type Material = EstadoBloque | "neutro";
/** Por qué se destaca un bloque: seleccionado, pincel de asignar o aviso. */
export type Marca = "seleccion" | "pincel" | "aviso" | null;

/** Alturas del plano en relieve (unidades del plano). */
export const ALT = {
  puesto: 14, // puesto, bar y local ocupados
  libre: 8, // cualquier espacio libre (lote bajo)
  contenedor: 16, // caja de contéiner ocupada
  galpon: 15, // subgalpón ocupado
  auto: 11, // cochera ocupada: el auto estacionado
  camion: 12, // quinta ocupada: la camioneta del quintero
  piso: 0.6, // cochera o quinta libre: el lugar pintado en el piso
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

/** Altura de la tapa de cada tipo ocupado. */
const ALTO_TIPO: Record<TipoEspacio, number> = {
  puesto: ALT.puesto,
  bar: ALT.puesto,
  local: ALT.puesto,
  contenedor: ALT.contenedor,
  galpon: ALT.galpon,
  cochera: ALT.auto,
  quinta: ALT.camion,
  invernadero: ALT.invernadero,
};

/** Cochera o quinta sin vehículo: es el lugar pintado en el piso, no un lote levantado
 * (libre, o en el mapa del Jefe, que no sabe si está ocupada). */
export function esPiso(tipo: TipoEspacio, estado: EstadoBloque): boolean {
  return (tipo === "cochera" || tipo === "quinta") && (estado === "libre" || estado === "anonimo");
}

/** La ÚNICA función de altura: la usan el cuerpo, las sombras, las huellas, los
 * anillos, las zonas táctiles y la pastilla. */
export function alturaDe(
  b: Pick<Bloque, "tipo">,
  e: { estado: EstadoBloque; atenuado: boolean; marca: Marca },
  i: { hover: boolean; foco: boolean }
): Alturas {
  const libre = e.estado === "libre";
  // El invernadero es un edificio: libre o atenuado conserva su bóveda (cambia el color).
  const edificio = b.tipo === "invernadero";
  const hTipo = edificio ? ALTO_TIPO[b.tipo] : esPiso(b.tipo, e.estado) ? ALT.piso : libre ? ALT.libre : ALTO_TIPO[b.tipo];
  let z0 = 0;
  let zTop: number = hTipo;
  if (e.atenuado && !edificio) zTop = Math.min(ALT.atenuado, hTipo); // el atenuado manda (lo pintado en el piso no sube)
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

/** Radio de las esquinas de la tapa. */
export function radioTapa(b: Pick<Bloque, "tipo" | "rect">): number {
  if (b.tipo === "contenedor") return 1.5;
  if (b.tipo === "local" || b.tipo === "galpon" || b.tipo === "invernadero") return 3;
  if (b.tipo === "quinta") return 2;
  return Math.min(4, b.rect.w / 5);
}

/** Cuántos puestos cuenta un espacio para la expensa: su tamaño (½ a 3, 0036) o, si no
 * vino, ½ si es medio puesto. Lo que no es puesto cuenta 1. */
export function tamanoDe(e: Pick<Espacio, "tipo" | "medio"> & { tamano?: number | null }): number {
  if (e.tipo !== "puesto") return 1;
  return e.tamano ?? (e.medio ? 0.5 : 1);
}

/** Tamaños que se pueden cargar en un puesto. */
export const TAMANOS_PUESTO = [0.5, 1, 1.5, 2, 2.5, 3] as const;

/** Unidades de puesto: un medio puesto cuenta 0,5; uno y medio, 1,5. */
export function unidades(espacios: Espacio[]): number {
  return espacios.reduce((acc, e) => acc + (e.tipo === "puesto" ? tamanoDe(e) : 0), 0);
}

/** Unidades de puesto comunes (EXME) o propios de la cooperativa (EXPP). */
export function unidadesPuestos(
  espacios: (Pick<Espacio, "tipo" | "medio" | "propio"> & { tamano?: number | null })[],
  propio: boolean
): number {
  return espacios.reduce(
    (acc, e) => acc + (e.tipo === "puesto" && Boolean(e.propio) === propio ? tamanoDe(e) : 0),
    0
  );
}

export const NOMBRE_TIPO: Record<TipoEspacio, string> = {
  puesto: "Puesto",
  bar: "Bar",
  local: "Local",
  contenedor: "Contéiner",
  galpon: "Galpón",
  cochera: "Cochera",
  quinta: "Quinta",
  invernadero: "Invernadero",
};

const NOMBRE_TIPO_PLURAL: Record<TipoEspacio, string> = {
  puesto: "Puestos",
  bar: "Bar",
  local: "Locales",
  contenedor: "Contéiners",
  galpon: "Galpones",
  cochera: "Cocheras",
  quinta: "Quintas",
  invernadero: "Invernaderos",
};

/** El orden en que se nombran los lugares de un cliente. */
const ORDEN_TIPOS: TipoEspacio[] = ["puesto", "bar", "local", "contenedor", "galpon", "invernadero", "cochera", "quinta"];

function esTipoEspacio(t: string): t is TipoEspacio {
  return (ORDEN_TIPOS as string[]).includes(t);
}

/** Nombre de un tipo de espacio en singular o plural ("Contéiner" / "Contéiners"). */
export function nombreTipo(tipo: TipoEspacio, plural = false): string {
  return plural ? NOMBRE_TIPO_PLURAL[tipo] : NOMBRE_TIPO[tipo];
}

/** Cocheras y quintas son femeninas: "la cochera 12", "asignársela". */
export function esFemenino(tipo: TipoEspacio): boolean {
  return tipo === "cochera" || tipo === "quinta";
}

/** "el puesto 58", "la quinta 40", "el bar". */
export function conArticulo(e: Pick<Espacio, "tipo" | "numero" | "medio">): string {
  if (e.tipo === "bar") return "el bar";
  return `${esFemenino(e.tipo) ? "la" : "el"} ${NOMBRE_TIPO[e.tipo].toLowerCase()} ${numeroVisible(e)}`;
}

/** Quién ocupa un lugar: el quintero (quinta), el cliente (cochera, invernadero) o el puestero. */
export function ocupante(tipo: TipoEspacio): string {
  return tipo === "quinta" ? "quintero" : tipo === "cochera" || tipo === "invernadero" ? "cliente" : "puestero";
}

/** "58", "34½", "34 (1½)", "?" — el número tal como se lee en el plano (con el tamaño si
 * el puesto cuenta más de uno). */
export function numeroVisible(e: Pick<Espacio, "numero" | "medio" | "tipo"> & { tamano?: number | null }): string {
  if (e.tipo === "bar") return e.numero ?? "Bar";
  const n = e.numero ?? "?";
  const t = tamanoDe(e);
  if (t === 0.5) return `${n}½`;
  return t === 1 ? n : `${n} (${formatFraccion(t)})`;
}

/** Orden natural de números de puesto ("2" < "10" < "Bar"). */
export function compararNumero(a: string | null, b: string | null): number {
  const na = a !== null && /^\d+$/.test(a) ? Number(a) : Number.POSITIVE_INFINITY;
  const nb = b !== null && /^\d+$/.test(b) ? Number(b) : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  return (a ?? "").localeCompare(b ?? "");
}

/**
 * Etiqueta de UN lugar del plano: "Puesto 58", "Puesto 34½", "Puesto propio 12",
 * "Local 3", "Contéiner 7", "Galpón 9", "Cochera 12", "Quinta 40", "Bar". TS puro
 * (server y client): la usan la ficha, las
 * solicitudes, la energía y las exportaciones (interfaz congelada, FASE3 §6.10).
 */
export function etiquetaEspacio(e: {
  tipo: string;
  numero: string | null;
  medio: boolean;
  propio?: boolean | null;
  tamano?: number | null;
}): string {
  if (e.tipo === "bar") return "Bar";
  const nombre = esTipoEspacio(e.tipo) ? NOMBRE_TIPO[e.tipo] : e.tipo;
  const t = e.tipo === "puesto" ? (e.tamano ?? (e.medio ? 0.5 : 1)) : 1;
  const numero = `${e.numero ?? "?"}${t === 0.5 ? "½" : t === 1 ? "" : ` (${formatFraccion(t)})`}`;
  return e.tipo === "puesto" && e.propio ? `Puesto propio ${numero}` : `${nombre} ${numero}`;
}

/** "Puestos 52 · 50 · Puesto propio 12 · Local 3": todos los lugares de un cliente. */
export function textoEspacios<T extends Pick<Espacio, "tipo" | "numero" | "medio" | "x" | "y"> & { propio?: boolean }>(
  espacios: T[]
): string {
  const partes: string[] = [];
  for (const g of espaciosPorTipo(espacios)) {
    if (g.tipo !== "puesto") {
      partes.push(etiquetaEspacios(g.espacios));
      continue;
    }
    const comunes = g.espacios.filter((e) => !e.propio);
    const propios = g.espacios.filter((e) => e.propio);
    if (comunes.length > 0) partes.push(etiquetaEspacios(comunes));
    if (propios.length > 0) {
      const nums = propios.map(numeroVisible).join(" · ");
      partes.push(`${propios.length > 1 ? "Puestos propios" : "Puesto propio"} ${nums}`);
    }
  }
  return partes.join(" · ");
}

/**
 * Cocheras y galpones que factura y todavía no tienen lugar en el plano: "2 cocheras",
 * "½ galpón". Desde 0032 cada cochera y cada subgalpón se asigna; hasta que se ubiquen,
 * la tarjeta y el buscador nombran lo que falta (si no, dirían menos que su carpeta).
 */
export function sinLugarEnPlano(
  f: { cocheras?: number; galpones?: number },
  suyos: Pick<Espacio, "tipo">[] = []
): string[] {
  const partes: string[] = [];
  const cocheras = Math.max(0, (f.cocheras ?? 0) - suyos.filter((e) => e.tipo === "cochera").length);
  const galpones = Math.max(0, (f.galpones ?? 0) - suyos.filter((e) => e.tipo === "galpon").length);
  if (cocheras > 0) partes.push(`${formatFraccion(cocheras)} ${cocheras > 1 ? "cocheras" : "cochera"}`);
  if (galpones > 0) partes.push(`${formatFraccion(galpones)} ${galpones > 1 ? "galpones" : "galpón"}`);
  return partes;
}

/** "2 cocheras", "2 cocheras y 1 galpón", "a, b y c". */
export function listaConY(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
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
  return ORDEN_TIPOS
    .map((tipo) => ({
      tipo,
      espacios: espacios
        .filter((e) => e.tipo === tipo)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    }))
    .filter((g) => g.espacios.length > 0);
}

/** Diferencia entre lo que el plano le asigna a un cliente y lo que factura.
 * puesto = comunes (EXME) · propio = de la cooperativa (EXPP) · local (EXPL) ·
 * contenedor (EXPE) · galpon (EXPG) · cochera (EXPC) · quinta (EXPQ). */
export type Diferencia = {
  tipo: "puesto" | "propio" | "local" | "contenedor" | "galpon" | "cochera" | "quinta";
  enPlano: number;
  facturado: number;
};

/** Qué código de la carpeta corresponde a cada tipo de diferencia. */
export const CODIGO_DIFERENCIA: Record<Diferencia["tipo"], CodigoPlano> = {
  puesto: "EXME",
  propio: "EXPP",
  local: "EXPL",
  contenedor: "EXPE",
  galpon: "EXPG",
  cochera: "EXPC",
  quinta: "EXPQ",
};

const TIPOS_DIFERENCIA: Diferencia["tipo"][] = ["puesto", "propio", "local", "contenedor", "galpon", "cochera", "quinta"];

/** Lo que el plano puede mostrar: puestos enteros o medios; el resto, enteros.
 * Una expensa facturada en cuartos (1¼) se compara contra lo representable más
 * cercano. */
export function objetivoPlano(facturado: number, tipo: Diferencia["tipo"]): number {
  return tipo === "puesto" || tipo === "propio" ? Math.round(facturado * 2) / 2 : Math.round(facturado);
}

export function diferencias(cliente: ClienteMapa, suyos: Espacio[]): Diferencia[] {
  const enPlano = {
    puesto: unidadesPuestos(suyos, false),
    propio: unidadesPuestos(suyos, true),
    // El bar se concesiona como un local.
    local: suyos.filter((e) => e.tipo === "local" || e.tipo === "bar").length,
    contenedor: suyos.filter((e) => e.tipo === "contenedor").length,
    galpon: suyos.filter((e) => e.tipo === "galpon").length,
    cochera: suyos.filter((e) => e.tipo === "cochera").length,
    quinta: suyos.filter((e) => e.tipo === "quinta").length,
  };
  const facturado = {
    puesto: cliente.facturado.puestos,
    propio: cliente.facturado.propios ?? 0,
    local: cliente.facturado.locales,
    contenedor: cliente.facturado.contenedores,
    galpon: cliente.facturado.galpones,
    cochera: cliente.facturado.cocheras,
    quinta: cliente.facturado.quintas,
  };
  return TIPOS_DIFERENCIA
    .filter((t) => Math.abs(enPlano[t] - objetivoPlano(facturado[t], t)) > 0.001)
    .map((t) => ({ tipo: t, enPlano: enPlano[t], facturado: facturado[t] }));
}

const PALABRA: Record<Diferencia["tipo"], [string, string]> = {
  puesto: ["puesto", "puestos"],
  propio: ["puesto propio", "puestos propios"],
  local: ["local", "locales"],
  contenedor: ["contéiner", "contéiners"],
  galpon: ["galpón", "galpones"],
  cochera: ["cochera", "cocheras"],
  quinta: ["quinta", "quintas"],
};

/** "cochera" o "cocheras" según cuántas (½ y 1 van en singular). */
export function palabra(n: number, tipo: Diferencia["tipo"]): string {
  const [uno, varios] = PALABRA[tipo];
  return n > 0 && n <= 1 ? uno : varios;
}

export function cantidad(n: number, tipo: Diferencia["tipo"]): string {
  return `${formatFraccion(n)} ${palabra(n, tipo)}`;
}

/** "Factura 3½ puestos y tiene 2 en el plano." · "Tiene 1 puesto propio en el plano y no lo factura." */
export function textoDiferencia(d: Diferencia): string {
  if (d.facturado <= 0) {
    return `Tiene ${cantidad(d.enPlano, d.tipo)} en el plano y no ${d.enPlano > 1 ? "los" : "lo"} factura.`;
  }
  return `Factura ${cantidad(d.facturado, d.tipo)} y tiene ${formatFraccion(d.enPlano)} en el plano.`;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
