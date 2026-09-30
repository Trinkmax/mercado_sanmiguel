import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { filtroClientePortal, getPerfil } from "@/lib/auth";
import {
  clienteEnPublico,
  esperaDescargo,
  registroSinVer,
  respuestaNueva,
  type CategoriaCliente,
} from "@/lib/segmentos";

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
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, org_id, nombre, codigo, categoria")
    .eq(...filtroClientePortal({ user_id: userId, vistaClienteId: (await getPerfil())?.vistaClienteId ?? null }))
    .maybeSingle();
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
