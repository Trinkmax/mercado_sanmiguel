/**
 * Segmentos de clientes (decisiones §1), público de circulares (D2), avance del mes (G5)
 * y lectura de registros en el portal (D5/D6). Client-safe: sin acceso a datos.
 *
 * Es el espejo EXACTO de las funciones SQL de fundación (0011):
 *   private.segmentos_cliente   → segmentosDeCliente()
 *   private.cliente_en_publico  → clienteEnPublico()
 *   v_avance_mes                → textoAvance() (la cuenta la hace SIEMPRE la vista)
 * Si cambia una, cambia la otra. Contrato: docs/FASE3-CONTRATO.md §5.5.
 */
import type { Rol } from "@/lib/auth";
import { formatARS } from "@/lib/format";

// ---------------------------------------------------------------------------
// Categoría: quién gestiona al cliente
// ---------------------------------------------------------------------------

/** Igual al enum `categoria_cliente` (Enums<"categoria_cliente"> cuando se regeneren los tipos). */
export type CategoriaCliente = "puestero" | "quintero" | "ambulante";

export const CATEGORIAS: CategoriaCliente[] = ["puestero", "quintero", "ambulante"];

export const LABEL_CATEGORIA: Record<CategoriaCliente, string> = {
  puestero: "Puestero",
  quintero: "Quintero",
  ambulante: "Ambulante",
};

export const LABEL_CATEGORIA_PLURAL: Record<CategoriaCliente, string> = {
  puestero: "Puesteros",
  quintero: "Quinteros",
  ambulante: "Ambulantes",
};

