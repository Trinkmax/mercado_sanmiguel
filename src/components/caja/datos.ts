import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import type { Enums, Tables } from "@/lib/database.types";
import type { CategoriaCliente } from "@/lib/segmentos";
import type { CanonEntrada, IconoTarifa } from "@/components/porteria/tarifas";
import { ARQUEO_VACIO, parsearArqueo, type Arqueo } from "@/components/caja/arqueo-tipos";
import type { MedioPago } from "@/components/caja/medios";

export type TipoCaja = Enums<"tipo_caja">;
export type EstadoCaja = Enums<"estado_caja">;
export type Caja = Tables<"cajas">;

/** Una línea (medio de pago) de un recibo. */
export type LineaCobro = {
  pagoId: string;
  linea: number;
  medio: MedioPago;
  monto: number;
  anulado: boolean;
  titularTransferencia: string | null;
  cheque: {
    numero: string;
    cuit: string | null;
    recibidoDe: string | null;
    fechaCobro: string;
    estado: string;
    proveedor: string | null;
    entregadoEnCobro: boolean;
  } | null;
};

/** Un recibo del día: todas las líneas de un mismo lote (cobro mixto). */
export type ReciboDia = {
  loteId: string;
  numero: number;
  /** Id de la primera línea: la ruta /recibos/{pagoId} acepta cualquier línea del lote. */
  pagoId: string;
  fecha: string;
  cliente: { nombre: string; codigo: number; categoria: CategoriaCliente | null } | null;
  lineas: LineaCobro[];
  /** Lo vigente (sin líneas anuladas). */
  total: number;
  /** Lo que se cobró originalmente (con las anuladas). */
  totalOriginal: number;
  anulado: boolean;
  motivoAnulacion: string | null;
  recibioNombre: string | null;
};

export type GastoCaja = {
  id: string;
  /** La descripción, o el nombre del rubro si quedó vacía (E3). */
  descripcion: string;
  rubro: { codigo: string; nombre: string } | null;
  monto: number;
  pagadoEn: string | null;
  pagadoPorNombre: string | null;
  /** Se imputó con la caja ya cerrada (el arqueo se recalculó). */
  despuesDelCierre: boolean;
};

/** Un ingreso sin cliente de la caja (venta de vacíos y tarimas…, 0053). */
export type IngresoCaja = {
  id: string;
  numero: number;
  creadoEn: string;
  creadoPor: string | null;
  creadoPorNombre: string | null;
  concepto: string;
  detalle: string | null;
  monto: number;
  medio: "efectivo" | "transferencia";
  titular: string | null;
  anulado: boolean;
  motivoAnulacion: string | null;
};

/**
 * Una transferencia de la caja para chequear contra el banco (0049): las que entraron
 * (cobros, bono camioneros y ventas sin cliente, también los de las cajas de portería
 * recibidas acá) y las que salieron (gastos pagados por banco ese día). Es la misma marca
 * que usa Tesorería → Conciliar.
 */
export type TransferenciaCaja = {
  clase: "cobro" | "canon" | "ingreso" | "gasto";
  id: string;
  sentido: "entra" | "sale";
  /** Vino en una caja de portería recibida en esta: la fecha de esa caja. */
  porteriaFecha: string | null;
  /** El cliente, el ingreso de transporte o el gasto. */
  titulo: string;
  /** "Recibo N° 12 · Titular: Juan Pérez". */
  detalle: string | null;
  monto: number;
  conciliada: boolean;
  conciliadaPorNombre: string | null;
  conciliadaEn: string | null;
  /** URL firmada (1 h) del comprobante; solo para quien concilia. */
  comprobanteUrl: string | null;
};

/** Ajuste de tesorería sobre la caja (movimientos_tesoreria con caja_id). */
export type AjusteCaja = {
  id: string;
  cuenta: "efectivo" | "banco";
  monto: number;
  descripcion: string | null;
  creadoEn: string;
  creadoPorNombre: string | null;
};

export type CajaPrevia = {
  id: string;
  fecha: string;
  estado: EstadoCaja;
  total_efectivo: number | null;
  total_transferencia: number | null;
  total_cheques: number | null;
  reapertura_solicitada_en: string | null;
};

/** Bitácora de la caja (caja_eventos) con el nombre de quien actuó. */
export type EventoCaja = {
  id: string;
  tipo: string;
  detalle: string | null;
  creado_en: string;
  usuario: string | null;
};

