import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import {
  DIAS_SEMANA,
  formatCuit,
  formatFecha,
  formatHora,
  formatSoloHora,
  labelPeriodo,
  sumarMeses,
} from "@/lib/format";
import { CATEGORIAS, categoriasDeRol, LABEL_SEGMENTO, type CategoriaCliente, type Segmento } from "@/lib/segmentos";
import { labelTipoRegistro } from "@/components/comunicaciones/constantes";
import { etiquetaEspacio } from "@/components/mapa/geometria";
import type { DatasetExportable } from "@/lib/exportar/datasets";
import { fechaExcel, fechaHoraExcel, siNo, type Celda, type Hoja } from "@/lib/exportar/xlsx";
import {
  LABEL_CATEGORIA,
  LABEL_CUENTA,
  LABEL_DESTINO_CANON,
  LABEL_ESTADO_CAJA,
  LABEL_ESTADO_CARGO,
  LABEL_ESTADO_CHEQUE,
  LABEL_ESTADO_GASTO,
  LABEL_ESTADO_NOVEDAD,
  LABEL_ESTADO_REGISTRO,
  LABEL_ESTADO_SOLICITUD,
  LABEL_MEDIO,
  LABEL_MONEDA,
  LABEL_ORIGEN_PAGO_GASTO,
  LABEL_ORIGEN_SOLICITUD,
  LABEL_RESOLUCION_DE,
  LABEL_SECTOR,
  LABEL_TIPO_CAJA,
  LABEL_TIPO_CONTRATO,
  LABEL_TIPO_GASTO,
  LABEL_TIPO_MOVIMIENTO,
  LABEL_TIPO_NOVEDAD,
  LABEL_TIPO_PERSONA,
  LABEL_TIPO_SOLICITUD,
  LABEL_UNIDAD_TARIFA,
  etiqueta,
} from "@/lib/exportar/etiquetas";

/**
 * Consultas de cada dataset exportable. Todas filtran por la organización del
 * perfil (además de la RLS) y, las mensuales, por el período "YYYY-MM-01".
 * Devuelven hojas listas para `generarXlsx`. Columnas de fase 3: FASE3 §6 M9-8.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ContextoExportacion = {
  supabase: Supabase;
  perfil: Perfil;
  /** "YYYY-MM-01" (ya validado). */
  periodo: string;
  /** Opcional: acotar a una sola carpeta (cuenta corriente / pagos). */
  clienteId?: string | null;
};

/** Error de consulta con mensaje para mostrar tal cual. */
export class ErrorExportacion extends Error {}

const TAMANO_PAGINA = 1000;

/** Trae TODAS las filas de una consulta paginando de a 1000 (límite de PostgREST). */
async function paginar<T>(
  hacer: (
    desde: number,
    hasta: number
  ) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await hacer(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw new ErrorExportacion(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < TAMANO_PAGINA) break;
  }
  return filas;
}

/** Nombres de perfiles por user_id (cobró, cerró, validó…). */
async function nombresDe(
  supabase: Supabase,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unicos.length === 0) return new Map();
  const { data, error } = await supabase
    .from("perfiles")
    .select("user_id, nombre")
    .in("user_id", unicos);
  if (error) throw new ErrorExportacion(error.message);
  return new Map((data ?? []).map((p) => [p.user_id, p.nombre]));
}

/** Rango del mes: fechas `date` [desde, hasta) y timestamps en hora argentina. */
function rangoMes(periodo: string) {
  const siguiente = sumarMeses(periodo, 1);
  return {
    desde: periodo,
    hasta: siguiente,
    desdeTs: `${periodo}T00:00:00-03:00`,
    hastaTs: `${siguiente}T00:00:00-03:00`,
  };
}

const n = (v: number | string | null | undefined) => Number(v ?? 0);
/** Número o celda vacía (null = todavía no hay dato, p. ej. una caja abierta). */
const nn = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

type ClienteRef = { codigo: number; nombre: string } | null;
const codigoCliente = (c: ClienteRef) => (c ? c.codigo : null);
const nombreCliente = (c: ClienteRef) => (c ? c.nombre : "");

type EspacioRef = { tipo: string; numero: string | null; medio: boolean; propio?: boolean | null } | null;
const lugar = (e: EspacioRef) => (e ? etiquetaEspacio(e) : "");

/** Categorías de clientes que exporta cada rol: las que gestiona (Administración
 * puesteros, el Jefe quinteros y ambulantes, el Líder todas). Tesorería (pagos): todas. */
function categoriasDe(perfil: Perfil): CategoriaCliente[] {
  if (perfil.rol === "tesoreria" || perfil.rol === "consejo") return [...CATEGORIAS];
  return categoriasDeRol(perfil.rol);
}
const filtraCategorias = (cats: CategoriaCliente[]) => cats.length < CATEGORIAS.length;

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

