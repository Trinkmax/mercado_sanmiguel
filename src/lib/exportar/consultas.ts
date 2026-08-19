import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import { DIAS_SEMANA, formatHora, labelPeriodo, sumarMeses } from "@/lib/format";
import type { DatasetExportable } from "@/lib/exportar/datasets";
import { fechaExcel, fechaHoraExcel, siNo, type Celda, type Hoja } from "@/lib/exportar/xlsx";
import {
  LABEL_ESTADO_CAJA,
  LABEL_ESTADO_CARGO,
  LABEL_ESTADO_CHEQUE,
  LABEL_ESTADO_GASTO,
  LABEL_ESTADO_SOLICITUD,
  LABEL_MEDIO,
  LABEL_ORIGEN_PAGO_GASTO,
  LABEL_ORIGEN_SOLICITUD,
  LABEL_TIPO_CAJA,
  LABEL_TIPO_CANON,
  LABEL_TIPO_CONTRATO,
  LABEL_TIPO_GASTO,
  LABEL_TIPO_MOVIMIENTO,
  LABEL_TIPO_PERSONA,
  LABEL_TIPO_SOLICITUD,
  etiqueta,
} from "@/lib/exportar/etiquetas";

/**
 * Consultas de cada dataset exportable. Todas filtran por la organización del
 * perfil (además de la RLS) y, las mensuales, por el período "YYYY-MM-01".
 * Devuelven hojas listas para `generarXlsx`.
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

type ClienteRef = { codigo: number; nombre: string } | null;
const codigoCliente = (c: ClienteRef) => (c ? c.codigo : null);
const nombreCliente = (c: ClienteRef) => (c ? c.nombre : "");

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

async function clientes({ supabase, perfil }: ContextoExportacion): Promise<Hoja[]> {
  const org = perfil.org_id;
  const [lista, deudaRes, saldoRes] = await Promise.all([
    paginar((a, b) =>
      supabase
        .from("clientes")
        .select(
          "id, codigo, nombre, apodo, tipo_persona, cuit, telefono, email, direccion, cuotas_mes, activo"
        )
        .eq("org_id", org)
        .order("codigo")
        .range(a, b)
    ),
    supabase.from("v_deuda_clientes").select("cliente_id, deuda").eq("org_id", org),
    supabase.from("v_saldo_favor").select("cliente_id, saldo_favor").eq("org_id", org),
  ]);
  if (deudaRes.error) throw new ErrorExportacion(deudaRes.error.message);
  if (saldoRes.error) throw new ErrorExportacion(saldoRes.error.message);

  const deuda = new Map(
    (deudaRes.data ?? []).map((d) => [d.cliente_id ?? "", n(d.deuda)])
  );
  const saldo = new Map(
    (saldoRes.data ?? []).map((s) => [s.cliente_id ?? "", n(s.saldo_favor)])
  );

  return [
    {
      nombre: "Clientes",
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Nombre", ancho: 36 },
        { titulo: "Apodo", ancho: 18 },
        { titulo: "Tipo", ancho: 10 },
        { titulo: "CUIT", ancho: 15 },
        { titulo: "Teléfono", ancho: 16 },
        { titulo: "Email", ancho: 28 },
        { titulo: "Dirección", ancho: 30 },
        { titulo: "Cuotas por mes", tipo: "entero", ancho: 14 },
        { titulo: "Activo", tipo: "booleano" },
        { titulo: "Deuda hoy", tipo: "moneda" },
        { titulo: "Saldo a favor", tipo: "moneda" },
      ],
      filas: lista.map((c) => [
        c.codigo,
        c.nombre,
        c.apodo ?? "",
        etiqueta(LABEL_TIPO_PERSONA, c.tipo_persona),
        c.cuit ?? "",
        c.telefono ?? "",
        c.email ?? "",
        c.direccion ?? "",
        c.cuotas_mes,
        siNo(c.activo),
        deuda.get(c.id) ?? 0,
        saldo.get(c.id) ?? 0,
      ]),
      notas: ["La deuda es la exigible hoy (con el beneficio por pago en término vigente)."],
    },
  ];
}

async function cuentaCorriente({ supabase, perfil, periodo, clienteId }: ContextoExportacion): Promise<Hoja[]> {
  const cargos = await paginar((a, b) => {
    let q = supabase
      .from("cargos")
      .select(
        "id, codigo, descripcion, periodo, monto, monto_pagado, descuento_aplicado, vencimiento, estado, cliente:clientes(codigo, nombre)"
      )
      .eq("org_id", perfil.org_id);
    // Para una carpeta: toda su cuenta corriente (todos los períodos); para la org: el mes.
    q = clienteId ? q.eq("cliente_id", clienteId) : q.eq("periodo", periodo);
    return q.order("id").range(a, b);
  });
  cargos.sort(
    (x, y) =>
      (codigoCliente(x.cliente) ?? 0) - (codigoCliente(y.cliente) ?? 0) ||
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
        codigoCliente(c.cliente),
        nombreCliente(c.cliente),
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
  const lista = await paginar((a, b) => {
    let q = supabase
      .from("pagos")
      .select(
        "id, numero, fecha, monto, medio, titular_transferencia, conciliado, anulado, motivo_anulacion, recibido_por, cliente:clientes(codigo, nombre)"
      )
      .eq("org_id", perfil.org_id);
    // Para una carpeta: todos sus pagos; para la org: los del mes.
    q = clienteId ? q.eq("cliente_id", clienteId) : q.gte("fecha", r.desdeTs).lt("fecha", r.hastaTs);
    return q.order("numero").range(a, b);
  });
  const nombres = await nombresDe(
    supabase,
    lista.map((p) => p.recibido_por)
  );
  const totalVigente = lista.filter((p) => !p.anulado).reduce((acc, p) => acc + n(p.monto), 0);

  return [
    {
      nombre: clienteId ? "Pagos" : `Pagos ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Recibo N°", tipo: "entero", ancho: 11 },
        { titulo: "Fecha y hora", tipo: "fechaHora" },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 34 },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Titular transferencia", ancho: 26 },
        { titulo: "Conciliado", tipo: "booleano", ancho: 11 },
        { titulo: "Anulado", tipo: "booleano" },
        { titulo: "Motivo de anulación", ancho: 28 },
        { titulo: "Cobró", ancho: 22 },
      ],
      filas: lista.map((p) => [
        p.numero,
        fechaHoraExcel(p.fecha),
        codigoCliente(p.cliente),
        nombreCliente(p.cliente),
        etiqueta(LABEL_MEDIO, p.medio),
        n(p.monto),
        p.titular_transferencia ?? "",
        p.medio === "transferencia" ? siNo(p.conciliado) : "",
        siNo(p.anulado),
        p.motivo_anulacion ?? "",
        nombres.get(p.recibido_por ?? "") ?? "",
      ]),
      totales: [["", null, null, "Total cobrado (sin anulados)", "", totalVigente, "", "", "", "", ""]],
      notas: ["Las horas son de Argentina."],
    },
  ];
}

async function cheques({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("cheques")
      .select(
        "id, numero, banco, titular, es_tercero, monto, fecha_recibido, fecha_cobro, fecha_depositado, fecha_acreditado, estado, notas, cliente:clientes(codigo, nombre)"
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
        { titulo: "Banco", ancho: 20 },
        { titulo: "Titular", ancho: 28 },
        { titulo: "De tercero", tipo: "booleano", ancho: 11 },
        { titulo: "N° cliente", tipo: "entero", ancho: 10 },
        { titulo: "Cliente", ancho: 34 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Recibido", tipo: "fecha" },
        { titulo: "Fecha de cobro", tipo: "fecha", ancho: 14 },
        { titulo: "Depositado", tipo: "fecha" },
        { titulo: "Acreditado", tipo: "fecha" },
        { titulo: "Estado", ancho: 14 },
        { titulo: "Notas", ancho: 30 },
      ],
      filas: lista.map((c) => [
        c.numero,
        c.banco ?? "",
        c.titular,
        siNo(c.es_tercero),
        codigoCliente(c.cliente),
        nombreCliente(c.cliente),
        n(c.monto),
        fechaExcel(c.fecha_recibido),
        fechaExcel(c.fecha_cobro),
        fechaExcel(c.fecha_depositado),
        fechaExcel(c.fecha_acreditado),
        etiqueta(LABEL_ESTADO_CHEQUE, c.estado),
        c.notas ?? "",
      ]),
      totales: [["", "", "", "", null, "Total", total, null, null, null, null, "", ""]],
    },
  ];
}

async function gastos({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  // Mismo criterio de mes que la RPC resumen_gastos:
  // coalesce(fecha_pago, vencimiento, creado_en) dentro del período.
  const lista = await paginar((a, b) =>
    supabase
      .from("gastos")
      .select(
        "id, descripcion, tipo, monto, vencimiento, estado, fecha_pago, medio_pago, pagado_desde, comprobante_validado, creado_en, rubro:rubros_gasto(codigo, nombre)"
      )
      .eq("org_id", perfil.org_id)
      .or(
        [
          `and(fecha_pago.gte.${r.desde},fecha_pago.lt.${r.hasta})`,
          `and(fecha_pago.is.null,vencimiento.gte.${r.desde},vencimiento.lt.${r.hasta})`,
          `and(fecha_pago.is.null,vencimiento.is.null,creado_en.gte.${r.desdeTs},creado_en.lt.${r.hastaTs})`,
        ].join(",")
      )
      .order("creado_en")
      .range(a, b)
  );
  lista.sort((x, y) => {
    const rx = x.rubro?.codigo ?? "";
    const ry = y.rubro?.codigo ?? "";
    return rx.localeCompare(ry) || (x.fecha_pago ?? x.vencimiento ?? "").localeCompare(y.fecha_pago ?? y.vencimiento ?? "");
  });

  const tot = lista.reduce(
    (acc, g) => {
      if (g.estado === "pagado") acc.pagado += n(g.monto);
      else if (g.estado === "pendiente") acc.pendiente += n(g.monto);
      return acc;
    },
    { pagado: 0, pendiente: 0 }
  );

  return [
    {
      nombre: `Gastos ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Rubro", ancho: 9 },
        { titulo: "Nombre del rubro", ancho: 26 },
        { titulo: "Descripción", ancho: 36 },
        { titulo: "Tipo", ancho: 10 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Vencimiento", tipo: "fecha" },
        { titulo: "Estado", ancho: 11 },
        { titulo: "Fecha de pago", tipo: "fecha", ancho: 14 },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Pagado desde", ancho: 14 },
        { titulo: "Comprobante validado", tipo: "booleano", ancho: 20 },
      ],
      filas: lista.map((g) => [
        g.rubro?.codigo ?? "",
        g.rubro?.nombre ?? "",
        g.descripcion,
        etiqueta(LABEL_TIPO_GASTO, g.tipo),
        n(g.monto),
        fechaExcel(g.vencimiento),
        etiqueta(LABEL_ESTADO_GASTO, g.estado),
        fechaExcel(g.fecha_pago),
        etiqueta(LABEL_MEDIO, g.medio_pago),
        etiqueta(LABEL_ORIGEN_PAGO_GASTO, g.pagado_desde),
        siNo(g.comprobante_validado),
      ]),
      totales: [
        ["", "", "Total pagado", "", tot.pagado, null, "", null, "", "", ""],
        ["", "", "Total pendiente", "", tot.pendiente, null, "", null, "", "", ""],
      ],
    },
  ];
}

async function cajas({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("cajas")
      .select(
        "id, fecha, tipo, estado, total_efectivo, total_transferencia, total_cheques, total_canon, total_gastos, total_rendido_efectivo, total_rendido_transferencia, cerrada_por, validada_por, integrada_por, observaciones"
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

  return [
    {
      nombre: `Cajas ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Caja", ancho: 16 },
        { titulo: "Estado", ancho: 15 },
        { titulo: "Efectivo", tipo: "moneda" },
        { titulo: "Transferencias", tipo: "moneda" },
        { titulo: "Cheques", tipo: "moneda" },
        { titulo: "Canon", tipo: "moneda" },
        { titulo: "Gastos pagados", tipo: "moneda" },
        { titulo: "Rendido portería (efectivo)", tipo: "moneda", ancho: 24 },
        { titulo: "Rendido portería (transf.)", tipo: "moneda", ancho: 24 },
        { titulo: "Cerrada por", ancho: 22 },
        { titulo: "Integrada por", ancho: 22 },
        { titulo: "Validada por", ancho: 22 },
        { titulo: "Observaciones", ancho: 32 },
      ],
      filas: lista.map((c) => [
        fechaExcel(c.fecha),
        etiqueta(LABEL_TIPO_CAJA, c.tipo),
        etiqueta(LABEL_ESTADO_CAJA, c.estado),
        n(c.total_efectivo),
        n(c.total_transferencia),
        n(c.total_cheques),
        n(c.total_canon),
        n(c.total_gastos),
        n(c.total_rendido_efectivo),
        n(c.total_rendido_transferencia),
        nombres.get(c.cerrada_por ?? "") ?? "",
        nombres.get(c.integrada_por ?? "") ?? "",
        nombres.get(c.validada_por ?? "") ?? "",
        c.observaciones ?? "",
      ]),
      notas: [
        "Los totales se fijan al cerrar la caja; una caja abierta muestra 0 hasta su cierre.",
      ],
    },
  ];
}

async function canon({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("canon_camiones")
      .select("id, fecha, tipo, cantidad, monto, medio, notas, caja:cajas(fecha, tipo)")
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("creado_en")
      .range(a, b)
  );
  const total = lista.reduce((acc, c) => acc + n(c.monto), 0);

  return [
    {
      nombre: `Canon ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Tipo", ancho: 12 },
        { titulo: "Cantidad", tipo: "entero" },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Medio", ancho: 14 },
        { titulo: "Caja", ancho: 16 },
        { titulo: "Fecha de la caja", tipo: "fecha", ancho: 15 },
        { titulo: "Notas", ancho: 30 },
      ],
      filas: lista.map((c) => [
        fechaExcel(c.fecha),
        etiqueta(LABEL_TIPO_CANON, c.tipo),
        n(c.cantidad),
        n(c.monto),
        etiqueta(LABEL_MEDIO, c.medio),
        etiqueta(LABEL_TIPO_CAJA, c.caja?.tipo),
        fechaExcel(c.caja?.fecha),
        c.notas ?? "",
      ]),
      totales: [[null, "Total", null, total, "", "", null, ""]],
    },
  ];
}

async function lecturas({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const lista = await paginar((a, b) =>
    supabase
      .from("lecturas")
      .select(
        "id, periodo, lectura_anterior, lectura_actual, kwh, precio_kwh, monto, medidor:medidores(numero, cliente:clientes(codigo, nombre))"
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
        codigoCliente(l.medidor?.cliente ?? null),
        nombreCliente(l.medidor?.cliente ?? null),
        n(l.lectura_anterior),
        n(l.lectura_actual),
        n(l.kwh),
        n(l.precio_kwh),
        n(l.monto),
      ]),
      totales: [["", "", null, "Total", null, null, tot.kwh, null, tot.monto]],
    },
  ];
}

async function movimientosTesoreria({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("movimientos_tesoreria")
      .select("id, fecha, tipo, descripcion, monto, creado_por, creado_en")
      .eq("org_id", perfil.org_id)
      .gte("fecha", r.desde)
      .lt("fecha", r.hasta)
      .order("fecha")
      .order("creado_en")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, lista.map((m) => m.creado_por));
  // Efecto en el banco con signo: impuestos/comisiones/débito fiscal restan (se guardan
  // en positivo); los ajustes ya vienen con signo. Igual que la pantalla de Tesorería.
  const efecto = (m: { tipo: string; monto: number | string | null }) =>
    m.tipo === "ajuste" ? n(m.monto) : -n(m.monto);
  const totalEfecto = lista.reduce((acc, m) => acc + efecto(m), 0);

  return [
    {
      nombre: `Tesorería ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "Fecha", tipo: "fecha" },
        { titulo: "Tipo", ancho: 14 },
        { titulo: "Descripción", ancho: 40 },
        { titulo: "Monto", tipo: "moneda" },
        { titulo: "Efecto en banco", tipo: "moneda", ancho: 16 },
        { titulo: "Cargó", ancho: 22 },
      ],
      filas: lista.map((m) => [
        fechaExcel(m.fecha),
        etiqueta(LABEL_TIPO_MOVIMIENTO, m.tipo),
        m.descripcion,
        n(m.monto),
        efecto(m),
        nombres.get(m.creado_por ?? "") ?? "",
      ]),
      totales: [[null, "", "Efecto total en el banco", null, totalEfecto, ""]],
      notas: ["Impuestos, comisiones y débito fiscal restan del banco; los ajustes suman o restan según su signo."],
    },
  ];
}

async function solicitudes({ supabase, perfil, periodo }: ContextoExportacion): Promise<Hoja[]> {
  const r = rangoMes(periodo);
  const lista = await paginar((a, b) =>
    supabase
      .from("solicitudes")
      .select(
        "id, numero, tipo, asunto, referencia, origen, estado, creada_en, resolucion, asignada_a, ejecutada_en, cliente:clientes(codigo, nombre)"
      )
      .eq("org_id", perfil.org_id)
      .gte("creada_en", r.desdeTs)
      .lt("creada_en", r.hastaTs)
      .order("numero")
      .range(a, b)
  );
  const nombres = await nombresDe(supabase, lista.map((s) => s.asignada_a));

  return [
    {
      nombre: `Solicitudes ${labelPeriodo(periodo)}`,
      columnas: [
        { titulo: "N°", tipo: "entero", ancho: 7 },
        { titulo: "Tipo", ancho: 11 },
        { titulo: "Asunto", ancho: 40 },
        { titulo: "Cliente / referencia", ancho: 34 },
        { titulo: "Origen", ancho: 18 },
        { titulo: "Estado", ancho: 24 },
        { titulo: "Creada", tipo: "fechaHora" },
        { titulo: "Resolución", ancho: 44 },
        { titulo: "Asignada a", ancho: 22 },
        { titulo: "Ejecutada", tipo: "fechaHora" },
      ],
      filas: lista.map((s) => [
        s.numero,
        etiqueta(LABEL_TIPO_SOLICITUD, s.tipo),
        s.asunto,
        s.cliente ? `N° ${s.cliente.codigo} — ${s.cliente.nombre}` : (s.referencia ?? ""),
        etiqueta(LABEL_ORIGEN_SOLICITUD, s.origen),
        etiqueta(LABEL_ESTADO_SOLICITUD, s.estado),
        fechaHoraExcel(s.creada_en),
        s.resolucion ?? "",
        nombres.get(s.asignada_a ?? "") ?? "",
        fechaHoraExcel(s.ejecutada_en),
      ]),
      notas: ["Las horas son de Argentina."],
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
        "id, apellido, nombre, dni, cuil, cargo, tipo_contrato, fecha_ingreso, fecha_egreso, telefono, email, activo, observaciones, empleado_horarios(dia_semana, hora_desde, hora_hasta)"
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
        { titulo: "Cargo", ancho: 22 },
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
        e.cargo ?? "",
        etiqueta(LABEL_TIPO_CONTRATO, e.tipo_contrato),
        fechaExcel(e.fecha_ingreso),
        fechaExcel(e.fecha_egreso),
        e.telefono ?? "",
        e.email ?? "",
        textoHorarios(e.empleado_horarios ?? []),
        siNo(e.activo),
        e.observaciones ?? "",
      ]),
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
        { titulo: "Recibidas", tipo: "entero", ancho: 11 },
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
      notas: ["“Recibidas” cuenta los socios que confirmaron la recepción desde el portal."],
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
    const f = flujoRes.data as Record<string, number | undefined>;
    resumen.push(
      ["", null],
      ["Flujo de caja a hoy", null],
      ["Efectivo", n(f.efectivo)],
      ["Banco", n(f.banco)],
      ["Cheques en cartera", n(f.cheques_en_cartera)],
      ["Total disponible", n(f.total)]
    );
    notasResumen.push("El flujo de caja es el saldo acumulado a hoy, no solo del mes.");
  }

  return [
    {
      nombre: "Ingresos por concepto",
      columnas: [
        { titulo: "Código", ancho: 9 },
        { titulo: "Concepto", ancho: 32 },
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
      notas: [`Ingresos de ${mes}. BC / BA / BQ es el canon diario cobrado en portería.`],
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
  empleados,
  ingresos_personal: ingresosPersonal,
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
