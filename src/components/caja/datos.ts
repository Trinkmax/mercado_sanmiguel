import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import type { Enums, Tables } from "@/lib/database.types";
import type { MedioPago } from "@/components/caja/medios";

export type TipoCaja = Enums<"tipo_caja">;
export type EstadoCaja = Enums<"estado_caja">;
export type Caja = Tables<"cajas">;

export type CobroDia = {
  id: string;
  numero: number;
  monto: number;
  medio: MedioPago;
  fecha: string;
  anulado: boolean;
  motivo_anulacion: string | null;
  titular_transferencia: string | null;
  cliente: { nombre: string; codigo: number } | null;
};

/** Qué entró por portería: camión, ambulante o quintero (cobro por día). */
export type TipoCanon = "camion" | "ambulante" | "quintero";

export type CanonDia = {
  id: string;
  tipo: TipoCanon;
  fecha: string;
  cantidad: number;
  monto: number;
  medio: MedioPago;
  notas: string | null;
  creado_en: string;
};

/** Precios configurados del canon diario (configuracion.precio_canon_*). */
export type PreciosCanon = {
  camion: number;
  ambulante: number;
  quintero: number;
};

export type GastoCaja = {
  id: string;
  descripcion: string;
  monto: number;
  medio_pago: MedioPago | null;
  rubro: { codigo: string; nombre: string } | null;
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

export type TotalesCaja = {
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos: number;
  /** Efectivo rendido por portería e integrado en esta caja (solo administración). */
  rendidoEfectivo: number;
  rendidoTransferencia: number;
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
  total_canon: number;
};

export type DatosCaja = {
  tipo: TipoCaja;
  /** Fecha de la caja que se muestra (hoy o la pedida por ?fecha=). */
  fecha: string;
  esHoy: boolean;
  caja: Caja | null;
  cobros: CobroDia[];
  canon: CanonDia[];
  gastos: GastoCaja[];
  preciosCanon: PreciosCanon;
  previas: CajaPrevia[];
  validadaPorNombre: string | null;
  cerradaPorNombre: string | null;
  reaperturaPorNombre: string | null;
  totales: TotalesCaja;
  eventos: EventoCaja[];
  rendidas: RendicionIntegrada[];
  /** Caja propia de otro día que sigue abierta (por ejemplo, reabierta). */
  cajaAbiertaOtroDia: { id: string; fecha: string; reaperturas: number } | null;
};

function sumar<T>(filas: T[], filtro: (f: T) => boolean, monto: (f: T) => number) {
  return filas.reduce((acc, f) => (filtro(f) ? acc + Number(monto(f)) : acc), 0);
}

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
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  const { data } = await supabase
    .from("perfiles")
    .select("user_id, nombre")
    .in("user_id", unicos);
  for (const p of data ?? []) mapa.set(p.user_id, p.nombre);
  return mapa;
}