async function clientes({ supabase, perfil }: ContextoExportacion): Promise<Hoja[]> {
  const org = perfil.org_id;
  const cats = categoriasDe(perfil);
  const [lista, segmentosRes, deudaRes, saldoRes] = await Promise.all([
    paginar((a, b) =>
      supabase
        .from("clientes")
        .select(
          "id, codigo, nombre, apodo, categoria, es_socio, tipo_persona, cuit, telefono, email, direccion, cuotas_mes, activo"
        )
        .eq("org_id", org)
        .in("categoria", cats)
        .order("codigo")
        .range(a, b)
    ),
    paginar((a, b) =>
      supabase
        .from("v_clientes_segmentos")
        .select("cliente_id, segmentos, tiene_portal")
        .eq("org_id", org)
        .order("codigo")
        .range(a, b)
    ),
    supabase.from("v_deuda_clientes").select("cliente_id, deuda").eq("org_id", org),
    supabase.from("v_saldo_favor").select("cliente_id, saldo_favor").eq("org_id", org),
  ]);
  if (deudaRes.error) throw new ErrorExportacion(deudaRes.error.message);
  if (saldoRes.error) throw new ErrorExportacion(saldoRes.error.message);

  const deuda = new Map((deudaRes.data ?? []).map((d) => [d.cliente_id ?? "", n(d.deuda)]));
  const saldo = new Map((saldoRes.data ?? []).map((s) => [s.cliente_id ?? "", n(s.saldo_favor)]));
  const segmentos = new Map(segmentosRes.map((s) => [s.cliente_id ?? "", s]));
  const tiene = (id: string) =>
    (segmentos.get(id)?.segmentos ?? [])
      .filter((v) => v !== "socios")
      .map((v) => LABEL_SEGMENTO[v as Segmento] ?? v)
      .join(" · ");

  return [
    {
      nombre: "Clientes",
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Nombre", ancho: 36 },
        { titulo: "Apodo", ancho: 18 },
        { titulo: "Categoría", ancho: 12 },
        { titulo: "Socio", tipo: "booleano", ancho: 8 },
        { titulo: "Tiene", ancho: 34 },
        { titulo: "Persona", ancho: 10 },
        { titulo: "CUIT", ancho: 15 },
        { titulo: "Teléfono", ancho: 16 },
        { titulo: "Email", ancho: 28 },
        { titulo: "Dirección", ancho: 30 },
        { titulo: "Cuotas por mes", tipo: "entero", ancho: 14 },
        { titulo: "Usa el portal", tipo: "booleano", ancho: 13 },
        { titulo: "Activo", tipo: "booleano" },
        { titulo: "Deuda hoy", tipo: "moneda" },
        { titulo: "Saldo a favor", tipo: "moneda" },
      ],
      filas: lista.map((c) => [
        c.codigo,
        c.nombre,
        c.apodo ?? "",
        etiqueta(LABEL_CATEGORIA, c.categoria),
        siNo(c.es_socio),
        tiene(c.id),
        etiqueta(LABEL_TIPO_PERSONA, c.tipo_persona),
        c.cuit ? formatCuit(c.cuit) : "",
        c.telefono ?? "",
        c.email ?? "",
        c.direccion ?? "",
        c.cuotas_mes,
        siNo(segmentos.get(c.id)?.tiene_portal ?? false),
        siNo(c.activo),
        deuda.get(c.id) ?? 0,
        saldo.get(c.id) ?? 0,
      ]),
      notas: [
        "La deuda es la exigible hoy (con el beneficio por pago en término vigente).",
        "“Tiene” son los segmentos del cliente (Puesteros, Puestos propios, Locales, Galpones, Contéiners, Cocheras, Quinteros, Ambulantes).",
      ],
    },
  ];
}

async function cuentaCorriente({ supabase, perfil, periodo, clienteId }: ContextoExportacion): Promise<Hoja[]> {
  const cats = categoriasDe(perfil);
  const cargos = await paginar((a, b) => {
    let q = supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, monto, monto_pagado, descuento_aplicado, vencimiento, estado, clientes!inner(codigo, nombre, categoria)"
      )
      .eq("org_id", perfil.org_id);
    if (filtraCategorias(cats)) q = q.in("clientes.categoria", cats);
    // Para una carpeta: toda su cuenta corriente (todos los períodos); para la org: el mes.
    q = clienteId ? q.eq("cliente_id", clienteId) : q.eq("periodo", periodo);
    return q.order("id").range(a, b);
  });
  cargos.sort(
    (x, y) =>
      (codigoCliente(x.clientes) ?? 0) - (codigoCliente(y.clientes) ?? 0) ||
      x.codigo.localeCompare(y.codigo)
  );

  const tot = cargos.reduce(
    (acc, c) => ({
      monto: acc.monto + n(c.monto),
      pagado: acc.pagado + n(c.monto_pagado),
      beneficio: acc.beneficio + n(c.descuento_aplicado),
    }),
    { monto: 0, pagado: 0, beneficio: 0 }
  );

  return [
    {
      nombre: clienteId ? "Cuenta corriente" : `Cuenta corriente ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 34 },
        { titulo: "Código", ancho: 9 },
        { titulo: "Descripción", ancho: 34 },
        { titulo: "Período", ancho: 16 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Pagado", tipo: "moneda" },
        { titulo: "Beneficio aplicado", tipo: "moneda", ancho: 18 },
        { titulo: "Vencimiento", tipo: "fecha" },
        { titulo: "Estado", ancho: 11 },
      ],
      filas: cargos.map((c) => [
        codigoCliente(c.clientes),
        nombreCliente(c.clientes),
        c.codigo,
        c.descripcion,
        labelPeriodo(c.periodo),
        n(c.monto),
        n(c.monto_pagado),
        n(c.descuento_aplicado),
        fechaExcel(c.vencimiento),
        etiqueta(LABEL_ESTADO_CARGO, c.estado),
      ]),
      totales: [["", "Total", "", "", "", tot.monto, tot.pagado, tot.beneficio, null, ""]],
    },
  ];
}

async function pagos({ supabase, perfil, periodo, clienteId }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const cats = categoriasDe(perfil);
  const lista = await paginar((a, b) => {
    let q = supabase
      .from("pagos")
      .select(
        "id, numero, lote_id, linea, fecha, monto, medio, titular_transferencia, conciliado, anulado, motivo_anulacion, recibido_por, clientes!inner(codigo, nombre, categoria), caja:cajas(tipo)"
      )
      .eq("org_id", perfil.org_id);
    if (filtraCategorias(cats)) q = q.in("clientes.categoria", cats);
    // Para una carpeta: todos sus pagos; para la org: los del mes.
    q = clienteId ? q.eq("cliente_id", clienteId) : q.gte("fecha", r.desdeTs).lt("fecha", r.hastaTs);
    return q.order("numero").order("linea").range(a, b);
  });
  const nombres = await nombresDe(
    supabase,
    lista.map((p) => p.recibido_por)
  );
  const lineasPorLote = new Map<string, number>();
  for (const p of lista) lineasPorLote.set(p.lote_id, (lineasPorLote.get(p.lote_id) ?? 0) + 1);
  const totalVigente = lista.filter((p) => !p.anulado).reduce((acc, p) => acc + n(p.monto), 0);

  return [
    {
      nombre: clienteId ? "Pagos" : `Pagos ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Recibo N°", tipo: "entero", ancho: 11 },
        { titulo: "Línea", tipo: "entero", ancho: 7 },
        { titulo: "Pago mixto", tipo: "booleano", ancho: 11 },
        { titulo: "Fecha y hora", tipo: "fechaHora" },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 34 },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Titular transferencia", ancho: 26 },
        { titulo: "Conciliado", tipo: "booleano", ancho: 11 },
        { titulo: "Anulado", tipo: "booleano" },
        { titulo: "Motivo de anulación", ancho: 28 },
        { titulo: "Caja", ancho: 17 },
        { titulo: "Cobró", ancho: 22 },
      ],
      filas: lista.map((p) => [
        p.numero,
        p.linea,
        siNo((lineasPorLote.get(p.lote_id) ?? 1) > 1),
        fechaHoraExcel(p.fecha),
        codigoCliente(p.clientes),
        nombreCliente(p.clientes),
        etiqueta(LABEL_MEDIO, p.medio),
        n(p.monto),
        p.titular_transferencia ?? "",
        p.medio === "transferencia" ? siNo(p.conciliado) : "",
        siNo(p.anulado),
        p.motivo_anulacion ?? "",
        etiqueta(LABEL_TIPO_CAJA, p.caja?.tipo),
        nombres.get(p.recibido_por ?? "") ?? "",
      ]),
      totales: [["", null, "", null, null, "Total cobrado (sin anulados)", "", totalVigente, "", "", "", "", "", ""]],
      notas: [
        "Un cobro con varios medios (pago mixto) es UN recibo: sus líneas comparten el N° de recibo.",
        "Las horas son de Argentina.",
      ],
    },
  ];
}