/** Caja de portería integrada en esta caja de administración. */
export type RendicionIntegrada = {
  id: string;
  fecha: string;
  estado: EstadoCaja;
  total_efectivo: number;
  total_transferencia: number;
  total_quintas: number;
  total_ambulantes: number;
  /** La cochera que el Jefe cobró en esa caja (cobros − quintas − ambulantes, 0052). */
  total_cocheras: number;
  total_canon: number;
  total_ajustes: number;
};

export type DatosCaja = {
  tipo: TipoCaja;
  /** Fecha de la caja que se muestra (hoy o la pedida por ?fecha=). */
  fecha: string;
  esHoy: boolean;
  caja: Caja | null;
  /** Arqueo de la caja (arqueo_caja: en vivo si está abierta, persistido si no). */
  arqueo: Arqueo;
  /** Si arqueo_caja falló, el mensaje (la pantalla lo muestra en vez de números en cero). */
  arqueoError: string | null;
  recibos: ReciboDia[];
  canon: CanonEntrada[];
  /** Ventas y otros ingresos sin cliente (solo la caja de administración, 0053). */
  ingresos: IngresoCaja[];
  /** Nombre e ícono de las tarifas (para dibujar cada ingreso de transporte). */
  tarifas: { nombre: string; icono: IconoTarifa }[];
  gastos: GastoCaja[];
  /** Transferencias de la caja (y de las cajas de portería recibidas) para chequear con el banco. */
  transferencias: TransferenciaCaja[];
  ajustes: AjusteCaja[];
  previas: CajaPrevia[];
  eventos: EventoCaja[];
  rendidas: RendicionIntegrada[];
  nombres: {
    abierta: string | null;
    cerrada: string | null;
    validada: string | null;
    integrada: string | null;
    reapertura: string | null;
  };
  /** Caja de este tipo de otro día que sigue abierta (reabierta o que se olvidaron de cerrar). */
  cajaAbiertaOtroDia: { id: string; fecha: string; reaperturas: number } | null;
  /**
   * Caja de portería de un día anterior: el estado de la caja de administración de ESE mismo
   * día, si existe y no está validada (la rendición puede entrar ahí en vez de en la de hoy).
   */
  adminMismoDia: AdminMismoDia;
};

/** Estado de la caja de administración del mismo día que una caja de portería (o null). */
export type AdminMismoDia = "abierta" | "cerrada" | null;

