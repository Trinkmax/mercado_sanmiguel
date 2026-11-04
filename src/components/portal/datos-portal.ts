import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { filtroClientePortal, getPerfil } from "@/lib/auth";
import { periodoActual } from "@/lib/format";
import { SIN_CONEXION } from "@/lib/sesion";
import {
  clienteEnPublico,
  esperaDescargo,
  registroSinVer,
  respuestaNueva,
  type CategoriaCliente,
} from "@/lib/segmentos";
import type { EstadoSolicitud } from "@/components/solicitudes/constantes";
import {
  armarCuenta,
  lugaresPrincipales,
  ordenarLugares,
  type CargoCrudo,
  type Cuenta,
  type LugarCrudo,
} from "@/components/portal/armar-cuenta";

/**
 * Datos del portal del socio compartidos por el layout (navegación con contador y
 * bloqueo por circulares obligatorias) y las páginas. `cache` = una sola consulta por request.
 */

export type ClienteSocio = {
  id: string;
  org_id: string;
  nombre: string;
  codigo: number;
  categoria: CategoriaCliente;
  segmentos: string[];
};

/** El cliente vinculado al usuario del portal (null si no está vinculado). */
export const getClienteSocio = cache(async (userId: string): Promise<ClienteSocio | null> => {
  const supabase = await createClient();
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("id, org_id, nombre, codigo, categoria")
    .eq(...filtroClientePortal({ user_id: userId, vistaClienteId: (await getPerfil())?.vistaClienteId ?? null }))
    .maybeSingle();
  // Si la base no respondió no se sabe nada: reintentar, nunca «no está unido a su carpeta».
  if (error) throw new Error(SIN_CONEXION);
  if (!cliente) return null;
  const { data: seg } = await supabase
    .from("v_clientes_segmentos")
    .select("segmentos")
    .eq("cliente_id", cliente.id)
    .maybeSingle();
  return {
    ...cliente,
    categoria: cliente.categoria as CategoriaCliente,
    segmentos: seg?.segmentos ?? [],
  };
});

export type CircularPortal = {
  id: string;
  numero: number;
  titulo: string;
  detalle: string | null;
  fecha: string;
  obligatoria: boolean;
  storage_path: string | null;
  publico: string[] | null;
  recibida_en: string | null;
};

/**
 * Circulares activas que le llegan a este socio, con su "la vio". La RLS (0022) ya filtra por
 * público; se vuelve a filtrar con clienteEnPublico() (espejo exacto) como red de seguridad.
 */
export const getCircularesSocio = cache(async (userId: string): Promise<CircularPortal[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const [circularesRes, recepcionesRes] = await Promise.all([
    supabase
      .from("circulares")
      .select("id, numero, titulo, detalle, fecha, obligatoria, storage_path, publico")
      .eq("activa", true)
      .order("fecha", { ascending: false })
      .order("numero", { ascending: false }),
    supabase
      .from("circular_recepciones")
      .select("circular_id, recibida_en")
      .eq("cliente_id", cliente.id),
  ]);
  const recibida = new Map<string, string>();
  for (const r of recepcionesRes.data ?? []) recibida.set(r.circular_id, r.recibida_en);
  return (circularesRes.data ?? [])
    .filter((c) => clienteEnPublico(cliente, c.publico))
    .map((c) => ({ ...c, recibida_en: recibida.get(c.id) ?? null }));
});

export type RegistroPortal = {
  id: string;
  numero: number;
  tipo: "notificacion" | "apercibimiento" | "sancion";
  titulo: string;
  fecha: string;
  estado: string;
  visto_en: string | null;
  socio_leyo_en: string | null;
  ultimo_mensaje_en: string | null;
  multa: number | null;
  multa_vencimiento: string | null;
  multa_sin_efecto_en: string | null;
  cargo: { estado: string; monto: number; monto_pagado: number } | null;
};