/** Junta todo lo que necesita la pantalla de la caja de un tipo, para una fecha. */
export async function cargarDatosCaja(
  perfil: Perfil,
  tipo: TipoCaja,
  fechaPedida?: string
): Promise<DatosCaja> {
  const supabase = await createClient();
  const hoy = hoyISO();
  const fecha = normalizarFechaCaja(fechaPedida);
  const esHoy = fecha === hoy;

  const { data: caja } = await supabase
    .from("cajas")
    .select("*")
    .eq("org_id", perfil.org_id)
    .eq("tipo", tipo)
    .eq("fecha", fecha)
    .maybeSingle();

  const [
    cobrosRes,
    canonRes,
    gastosRes,
    configRes,
    previasRes,
    eventosRes,
    rendidasRes,
    otroDiaRes,
  ] = await Promise.all([
    caja
      ? supabase
          .from("pagos")
          .select(
            "id, numero, monto, medio, fecha, anulado, motivo_anulacion, titular_transferencia, cliente:clientes(nombre, codigo)"
          )
          .eq("caja_id", caja.id)
          .order("fecha", { ascending: true })
      : Promise.resolve({ data: null }),
    caja && tipo === "guardia"
      ? supabase
          .from("canon_camiones")
          .select("id, tipo, fecha, cantidad, monto, medio, notas, creado_en")
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    // El Jefe de Portería no tiene permiso de lectura sobre gastos (y su caja no paga gastos).
    caja && perfil.rol !== "guardia"
      ? supabase
          .from("gastos")
          .select(
            "id, descripcion, monto, medio_pago, rubro:rubros_gasto(codigo, nombre)"
          )
          .eq("caja_id", caja.id)
          .eq("estado", "pagado")
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    tipo === "guardia"
      ? supabase
          .from("configuracion")
          .select("precio_canon_camion, precio_canon_ambulante, precio_canon_quintero_dia")
          .eq("org_id", perfil.org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("cajas")
      .select(
        "id, fecha, estado, total_efectivo, total_transferencia, total_cheques, reapertura_solicitada_en"
      )
      .eq("org_id", perfil.org_id)
      .eq("tipo", tipo)
      .lt("fecha", hoy)
      .order("fecha", { ascending: false })
      .limit(8),
    caja
      ? supabase
          .from("caja_eventos")
          .select("id, tipo, detalle, creado_en, usuario_id")
          .eq("caja_id", caja.id)
          .order("creado_en", { ascending: true })
      : Promise.resolve({ data: null }),
    // Rendiciones de portería que ya entraron en esta caja de administración.
    caja && tipo === "administracion"
      ? supabase
          .from("cajas")
          .select("id, fecha, estado, total_efectivo, total_transferencia, total_canon")
          .eq("caja_destino_id", caja.id)
          .in("estado", ["integrada", "validada"])
          .order("fecha", { ascending: true })
      : Promise.resolve({ data: null }),
    // ¿Quedó una caja de otro día abierta (reabierta o sin cerrar)?
    esHoy
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
  ]);

  const eventosCrudos = eventosRes.data ?? [];
  const nombres = await nombresPorUsuario(supabase, [
    caja?.validada_por,
    caja?.cerrada_por,
    caja?.reapertura_solicitada_por,
    ...eventosCrudos.map((e) => e.usuario_id),
  ]);

  const cobros: CobroDia[] = (cobrosRes.data ?? []).map((p) => ({
    id: p.id,
    numero: Number(p.numero),
    monto: Number(p.monto),
    medio: p.medio,
    fecha: p.fecha,
    anulado: p.anulado,
    motivo_anulacion: p.motivo_anulacion,
    titular_transferencia: p.titular_transferencia,
    cliente: p.cliente ?? null,
  }));

  const canon: CanonDia[] = (canonRes.data ?? []).map((c) => ({
    id: c.id,
    tipo: (["camion", "ambulante", "quintero"].includes(c.tipo)
      ? c.tipo
      : "camion") as TipoCanon,
    fecha: c.fecha,
    cantidad: Number(c.cantidad),
    monto: Number(c.monto),
    medio: c.medio,
    notas: c.notas,
    creado_en: c.creado_en,
  }));

  const gastos: GastoCaja[] = (gastosRes.data ?? []).map((g) => ({
    id: g.id,
    descripcion: g.descripcion,
    monto: Number(g.monto),
    medio_pago: g.medio_pago,
    rubro: g.rubro ?? null,
  }));

  const rendidas: RendicionIntegrada[] = (rendidasRes.data ?? []).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    estado: r.estado,
    total_efectivo: Number(r.total_efectivo ?? 0),
    total_transferencia: Number(r.total_transferencia ?? 0),
    total_canon: Number(r.total_canon ?? 0),
  }));

  const eventos: EventoCaja[] = eventosCrudos.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    detalle: e.detalle,
    creado_en: e.creado_en,
    usuario: e.usuario_id ? (nombres.get(e.usuario_id) ?? null) : null,
  }));

  // Totales por medio: en vivo si está abierta; congelados si ya cerró.
  // Mismo criterio que la RPC (recalcular_arqueo): el canon suma a su medio,
  // los gastos pagados en efectivo se restan y lo rendido por portería e
  // integrado en esta caja se suma a efectivo / transferencias.
  let totales: TotalesCaja;
  if (caja && caja.estado !== "abierta") {
    totales = {
      efectivo: Number(caja.total_efectivo ?? 0),
      transferencia: Number(caja.total_transferencia ?? 0),
      cheques: Number(caja.total_cheques ?? 0),
      canon: Number(caja.total_canon ?? 0),
      gastos: Number(caja.total_gastos ?? 0),
      rendidoEfectivo: Number(caja.total_rendido_efectivo ?? 0),
      rendidoTransferencia: Number(caja.total_rendido_transferencia ?? 0),
    };
  } else {
    const vigentes = cobros.filter((c) => !c.anulado);
    const gastosEfectivo = sumar(
      gastos,
      (g) => g.medio_pago === "efectivo",
      (g) => g.monto
    );
    const rendidoEfectivo = sumar(rendidas, () => true, (r) => r.total_efectivo);
    const rendidoTransferencia = sumar(
      rendidas,
      () => true,
      (r) => r.total_transferencia
    );
    totales = {
      efectivo:
        sumar(vigentes, (c) => c.medio === "efectivo", (c) => c.monto) +
        sumar(canon, (c) => c.medio === "efectivo", (c) => c.monto) -
        gastosEfectivo +
        rendidoEfectivo,
      transferencia:
        sumar(vigentes, (c) => c.medio === "transferencia", (c) => c.monto) +
        sumar(canon, (c) => c.medio === "transferencia", (c) => c.monto) +
        rendidoTransferencia,
      cheques: sumar(vigentes, (c) => c.medio === "cheque", (c) => c.monto),
      canon: sumar(canon, () => true, (c) => c.monto),
      gastos: gastosEfectivo,
      rendidoEfectivo,
      rendidoTransferencia,
    };
  }

  const previas = ((previasRes.data ?? []) as CajaPrevia[])
    .filter((p) => p.id !== caja?.id)
    .slice(0, 7);

  return {
    tipo,
    fecha,
    esHoy,
    caja: caja ?? null,
    cobros,
    canon,
    gastos,
    preciosCanon: {
      camion: Number(configRes.data?.precio_canon_camion ?? 0),
      ambulante: Number(configRes.data?.precio_canon_ambulante ?? 0),
      quintero: Number(configRes.data?.precio_canon_quintero_dia ?? 0),
    },
    previas,
    validadaPorNombre: caja?.validada_por
      ? (nombres.get(caja.validada_por) ?? null)
      : null,
    cerradaPorNombre: caja?.cerrada_por ? (nombres.get(caja.cerrada_por) ?? null) : null,
    reaperturaPorNombre: caja?.reapertura_solicitada_por
      ? (nombres.get(caja.reapertura_solicitada_por) ?? null)
      : null,
    totales,
    eventos,
    rendidas,
    cajaAbiertaOtroDia: otroDiaRes.data
      ? {
          id: otroDiaRes.data.id,
          fecha: otroDiaRes.data.fecha,
          reaperturas: Number(otroDiaRes.data.reaperturas ?? 0),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Bandeja de administración: rendiciones de portería y pedidos de reapertura.
// ---------------------------------------------------------------------------

/** Caja de portería rendida (cerrada) que espera entrar en la caja mayor. */
export type RendicionPendiente = {
  id: string;
  fecha: string;
  cerrada_en: string | null;
  cerradaPorNombre: string | null;
  total_efectivo: number;
  total_transferencia: number;
  total_cheques: number;
  total_canon: number;
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

/** Lo que administración (o tesorería) tiene para resolver sobre las cajas. */
export async function cargarBandejaAdmin(perfil: Perfil): Promise<BandejaAdmin> {
  const supabase = await createClient();

  const [rendicionesRes, pedidosRes] = await Promise.all([
    supabase
      .from("cajas")
      .select(
        "id, fecha, cerrada_en, cerrada_por, total_efectivo, total_transferencia, total_cheques, total_canon, reapertura_solicitada_en, reapertura_motivo"
      )
      .eq("org_id", perfil.org_id)
      .eq("tipo", "guardia")
      .eq("estado", "cerrada")
      .order("fecha", { ascending: false }),
    supabase
      .from("cajas")
      .select(
        "id, tipo, fecha, estado, reapertura_motivo, reapertura_solicitada_en, reapertura_solicitada_por"
      )
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
      total_cheques: Number(r.total_cheques ?? 0),
      total_canon: Number(r.total_canon ?? 0),
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
