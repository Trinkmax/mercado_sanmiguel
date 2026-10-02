/**
 * Listado de Clientes: chips de filtro por rol y mini-etiquetas de lo que tiene
 * cada cliente ("Puesto 58 · 60", "Local 3", "2 galpones"). Compartido server/client.
 * Los segmentos en sí salen SIEMPRE de `v_clientes_segmentos` (espejo: src/lib/segmentos.ts);
 * acá solo se decide qué chips ve cada rol y cómo se escriben las etiquetas.
 * Reemplaza a `tipo-cliente.ts` (tipo único y "Depósitos", que ya no existen: C1, C2).
 */
import type { Rol } from "@/lib/auth";
import { formatFraccion } from "@/lib/format";
import { LABEL_SEGMENTO, type Segmento } from "@/lib/segmentos";

/** Fila 1 del listado — "¿Qué tiene?" (?seg=). Se combinan con la fila 2 (AND). */
export function segmentosDeRol(rol: Rol): Segmento[] {
  if (rol === "guardia") return ["quinteros", "ambulantes"];
  const puesteros: Segmento[] = [
    "puesteros",
    "puestos_propios",
    "locales",
    "galpones",
    "conteiners",
    "cocheras",
  ];
  if (rol === "lider") return [...puesteros, "quinteros", "ambulantes", "empleados", "socios"];
  return [...puesteros, "empleados", "socios"];
}

export { LABEL_SEGMENTO };

/** Fila 2 del listado — "¿Cómo está?" (?estado=). */
export type FiltroEstado = "deuda" | "vencidos" | "bajas";

export const FILTROS_ESTADO: { valor: FiltroEstado; label: string }[] = [
  { valor: "deuda", label: "Con deuda" },
  { valor: "vencidos", label: "Vencidos" },
  { valor: "bajas", label: "Dados de baja" },
];

/**
 * Compatibilidad con links viejos: ?tipo=vencidos|deuda (Inicio) y ?filtro=vencidos pasan
 * a estado; ?tipo=puesteros|locales|quinteros a segmento; ?tipo=depositos se ignora.
 */
export function leerFiltrosListado(sp: {
  seg?: string;
  estado?: string;
  tipo?: string;
  filtro?: string;
}): { seg: Segmento | null; estado: FiltroEstado | null } {
  const estados = new Set<string>(FILTROS_ESTADO.map((f) => f.valor));
  const segmentos = new Set<string>(Object.keys(LABEL_SEGMENTO));
  let estado: FiltroEstado | null = sp.estado && estados.has(sp.estado) ? (sp.estado as FiltroEstado) : null;
  let seg: Segmento | null = sp.seg && segmentos.has(sp.seg) ? (sp.seg as Segmento) : null;
  const viejo = sp.tipo ?? sp.filtro;
  if (!estado && (viejo === "vencidos" || viejo === "deuda")) estado = viejo;
  if (!seg && viejo && viejo !== "depositos" && segmentos.has(viejo)) seg = viejo as Segmento;
  return { seg, estado };
}

/* ------------------------------------------------------------------ */
/* Mini-etiquetas de la fila                                           */
/* ------------------------------------------------------------------ */

export type EspacioDeCliente = {
  tipo: string;
  numero: string | null;
  medio: boolean;
  propio: boolean;
};

export type ConceptoDeCliente = { codigo: string; cantidad: number };

/** "58", "34½", "?" */
function numeroEspacio(e: EspacioDeCliente): string {
  const n = e.numero ?? "?";
  return e.medio ? `${n}½` : n;
}

function ordenNumero(a: EspacioDeCliente, b: EspacioDeCliente): number {
  const na = Number(a.numero);
  const nb = Number(b.numero);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return (a.numero ?? "").localeCompare(b.numero ?? "");
}

/** "Puesto 58" · "Puestos 58 · 60" · "Contéiner 7" */
function etiquetaGrupo(singular: string, plural: string, espacios: EspacioDeCliente[]): string {
  const nums = [...espacios].sort(ordenNumero).map(numeroEspacio).join(" · ");
  return `${espacios.length > 1 ? plural : singular} ${nums}`;
}

/** "2 galpones" · "½ galpón" · "1 cochera" */
function cantidadConNombre(n: number, singular: string, plural: string): string {
  return `${formatFraccion(n)} ${n > 1 ? plural : singular}`;
}

/**
 * Lo que tiene el cliente, en el orden del plano. Lo ubicado en el plano manda (con sus
 * números); si factura algo que todavía no está ubicado, se muestra la cantidad facturada.
 * La quinta, solo la del puestero que además alquila una (0046), al final: la del quintero
 * ya la dice su categoría.
 */
export function etiquetasCliente(
  espacios: EspacioDeCliente[],
  conceptos: ConceptoDeCliente[],
  categoria?: string
): string[] {
  const cantidad = (codigo: string) =>
    conceptos.filter((c) => c.codigo === codigo).reduce((acc, c) => acc + Number(c.cantidad), 0);
  const etiquetas: string[] = [];

  const puestos = espacios.filter((e) => e.tipo === "puesto" && !e.propio);
  if (puestos.length > 0) etiquetas.push(etiquetaGrupo("Puesto", "Puestos", puestos));
  else if (cantidad("EXME") > 0) etiquetas.push(cantidadConNombre(cantidad("EXME"), "puesto", "puestos"));

  const propios = espacios.filter((e) => e.tipo === "puesto" && e.propio);
  if (propios.length > 0) etiquetas.push(etiquetaGrupo("Puesto propio", "Puestos propios", propios));
  else if (cantidad("EXPP") > 0)
    etiquetas.push(cantidadConNombre(cantidad("EXPP"), "puesto propio", "puestos propios"));

  const locales = espacios.filter((e) => e.tipo === "local");
  const bar = espacios.some((e) => e.tipo === "bar");
  if (locales.length > 0) etiquetas.push(etiquetaGrupo("Local", "Locales", locales));
  if (bar) etiquetas.push("Bar");
  if (locales.length === 0 && !bar && cantidad("EXPL") > 0)
    etiquetas.push(cantidadConNombre(cantidad("EXPL"), "local", "locales"));

  if (cantidad("EXPG") > 0) etiquetas.push(cantidadConNombre(cantidad("EXPG"), "galpón", "galpones"));

  const conteiners = espacios.filter((e) => e.tipo === "contenedor");
  if (conteiners.length > 0) etiquetas.push(etiquetaGrupo("Contéiner", "Contéiners", conteiners));
  else if (cantidad("EXPE") > 0)
    etiquetas.push(cantidadConNombre(cantidad("EXPE"), "contéiner", "contéiners"));

  if (cantidad("EXPC") > 0) etiquetas.push(cantidadConNombre(cantidad("EXPC"), "cochera", "cocheras"));

  if (categoria === "puestero") {
    const quintas = espacios.filter((e) => e.tipo === "quinta");
    if (quintas.length > 0) etiquetas.push(etiquetaGrupo("Quinta", "Quintas", quintas));
    else if (cantidad("EXPQ") > 0) etiquetas.push(cantidadConNombre(cantidad("EXPQ"), "quinta", "quintas"));
  }
  return etiquetas;
}

/** Sin tildes ni mayúsculas, para buscar "Juarez" y encontrar "Juárez". */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