/** Notificaciones, apercibimientos y sanciones del socio (la RLS da solo los propios). */
export const getRegistrosSocio = cache(async (userId: string): Promise<RegistroPortal[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("sanciones")
    .select(
      "id, numero, tipo, titulo, fecha, estado, visto_en, socio_leyo_en, ultimo_mensaje_en, multa, multa_vencimiento, multa_sin_efecto_en, creado_en, cargos(estado, monto, monto_pagado)"
    )
    .eq("cliente_id", cliente.id)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false });
  return (data ?? []).map((r) => {
    const cargo = Array.isArray(r.cargos) ? r.cargos[0] : r.cargos;
    return {
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      titulo: r.titulo,
      fecha: r.fecha,
      estado: r.estado,
      visto_en: r.visto_en,
      socio_leyo_en: r.socio_leyo_en,
      ultimo_mensaje_en: r.ultimo_mensaje_en,
      multa: r.multa === null ? null : Number(r.multa),
      multa_vencimiento: r.multa_vencimiento,
      multa_sin_efecto_en: r.multa_sin_efecto_en,
      cargo: cargo
        ? { estado: cargo.estado, monto: Number(cargo.monto), monto_pagado: Number(cargo.monto_pagado) }
        : null,
    };
  });
});

/** ¿El registro tiene algo nuevo para el socio? (sin ver o respuesta nueva) */
export function registroEsNuevo(r: RegistroPortal): boolean {
  return registroSinVer(r) || respuestaNueva(r);
}

/**
 * Solicitudes que cargó el socio con una respuesta (o un cambio de estado) de otra persona
 * que todavía no abrió: sello "Respuesta nueva" en la lista y número en "Mi cuenta". Se apaga
 * al abrir el detalle (marcar_solicitud_vista). Si la base no responde, no marca nada.
 */
export const getSolicitudesConRespuesta = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("solicitudes_con_respuesta");
  if (error) return [];
  return data ?? [];
});

export type ResumenComunicaciones = {
  /** Contador de "nuevas" por pestaña del portal. */
  nuevas: { circulares: number; notificaciones: number; apercibimientos: number; sanciones: number };
  total: number;
  /** Apercibimientos y sanciones que esperan el descargo del socio. */
  aResponder: { apercibimientos: number; sanciones: number };
  /** Obligatorias sin confirmar: bloquean el portal. */
  obligatoriasPendientes: CircularPortal[];
};

/** Badge del portal = circulares sin abrir + registros sin ver + registros con respuesta nueva. */
export const getResumenComunicaciones = cache(
  async (userId: string): Promise<ResumenComunicaciones> => {
    const [circulares, registros] = await Promise.all([
      getCircularesSocio(userId),
      getRegistrosSocio(userId),
    ]);
    const nuevosDe = (tipo: RegistroPortal["tipo"]) =>
      registros.filter((r) => r.tipo === tipo && registroEsNuevo(r)).length;
    const nuevas = {
      circulares: circulares.filter((c) => !c.recibida_en).length,
      notificaciones: nuevosDe("notificacion"),
      apercibimientos: nuevosDe("apercibimiento"),
      sanciones: nuevosDe("sancion"),
    };
    return {
      nuevas,
      total: nuevas.circulares + nuevas.notificaciones + nuevas.apercibimientos + nuevas.sanciones,
      aResponder: {
        apercibimientos: registros.filter((r) => r.tipo === "apercibimiento" && esperaDescargo(r)).length,
        sanciones: registros.filter((r) => r.tipo === "sancion" && esperaDescargo(r)).length,
      },
      obligatoriasPendientes: circulares.filter((c) => c.obligatoria && !c.recibida_en),
    };
  }
);

// ---------------------------------------------------------------------------
// La cuenta (rediseño «Tu lugar en el mercado», ver DESIGN.md)
// ---------------------------------------------------------------------------

