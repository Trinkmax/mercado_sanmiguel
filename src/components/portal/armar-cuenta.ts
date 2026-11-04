import {
  formatFechaLarga,
  hoyISO,
  labelPeriodo,
  nivelDeuda,
  redondear2,
  saldoCargo,
  diasHasta,
  type NivelDeuda,
} from "@/lib/format";
import { etiquetaEspacios, espaciosPorTipo } from "@/components/mapa/geometria";
import type { TipoEspacio } from "@/components/mapa/tipos";
import { textoCargo } from "@/components/cobranza/descripcion-cargo";
import type { AvanceMes, CategoriaCliente } from "@/lib/segmentos";
import type { LugarPlano } from "./plano-portal";

/**
 * La cuenta del socio en palabras del socio. Lógica pura (sin datos ni JSX): recibe lo que
 * sale de la base y arma lo que dibuja el portal. Los números NO se recalculan: salen de
 * v_deuda_clientes, v_saldo_favor, v_avance_mes y saldoCargo (igual que Cobrar y la ficha).
 */

export type CargoCrudo = {
  id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  vencimiento: string;
  monto: number;
  monto_pagado: number;
  descuento_pronto_pago: number;
  estado: "pendiente" | "parcial" | "pagado" | "anulado";
  /** Reconocimiento de deuda (0055): tiene plan de pago, no se vence. */
  reconocimiento: boolean;
};