async function cheques({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("cheques")
      .select(
        "id, numero, cuit, recibido_de, titular, puesto, monto, fecha_recibido, fecha_cobro, fecha_depositado, fecha_acreditado, fecha_entregado, proveedor, entregado_en_cobro, estado, motivo_rechazo, notas, cliente:clientes(codigo, nombre)"
      )
      .eq("org_id", perfil.org_id)
      .gte("fecha_recibido", r.desde)
      .lt("fecha_recibido", r.hasta)
      .order("fecha_recibido")
      .order("numero")
      .range(a, b)
  );
  const total = lista.reduce((acc, c) => acc + n(c.monto), 0);

  return [
    {
      nombre: `Cheques ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "N° cheque", ancho: 14 },
        { titulo: "CUIT", ancho: 15 },
        { titulo: "Puesto", ancho: 20 },
        { titulo: "Recibido de", ancho: 28 },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 30 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Recibido", tipo: "fecha" },
        { titulo: "Se cobra desde", tipo: "fecha", ancho: 14 },
        { titulo: "Estado", ancho: 20 },
        { titulo: "Proveedor", ancho: 24 },
        { titulo: "Entregado", tipo: "fecha" },
        { titulo: "Entregado en el cobro", tipo: "booleano", ancho: 19 },
        { titulo: "Depositado", tipo: "fecha" },
        { titulo: "Acreditado", tipo: "fecha" },
        { titulo: "Motivo del rechazo", ancho: 28 },
        { titulo: "Notas", ancho: 30 },
      ],
      filas: lista.map((c) => [
        c.numero,
        c.cuit ? formatCuit(c.cuit) : "",
        c.puesto ?? "",
        c.recibido_de ?? c.titular ?? "",
        codigoCliente(c.cliente),
        nombreCliente(c.cliente),
        n(c.monto),
        fechaExcel(c.fecha_recibido),
        fechaExcel(c.fecha_cobro),
        etiqueta(LABEL_ESTADO_CHEQUE, c.estado),
        c.proveedor ?? "",
        fechaExcel(c.fecha_entregado),
        siNo(c.entregado_en_cobro),
        fechaExcel(c.fecha_depositado),
        fechaExcel(c.fecha_acreditado),
        c.motivo_rechazo ?? "",
        c.notas ?? "",
      ]),
      totales: [["", "", "", "", null, "Total", total, null, null, "", "", null, "", null, null, "", ""]],
    },
  ];
}

async function gastos({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  // Criterio único de mes: gastos.periodo (el mismo que resumen_gastos).
  const lista = await paginar((a, b) =>
    supabase
      .from("gastos")
      .select(
        "id, periodo, descripcion, tipo, monto, vencimiento, estado, fecha_pago, medio_pago, pagado_desde, pagado_por, comprobante_validado, creado_en, rubro:rubros_gasto(codigo, nombre), caja:cajas(fecha)"
      )
      .eq("org_id", perfil.org_id)
      .eq("periodo", periodo)
      .order("creado_en")
      .range(a, b)
  );
  lista.sort((x, y) => {
    const rx = x.rubro?.codigo ?? "";
    const ry = y.rubro?.codigo ?? "";
    return rx.localeCompare(ry) || (x.fecha_pago ?? x.vencimiento ?? "").localeCompare(y.fecha_pago ?? y.vencimiento ?? "");
  });
  const nombres = await nombresDe(supabase, lista.map((g) => g.pagado_por));

  const tot = lista.reduce(
    (acc, g) => {
      if (g.estado === "pagado") acc.pagado += n(g.monto);
      else if (g.estado === "pendiente") acc.pendiente += n(g.monto);
      return acc;
    },
    { pagado: 0, pendiente: 0 }
  );
  const origen = (g: (typeof lista)[number]) =>
    g.pagado_desde === "caja" && g.caja?.fecha
      ? `Caja del día (${formatFecha(g.caja.fecha)})`
      : etiqueta(LABEL_ORIGEN_PAGO_GASTO, g.pagado_desde);

  return [
    {
      nombre: `Gastos ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Período", ancho: 16 },
        { titulo: "Rubro", ancho: 9 },
        { titulo: "Nombre del rubro", ancho: 26 },
        { titulo: "Descripción", ancho: 36 },
        { titulo: "Tipo", ancho: 10 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Vencimiento", tipo: "fecha" },
        { titulo: "Estado", ancho: 11 },
        { titulo: "Fecha de pago", tipo: "fecha", ancho: 14 },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Pagado desde", ancho: 24 },
        { titulo: "Pagó", ancho: 22 },
        { titulo: "Comprobante validado", tipo: "booleano", ancho: 20 },
      ],
      filas: lista.map((g) => [
        labelPeriodo(g.periodo),
        g.rubro?.codigo ?? "",
        g.rubro?.nombre ?? "",
        g.descripcion?.trim() ? g.descripcion : g.rubro?.nombre ?? "",
        etiqueta(LABEL_TIPO_GASTO, g.tipo),
        n(g.monto),
        fechaExcel(g.vencimiento),
        etiqueta(LABEL_ESTADO_GASTO, g.estado),
        fechaExcel(g.fecha_pago),
        etiqueta(LABEL_MEDIO, g.medio_pago),
        origen(g),
        nombres.get(g.pagado_por ?? "") ?? "",
        siNo(g.comprobante_validado),
      ]),
      totales: [
        ["", "", "", "Total pagado", "", tot.pagado, null, "", null, "", "", "", ""],
        ["", "", "", "Total pendiente", "", tot.pendiente, null, "", null, "", "", "", ""],
      ],
      notas: ["El mes de cada gasto es su período (el mes al que corresponde), no la fecha en que se pagó."],
    },
  ];
}