/** Sus lugares en el plano: la RLS de `espacios` le da solo los propios. */
export const getLugaresSocio = cache(async (userId: string): Promise<LugarCrudo[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("espacios")
    .select("id, tipo, numero, medio, tamano, propio, x, y, w, h")
    .eq("cliente_id", cliente.id);
  const lugares = (data ?? []).map((l) => ({
    ...l,
    tipo: l.tipo as LugarCrudo["tipo"],
    medio: Boolean(l.medio),
    propio: Boolean(l.propio),
    tamano: l.tamano === null ? null : Number(l.tamano),
    x: Number(l.x),
    y: Number(l.y),
    w: Number(l.w),
    h: Number(l.h),
  }));
  return ordenarLugares(lugares, cliente.categoria);
});

export type DeudaSocio = {
  deuda: number;
  deudaVencida: number;
  vencidoDesde: string | null;
  proximoVencimiento: string | null;
  saldoFavor: number;
};

/** Lo que debe hoy: de las mismas vistas que Cobrar y la ficha (nunca se recalcula acá). */
export const getDeudaSocio = cache(async (userId: string): Promise<DeudaSocio> => {
  const cliente = await getClienteSocio(userId);
  const vacia = { deuda: 0, deudaVencida: 0, vencidoDesde: null, proximoVencimiento: null, saldoFavor: 0 };
  if (!cliente) return vacia;
  const supabase = await createClient();
  const [deudaRes, favorRes] = await Promise.all([
    supabase
      .from("v_deuda_clientes")
      .select("deuda, deuda_vencida, vencido_desde, proximo_vencimiento")
      .eq("cliente_id", cliente.id)
      .maybeSingle(),
    supabase.from("v_saldo_favor").select("saldo_favor").eq("cliente_id", cliente.id).maybeSingle(),
  ]);
  // Sin respuesta de la base no se sabe lo que debe: reintentar, nunca «Estás al día».
  if (deudaRes.error || favorRes.error) throw new Error(SIN_CONEXION);
  return {
    deuda: Number(deudaRes.data?.deuda ?? 0),
    deudaVencida: Number(deudaRes.data?.deuda_vencida ?? 0),
    vencidoDesde: deudaRes.data?.vencido_desde ?? null,
    proximoVencimiento: deudaRes.data?.proximo_vencimiento ?? null,
    saldoFavor: Number(favorRes.data?.saldo_favor ?? 0),
  };
});

/** Todos los cargos del socio (sin anulados), con los montos como números. */
export const getCargosSocio = cache(async (userId: string): Promise<CargoCrudo[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cargos")
    .select("id, codigo, descripcion, periodo, vencimiento, monto, monto_pagado, descuento_pronto_pago, estado, reconocimiento")
    .eq("cliente_id", cliente.id)
    .neq("estado", "anulado")
    .order("periodo", { ascending: false })
    .order("descripcion");
  if (error) throw new Error(SIN_CONEXION);
  return (data ?? []).map((c) => ({
    ...c,
    periodo: c.periodo.slice(0, 10),
    monto: Number(c.monto),
    monto_pagado: Number(c.monto_pagado),
    descuento_pronto_pago: Number(c.descuento_pronto_pago),
    reconocimiento: c.reconocimiento === true,
  }));
});

/** La cuenta armada: el cartel, lo del mes, lo atrasado y el plan de pago. */
export const getCuentaSocio = cache(async (userId: string): Promise<Cuenta | null> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return null;
  const supabase = await createClient();
  const periodo = periodoActual();
  const [cargos, lugares, deuda, medidoresRes, avanceRes] = await Promise.all([
    getCargosSocio(userId),
    getLugaresSocio(userId),
    getDeudaSocio(userId),
    supabase.from("medidores").select("numero, espacio_id").eq("cliente_id", cliente.id).eq("activo", true),
    supabase
      .from("v_avance_mes")
      .select("total, pagado, falta, cuotas, cuotas_cubiertas, cuota_sugerida, semanas_no_vino")
      .eq("cliente_id", cliente.id)
      .eq("periodo", periodo)
      .maybeSingle(),
  ]);
  const a = avanceRes.data;
  return armarCuenta({
    cargos,
    lugares,
    principal: lugaresPrincipales(lugares),
    medidores: medidoresRes.data ?? [],
    ...deuda,
    avance: a
      ? {
          total: Number(a.total),
          pagado: Number(a.pagado),
          falta: Number(a.falta),
          cuotas: Number(a.cuotas),
          cuotas_cubiertas: Number(a.cuotas_cubiertas),
          cuota_sugerida: Number(a.cuota_sugerida),
          semanas_no_vino: Number(a.semanas_no_vino ?? 0),
        }
      : null,
    periodo,
  });
});