export type LugarCrudo = {
  id: string;
  tipo: TipoEspacio;
  numero: string | null;
  medio: boolean;
  tamano: number | null;
  propio: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MedidorCrudo = { numero: string; espacio_id: string | null };

// ---------------------------------------------------------------------------
// Conceptos: cada cargo con nombre claro, su ícono y dónde queda
// ---------------------------------------------------------------------------

export type IconoConcepto =
  | "puesto"
  | "cochera"
  | "quinta"
  | "luz"
  | "galpon"
  | "conteiner"
  | "local"
  | "deuda"
  | "multa"
  | "otro";

type Datos = { nombre: string; icono: IconoConcepto; ayuda: string | null };

/** Los nombres de la carpeta son contables («Expensas Cobradas»): al socio se le dice qué es. */
const POR_CODIGO: Record<string, Datos> = {
  EXME: { nombre: "Expensas de tu puesto", icono: "puesto", ayuda: "Lo que paga cada puesto todos los meses." },
  EXPP: { nombre: "Expensas de tu puesto", icono: "puesto", ayuda: "Lo que paga cada puesto propio todos los meses." },
  EXCO: { nombre: "Contribución del puesto", icono: "puesto", ayuda: "La contribución mensual de tu puesto." },
  EXPL: { nombre: "Expensas de tu local", icono: "local", ayuda: "Lo que paga tu local todos los meses." },
  EXPG: { nombre: "Expensas de tu galpón", icono: "galpon", ayuda: "Lo que paga tu galpón todos los meses." },
  EXPE: { nombre: "Expensas de tu contéiner", icono: "conteiner", ayuda: "Lo que paga tu contéiner todos los meses." },
  EXPQ: { nombre: "Tu quinta", icono: "quinta", ayuda: "El alquiler mensual de tu lugar en la playa de quintas." },
  EXPC: { nombre: "Tu cochera", icono: "cochera", ayuda: "El alquiler mensual de tu cochera." },
  ENER: { nombre: "Luz", icono: "luz", ayuda: "Lo que marcó tu medidor este mes." },
  ABEN: { nombre: "Abono de la luz", icono: "luz", ayuda: "El abono fijo de la luz, todos los meses." },
  MULT: { nombre: "Multa", icono: "multa", ayuda: "Una multa de la cooperativa. Los detalles están en Mensajes." },
};

function datosDe(c: Pick<CargoCrudo, "codigo" | "descripcion" | "reconocimiento">): Datos {
  if (c.codigo === "RD") {
    return c.reconocimiento
      ? {
          nombre: "Tu plan de pago",
          icono: "deuda",
          ayuda: "La deuda de antes que reconociste con un plan de pago. No se vence y no te hace perder el beneficio.",
        }
      : { nombre: "Deuda anterior", icono: "deuda", ayuda: "Lo que venías debiendo de antes de empezar con este sistema." };
  }
  return POR_CODIGO[c.codigo] ?? { nombre: c.descripcion, icono: "otro", ayuda: null };
}

/** Lo que aclara el renglón: cantidad, porcentaje, medidor y consumo, o las semanas descontadas. */
function detalleDe(c: Pick<CargoCrudo, "codigo" | "descripcion">): string | null {
  const texto = textoCargo(c.descripcion);
  const noVino = /no vino (\d+) semanas?/i.exec(texto);
  if (noVino) {
    const n = Number(noVino[1]);
    return `No viniste ${n === 1 ? "1 semana" : `${n} semanas`}: ya está descontado`;
  }
  const partes: string[] = [];
  const medidor = /Medidor N° (.+?) \(([^()]*kWh)\)/.exec(texto);
  if (medidor) partes.push(`Medidor ${medidor[1]} · ${medidor[2]}`);
  const veces = /× (\d+(?:[.,]\d+)?)/.exec(texto);
  if (veces) partes.push(`Cantidad: ${veces[1]}`);
  const porciento = /· (\d+(?:[.,]\d+)?) %/.exec(texto);
  if (porciento) partes.push(`${porciento[1]} %`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

const TIPO_POR_CODIGO: Record<string, TipoEspacio> = {
  EXME: "puesto",
  EXPP: "puesto",
  EXCO: "puesto",
  EXPL: "local",
  EXPG: "galpon",
  EXPE: "contenedor",
  EXPC: "cochera",
  EXPQ: "quinta",
};

/** Dónde queda lo que se paga: un concepto del plano lleva a sus lugares; la luz, a su medidor. */
function lugaresDe(
  c: Pick<CargoCrudo, "codigo" | "descripcion">,
  lugares: LugarCrudo[],
  medidores: MedidorCrudo[],
  principal: LugarCrudo[]
): LugarCrudo[] {
  if (c.codigo === "ENER" || c.codigo === "ABEN") {
    const numero = /Medidor N° (.+?) \(/.exec(c.descripcion)?.[1];
    const medidor = numero ? medidores.find((m) => m.numero === numero) : medidores.find((m) => m.espacio_id);
    const suyo = medidor?.espacio_id ? lugares.find((l) => l.id === medidor.espacio_id) : null;
    return suyo ? [suyo] : principal;
  }
  const tipo = TIPO_POR_CODIGO[c.codigo];
  if (!tipo) return [];
  let suyos = lugares.filter((l) => l.tipo === tipo);
  if (c.codigo === "EXPP") suyos = suyos.filter((l) => l.propio);
  if (c.codigo === "EXME") suyos = suyos.filter((l) => !l.propio);
  return suyos.length > 0 ? suyos : principal;
}

export type Concepto = {
  id: string;
  codigo: string;
  nombre: string;
  icono: IconoConcepto;
  detalle: string | null;
  ayuda: string | null;
  /** Como figura en la carpeta (por si en Administración lo nombran así). */
  descripcion: string;
  periodo: string;
  vencimiento: string;
  monto: number;
  pagado: number;
  /** Lo que falta hoy (con el beneficio si está en término). */
  saldo: number;
  beneficio: number;
  reconocimiento: boolean;
  /** Clave de <Sello>. */
  sello: "pagado" | "parcial" | "pendiente" | "vencido";
  /** En qué color se prende en el plano. */
  tono: "al_dia" | "en_termino" | "vencido";
  lugares: string[];
  lugaresTexto: string | null;
};

/** Cuánto se ahorra hoy por pagar en término (0 si no aplica o ya venció). */
function beneficioCargo(c: CargoCrudo): number {
  if (c.estado === "pagado" || c.estado === "anulado") return 0;
  if (c.descuento_pronto_pago <= 0 || hoyISO() > c.vencimiento) return 0;
  const b = c.monto - c.monto_pagado - saldoCargo(c);
  return b > 0 ? redondear2(b) : 0;
}

function selloDe(c: CargoCrudo): Concepto["sello"] {
  if (c.estado === "pagado") return "pagado";
  if (c.vencimiento < hoyISO() && !c.reconocimiento) return "vencido";
  return c.estado === "parcial" ? "parcial" : "pendiente";
}

function tonoDe(sello: Concepto["sello"]): Concepto["tono"] {
  return sello === "pagado" ? "al_dia" : sello === "vencido" ? "vencido" : "en_termino";
}

// ---------------------------------------------------------------------------
// Lugares
// ---------------------------------------------------------------------------

/** Los lugares del socio en el orden en que se nombran; a un quintero, primero su quinta. */
export function ordenarLugares(lugares: LugarCrudo[], categoria: CategoriaCliente): LugarCrudo[] {
  const grupos = espaciosPorTipo(lugares).map((g) => g.espacios);
  if (categoria === "quintero") {
    grupos.sort((a, b) => Number(b[0].tipo === "quinta") - Number(a[0].tipo === "quinta"));
  }
  return grupos.flat();
}

/** Los del tipo principal: los que encuadra el plano al entrar. */
export function lugaresPrincipales(ordenados: LugarCrudo[]): LugarCrudo[] {
  const primero = ordenados[0];
  return primero ? ordenados.filter((l) => l.tipo === primero.tipo) : [];
}

export function aLugarPlano(l: LugarCrudo): LugarPlano {
  const numero = l.tipo === "bar" ? (l.numero ?? "Bar") : l.numero ? `${l.numero}${l.medio ? "½" : ""}` : null;
  return { id: l.id, tipo: l.tipo, numero, x: l.x, y: l.y, w: l.w, h: l.h };
}

/** "Puesto 58" · "Puestos 58 · 56" (con más de tres: "Puestos 58 · 56 · 54 y 2 más"). */
export function etiquetaChapa(lugares: LugarCrudo[]): string | null {
  if (lugares.length === 0) return null;
  if (lugares.length <= 3) return etiquetaEspacios(lugares);
  const primeros = lugares.slice(0, 3);
  return `${etiquetaEspacios(primeros)} y ${lugares.length - 3} más`;
}

// ---------------------------------------------------------------------------
// La cuenta
// ---------------------------------------------------------------------------

export type Cuenta = {
  nivel: NivelDeuda;
  /** Lo que muestra el cartel: lo que debe hoy, sin el plan de pago. */
  principal: number;
  /** Lo que queda del plan de pago (reconocimiento de deuda). */
  plan: number;
  /** Lo vencido, ya descontado el saldo a favor: lo que hay que pagar hoy. */
  vencido: number;
  vencidoDesde: string | null;
  /** Lo vencido viene de más de una fecha: «desde el…» en vez de «el…». */
  vencidoVariasFechas: boolean;
  /** Algo de lo vencido tenía beneficio (solo así se puede decir que lo perdió). */
  perdioBeneficio: boolean;
  /** Lo que todavía no venció (sin el plan de pago): se paga hasta `proximoVencimiento`. */
  enTermino: number;
  proximoVencimiento: string | null;
  beneficio: number;
  favorAplicado: number;
  favorSobrante: number;
  avance: AvanceMes | null;
  conceptosMes: Concepto[];
  /** Lo que quedó sin pagar de meses anteriores, por mes (lo más nuevo primero). */
  atrasados: { periodo: string; total: number; conceptos: Concepto[] }[];
  conceptoPlan: Concepto[];
  periodo: string;
  /** Solo el mes: "noviembre". */
  mes: string;
};

export function armarCuenta(d: {
  cargos: CargoCrudo[];
  lugares: LugarCrudo[];
  principal: LugarCrudo[];
  medidores: MedidorCrudo[];
  deuda: number;
  deudaVencida: number;
  vencidoDesde: string | null;
  proximoVencimiento: string | null;
  saldoFavor: number;
  avance: AvanceMes | null;
  periodo: string;
}): Cuenta {
  const conceptos: Concepto[] = d.cargos.map((c) => {
    const datos = datosDe(c);
    const suyos = lugaresDe(c, d.lugares, d.medidores, d.principal);
    const sello = selloDe(c);
    return {
      id: c.id,
      codigo: c.codigo,
      nombre: datos.nombre,
      icono: datos.icono,
      ayuda: datos.ayuda,
      detalle: detalleDe(c),
      descripcion: textoCargo(c.descripcion),
      periodo: c.periodo,
      vencimiento: c.vencimiento,
      monto: c.monto,
      pagado: c.monto_pagado,
      saldo: saldoCargo(c),
      beneficio: beneficioCargo(c),
      reconocimiento: c.reconocimiento,
      sello,
      tono: tonoDe(sello),
      lugares: suyos.map((l) => l.id),
      lugaresTexto: suyos.length > 0 ? (etiquetaChapa(suyos) ?? null) : null,
    };
  });

  const planCargos = conceptos.filter((c) => c.reconocimiento && c.saldo > 0.009);
  const planTotal = redondear2(planCargos.reduce((a, c) => a + c.saldo, 0));

  const nivel = nivelDeuda({ deuda: d.deuda, deudaVencida: d.deudaVencida, saldoFavor: d.saldoFavor });
  const favorAplicado = redondear2(Math.min(d.saldoFavor, d.deuda));
  const aPagar = Math.max(redondear2(d.deuda - favorAplicado), 0);
  const plan = redondear2(Math.min(planTotal, aPagar));
  const principal = Math.max(redondear2(aPagar - plan), 0);

  const vencido = Math.min(Math.max(redondear2(d.deudaVencida - favorAplicado), 0), principal);
  const vencidos = d.cargos.filter((c) => saldoCargo(c) > 0.009 && selloDe(c) === "vencido");

  // Lo que se generó para un mes que todavía no llegó, también entra: si no, sumaría al cartel
  // sin que se vea en ningún renglón.
  const conceptosMes = conceptos.filter((c) => c.periodo >= d.periodo && !c.reconocimiento);

  const porMes = new Map<string, Concepto[]>();
  for (const c of conceptos) {
    if (c.reconocimiento || c.periodo >= d.periodo || c.saldo <= 0.009) continue;
    const lista = porMes.get(c.periodo);
    if (lista) lista.push(c);
    else porMes.set(c.periodo, [c]);
  }
  const atrasados = [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([periodo, lista]) => ({
      periodo,
      total: redondear2(lista.reduce((acc, c) => acc + c.saldo, 0)),
      conceptos: lista,
    }));

  return {
    nivel,
    principal,
    plan,
    vencido,
    vencidoDesde: d.vencidoDesde,
    vencidoVariasFechas: new Set(vencidos.map((c) => c.vencimiento)).size > 1,
    perdioBeneficio: vencidos.some((c) => c.descuento_pronto_pago > 0),
    enTermino: Math.max(redondear2(principal - vencido), 0),
    proximoVencimiento: d.proximoVencimiento,
    beneficio: redondear2(conceptos.reduce((a, c) => a + c.beneficio, 0)),
    favorAplicado,
    favorSobrante: Math.max(redondear2(d.saldoFavor - favorAplicado), 0),
    avance: d.avance,
    conceptosMes,
    atrasados,
    conceptoPlan: planCargos,
    periodo: d.periodo,
    mes: nombreMes(d.periodo),
  };
}

// ---------------------------------------------------------------------------
// Palabras
// ---------------------------------------------------------------------------

/** "2026-11-01" → "noviembre". */
export function nombreMes(periodo: string): string {
  return labelPeriodo(periodo).split(" ")[0].toLowerCase();
}

/** "domingo 30 de noviembre", o "hoy" / "mañana". */
export function diaEnPalabras(iso: string): string {
  const dias = diasHasta(iso);
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  return sinComa(formatFechaLarga(iso));
}

/** "lunes, 30 de noviembre" → "lunes 30 de noviembre". */
export function sinComa(fecha: string): string {
  return fecha.replace(",", "");
}

/** "Te quedan 27 días" · "Te queda 1 día" · "Vence hoy". */
export function textoDias(iso: string): string {
  const dias = diasHasta(iso);
  if (dias <= 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Te quedan ${dias} días`;
}

/** Cómo se llaman las cuotas de quien paga en partes. */
export function nombreCuotas(a: Pick<AvanceMes, "cuotas" | "semanas_no_vino">): { uno: string; varios: string } {
  const base = Number(a.cuotas ?? 1) + Number(a.semanas_no_vino ?? 0);
  if (base === 4) return { uno: "semana", varios: "semanas" };
  if (base === 2) return { uno: "quincena", varios: "quincenas" };
  if (base >= 28) return { uno: "día", varios: "días" };
  return { uno: "cuota", varios: "cuotas" };
}

/**
 * Cuántas cuotas están pagas de verdad. `cuotas_cubiertas` de v_avance_mes compara contra el total
 * sin el beneficio, así que cuenta el beneficio como pagado («3 de 30 días» sin haber pagado nada).
 * Acá sale de lo que pagó sobre lo que tiene que pagar (lo pagado + lo que falta hoy).
 */
export function avanceReal(a: AvanceMes): { fraccion: number; cubiertas: number } {
  const cuotas = Math.max(1, Number(a.cuotas ?? 1));
  const falta = Number(a.falta ?? 0);
  const pagado = Number(a.pagado ?? 0);
  if (falta <= 0.009) return { fraccion: 1, cubiertas: cuotas };
  const fraccion = pagado > 0 ? pagado / (pagado + falta) : 0;
  return { fraccion, cubiertas: Math.min(cuotas - 1, Math.floor(fraccion * cuotas)) };
}

/** Ancho aproximado de un monto en em, en la letra del cartel: el número llena el ancho justo. */
export function anchoMontoEm(entero: string): number {
  let em = 0;
  for (const ch of entero) {
    if (/\d/.test(ch)) em += 0.57;
    else if (ch === "$") em += 0.56;
    else if (ch === ".") em += 0.24;
    else if (ch === " " || ch === " ") em += 0.2;
    else em += 0.5;
  }
  return Math.round(em * 100) / 100;
}

/** "lunes 2 de noviembre" de un timestamptz, en hora argentina. */
export function fechaLargaTS(iso: string): string {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return diaEnPalabrasPasado(dia);
}

function diaEnPalabrasPasado(dia: string): string {
  const dias = diasHasta(dia);
  if (dias === 0) return "hoy";
  if (dias === -1) return "ayer";
  return sinComa(formatFechaLarga(dia));
}

/** Día (número) y mes corto de un timestamptz, para el talón del pago. */
export function diaYMesTS(iso: string): { dia: string; mes: string; periodo: string } {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "short",
  }).formatToParts(new Date(iso));
  const clave = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
  return {
    dia: partes.find((p) => p.type === "day")?.value ?? "",
    mes: (partes.find((p) => p.type === "month")?.value ?? "").replace(".", ""),
    periodo: `${clave}-01`,
  };
}