async function cajas({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("cajas")
      .select(
        "id, fecha, tipo, estado, total_cobros, total_quintas, total_ambulantes, total_canon, total_rendido_efectivo, total_rendido_transferencia, total_gastos, total_ajustes, total_efectivo, total_transferencia, total_cheques, total_cheques_entregados, cerrada_por, validada_por, integrada_por, observaciones"
      )
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("tipo")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, [
    ...lista.map((c) => c.cerrada_por),
    ...lista.map((c) => c.validada_por),
    ...lista.map((c) => c.integrada_por),
  ]);
  // Juntado = cobros + bono camioneros + lo que rindió portería (FASE3 §4.5).
  const juntado = (c: (typeof lista)[number]) =>
    c.total_cobros === null
      ? null
      : n(c.total_cobros) + n(c.total_canon) + n(c.total_rendido_efectivo) + n(c.total_rendido_transferencia);

  return [
    {
      nombre: `Cajas ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Caja", ancho: 17 },
        { titulo: "Estado", ancho: 15 },
        { titulo: "Cobros", tipo: "moneda" },
        { titulo: "Quintas", tipo: "moneda" },
        { titulo: "Ambulantes", tipo: "moneda" },
        { titulo: "Bono camioneros", tipo: "moneda", ancho: 16 },
        { titulo: "Recibido de portería", tipo: "moneda", ancho: 19 },
        { titulo: "Juntado", tipo: "moneda" },
        { titulo: "Gastos pagados", tipo: "moneda" },
        { titulo: "Ajustes", tipo: "moneda" },
        { titulo: "Efectivo (tenía que tener)", tipo: "moneda", ancho: 24 },
        { titulo: "Transferencias", tipo: "moneda" },
        { titulo: "Cheques", tipo: "moneda" },
        { titulo: "Cheques entregados", tipo: "moneda", ancho: 18 },
        { titulo: "Cerrada por", ancho: 22 },
        { titulo: "Integrada por", ancho: 22 },
        { titulo: "Validada por", ancho: 22 },
        { titulo: "Observaciones", ancho: 32 },
      ],
      filas: lista.map((c) => [
        fechaExcel(c.fecha),
        etiqueta(LABEL_TIPO_CAJA, c.tipo),
        etiqueta(LABEL_ESTADO_CAJA, c.estado),
        nn(c.total_cobros),
        nn(c.total_quintas),
        nn(c.total_ambulantes),
        nn(c.total_canon),
        c.total_rendido_efectivo === null && c.total_rendido_transferencia === null
          ? null
          : n(c.total_rendido_efectivo) + n(c.total_rendido_transferencia),
        juntado(c),
        nn(c.total_gastos),
        nn(c.total_ajustes),
        nn(c.total_efectivo),
        nn(c.total_transferencia),
        nn(c.total_cheques),
        nn(c.total_cheques_entregados),
        nombres.get(c.cerrada_por ?? "") ?? "",
        nombres.get(c.integrada_por ?? "") ?? "",
        nombres.get(c.validada_por ?? "") ?? "",
        c.observaciones ?? "",
      ]),
      notas: [
        "Los totales se fijan al cerrar la caja; una caja abierta queda en blanco hasta su cierre.",
        "Juntado = cobros + bono camioneros + lo recibido de la caja de portería. Tenía que tener = juntado en efectivo − gastos ± ajustes.",
      ],
    },
  ];
}

async function canon({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("canon_camiones")
      .select(
        "id, numero, fecha, creado_en, creado_por, tarifa_nombre, tipo, unidad, cantidad, precio_unitario, monto, medio, patente, destino, destino_detalle, anulado, motivo_anulacion, espacio:espacios(tipo, numero, medio, propio)"
      )
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("numero")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, lista.map((c) => c.creado_por));
  const total = lista.filter((c) => !c.anulado).reduce((acc, c) => acc + n(c.monto), 0);

  return [
    {
      nombre: "Bono camioneros",
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 8 },
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Hora", ancho: 8 },
        { titulo: "Vehículo", ancho: 16 },
        { titulo: "Cantidad", tipo: "entero" },
        { titulo: "Precio", tipo: "moneda" },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Patente", ancho: 11 },
        { titulo: "A quién viene", ancho: 14 },
        { titulo: "Puesto", ancho: 16 },
        { titulo: "Cobró", ancho: 22 },
        { titulo: "Anulado", tipo: "booleano" },
        { titulo: "Motivo de anulación", ancho: 30 },
      ],
      filas: lista.map((c) => [
        c.numero,
        fechaExcel(c.fecha),
        formatSoloHora(c.creado_en),
        c.tarifa_nombre
          ? `${c.tarifa_nombre}${c.unidad ? ` (${etiqueta(LABEL_UNIDAD_TARIFA, c.unidad)})` : ""}`
          : "Camión",
        n(c.cantidad),
        nn(c.precio_unitario),
        n(c.monto),
        etiqueta(LABEL_MEDIO, c.medio),
        c.patente ?? "",
        etiqueta(LABEL_DESTINO_CANON, c.destino),
        c.espacio ? lugar(c.espacio) : c.destino_detalle ? `Puesto ${c.destino_detalle}` : "",
        nombres.get(c.creado_por ?? "") ?? "",
        siNo(c.anulado),
        c.motivo_anulacion ?? "",
      ]),
      totales: [[null, null, "", "Total (sin anulados)", null, null, total, "", "", "", "", "", "", ""]],
      notas: [
        `Bono camioneros (canon de transporte) cobrado en portería en ${labelPeriodo(periodo)}.`,
        "Los anulados se listan con su motivo pero no suman.",
      ],
    },
  ];
}

async function lecturas({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const lista = await paginar((a, b) =>
    supabase
      .from("lecturas")
      .select(
        "id, periodo, lectura_anterior, lectura_actual, kwh, precio_kwh, monto, medidor:medidores(numero, ubicacion, espacio:espacios(tipo, numero, medio, propio), cliente:clientes(codigo, nombre))"
      )
      .eq("org_id", perfil.org_id)
      .eq("periodo", periodo)
      .order("id")
      .range(a, b)
  );
  lista.sort((x, y) =>
    (x.medidor?.numero ?? "").localeCompare(y.medidor?.numero ?? "", "es", { numeric: true })
  );
  const tot = lista.reduce(
    (acc, l) => ({ kwh: acc.kwh + n(l.kwh), monto: acc.monto + n(l.monto) }),
    { kwh: 0, monto: 0 }
  );

  return [
    {
      nombre: `Lecturas ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Período", ancho: 16 },
        { titulo: "N° medidor", ancho: 12 },
        { titulo: "Ubicación", ancho: 22 },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 34 },
        { titulo: "Anterior", tipo: "numero" },
        { titulo: "Actual", tipo: "numero" },
        { titulo: "kWh", tipo: "numero" },
        { titulo: "Precio kWh", tipo: "moneda", ancho: 14 },
        { titulo: "Monto", tipo: "moneda" },
      ],
      filas: lista.map((l) => [
        labelPeriodo(l.periodo),
        l.medidor?.numero ?? "",
        l.medidor?.espacio ? lugar(l.medidor.espacio) : l.medidor?.ubicacion ?? "",
        codigoCliente(l.medidor?.cliente ?? null),
        nombreCliente(l.medidor?.cliente ?? null),
        n(l.lectura_anterior),
        n(l.lectura_actual),
        n(l.kwh),
        n(l.precio_kwh),
        n(l.monto),
      ]),
      totales: [["", "", "", null, "Total", null, null, tot.kwh, null, tot.monto]],
      notas: ["El abono mensual de energía (ABEN) no está acá: se genera con el mes (ver Cuenta corriente)."],
    },
  ];
}

