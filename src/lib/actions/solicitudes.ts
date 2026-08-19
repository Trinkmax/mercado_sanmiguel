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

type Origen = Enums<"origen_solicitud">;

const TIPOS = ["solicitud", "informe", "reclamo", "consulta"] as const;
const ORIGENES = ["portal", "porteria", "administracion", "lider"] as const;
const ACCIONES = [
  "tomar",
  "derivar_consejo",
  "resolver",
  "asignar",
  "ejecutar",
  "rechazar",
  "cerrar",
  "reabrir",
] as const;

/** Origen por defecto según quién la carga (el socio siempre es `portal`). */
function origenPorRol(rol: Rol): Origen {
  if (rol === "porteria" || rol === "guardia") return "porteria";
  if (rol === "lider" || rol === "consejo") return "lider";
  if (rol === "socio") return "portal";
  return "administracion";
}

/** Sube un adjunto opcional a la carpeta de solicitudes. Devuelve el path o null. */
async function subirAdjunto(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
  clienteId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  referencia: z
    .string()
    .trim()
    .max(200, "La referencia es demasiado larga")
    .optional()
    .transform((v) => (v ? v : null)),
  origen: z.enum(ORIGENES).optional(),
});

/**
 * Alta de solicitud desde el panel (portería, administración, líder, consejo,
 * tesorería). El origen sale del rol; admin y líder pueden indicar otro cuando
 * cargan al sistema un formulario físico.
 */
export async function crearSolicitud(
  formData: FormData
): Promise<ActionResult<{ id: string; numero: number; origen: Origen }>> {
  const perfil = await requireRol(
    "admin",
    "guardia",
    "porteria",
    "tesoreria",
    "consejo",
    "lider"
  );

  const parsed = schemaCrear.safeParse({
    tipo: formData.get("tipo"),
    asunto: formData.get("asunto"),
    detalle: formData.get("detalle") ?? undefined,
    clienteId: formData.get("clienteId") ?? undefined,
    referencia: formData.get("referencia") ?? undefined,
    origen: formData.get("origen") || undefined,
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const puedeElegirOrigen = perfil.rol === "admin" || perfil.rol === "lider";
  const origen: Origen =
    puedeElegirOrigen && parsed.data.origen
      ? parsed.data.origen
      : origenPorRol(perfil.rol);

  const supabase = await createClient();

  if (
    parsed.data.clienteId &&
    !(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))
  ) {
    return fallo("Ese puesto no existe. Buscalo de nuevo.");
  }

  const adjunto = await subirAdjunto(
    supabase,
    perfil.org_id,
    formData.get("adjunto")
  );
  if (!adjunto.ok) return fallo(adjunto.error);

  const { data, error } = await supabase
    .from("solicitudes")
    .insert({
      org_id: perfil.org_id,
      tipo: parsed.data.tipo,
      asunto: parsed.data.asunto,
      detalle: parsed.data.detalle,
      cliente_id: parsed.data.clienteId,
      referencia: parsed.data.clienteId ? null : parsed.data.referencia,
      origen,
      adjunto_path: adjunto.data,
      creada_por: perfil.user_id,
    })
    .select("id, numero")
    .single();

  if (error) {
    if (adjunto.data)
      await supabase.storage.from("documentos").remove([adjunto.data]);
    return fallo(error);
  }

  revalidatePath("/solicitudes");
  revalidatePath("/porteria");
  return ok({ id: data.id, numero: data.numero, origen });
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
 * Mensaje en el hilo de una solicitud. Lo usan el staff y el socio; el socio
 * nunca puede marcarlo interno (la RLS también lo impide). Devuelve el id.
 */
export async function enviarMensaje(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol(
    "admin",
    "guardia",
    "porteria",
    "tesoreria",
    "consejo",
    "lider",
    "socio"
  );

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
    .select("id, cliente_id, estado")
    .eq("id", parsed.data.solicitudId)
    .maybeSingle();
  if (!solicitud) return fallo("No encontramos esa solicitud.");

  const adjunto = await subirAdjunto(
    supabase,
    perfil.org_id,
    formData.get("adjunto")
  );
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
    if (adjunto.data)
      await supabase.storage.from("documentos").remove([adjunto.data]);
    return fallo(error);
  }

  // "Última actualización" de la bandeja: solo los roles con permiso de
  // edición pueden tocarla; para el resto el listado usa el último mensaje.
  if (perfil.rol === "admin" || perfil.rol === "lider" || perfil.rol === "consejo") {
    await supabase
      .from("solicitudes")
      .update({ actualizada_en: new Date().toISOString() })
      .eq("id", solicitud.id);
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
 * Cambia el estado de una solicitud vía `avanzar_solicitud`. La RPC valida
 * quién puede hacer qué y deja el mensaje automático en el hilo.
 */
export async function avanzarSolicitud(
  input: unknown
): Promise<ActionResult<{ estado: Enums<"estado_solicitud"> }>> {
  await requireRol("admin", "consejo", "lider");
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
  revalidatePath("/mi-cuenta");
  revalidatePath(`/mi-cuenta/solicitudes/${parsed.data.solicitudId}`);
  return ok({ estado: data });
}