function aAdminMismoDia(estado: string | null | undefined): AdminMismoDia {
  return estado === "abierta" || estado === "cerrada" ? estado : null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** "2026-08-19" válida y no futura; si no, hoy. */
export function normalizarFechaCaja(fecha: string | undefined): string {
  const hoy = hoyISO();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return hoy;
  if (fecha > hoy) return hoy;
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return hoy;
  return fecha;
}

/** Nombres de perfiles por user_id (lo que la RLS deje ver; el resto queda null). */
async function nombresPorUsuario(
  supabase: Supabase,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  const { data } = await supabase.from("perfiles").select("user_id, nombre").in("user_id", unicos);
  for (const p of data ?? []) mapa.set(p.user_id, p.nombre);
  return mapa;
}

const CATEGORIAS = new Set(["puestero", "quintero", "ambulante", "empleado"]);
const ICONOS = new Set(["camioneta", "camion", "balancin", "equipo", "estadia"]);

function mensajeError(error: { message?: string } | null): string | null {
  if (!error) return null;
  return (error.message ?? "").replace(/^.*?: /, "") || "No se pudo calcular el arqueo.";
}

/** Todo lo que necesita la pantalla (y el imprimible) de una caja ya encontrada (o ninguna). */
async function armarDatos(
  supabase: Supabase,
  perfil: Perfil,
  tipo: TipoCaja,
  fecha: string,
  caja: Caja | null,
  conPrevias: boolean
): Promise<DatosCaja> {
  const hoy = hoyISO();
  const esHoy = fecha === hoy;

  const [
    arqueoRes,
    pagosRes,
    canonRes,
    gastosRes,
    gastosBancoRes,
    ajustesRes,
    previasRes,
    eventosRes,
    rendidasRes,
    otroDiaRes,
    tarifasRes,
    adminMismoDiaRes,
    ingresosRes,
  ] = await Promise.all([
    caja ? supabase.rpc("arqueo_caja", { p_caja: caja.id }) : Promise.resolve({ data: null, error: null }),
    caja
      ? supabase
          .from("pagos")
          .select(
            "id, cliente_id, numero, lote_id, linea, monto, medio, fecha, anulado, motivo_anulacion, titular_transferencia, recibido_por, comprobante_path, conciliado, conciliado_por, conciliado_en, cliente:clientes(nombre, codigo, categoria), cheque:cheques(numero, cuit, recibido_de, fecha_cobro, estado, proveedor, entregado_en_cobro)"
          )
          .eq("caja_id", caja.id)
          .order("fecha", { ascending: true })
          .order("linea", { ascending: true })
      : Promise.resolve({ data: null }),
    // 0052: Administración también cobra el bono camioneros (en su caja).
    caja
      ? supabase
          .from("canon_camiones")
          .select(
            "id, numero, creado_en, creado_por, tarifa_nombre, unidad, cantidad, precio_unitario, monto, medio, patente, destino, destino_detalle, anulado, motivo_anulacion, conciliado, conciliado_por, conciliado_en"
          )
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    // Los gastos salen solo de la caja de administración (y el Jefe no lee gastos).
    caja && tipo === "administracion" && perfil.rol !== "guardia"
      ? supabase
          .from("gastos")
          .select("id, descripcion, monto, pagado_en, pagado_por, rubro:rubros_gasto(codigo, nombre)")
          .eq("caja_id", caja.id)
          .eq("estado", "pagado")
          .eq("pagado_desde", "caja")
          .order("pagado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    // Gastos pagados por banco ese día: no tocan el cajón, pero Tesorería los chequea acá (0049).
    caja && tipo === "administracion" && perfil.rol !== "guardia"
      ? supabase
          .from("gastos")
          .select(
            "id, descripcion, monto, pagado_por, conciliado, conciliado_por, conciliado_en, rubro:rubros_gasto(codigo, nombre)"
          )
          .eq("org_id", perfil.org_id)
          .eq("estado", "pagado")
          .eq("medio_pago", "transferencia")
          .eq("fecha_pago", caja.fecha)
          .order("pagado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    caja
      ? supabase
          .from("movimientos_tesoreria")
          .select("id, cuenta, monto, descripcion, creado_en, creado_por")
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    conPrevias
      ? supabase
          .from("cajas")
          .select(
            "id, fecha, estado, total_efectivo, total_transferencia, total_cheques, reapertura_solicitada_en"
          )
          .eq("org_id", perfil.org_id)
          .eq("tipo", tipo)
          .lt("fecha", hoy)
          .order("fecha", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: null }),
    caja
      ? supabase
          .from("caja_eventos")
          .select("id, tipo, detalle, creado_en, usuario_id")
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    caja && tipo === "administracion"
      ? supabase
          .from("cajas")
          .select(
            "id, fecha, estado, total_efectivo, total_transferencia, total_cobros, total_quintas, total_ambulantes, total_canon, total_ajustes"
          )
          .eq("caja_destino_id", caja.id)
          .in("estado", ["integrada", "validada"])
          .order("fecha", { ascending: true })
      : Promise.resolve({ data: null }),
    esHoy && conPrevias
      ? supabase
          .from("cajas")
          .select("id, fecha, reaperturas")
          .eq("org_id", perfil.org_id)
          .eq("tipo", tipo)
          .eq("estado", "abierta")
          .lt("fecha", hoy)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    caja
      ? supabase.from("tarifas_transporte").select("nombre, icono").eq("org_id", perfil.org_id)
      : Promise.resolve({ data: null }),
    // El Jefe no recibe cajas (ni lee la de administración): no hace falta.
    caja && tipo === "guardia" && caja.fecha < hoy && perfil.rol !== "guardia"
      ? supabase
          .from("cajas")
          .select("estado")
          .eq("org_id", perfil.org_id)
          .eq("tipo", "administracion")
          .eq("fecha", caja.fecha)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // 0053: ventas y otros ingresos sin cliente (los cobra Administración, en su caja).
    caja && tipo === "administracion" && perfil.rol !== "guardia"
      ? supabase
          .from("ingresos_varios")
          .select(
            "id, numero, creado_en, creado_por, concepto_nombre, detalle, monto, medio, titular_transferencia, comprobante_path, anulado, motivo_anulacion, conciliado, conciliado_por, conciliado_en"
          )
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  const pagos = pagosRes.data ?? [];
  const canonFilas = canonRes.data ?? [];
  const ingresosFilas = ingresosRes.data ?? [];
  const gastosFilas = gastosRes.data ?? [];
  const gastosBancoFilas = gastosBancoRes.data ?? [];
  const ajustesFilas = ajustesRes.data ?? [];
  const eventosFilas = eventosRes.data ?? [];

  // Las transferencias de las cajas de portería recibidas acá también están en el "Banco"
  // de esta caja: Tesorería las chequea en el mismo lugar.
  const fechaRendida = new Map((rendidasRes.data ?? []).map((r) => [r.id, r.fecha]));
  const idsRendidas = [...fechaRendida.keys()];
  const [pagosPorteriaRes, canonPorteriaRes] =
    idsRendidas.length > 0
      ? await Promise.all([
          supabase
            .from("pagos")
            .select(
              "id, numero, caja_id, monto, fecha, titular_transferencia, comprobante_path, conciliado, conciliado_por, conciliado_en, cliente:clientes(nombre, codigo)"
            )
            .in("caja_id", idsRendidas)
            .eq("medio", "transferencia")
            .eq("anulado", false)
            .order("fecha", { ascending: true }),
          supabase
            .from("canon_camiones")
            .select(
              "id, numero, caja_id, creado_en, tarifa_nombre, cantidad, monto, patente, conciliado, conciliado_por, conciliado_en"
            )
            .in("caja_id", idsRendidas)
            .eq("medio", "transferencia")
            .eq("anulado", false)
            .order("creado_en", { ascending: true }),
        ])
      : [{ data: null }, { data: null }];
  const pagosPorteria = pagosPorteriaRes.data ?? [];
  const canonPorteria = canonPorteriaRes.data ?? [];

  // Los comprobantes solo se firman para quien concilia, y no en el imprimible.
  const concilia = conPrevias && (perfil.rol === "tesoreria" || perfil.rol === "lider");
  const comprobantes = new Map<string, string>();
  if (concilia) {
    const paths = [...pagos, ...pagosPorteria, ...ingresosFilas]
      .filter((p) => !p.conciliado && p.comprobante_path)
      .map((p) => p.comprobante_path as string);
    if (paths.length > 0) {
      const { data: firmadas } = await supabase.storage.from("documentos").createSignedUrls(paths, 3600);
      for (const f of firmadas ?? []) if (f.path && f.signedUrl) comprobantes.set(f.path, f.signedUrl);
    }
  }

  const nombres = await nombresPorUsuario(supabase, [
    caja?.abierta_por,
    caja?.cerrada_por,
    caja?.validada_por,
    caja?.integrada_por,
    caja?.reapertura_solicitada_por,
    ...pagos.map((p) => p.recibido_por),
    ...canonFilas.map((c) => c.creado_por),
    ...gastosFilas.map((g) => g.pagado_por),
    ...gastosBancoFilas.flatMap((g) => [g.pagado_por, g.conciliado_por]),
    ...pagos.map((p) => p.conciliado_por),
    ...canonFilas.map((c) => c.conciliado_por),
    ...ingresosFilas.flatMap((i) => [i.creado_por, i.conciliado_por]),
    ...pagosPorteria.map((p) => p.conciliado_por),
    ...canonPorteria.map((c) => c.conciliado_por),
    ...ajustesFilas.map((a) => a.creado_por),
    ...eventosFilas.map((e) => e.usuario_id),
  ]);
  const nombre = (id: string | null | undefined) => (id ? (nombres.get(id) ?? null) : null);

  // 0052: el Jefe cobra la cochera de puesteros y empleados, que no lee (RLS): los nombra la base.
  const sinNombre = [...new Set(pagos.filter((p) => !p.cliente).map((p) => p.cliente_id))];
  const cobradosEnPorteria = new Map<string, { nombre: string; codigo: number; categoria: string }>();
  if (sinNombre.length > 0 && tipo === "guardia") {
    const { data } = await supabase.rpc("clientes_cobrados_en_porteria", { p_clientes: sinNombre });
    for (const c of data ?? []) cobradosEnPorteria.set(c.id, c);
  }
  const clienteDe = (p: (typeof pagos)[number]) => p.cliente ?? cobradosEnPorteria.get(p.cliente_id) ?? null;

  // Recibos: las líneas de un mismo lote van juntas (cobro mixto).
  const porLote = new Map<string, ReciboDia>();
  for (const p of pagos) {
    const linea: LineaCobro = {
      pagoId: p.id,
      linea: Number(p.linea ?? 1),
      medio: p.medio,
      monto: Number(p.monto),
      anulado: p.anulado,
      titularTransferencia: p.titular_transferencia,
      cheque: p.cheque
        ? {
            numero: p.cheque.numero,
            cuit: p.cheque.cuit,
            recibidoDe: p.cheque.recibido_de,
            fechaCobro: p.cheque.fecha_cobro,
            estado: p.cheque.estado,
            proveedor: p.cheque.proveedor,
            entregadoEnCobro: Boolean(p.cheque.entregado_en_cobro),
          }
        : null,
    };
    const lote = p.lote_id ?? p.id;
    const existente = porLote.get(lote);
    if (existente) {
      existente.lineas.push(linea);
      continue;
    }
    const cliente = clienteDe(p);
    const categoria = cliente?.categoria;
    porLote.set(lote, {
      loteId: lote,
      numero: Number(p.numero),
      pagoId: p.id,
      fecha: p.fecha,
      cliente: cliente
        ? {
            nombre: cliente.nombre,
            codigo: Number(cliente.codigo),
            categoria: categoria && CATEGORIAS.has(categoria) ? (categoria as CategoriaCliente) : null,
          }
        : null,
      lineas: [linea],
      total: 0,
      totalOriginal: 0,
      anulado: false,
      motivoAnulacion: p.motivo_anulacion,
      recibioNombre: nombre(p.recibido_por),
    });
  }
  const recibos = [...porLote.values()].map((r) => {
    const lineas = [...r.lineas].sort((a, b) => a.linea - b.linea);
    const anulado = lineas.every((l) => l.anulado);
    const primeraAnulada = pagos.find((p) => (p.lote_id ?? p.id) === r.loteId && p.anulado);
    return {
      ...r,
      lineas,
      pagoId: lineas[0]?.pagoId ?? r.pagoId,
      total: lineas.reduce((acc, l) => (l.anulado ? acc : acc + l.monto), 0),
      totalOriginal: lineas.reduce((acc, l) => acc + l.monto, 0),
      anulado,
      motivoAnulacion: primeraAnulada?.motivo_anulacion ?? null,
    };
  });

  const canon: CanonEntrada[] = canonFilas.map((c) => ({
    id: c.id,
    numero: Number(c.numero),
    creado_en: c.creado_en,
    creado_por: c.creado_por,
    creadoPorNombre: nombre(c.creado_por),
    tarifa_nombre: c.tarifa_nombre,
    unidad: c.unidad === "dia" ? "dia" : c.unidad === "vehiculo" ? "vehiculo" : null,
    cantidad: Number(c.cantidad),
    precio_unitario: c.precio_unitario === null ? null : Number(c.precio_unitario),
    monto: Number(c.monto),
    medio: c.medio === "transferencia" ? "transferencia" : "efectivo",
    patente: c.patente,
    destino:
      c.destino === "puesto" || c.destino === "verdulero" || c.destino === "ambulante" ? c.destino : null,
    destino_detalle: c.destino_detalle,
    anulado: Boolean(c.anulado),
    motivo_anulacion: c.motivo_anulacion,
  }));

  const cerradaEn = caja?.cerrada_en ? new Date(caja.cerrada_en).getTime() : null;
  const gastos: GastoCaja[] = gastosFilas.map((g) => ({
    id: g.id,
    descripcion: g.descripcion?.trim() || g.rubro?.nombre || "Gasto",
    rubro: g.rubro ?? null,
    monto: Number(g.monto),
    pagadoEn: g.pagado_en,
    pagadoPorNombre: nombre(g.pagado_por),
    despuesDelCierre:
      cerradaEn !== null && g.pagado_en !== null && new Date(g.pagado_en).getTime() > cerradaEn,
  }));

  const partes = (...p: (string | null | false | undefined)[]) => p.filter(Boolean).join(" · ") || null;
  const cobroATransferencia = (
    p: {
      id: string;
      numero: number;
      monto: number;
      titular_transferencia: string | null;
      comprobante_path: string | null;
      conciliado: boolean;
      conciliado_por: string | null;
      conciliado_en: string | null;
      cliente: { nombre: string; codigo: number } | null;
    },
    porteriaFecha: string | null
  ): TransferenciaCaja => ({
    clase: "cobro",
    id: p.id,
    sentido: "entra",
    porteriaFecha,
    titulo: p.cliente?.nombre ?? "—",
    detalle: partes(
      p.cliente ? `Carpeta ${p.cliente.codigo}` : null,
      `Recibo N° ${p.numero}`,
      p.titular_transferencia ? `Titular: ${p.titular_transferencia}` : null
    ),
    monto: Number(p.monto),
    conciliada: p.conciliado,
    conciliadaPorNombre: nombre(p.conciliado_por),
    conciliadaEn: p.conciliado_en,
    comprobanteUrl: p.comprobante_path ? (comprobantes.get(p.comprobante_path) ?? null) : null,
  });
  const canonATransferencia = (
    c: {
      id: string;
      numero: number;
      tarifa_nombre: string | null;
      cantidad: number;
      monto: number;
      patente: string | null;
      conciliado: boolean;
      conciliado_por: string | null;
      conciliado_en: string | null;
    },
    porteriaFecha: string | null
  ): TransferenciaCaja => ({
    clase: "canon",
    id: c.id,
    sentido: "entra",
    porteriaFecha,
    titulo: `${c.tarifa_nombre ?? "Bono camioneros"}${Number(c.cantidad) > 1 ? ` × ${Number(c.cantidad)}` : ""}`,
    detalle: partes(`Bono camioneros N° ${c.numero}`, c.patente ? `Patente ${c.patente}` : null),
    monto: Number(c.monto),
    conciliada: c.conciliado,
    conciliadaPorNombre: nombre(c.conciliado_por),
    conciliadaEn: c.conciliado_en,
    comprobanteUrl: null,
  });
  const transferencias: TransferenciaCaja[] = [
    ...pagos
      .filter((p) => p.medio === "transferencia" && !p.anulado)
      .map((p) => cobroATransferencia({ ...p, cliente: clienteDe(p) }, null)),
    ...canonFilas
      .filter((c) => c.medio === "transferencia" && !c.anulado)
      .map((c) => canonATransferencia(c, null)),
    ...pagosPorteria.map((p) => cobroATransferencia(p, fechaRendida.get(p.caja_id ?? "") ?? null)),
    ...canonPorteria.map((c) => canonATransferencia(c, fechaRendida.get(c.caja_id ?? "") ?? null)),
    ...ingresosFilas
      .filter((i) => i.medio === "transferencia" && !i.anulado)
      .map(
        (i): TransferenciaCaja => ({
          clase: "ingreso",
          id: i.id,
          sentido: "entra",
          porteriaFecha: null,
          titulo: i.detalle?.trim() ? `${i.concepto_nombre}: ${i.detalle.trim()}` : i.concepto_nombre,
          detalle: partes(
            `Cobro N° ${i.numero}`,
            i.titular_transferencia ? `Titular: ${i.titular_transferencia}` : null
          ),
          monto: Number(i.monto),
          conciliada: i.conciliado,
          conciliadaPorNombre: nombre(i.conciliado_por),
          conciliadaEn: i.conciliado_en,
          comprobanteUrl: i.comprobante_path ? (comprobantes.get(i.comprobante_path) ?? null) : null,
        })
      ),
    ...gastosBancoFilas.map(
      (g): TransferenciaCaja => ({
        clase: "gasto",
        id: g.id,
        sentido: "sale",
        porteriaFecha: null,
        titulo: g.descripcion?.trim() || g.rubro?.nombre || "Gasto",
        detalle: partes(
          g.rubro && g.descripcion?.trim() ? g.rubro.nombre : null,
          nombre(g.pagado_por) ? `Lo pagó ${nombre(g.pagado_por)}` : null
        ),
        monto: Number(g.monto),
        conciliada: g.conciliado,
        conciliadaPorNombre: nombre(g.conciliado_por),
        conciliadaEn: g.conciliado_en,
        comprobanteUrl: null,
      })
    ),
  ];

  const ingresos: IngresoCaja[] = ingresosFilas.map((i) => ({
    id: i.id,
    numero: Number(i.numero),
    creadoEn: i.creado_en,
    creadoPor: i.creado_por,
    creadoPorNombre: nombre(i.creado_por),
    concepto: i.concepto_nombre,
    detalle: i.detalle,
    monto: Number(i.monto),
    medio: i.medio === "transferencia" ? "transferencia" : "efectivo",
    titular: i.titular_transferencia,
    anulado: i.anulado,
    motivoAnulacion: i.motivo_anulacion,
  }));

  const ajustes: AjusteCaja[] = ajustesFilas.map((a) => ({
    id: a.id,
    cuenta: a.cuenta === "efectivo" ? "efectivo" : "banco",
    monto: Number(a.monto),
    descripcion: a.descripcion,
    creadoEn: a.creado_en,
    creadoPorNombre: nombre(a.creado_por),
  }));

  const eventos: EventoCaja[] = eventosFilas.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    detalle: e.detalle,
    creado_en: e.creado_en,
    usuario: nombre(e.usuario_id),
  }));

  const rendidas: RendicionIntegrada[] = (rendidasRes.data ?? []).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    estado: r.estado,
    total_efectivo: Number(r.total_efectivo ?? 0),
    total_transferencia: Number(r.total_transferencia ?? 0),
    total_quintas: Number(r.total_quintas ?? 0),
    total_ambulantes: Number(r.total_ambulantes ?? 0),
    total_cocheras: Math.max(
      Math.round((Number(r.total_cobros ?? 0) - Number(r.total_quintas ?? 0) - Number(r.total_ambulantes ?? 0)) * 100) / 100,
      0
    ),
    total_canon: Number(r.total_canon ?? 0),
    total_ajustes: Number(r.total_ajustes ?? 0),
  }));

  const previas = ((previasRes.data ?? []) as CajaPrevia[]).filter((p) => p.id !== caja?.id).slice(0, 7);

  return {
    tipo,
    fecha,
    esHoy,
    caja,
    arqueo: arqueoRes.data ? parsearArqueo(arqueoRes.data) : ARQUEO_VACIO,
    arqueoError: mensajeError(arqueoRes.error),
    recibos,
    canon,
    ingresos,
    tarifas: (tarifasRes.data ?? [])
      .filter((t) => ICONOS.has(t.icono))
      .map((t) => ({ nombre: t.nombre, icono: t.icono as IconoTarifa })),
    gastos,
    transferencias,
    ajustes,
    previas,
    eventos,
    rendidas,
    nombres: {
      abierta: nombre(caja?.abierta_por),
      cerrada: nombre(caja?.cerrada_por),
      validada: nombre(caja?.validada_por),
      integrada: nombre(caja?.integrada_por),
      reapertura: nombre(caja?.reapertura_solicitada_por),
    },
    cajaAbiertaOtroDia: otroDiaRes.data
      ? {
          id: otroDiaRes.data.id,
          fecha: otroDiaRes.data.fecha,
          reaperturas: Number(otroDiaRes.data.reaperturas ?? 0),
        }
      : null,
    adminMismoDia: aAdminMismoDia(adminMismoDiaRes.data?.estado),
  };
}