/** Efecto de un movimiento en cada cuenta de su moneda (FASE3 §4.9): ajuste con su signo,
 * ingreso suma, impuestos/comisiones/débito fiscal/egreso restan, depósito y extracción pasan
 * de una cuenta a la otra. */
function efectoMovimiento(m: {
  tipo: string;
  monto: number | string | null;
  cuenta: string | null;
  cuenta_destino: string | null;
}): { efectivo: number; banco: number } {
  const e = { efectivo: 0, banco: 0 };
  const monto = n(m.monto);
  const cuenta = (m.cuenta ?? "banco") as "efectivo" | "banco";
  switch (m.tipo) {
    case "ajuste":
    case "ingreso":
      e[cuenta] += monto;
      break;
    case "deposito":
    case "extraccion":
      e[cuenta] -= monto;
      if (m.cuenta_destino === "efectivo" || m.cuenta_destino === "banco") e[m.cuenta_destino] += monto;
      break;
    default:
      e[cuenta] -= monto;
  }
  return e;
}

async function movimientosTesoreria({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("movimientos_tesoreria")
      .select("id, fecha, tipo, moneda, cuenta, cuenta_destino, descripcion, monto, caja_id, creado_por, creado_en")
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("creado_en")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, lista.map((m) => m.creado_por));
  const totales = { ARS: { efectivo: 0, banco: 0 }, USD: { efectivo: 0, banco: 0 } };
  for (const m of lista) {
    const e = efectoMovimiento(m);
    const t = totales[m.moneda === "USD" ? "USD" : "ARS"];
    t.efectivo += e.efectivo;
    t.banco += e.banco;
  }

  return [
    {
      nombre: `Tesorería ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Tipo", ancho: 14 },
        { titulo: "Moneda", ancho: 10 },
        { titulo: "Cuenta", ancho: 11 },
        { titulo: "Destino", ancho: 11 },
        { titulo: "Descripción", ancho: 40 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Efecto en efectivo", tipo: "moneda", ancho: 17 },
        { titulo: "Efecto en banco", tipo: "moneda", ancho: 16 },
        { titulo: "De una caja del día", tipo: "booleano", ancho: 17 },
        { titulo: "Cargó", ancho: 22 },
      ],
      filas: lista.map((m) => {
        const e = efectoMovimiento(m);
        return [
          fechaExcel(m.fecha),
          etiqueta(LABEL_TIPO_MOVIMIENTO, m.tipo),
          etiqueta(LABEL_MONEDA, m.moneda),
          etiqueta(LABEL_CUENTA, m.cuenta),
          etiqueta(LABEL_CUENTA, m.cuenta_destino),
          m.descripcion ?? "",
          n(m.monto),
          e.efectivo,
          e.banco,
          siNo(m.caja_id !== null),
          nombres.get(m.creado_por ?? "") ?? "",
        ];
      }),
      totales: [
        [null, "", "Pesos", "", "", "Efecto total del mes", null, totales.ARS.efectivo, totales.ARS.banco, "", ""],
        [null, "", "Dólares", "", "", "Efecto total del mes", null, totales.USD.efectivo, totales.USD.banco, "", ""],
      ],
      notas: [
        "Los montos van en la moneda de cada movimiento: pesos y dólares no se suman entre sí.",
        "Depósito: sale del efectivo y entra al banco. Extracción: al revés. Impuestos, comisiones, débito fiscal y egresos restan; ingresos suman; los ajustes suman o restan según su signo.",
      ],
    },
  ];
}

async function solicitudes({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("solicitudes")
      .select(
        "id, numero, tipo, asunto, referencia, origen, estado, creada_en, resolucion, resolucion_de, resuelta_por, asignada_a, ejecutada_en, elevada_en, elevada_por, cliente:clientes(codigo, nombre), espacio:espacios(tipo, numero, medio, propio)"
      )
      .eq("org_id", perfil.org_id)
      .gte("creada_en", r.desdeTs)
      .lt("creada_en", r.hastaTs)
      .order("numero")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, [
    ...lista.map((s) => s.asignada_a),
    ...lista.map((s) => s.resuelta_por),
    ...lista.map((s) => s.elevada_por),
  ]);
  const resolvio = (s: (typeof lista)[number]) => {
    const quien = s.resolucion_de ? etiqueta(LABEL_RESOLUCION_DE, s.resolucion_de) : "";
    const nombre = nombres.get(s.resuelta_por ?? "") ?? "";
    return [quien, nombre].filter(Boolean).join(" · ");
  };

  return [
    {
      nombre: `Solicitudes ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Tipo", ancho: 11 },
        { titulo: "Asunto", ancho: 40 },
        { titulo: "Cliente", ancho: 30 },
        { titulo: "Puesto", ancho: 16 },
        { titulo: "Origen", ancho: 18 },
        { titulo: "Estado", ancho: 24 },
        { titulo: "Creada", tipo: "fechaHora" },
        { titulo: "Elevada al Líder", tipo: "fechaHora", ancho: 16 },
        { titulo: "Resolución", ancho: 44 },
        { titulo: "Resolvió", ancho: 30 },
        { titulo: "Asignada a", ancho: 22 },
        { titulo: "Ejecutada", tipo: "fechaHora" },
      ],
      filas: lista.map((s) => [
        s.numero,
        etiqueta(LABEL_TIPO_SOLICITUD, s.tipo),
        s.asunto,
        s.cliente ? `N° ${s.cliente.codigo} — ${s.cliente.nombre}` : "",
        s.espacio ? lugar(s.espacio) : s.referencia ?? "",
        etiqueta(LABEL_ORIGEN_SOLICITUD, s.origen),
        etiqueta(LABEL_ESTADO_SOLICITUD, s.estado),
        fechaHoraExcel(s.creada_en),
        fechaHoraExcel(s.elevada_en),
        s.resolucion ?? "",
        resolvio(s),
        nombres.get(s.asignada_a ?? "") ?? "",
        fechaHoraExcel(s.ejecutada_en),
      ]),
      notas: ["Las horas son de Argentina."],
    },
  ];
}