export type ReciboPortal = {
  pagoId: string;
  numero: number;
  fecha: string;
  total: number;
  medios: string[];
  titular: string | null;
};

/** Sus pagos: un renglón por recibo (lote), con todos sus medios. */
export const getRecibosSocio = cache(async (userId: string): Promise<ReciboPortal[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select("id, fecha, numero, monto, medio, titular_transferencia, lote_id, linea")
    .eq("cliente_id", cliente.id)
    .eq("anulado", false)
    .order("fecha", { ascending: false })
    .order("numero", { ascending: false })
    .order("linea", { ascending: true })
    .limit(400);
  if (error) throw new Error(SIN_CONEXION);
  const recibos: ReciboPortal[] = [];
  const porLote = new Map<string, ReciboPortal>();
  for (const p of data ?? []) {
    const clave = p.lote_id ?? p.id;
    const existente = porLote.get(clave);
    if (existente) {
      existente.total += Number(p.monto);
      if (!existente.medios.includes(p.medio)) existente.medios.push(p.medio);
      continue;
    }
    const nuevo: ReciboPortal = {
      pagoId: p.id,
      numero: p.numero,
      fecha: p.fecha,
      total: Number(p.monto),
      medios: [p.medio],
      titular: p.medio === "transferencia" ? p.titular_transferencia : null,
    };
    porLote.set(clave, nuevo);
    recibos.push(nuevo);
  }
  return recibos;
});

export type SolicitudPortal = {
  id: string;
  numero: number;
  tipo: "solicitud" | "informe" | "reclamo" | "consulta";
  asunto: string;
  estado: EstadoSolicitud;
  actualizada_en: string;
};

export const getSolicitudesSocio = cache(async (userId: string): Promise<SolicitudPortal[]> => {
  const cliente = await getClienteSocio(userId);
  if (!cliente) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("solicitudes")
    .select("id, numero, tipo, asunto, estado, actualizada_en")
    .eq("cliente_id", cliente.id)
    .order("actualizada_en", { ascending: false });
  return data ?? [];
});

/**
 * Lo que espera algo del socio: lo nuevo y lo que todavía pide su versión. Cada cosa una sola
 * vez (un apercibimiento nuevo también espera descargo). Da el número de Mensajes y, si hay una
 * sola, el aviso de «Mi cuenta» lleva directo a ella.
 */
export const getPendientesSocio = cache(async (userId: string): Promise<{ href: string; aResponder: boolean }[]> => {
  const [circulares, registros, conRespuesta] = await Promise.all([
    getCircularesSocio(userId),
    getRegistrosSocio(userId),
    getSolicitudesConRespuesta(),
  ]);
  return [
    ...registros
      .filter((r) => registroEsNuevo(r) || esperaDescargo(r))
      .map((r) => ({ href: `/mi-cuenta/comunicaciones/${r.id}`, aResponder: esperaDescargo(r) })),
    ...circulares.filter((c) => !c.recibida_en).map((c) => ({ href: `/mi-cuenta/circulares/${c.id}`, aResponder: false })),
    ...conRespuesta.map((id) => ({ href: `/mi-cuenta/solicitudes/${id}`, aResponder: false })),
  ];
});