/** Junta todo lo que necesita la pantalla de la caja de un tipo, para una fecha. */
export async function cargarDatosCaja(
  perfil: Perfil,
  tipo: TipoCaja,
  fechaPedida?: string
): Promise<DatosCaja> {
  const supabase = await createClient();
  const fecha = normalizarFechaCaja(fechaPedida);
  const { data: caja } = await supabase
    .from("cajas")
    .select("*")
    .eq("org_id", perfil.org_id)
    .eq("tipo", tipo)
    .eq("fecha", fecha)
    .maybeSingle();
  return armarDatos(supabase, perfil, tipo, fecha, caja ?? null, true);
}

/** Una caja por id (para el imprimible). null si no existe o la RLS no la deja ver. */
export async function cargarDatosCajaPorId(perfil: Perfil, cajaId: string): Promise<DatosCaja | null> {
  if (!/^[0-9a-f-]{36}$/i.test(cajaId)) return null;
  const supabase = await createClient();
  const { data: caja } = await supabase
    .from("cajas")
    .select("*")
    .eq("org_id", perfil.org_id)
    .eq("id", cajaId)
    .maybeSingle();
  if (!caja) return null;
  return armarDatos(supabase, perfil, caja.tipo, caja.fecha, caja, false);
}

// ---------------------------------------------------------------------------
// Bandeja: cajas de portería por recibir y pedidos de reapertura.
// ---------------------------------------------------------------------------