/** Categorías que gestiona (escribe / cobra) cada rol. Espejo de private.categorias_gestionables(). */
export function categoriasDeRol(rol: Rol): CategoriaCliente[] {
  switch (rol) {
    case "lider":
      return ["puestero", "quintero", "ambulante"];
    case "admin":
      return ["puestero"];
    case "guardia":
      return ["quintero", "ambulante"];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Segmentos (no excluyentes)
// ---------------------------------------------------------------------------

export type Segmento =
  | "socios"
  | "puesteros"
  | "puestos_propios"
  | "locales"
  | "galpones"
  | "conteiners"
  | "cocheras"
  | "quinteros"
  | "ambulantes";

/** En el orden en que se muestran los chips. */
export const SEGMENTOS: { valor: Segmento; label: string; singular: string }[] = [
  { valor: "puesteros", label: "Puesteros", singular: "Puesto" },
  { valor: "puestos_propios", label: "Puestos propios", singular: "Puesto propio" },
  { valor: "locales", label: "Locales", singular: "Local" },
  { valor: "galpones", label: "Galpones", singular: "Galpón" },
  { valor: "conteiners", label: "Contéiners", singular: "Contéiner" },
  { valor: "cocheras", label: "Cocheras", singular: "Cochera" },
  { valor: "quinteros", label: "Quinteros", singular: "Quintero" },
  { valor: "ambulantes", label: "Ambulantes", singular: "Ambulante" },
  { valor: "socios", label: "Socios", singular: "Socio" },
];

export const LABEL_SEGMENTO: Record<Segmento, string> = Object.fromEntries(
  SEGMENTOS.map((s) => [s.valor, s.label])
) as Record<Segmento, string>;

/** conceptos.segmento de cada código (catálogo §2.5). */
export const SEGMENTO_POR_CODIGO: Record<string, Segmento> = {
  EXME: "puesteros",
  EXPP: "puestos_propios",
  EXPL: "locales",
  EXPG: "galpones",
  EXPE: "conteiners",
  EXPC: "cocheras",
  EXPQ: "quinteros",
  AMB: "ambulantes",
};

/** Segmentos que salen de tener un concepto ACTIVO (los de quinteros/ambulantes salen de la categoría). */
const SEGMENTOS_POR_CONCEPTO: ReadonlySet<string> = new Set([
  "puesteros",
  "puestos_propios",
  "locales",
  "galpones",
  "conteiners",
  "cocheras",
]);

/**
 * Misma regla que private.segmentos_cliente: conceptos activos (del cliente y del catálogo)
 * con segmento de espacio + quinteros/ambulantes por categoría + socios si es socio.
 * `conceptosActivos` = solo los cliente_conceptos activos cuyo concepto también está activo.
 */
export function segmentosDeCliente(c: {
  categoria: CategoriaCliente;
  es_socio: boolean;
  conceptosActivos: { segmento: string | null }[];
}): Segmento[] {
  const set = new Set<Segmento>();
  for (const cc of c.conceptosActivos) {
    if (cc.segmento && SEGMENTOS_POR_CONCEPTO.has(cc.segmento)) set.add(cc.segmento as Segmento);
  }
  if (c.categoria === "quintero") set.add("quinteros");
  if (c.categoria === "ambulante") set.add("ambulantes");
  if (c.es_socio) set.add("socios");
  return [...set].sort();
}

// ---------------------------------------------------------------------------
// Público de circulares (D2): "Todos" o unión de segmentos + filtro "Solo socios"
// ---------------------------------------------------------------------------

/** Segmentos elegibles como chips del público (socios va aparte: es un filtro). */
export type SegmentoPublico =
  | "puesteros"
  | "puestos_propios"
  | "locales"
  | "galpones"
  | "conteiners"
  | "quinteros";

/** Valores válidos de circulares.publico (check circulares_publico_check). */
export type Publico = "todos" | "socios" | SegmentoPublico;

export const OPCIONES_PUBLICO: { valor: SegmentoPublico; label: string }[] = [
  { valor: "puesteros", label: "Puesteros" },
  { valor: "puestos_propios", label: "Puestos propios" },
  { valor: "locales", label: "Locales" },
  { valor: "galpones", label: "Galpones" },
  { valor: "conteiners", label: "Contéiners" },
  { valor: "quinteros", label: "Quinteros" },
];

const VALORES_SEGMENTO_PUBLICO: ReadonlySet<string> = new Set(OPCIONES_PUBLICO.map((o) => o.valor));

/** Lo que eligió quien publica: "Todos" o segmentos, y aparte el switch "¿Solo a los socios?". */
export type EleccionPublico = {
  todos: boolean;
  segmentos: SegmentoPublico[];
  soloSocios: boolean;
};

/** Elección → valor de circulares.publico. null = todos; ["socios"] = todos los socios. */
export function armarPublico(e: EleccionPublico): Publico[] | null {
  const segmentos = e.todos
    ? []
    : OPCIONES_PUBLICO.map((o) => o.valor).filter((v) => e.segmentos.includes(v));
  if (segmentos.length === 0) return e.soloSocios ? ["socios"] : null;
  return e.soloSocios ? [...segmentos, "socios"] : segmentos;
}

/** circulares.publico → elección (para editar o mostrar). */
export function leerPublico(publico: string[] | null): EleccionPublico {
  const p = publico ?? [];
  const segmentos = p.filter((v): v is SegmentoPublico => VALORES_SEGMENTO_PUBLICO.has(v));
  return {
    todos: p.includes("todos") || segmentos.length === 0,
    segmentos: p.includes("todos") ? [] : segmentos,
    soloSocios: p.includes("socios"),
  };
}

/**
 * ¿Una circular con este público le llega a este cliente? Misma regla que
 * private.cliente_en_publico: los ambulantes nunca; "socios" filtra; "todos" (o vacío, o solo
 * socios) no filtra por segmento; si no, algún segmento en común.
 * `segmentos` = v_clientes_segmentos.segmentos (incluye "socios" si es socio).
 */
export function clienteEnPublico(
  c: { categoria: CategoriaCliente; segmentos: string[] },
  publico: string[] | null
): boolean {
  if (c.categoria === "ambulante") return false;
  const p = publico ?? [];
  if (p.includes("socios") && !c.segmentos.includes("socios")) return false;
  const elegidos = p.filter((v) => v !== "socios");
  if (p.includes("todos") || elegidos.length === 0) return true;
  return elegidos.some((v) => c.segmentos.includes(v));
}

/**
 * "Todos los clientes" · "Solo socios" · "Puesteros · Locales" · "Quinteros — solo socios".
 * "Todos" a secas se confundía con "Todos los socios" (6 contra 11 en la misma lista): el filtro
 * de socios se nombra siempre igual ("solo socios") y "todos" dice de quiénes.
 */
export function textoPublico(publico: string[] | null): string {
  const e = leerPublico(publico);
  if (e.todos) return e.soloSocios ? "Solo socios" : "Todos los clientes";
  const texto = e.segmentos
    .map((v) => OPCIONES_PUBLICO.find((o) => o.valor === v)?.label ?? v)
    .join(" · ");
  return e.soloSocios ? `${texto} — solo socios` : texto;
}

// ---------------------------------------------------------------------------
// Avance del mes (G5) — los números salen SIEMPRE de la vista v_avance_mes
// ---------------------------------------------------------------------------

export type AvanceMes = {
  total: number;
  pagado: number;
  falta: number;
  cuotas: number;
  cuotas_cubiertas: number;
  cuota_sugerida: number;
};

/** "2 de 4 · Falta $165.000" · "Pagó 12 de 30 días · Falta $45.000" · "Al día" */
export function textoAvance(a: AvanceMes): string {
  const falta = Number(a.falta ?? 0);
  const cuotas = Number(a.cuotas ?? 1);
  const cubiertas = Number(a.cuotas_cubiertas ?? 0);
  if (falta <= 0.009) return "Al día";
  const resto = `Falta ${formatARS(falta)}`;
  if (cuotas <= 1) return resto;
  if (cuotas >= 30) return `Pagó ${cubiertas} de ${cuotas} días · ${resto}`;
  return `${cubiertas} de ${cuotas} · ${resto}`;
}

// ---------------------------------------------------------------------------
// Registros (notificación / apercibimiento / sanción) en el portal — §4.8
// ---------------------------------------------------------------------------

/** El socio todavía no lo abrió nunca → sello "Nueva". */
export function registroSinVer(r: { visto_en: string | null }): boolean {
  return r.visto_en === null;
}

/**
 * Administración o el Líder escribieron después de la última vez que el socio lo abrió
 * (respuesta a su descargo, o un mensaje del staff aunque el socio todavía no haya escrito).
 * No depende del estado: cuando escribe el socio, el trigger iguala socio_leyo_en con su
 * mensaje, así que solo un mensaje del staff posterior lo prende.
 */
export function respuestaNueva(r: {
  estado: string;
  ultimo_mensaje_en: string | null;
  socio_leyo_en: string | null;
}): boolean {
  if (!r.ultimo_mensaje_en) return false;
  if (!r.socio_leyo_en) return true;
  return new Date(r.ultimo_mensaje_en).getTime() > new Date(r.socio_leyo_en).getTime();
}

/** Apercibimiento o sanción al que el socio todavía no le presentó descargo → "Tenés que responder". */
export function esperaDescargo(r: { tipo: string; estado: string }): boolean {
  return (r.tipo === "apercibimiento" || r.tipo === "sancion") && r.estado === "notificado";
}
