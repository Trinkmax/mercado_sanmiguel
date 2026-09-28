"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Rol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { clientePerteneceAOrg } from "@/lib/actions/helpers";
import {
  rutaAdjuntoSolicitud,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";
import type { Enums } from "@/lib/database.types";
import { etiquetaLugar } from "@/components/solicitudes/lugares";

type Origen = Enums<"origen_solicitud">;
type Estado = Enums<"estado_solicitud">;
type Supabase = Awaited<ReturnType<typeof createClient>>;

const TIPOS = ["solicitud", "informe", "reclamo", "consulta"] as const;
const ORIGENES = ["portal", "porteria", "administracion", "tesoreria", "lider"] as const;
const ACCIONES = [
  "tomar",
  "derivar_consejo",
  "resolver",
  "asignar",
  "ejecutar",
  "rechazar",
  "cerrar",
  "reabrir",
  "elevar",
  "resolver_jefe",
] as const;

/** Origen por defecto según quién la carga. El trigger `preparar_solicitud` lo impone igual. */
function origenPorRol(rol: Rol): Origen {
  if (rol === "porteria" || rol === "guardia") return "porteria";
  if (rol === "tesoreria") return "tesoreria";
  if (rol === "lider" || rol === "consejo") return "lider";
  if (rol === "socio") return "portal";
  return "administracion";
}

/** Portería, el Jefe y Tesorería eligen un puesto por número: nunca un cliente. */
function veClientes(rol: Rol): boolean {
  return rol === "admin" || rol === "lider";
}

/** Sube un adjunto opcional a la carpeta de solicitudes. Devuelve el path o null. */
async function subirAdjunto(
  supabase: Supabase,
  orgId: string,
  archivo: FormDataEntryValue | null
): Promise<ActionResult<string | null>> {
  if (!(archivo instanceof File) || archivo.size === 0) return ok(null);
  if (!MIME_PERMITIDOS.includes(archivo.type))
    return fallo("El adjunto tiene que ser PDF o imagen (JPG, PNG o WEBP).");
  if (archivo.size > TAMANO_MAX_BYTES)
    return fallo("El adjunto no puede pesar más de 20 MB.");
  const ruta = rutaAdjuntoSolicitud(orgId, archivo.name);
  const { error } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (error) return fallo("No pudimos subir el adjunto. Probá de nuevo.");
  return ok(ruta);
}

/**
 * Un lugar del plano de mi organización, leído con `espacios_del_plano()` (el Jefe y Portería
 * no leen la tabla `espacios`). Devuelve su etiqueta ("Puesto 58") o null si no existe.
 */
async function lugarDelPlano(
  supabase: Supabase,
  espacioId: string
): Promise<{ id: string; etiqueta: string } | null> {
  const { data } = await supabase.rpc("espacios_del_plano");
  const e = (data ?? []).find((x) => x.id === espacioId);
  return e ? { id: e.id, etiqueta: etiquetaLugar(e) } : null;
}

const idOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const schemaCrear = z.object({
  tipo: z.enum(TIPOS, { error: "Elegí qué tipo de solicitud es" }),
  asunto: z
    .string()
    .trim()
    .min(1, "Poné un asunto corto (ej.: Luminaria rota frente al puesto 7)")
    .max(200, "El asunto es demasiado largo"),
  detalle: z
    .string()
    .trim()
    .max(6000, "El detalle es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
  clienteId: idOpcional,
  espacioId: idOpcional,
  referencia: z
    .string()
    .trim()
    .max(200, "La referencia es demasiado larga")
    .optional()
    .transform((v) => (v ? v : null)),
  origen: z.enum(ORIGENES).optional(),
});

/**
 * Alta de solicitud desde el panel. A quién le llega lo decide la base (trigger
 * `preparar_solicitud`): lo de Portería va al Jefe de Portería ("con_jefe"); el resto
 * (incluidos los avisos del Jefe) al Líder de Procesos ("nueva"). Devuelve el estado real.
 */
export async function crearSolicitud(
  formData: FormData
): Promise<ActionResult<{ id: string; numero: number; estado: Estado; origen: Origen }>> {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");

  const parsed = schemaCrear.safeParse({
    tipo: formData.get("tipo"),
    asunto: formData.get("asunto"),
    detalle: formData.get("detalle") ?? undefined,
    clienteId: formData.get("clienteId") ?? undefined,
    espacioId: formData.get("espacioId") ?? undefined,
    referencia: formData.get("referencia") ?? undefined,
    origen: formData.get("origen") || undefined,
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const puedeElegirOrigen = perfil.rol === "admin" || perfil.rol === "lider";
  const origen: Origen =
    puedeElegirOrigen && parsed.data.origen ? parsed.data.origen : origenPorRol(perfil.rol);

  const supabase = await createClient();

  // Portería, el Jefe y Tesorería no mandan clientes (no los ven): se ignora lo que venga.
  const clienteId = veClientes(perfil.rol) ? parsed.data.clienteId : null;
  if (clienteId && !(await clientePerteneceAOrg(supabase, clienteId, perfil.org_id))) {
    return fallo("Ese cliente no existe. Buscalo de nuevo.");
  }

  let referencia = clienteId ? null : parsed.data.referencia;
  let espacioId: string | null = null;
  if (parsed.data.espacioId) {
    const lugar = await lugarDelPlano(supabase, parsed.data.espacioId);
    if (!lugar) return fallo("Ese puesto no está en el plano. Elegilo de nuevo.");
    espacioId = lugar.id;
    referencia = lugar.etiqueta;
  }

  const adjunto = await subirAdjunto(supabase, perfil.org_id, formData.get("adjunto"));
  if (!adjunto.ok) return fallo(adjunto.error);

  const { data, error } = await supabase
    .from("solicitudes")
    .insert({
      org_id: perfil.org_id,
      tipo: parsed.data.tipo,
      asunto: parsed.data.asunto,
      detalle: parsed.data.detalle,
      cliente_id: clienteId,
      espacio_id: espacioId,
      referencia,
      origen,
      adjunto_path: adjunto.data,
      creada_por: perfil.user_id,
    })
    .select("id, numero, estado, origen")
    .single();

  if (error) {
    if (adjunto.data) await supabase.storage.from("documentos").remove([adjunto.data]);
    return fallo(error);
  }

  revalidatePath("/solicitudes");
  revalidatePath("/porteria");
  revalidatePath("/inicio");
  return ok({ id: data.id, numero: data.numero, estado: data.estado, origen: data.origen });
}

const schemaAviso = z.object({
  espacioId: z.string().trim().min(1, "Elegí el puesto en el plano"),
  motivo: z
    .string()
    .trim()
    .min(1, "Elegí qué viste en el puesto")
    .max(80, "El motivo es demasiado largo"),
  detalle: z
    .string()
    .trim()
    .max(2000, "El detalle es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
});

/**
 * Aviso del Jefe de Portería al Líder sobre un puesto, desde el mapa (G11; lo usa M9).
 * Crea un informe "Puesto 58: Luz / electricidad" con el espacio. Del Jefe nace "nueva"
 * (va directo a la bandeja del Líder, nunca a "Para resolver" del Jefe).
 */
export async function avisarSobrePuesto(input: {
  espacioId: string;
  motivo: string;
  detalle?: string;
}): Promise<ActionResult<{ id: string; numero: number; estado: Estado }>> {
  const perfil = await requireRol("guardia", "lider");
  const parsed = schemaAviso.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const lugar = await lugarDelPlano(supabase, parsed.data.espacioId);
  if (!lugar) return fallo("Ese puesto no está en el plano. Actualizá la página y probá de nuevo.");

  const { data, error } = await supabase
    .from("solicitudes")
    .insert({
      org_id: perfil.org_id,
      tipo: "informe",
      asunto: `${lugar.etiqueta}: ${parsed.data.motivo}`,
      detalle: parsed.data.detalle,
      referencia: lugar.etiqueta,
      espacio_id: lugar.id,
      origen: origenPorRol(perfil.rol),
      creada_por: perfil.user_id,
    })
    .select("id, numero, estado")
    .single();
  if (error) return fallo(error);

  revalidatePath("/solicitudes");
  revalidatePath("/mapa");
  revalidatePath("/inicio");
  return ok({ id: data.id, numero: data.numero, estado: data.estado });
}

const schemaMensaje = z.object({
  solicitudId: z.string().min(1),
  mensaje: z
    .string()
    .trim()
    .min(1, "Escribí el mensaje antes de enviarlo")
    .max(6000, "El mensaje es demasiado largo"),
  interno: z.boolean(),
});

/**
 * Mensaje en el hilo de una solicitud. Lo usan el staff y el socio; el socio nunca puede
 * marcarlo interno (la RLS también lo impide). La bandeja sube sola: el trigger
 * `tocar_solicitud` actualiza `actualizada_en` con cualquier mensaje.
 */
export async function enviarMensaje(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider", "socio");

  const parsed = schemaMensaje.safeParse({
    solicitudId: formData.get("solicitudId"),
    mensaje: formData.get("mensaje"),
    interno: perfil.rol !== "socio" && formData.get("interno") === "true",
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  // La RLS de lectura ya recorta qué solicitudes ve cada uno.
  const { data: solicitud } = await supabase
    .from("solicitudes")
    .select("id")
    .eq("id", parsed.data.solicitudId)
    .maybeSingle();
  if (!solicitud) return fallo("No encontramos esa solicitud.");

  const adjunto = await subirAdjunto(supabase, perfil.org_id, formData.get("adjunto"));
  if (!adjunto.ok) return fallo(adjunto.error);

  const { data, error } = await supabase
    .from("solicitud_mensajes")
    .insert({
      org_id: perfil.org_id,
      solicitud_id: solicitud.id,
      autor_id: perfil.user_id,
      autor_nombre: perfil.nombre,
      autor_rol: perfil.rol,
      mensaje: parsed.data.mensaje,
      interno: parsed.data.interno,
      adjunto_path: adjunto.data,
    })
    .select("id")
    .single();

  if (error) {
    if (adjunto.data) await supabase.storage.from("documentos").remove([adjunto.data]);
    return fallo(error);
  }

  revalidatePath("/solicitudes");
  revalidatePath(`/solicitudes/${solicitud.id}`);
  revalidatePath("/mi-cuenta");
  revalidatePath(`/mi-cuenta/solicitudes/${solicitud.id}`);
  return ok({ id: data.id });
}

const schemaAvanzar = z.object({
  solicitudId: z.string().min(1),
  accion: z.enum(ACCIONES),
  texto: z
    .string()
    .trim()
    .max(6000, "El texto es demasiado largo")
    .optional()
    .transform((v) => (v ? v : undefined)),
  usuarioId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/**
 * Cambia el estado de una solicitud vía `avanzar_solicitud`. La RPC valida quién puede
 * hacer qué (el Jefe de Portería solo sobre las de Portería) y deja el mensaje automático.
 */
export async function avanzarSolicitud(
  input: unknown
): Promise<ActionResult<{ estado: Estado }>> {
  await requireRol("admin", "guardia", "lider");
  const parsed = schemaAvanzar.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("avanzar_solicitud", {
    p_solicitud: parsed.data.solicitudId,
    p_accion: parsed.data.accion,
    p_texto: parsed.data.texto,
    p_usuario: parsed.data.usuarioId,
  });
  if (error) return fallo(error);

  revalidatePath("/solicitudes");
  revalidatePath(`/solicitudes/${parsed.data.solicitudId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-cuenta");
  revalidatePath(`/mi-cuenta/solicitudes/${parsed.data.solicitudId}`);
  return ok({ estado: data });
}