async function registros({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("sanciones")
      .select(
        "id, numero, fecha, tipo, titulo, estado, visto_en, multa, multa_vencimiento, multa_sin_efecto_en, multa_sin_efecto_motivo, cliente:clientes(codigo, nombre), espacio:espacios(tipo, numero, medio, propio), cargo:cargos(estado, monto, monto_pagado)"
      )
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("numero")
      .range(a, b)
  );
  const estadoMulta = (x: (typeof lista)[number]): string => {
    if (!x.multa || n(x.multa) <= 0) return "";
    if (x.multa_sin_efecto_en) return "Sin efecto";
    if (x.cargo?.estado === "pagado") return "Pagada";
    if (x.cargo && n(x.cargo.monto_pagado) > 0) return "Pagada en parte";
    return "Pendiente";
  };
  const totalMultas = lista
    .filter((x) => !x.multa_sin_efecto_en)
    .reduce((acc, x) => acc + n(x.multa), 0);

  return [
    {
      nombre: `Registros ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Tipo", ancho: 15 },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 30 },
        { titulo: "Puesto", ancho: 16 },
        { titulo: "Título", ancho: 40 },
        { titulo: "Estado", ancho: 20 },
        { titulo: "Lo vio el socio", tipo: "fechaHora", ancho: 16 },
        { titulo: "Multa", tipo: "moneda" },
        { titulo: "Vence", tipo: "fecha" },
        { titulo: "Estado de la multa", ancho: 17 },
        { titulo: "Por qué quedó sin efecto", ancho: 30 },
      ],
      filas: lista.map((x) => [
        x.numero,
        fechaExcel(x.fecha),
        labelTipoRegistro(x.tipo),
        codigoCliente(x.cliente),
        nombreCliente(x.cliente),
        lugar(x.espacio),
        x.titulo,
        etiqueta(LABEL_ESTADO_REGISTRO, x.estado),
        fechaHoraExcel(x.visto_en),
        nn(x.multa),
        fechaExcel(x.multa_vencimiento),
        estadoMulta(x),
        x.multa_sin_efecto_motivo ?? "",
      ]),
      totales: [[null, null, "", null, "", "", "Multas vigentes", "", null, totalMultas, null, "", ""]],
      notas: ["“Lo vio el socio” es la primera vez que lo abrió en el portal. Las horas son de Argentina."],
    },
  ];
}

function textoHorarios(
  franjas: { dia_semana: number; hora_desde: string; hora_hasta: string }[]
): string {
  return [...franjas]
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_desde.localeCompare(b.hora_desde))
    .map((f) => {
      const dia = DIAS_SEMANA.find((d) => d.valor === f.dia_semana)?.corto ?? String(f.dia_semana);
      return `${dia} ${formatHora(f.hora_desde)}–${formatHora(f.hora_hasta)}`;
    })
    .join("; ");
}

async function empleados({ supabase, perfil }: ContextoExportacion): Promise<Hoja[]> {
  const lista = await paginar((a, b) =>
    supabase
      .from("empleados")
      .select(
        "id, apellido, nombre, dni, cuil, cargo, sector, horas_semanales, tipo_contrato, fecha_ingreso, fecha_egreso, telefono, email, activo, observaciones, empleado_horarios(dia_semana, hora_desde, hora_hasta)"
      )
      .eq("org_id", perfil.org_id)
      .order("apellido")
      .order("nombre")
      .range(a, b)
  );

  return [
    {
      nombre: "Empleados",
      columnas: [
        { titulo: "Apellido", ancho: 20 },
        { titulo: "Nombre", ancho: 20 },
        { titulo: "DNI", ancho: 12 },
        { titulo: "CUIL", ancho: 15 },
        { titulo: "Sector", ancho: 15 },
        { titulo: "Cargo", ancho: 22 },
        { titulo: "Horas/sem", tipo: "numero", ancho: 11 },
        { titulo: "Tipo de contrato", ancho: 18 },
        { titulo: "Ingreso", tipo: "fecha" },
        { titulo: "Egreso", tipo: "fecha" },
        { titulo: "Teléfono", ancho: 16 },
        { titulo: "Email", ancho: 28 },
        { titulo: "Horarios", ancho: 48 },
        { titulo: "Activo", tipo: "booleano" },
        { titulo: "Observaciones", ancho: 36 },
      ],
      filas: lista.map((e) => [
        e.apellido,
        e.nombre,
        e.dni,
        e.cuil ?? "",
        etiqueta(LABEL_SECTOR, e.sector),
        e.cargo ?? "",
        nn(e.horas_semanales),
        etiqueta(LABEL_TIPO_CONTRATO, e.tipo_contrato),
        fechaExcel(e.fecha_ingreso),
        fechaExcel(e.fecha_egreso),
        e.telefono ?? "",
        e.email ?? "",
        textoHorarios(e.empleado_horarios ?? []),
        siNo(e.activo),
        e.observaciones ?? "",
      ]),
      notas: ["Horas/sem en blanco: salen de sus horarios cargados."],
    },
  ];
}

async function ingresosPersonal({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("ingresos_personal")
      .select("id, ingreso_en, dni, apellido, nombre, fuera_de_horario, egreso_en, notas, registrado_por")
      .eq("org_id", perfil.org_id)
      .gte("ingreso_en", r.desdeTs)
      .lt("ingreso_en", r.hastaTs)
      .order("ingreso_en")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, lista.map((i) => i.registrado_por));

  return [
    {
      nombre: `Ingresos ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Ingreso", tipo: "fechaHora" },
        { titulo: "DNI", ancho: 12 },
        { titulo: "Apellido", ancho: 20 },
        { titulo: "Nombre", ancho: 20 },
        { titulo: "En horario", tipo: "booleano", ancho: 11 },
        { titulo: "Salida", tipo: "fechaHora" },
        { titulo: "Notas", ancho: 32 },
        { titulo: "Registró", ancho: 22 },
      ],
      filas: lista.map((i) => [
        fechaHoraExcel(i.ingreso_en),
        i.dni,
        i.apellido,
        i.nombre,
        siNo(!i.fuera_de_horario),
        fechaHoraExcel(i.egreso_en),
        i.notas ?? "",
        nombres.get(i.registrado_por ?? "") ?? "",
      ]),
      notas: ["Las horas son de Argentina."],
    },
  ];
}