/** Caja de portería rendida (cerrada) que espera entrar en la caja mayor. */
export type RendicionPendiente = {
  id: string;
  fecha: string;
  cerrada_en: string | null;
  cerradaPorNombre: string | null;
  total_efectivo: number;
  total_transferencia: number;
  total_quintas: number;
  total_ambulantes: number;
  /** La cochera que el Jefe le cobró a puesteros y empleados (cobros − quintas − ambulantes, 0052). */
  total_cocheras: number;
  total_canon: number;
  total_ajustes: number;
  reapertura_solicitada_en: string | null;
  reapertura_motivo: string | null;
  /** La caja de administración de ese mismo día (anterior a hoy), si existe y no está validada. */
  adminMismoDia: AdminMismoDia;
};

export type PedidoReapertura = {
  id: string;
  tipo: TipoCaja;
  fecha: string;
  estado: EstadoCaja;
  motivo: string | null;
  solicitada_en: string;
  solicitadaPorNombre: string | null;
};

export type BandejaAdmin = {
  rendiciones: RendicionPendiente[];
  pedidos: PedidoReapertura[];
};

/** Lo que Administración (o Tesorería, o el Líder) tiene para resolver sobre las cajas. */
export async function cargarBandejaAdmin(perfil: Perfil): Promise<BandejaAdmin> {
  const supabase = await createClient();

  const [rendicionesRes, pedidosRes] = await Promise.all([
    supabase
      .from("cajas")
      .select(
        "id, fecha, cerrada_en, cerrada_por, total_efectivo, total_transferencia, total_cobros, total_quintas, total_ambulantes, total_canon, total_ajustes, reapertura_solicitada_en, reapertura_motivo"
      )
      .eq("org_id", perfil.org_id)
      .eq("tipo", "guardia")
      .eq("estado", "cerrada")
      .order("fecha", { ascending: false }),
    supabase
      .from("cajas")
      .select("id, tipo, fecha, estado, reapertura_motivo, reapertura_solicitada_en, reapertura_solicitada_por")
      .eq("org_id", perfil.org_id)
      .not("reapertura_solicitada_en", "is", null)
      .order("reapertura_solicitada_en", { ascending: true }),
  ]);

  // Carga atrasada: una caja de portería de un día anterior puede entrar en la caja de
  // administración de ese mismo día (si está abierta o cerrada sin validar).
  const hoy = hoyISO();
  const diasAnteriores = [
    ...new Set((rendicionesRes.data ?? []).map((r) => r.fecha).filter((f) => f < hoy)),
  ];
  const [nombres, adminRes] = await Promise.all([
    nombresPorUsuario(supabase, [
      ...(rendicionesRes.data ?? []).map((r) => r.cerrada_por),
      ...(pedidosRes.data ?? []).map((p) => p.reapertura_solicitada_por),
    ]),
    diasAnteriores.length > 0
      ? supabase
          .from("cajas")
          .select("fecha, estado")
          .eq("org_id", perfil.org_id)
          .eq("tipo", "administracion")
          .in("fecha", diasAnteriores)
      : Promise.resolve({ data: null }),
  ]);
  const adminPorDia = new Map<string, AdminMismoDia>();
  for (const c of adminRes.data ?? []) adminPorDia.set(c.fecha, aAdminMismoDia(c.estado));

  return {
    rendiciones: (rendicionesRes.data ?? []).map((r) => ({
      id: r.id,
      fecha: r.fecha,
      cerrada_en: r.cerrada_en,
      cerradaPorNombre: r.cerrada_por ? (nombres.get(r.cerrada_por) ?? null) : null,
      total_efectivo: Number(r.total_efectivo ?? 0),
      total_transferencia: Number(r.total_transferencia ?? 0),
      total_quintas: Number(r.total_quintas ?? 0),
      total_ambulantes: Number(r.total_ambulantes ?? 0),
      total_cocheras: Math.max(
        Math.round((Number(r.total_cobros ?? 0) - Number(r.total_quintas ?? 0) - Number(r.total_ambulantes ?? 0)) * 100) / 100,
        0
      ),
      total_canon: Number(r.total_canon ?? 0),
      total_ajustes: Number(r.total_ajustes ?? 0),
      reapertura_solicitada_en: r.reapertura_solicitada_en,
      reapertura_motivo: r.reapertura_motivo,
      adminMismoDia: adminPorDia.get(r.fecha) ?? null,
    })),
    pedidos: (pedidosRes.data ?? [])
      .filter((p) => p.reapertura_solicitada_en)
      .map((p) => ({
        id: p.id,
        tipo: p.tipo,
        fecha: p.fecha,
        estado: p.estado,
        motivo: p.reapertura_motivo,
        solicitada_en: p.reapertura_solicitada_en as string,
        solicitadaPorNombre: p.reapertura_solicitada_por
          ? (nombres.get(p.reapertura_solicitada_por) ?? null)
          : null,
      })),
  };
}
