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
  /** Nombre e ícono de las tarifas (para dibujar cada ingreso de transporte). */
  tarifas: { nombre: string; icono: IconoTarifa }[];
  gastos: GastoCaja[];
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
};

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

const CATEGORIAS = new Set(["puestero", "quintero", "ambulante"]);
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
    ajustesRes,
    previasRes,
    eventosRes,
    rendidasRes,
    otroDiaRes,
    tarifasRes,
  ] = await Promise.all([
    caja ? supabase.rpc("arqueo_caja", { p_caja: caja.id }) : Promise.resolve({ data: null, error: null }),
    caja
      ? supabase
          .from("pagos")
          .select(
            "id, numero, lote_id, linea, monto, medio, fecha, anulado, motivo_anulacion, titular_transferencia, recibido_por, cliente:clientes(nombre, codigo, categoria), cheque:cheques(numero, cuit, recibido_de, fecha_cobro, estado, proveedor, entregado_en_cobro)"
          )
          .eq("caja_id", caja.id)
          .order("fecha", { ascending: true })
          .order("linea", { ascending: true })
      : Promise.resolve({ data: null }),
    caja && tipo === "guardia"
      ? supabase
          .from("canon_camiones")
          .select(
            "id, numero, creado_en, creado_por, tarifa_nombre, unidad, cantidad, precio_unitario, monto, medio, patente, destino, destino_detalle, anulado, motivo_anulacion"
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
            "id, fecha, estado, total_efectivo, total_transferencia, total_quintas, total_ambulantes, total_canon, total_ajustes"
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
    caja && tipo === "guardia"
      ? supabase.from("tarifas_transporte").select("nombre, icono").eq("org_id", perfil.org_id)
      : Promise.resolve({ data: null }),
  ]);

  const pagos = pagosRes.data ?? [];
  const canonFilas = canonRes.data ?? [];
  const gastosFilas = gastosRes.data ?? [];
  const ajustesFilas = ajustesRes.data ?? [];
  const eventosFilas = eventosRes.data ?? [];

  const nombres = await nombresPorUsuario(supabase, [
    caja?.abierta_por,
    caja?.cerrada_por,
    caja?.validada_por,
    caja?.integrada_por,
    caja?.reapertura_solicitada_por,
    ...pagos.map((p) => p.recibido_por),
    ...canonFilas.map((c) => c.creado_por),
    ...gastosFilas.map((g) => g.pagado_por),
    ...ajustesFilas.map((a) => a.creado_por),
    ...eventosFilas.map((e) => e.usuario_id),
  ]);
  const nombre = (id: string | null | undefined) => (id ? (nombres.get(id) ?? null) : null);

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
    const categoria = p.cliente?.categoria;
    porLote.set(lote, {
      loteId: lote,
      numero: Number(p.numero),
      pagoId: p.id,
      fecha: p.fecha,
      cliente: p.cliente
        ? {
            nombre: p.cliente.nombre,
            codigo: Number(p.cliente.codigo),
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
    tarifas: (tarifasRes.data ?? [])
      .filter((t) => ICONOS.has(t.icono))
      .map((t) => ({ nombre: t.nombre, icono: t.icono as IconoTarifa })),
    gastos,
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
  total_canon: number;
  total_ajustes: number;
  reapertura_solicitada_en: string | null;
  reapertura_motivo: string | null;
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
        "id, fecha, cerrada_en, cerrada_por, total_efectivo, total_transferencia, total_quintas, total_ambulantes, total_canon, total_ajustes, reapertura_solicitada_en, reapertura_motivo"
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

  const nombres = await nombresPorUsuario(supabase, [
    ...(rendicionesRes.data ?? []).map((r) => r.cerrada_por),
    ...(pedidosRes.data ?? []).map((p) => p.reapertura_solicitada_por),
  ]);

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
      total_canon: Number(r.total_canon ?? 0),
      total_ajustes: Number(r.total_ajustes ?? 0),
      reapertura_solicitada_en: r.reapertura_solicitada_en,
      reapertura_motivo: r.reapertura_motivo,
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