async function novedadesPersonal({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const [resumenRes, detalle] = await Promise.all([
    supabase.rpc("resumen_novedades", { p_periodo: periodo }),
    paginar((a, b) =>
      supabase
        .from("novedades_personal")
        .select(
          "id, fecha_desde, fecha_hasta, tipo, sector, horas, justificada, detalle, estado, cargada_por, revisada_por, motivo_rechazo, motivo_anulacion, empleado:empleados(apellido, nombre, dni)"
        )
        .eq("org_id", perfil.org_id)
        .lt("fecha_desde", r.hasta)
        .or(`fecha_hasta.gte.${r.desde},and(fecha_hasta.is.null,fecha_desde.gte.${r.desde})`)
        .order("fecha_desde")
        .range(a, b)
    ),
  ]);
  if (resumenRes.error) throw new ErrorExportacion(resumenRes.error.message);
  const resumen = [...(resumenRes.data ?? [])].sort(
    (x, y) => x.apellido.localeCompare(y.apellido) || x.nombre.localeCompare(y.nombre)
  );
  const nombres = await nombresDe(supabase, [
    ...detalle.map((d) => d.cargada_por),
    ...detalle.map((d) => d.revisada_por),
  ]);

  return [
    {
      nombre: `Novedades ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Apellido", ancho: 18 },
        { titulo: "Nombre", ancho: 18 },
        { titulo: "DNI", ancho: 12 },
        { titulo: "Sector", ancho: 14 },
        { titulo: "Horas/sem", tipo: "numero", ancho: 10 },
        { titulo: "Debería (h)", tipo: "numero", ancho: 11 },
        { titulo: "Registró (h)", tipo: "numero", ancho: 12 },
        { titulo: "Diferencia (h)", tipo: "numero", ancho: 13 },
        { titulo: "Ingresos", tipo: "entero", ancho: 9 },
        { titulo: "Sin salida", tipo: "entero", ancho: 10 },
        { titulo: "Faltas", tipo: "entero", ancho: 8 },
        { titulo: "Injustificadas", tipo: "entero", ancho: 13 },
        { titulo: "Llegadas tarde", tipo: "entero", ancho: 13 },
        { titulo: "Horas tarde", tipo: "numero", ancho: 11 },
        { titulo: "Feriados trabajados", tipo: "entero", ancho: 17 },
        { titulo: "Horas feriado", tipo: "numero", ancho: 13 },
        { titulo: "Días de vacaciones", tipo: "entero", ancho: 16 },
        { titulo: "Días de licencia", tipo: "entero", ancho: 15 },
        { titulo: "Horas extra", tipo: "numero", ancho: 11 },
        { titulo: "Otras", tipo: "entero", ancho: 7 },
        { titulo: "Sin aprobar", tipo: "entero", ancho: 11 },
      ],
      filas: resumen.map((e) => [
        e.apellido,
        e.nombre,
        e.dni,
        etiqueta(LABEL_SECTOR, e.sector),
        nn(e.horas_semanales),
        n(e.horas_esperadas),
        n(e.horas_registradas),
        n(e.horas_registradas) - n(e.horas_esperadas),
        n(e.ingresos),
        n(e.ingresos_sin_salida),
        n(e.faltas),
        n(e.faltas_injustificadas),
        n(e.llegadas_tarde),
        n(e.horas_tarde),
        n(e.feriados_trabajados),
        n(e.horas_feriado),
        n(e.dias_vacaciones),
        n(e.dias_licencia),
        n(e.horas_extra),
        n(e.otras),
        n(e.pendientes),
      ]),
      notas: [
        "Los contadores cuentan solo novedades aprobadas; “Sin aprobar” son las que esperan el OK de Administración.",
        "Los feriados trabajados se pagan doble.",
      ],
    },
    {
      nombre: "Detalle de novedades",
      columnas: [
        { titulo: "Desde", tipo: "fecha" },
        { titulo: "Hasta", tipo: "fecha" },
        { titulo: "Apellido", ancho: 18 },
        { titulo: "Nombre", ancho: 18 },
        { titulo: "Sector", ancho: 14 },
        { titulo: "Novedad", ancho: 18 },
        { titulo: "Horas", tipo: "numero", ancho: 8 },
        { titulo: "Justificada", tipo: "booleano", ancho: 11 },
        { titulo: "Detalle", ancho: 40 },
        { titulo: "Estado", ancho: 11 },
        { titulo: "Cargó", ancho: 22 },
        { titulo: "Revisó", ancho: 22 },
        { titulo: "Motivo (rechazo o anulación)", ancho: 30 },
      ],
      filas: detalle.map((d) => [
        fechaExcel(d.fecha_desde),
        fechaExcel(d.fecha_hasta),
        d.empleado?.apellido ?? "",
        d.empleado?.nombre ?? "",
        etiqueta(LABEL_SECTOR, d.sector),
        etiqueta(LABEL_TIPO_NOVEDAD, d.tipo),
        nn(d.horas),
        siNo(d.justificada),
        d.detalle ?? "",
        etiqueta(LABEL_ESTADO_NOVEDAD, d.estado),
        nombres.get(d.cargada_por ?? "") ?? "",
        nombres.get(d.revisada_por ?? "") ?? "",
        d.motivo_rechazo ?? d.motivo_anulacion ?? "",
      ]),
    },
  ];
}

async function circulares({ supabase, perfil }: ContextoExportacion): Promise<Hoja[]> {
  const [lista, recepciones] = await Promise.all([
    paginar((a, b) =>
      supabase
        .from("circulares")
        .select("id, numero, titulo, detalle, fecha, obligatoria, activa")
        .eq("org_id", perfil.org_id)
        .order("numero", { ascending: false })
        .range(a, b)
    ),
    paginar((a, b) =>
      supabase
        .from("circular_recepciones")
        .select("id, circular_id")
        .eq("org_id", perfil.org_id)
        .order("id")
        .range(a, b)
    ),
  ]);
  const recibidas = new Map<string, number>();
  for (const rcp of recepciones) {
    recibidas.set(rcp.circular_id, (recibidas.get(rcp.circular_id) ?? 0) + 1);
  }

  return [
    {
      nombre: "Circulares",
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Título", ancho: 40 },
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Obligatoria", tipo: "booleano", ancho: 12 },
        { titulo: "Activa", tipo: "booleano" },
        { titulo: "La vieron", tipo: "entero", ancho: 11 },
        { titulo: "Detalle", ancho: 50 },
      ],
      filas: lista.map((c) => [
        c.numero,
        c.titulo,
        fechaExcel(c.fecha),
        siNo(c.obligatoria),
        siNo(c.activa),
        recibidas.get(c.id) ?? 0,
        c.detalle ?? "",
      ]),
      notas: ["“La vieron” cuenta los socios que la abrieron (o confirmaron, si es obligatoria) en el portal."],
    },
  ];
}

async function balanceMensual({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const veFlujo = ["tesoreria", "consejo", "lider"].includes(perfil.rol);
  const [conceptosRes, gastosRes, flujoRes] = await Promise.all([
    supabase.rpc("resumen_conceptos", { p_periodo: periodo }),
    supabase.rpc("resumen_gastos", { p_periodo: periodo }),
    veFlujo ? supabase.rpc("flujo_caja") : Promise.resolve({ data: null, error: null }),
  ]);
  if (conceptosRes.error) throw new ErrorExportacion(conceptosRes.error.message);
  if (gastosRes.error) throw new ErrorExportacion(gastosRes.error.message);

  const conceptos = conceptosRes.data ?? [];
  const totI = conceptos.reduce(
    (acc, f) => ({
      estimado: acc.estimado + n(f.estimado),
      cobrado: acc.cobrado + n(f.cobrado),
      beneficios: acc.beneficios + n(f.descuentos),
      pendiente: acc.pendiente + n(f.pendiente),
    }),
    { estimado: 0, cobrado: 0, beneficios: 0, pendiente: 0 }
  );

  const gastosOrdenados = [...(gastosRes.data ?? [])].sort((a, b) =>
    a.tipo === b.tipo ? a.codigo.localeCompare(b.codigo) : a.tipo === "fijo" ? -1 : 1
  );
  const sub = (tipo: "fijo" | "variable") =>
    gastosOrdenados
      .filter((g) => g.tipo === tipo)
      .reduce(
        (acc, g) => ({ pagado: acc.pagado + n(g.pagado), pendiente: acc.pendiente + n(g.pendiente) }),
        { pagado: 0, pendiente: 0 }
      );
  const fijos = sub("fijo");
  const variables = sub("variable");
  const totG = {
    pagado: fijos.pagado + variables.pagado,
    pendiente: fijos.pendiente + variables.pendiente,
  };
  const resultado = totI.cobrado - totG.pagado;
  const mes = labelPeriodo(periodo);

  const resumen: Celda[][] = [
    ["Período", mes],
    ["Cobrado en el mes", totI.cobrado],
    ["Beneficios por pago en término otorgados", totI.beneficios],
    ["Falta cobrar", totI.pendiente],
    ["Gastado (pagado)", totG.pagado],
    ["Gastos pendientes", totG.pendiente],
    ["Resultado del mes (cobrado − gastado)", resultado],
  ];
  const notasResumen: string[] = [];
  if (flujoRes.error) {
    notasResumen.push("El flujo de caja no pudo calcularse para este usuario.");
  } else if (flujoRes.data && typeof flujoRes.data === "object" && !Array.isArray(flujoRes.data)) {
    const f = flujoRes.data as Record<string, unknown>;
    const num = (v: unknown) => n(typeof v === "number" || typeof v === "string" ? v : 0);
    const dolares = (f.dolares ?? null) as Record<string, unknown> | null;
    resumen.push(
      ["", null],
      ["Flujo de caja a hoy (pesos)", null],
      ["Efectivo", num(f.efectivo)],
      ["Banco", num(f.banco)],
      ["Cheques en cartera", num(f.cheques_en_cartera)],
      ["Total en pesos", num(f.total)]
    );
    if (dolares && num(dolares.total) !== 0) {
      resumen.push(["Dólares (US$, no se suman a los pesos)", num(dolares.total)]);
    }
    notasResumen.push("El flujo de caja es el saldo acumulado a hoy, no solo del mes.");
  }

  return [
    {
      nombre: "Ingresos por concepto",
      columnas: [
        { titulo: "Código", ancho: 9 },
        { titulo: "Concepto", ancho: 36 },
        { titulo: "Estimado", tipo: "moneda" },
        { titulo: "Cobrado", tipo: "moneda" },
        { titulo: "Beneficios otorgados", tipo: "moneda", ancho: 20 },
        { titulo: "Pendiente", tipo: "moneda" },
      ],
      filas: conceptos.map((f) => [
        f.codigo,
        f.nombre,
        n(f.estimado),
        n(f.cobrado),
        n(f.descuentos),
        n(f.pendiente),
      ]),
      totales: [["", "Total ingresos", totI.estimado, totI.cobrado, totI.beneficios, totI.pendiente]],
      notas: [
        `Ingresos de ${mes}. BC es el bono camioneros (canon de transporte) cobrado en portería; AMB son los ambulantes cobrados por día.`,
        "EXME es la expensa de los puestos comunes y EXPP la de los puestos propios de la cooperativa; ABEN es el abono mensual de energía y MULT las multas.",
      ],
    },
    {
      nombre: "Gastos por rubro",
      columnas: [
        { titulo: "Código", ancho: 9 },
        { titulo: "Rubro", ancho: 32 },
        { titulo: "Tipo", ancho: 10 },
        { titulo: "Pagado", tipo: "moneda" },
        { titulo: "Pendiente", tipo: "moneda" },
      ],
      filas: gastosOrdenados.map((g) => [
        g.codigo,
        g.nombre,
        etiqueta(LABEL_TIPO_GASTO, g.tipo),
        n(g.pagado),
        n(g.pendiente),
      ]),
      totales: [
        ["", "Subtotal fijos", "", fijos.pagado, fijos.pendiente],
        ["", "Subtotal variables", "", variables.pagado, variables.pendiente],
        ["", "Total gastos", "", totG.pagado, totG.pendiente],
      ],
      notas: [`Gastos de ${mes}.`],
    },
    {
      nombre: "Resumen",
      columnas: [
        { titulo: "Concepto", ancho: 44 },
        { titulo: "Importe", tipo: "moneda", ancho: 18 },
      ],
      filas: resumen,
      notas: notasResumen,
    },
  ];
}

// ---------------------------------------------------------------------------

const CONSTRUCTORES: Record<DatasetExportable, (ctx: ContextoExportacion) => Promise<Hoja[]>> = {
  clientes,
  cuenta_corriente: cuentaCorriente,
  pagos,
  cheques,
  gastos,
  cajas,
  canon,
  lecturas,
  movimientos_tesoreria: movimientosTesoreria,
  solicitudes,
  registros,
  empleados,
  ingresos_personal: ingresosPersonal,
  novedades_personal: novedadesPersonal,
  circulares,
  balance_mensual: balanceMensual,
};

/** Arma las hojas del dataset pedido (lanza ErrorExportacion si algo falla). */
export async function construirDataset(
  dataset: DatasetExportable,
  ctx: ContextoExportacion
): Promise<Hoja[]> {
  return CONSTRUCTORES[dataset](ctx);
}
