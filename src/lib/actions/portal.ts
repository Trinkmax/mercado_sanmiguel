"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, filtroClientePortal } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import {
  rutaDocumentoCliente,
  rutaAdjuntoSolicitud,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";

const CATEGORIAS = [
  "habilitacion_municipal",
  "senasa",
  "apto_electrico",
  "otro",
] as const;

/**
 * El socio sube un documento a su propia carpeta (habilitación, apto
 * eléctrico, etc.). La RLS solo le permite insertar sobre su propio cliente.
 */
export async function subirDocumentoSocio(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("socio");

  const parsed = z
    .object({
      titulo: z
        .string()
        .trim()
        .min(1, "Poné un título para el documento (ej.: Habilitación 2026)")
        .max(200, "El título es demasiado largo"),
      categoria: z.enum(CATEGORIAS, { error: "Elegí la categoría" }),
    })
    .safeParse({
      titulo: formData.get("titulo"),
      categoria: formData.get("categoria"),
    });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0)
    return fallo("Elegí el archivo que querés subir.");
  if (!MIME_PERMITIDOS.includes(archivo.type))
    return fallo("El archivo tiene que ser PDF o imagen (JPG, PNG o WEBP).");
  if (archivo.size > TAMANO_MAX_BYTES)
    return fallo("El archivo no puede pesar más de 20 MB.");

  const supabase = await createClient();

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .select("id")
    .eq(...filtroClientePortal(perfil))
    .maybeSingle();
  if (errorCliente) return fallo(errorCliente);
  if (!cliente)
    return fallo(
      "Tu usuario no está vinculado a un puesto. Consultá en administración."
    );

  const ruta = rutaDocumentoCliente(perfil.org_id, cliente.id, archivo.name);

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) return fallo("No pudimos subir el archivo. Probá de nuevo.");

  const { data, error } = await supabase
    .from("documentos_cliente")
    .insert({
      org_id: perfil.org_id,
      cliente_id: cliente.id,
      titulo: parsed.data.titulo,
      categoria: parsed.data.categoria,
      storage_path: ruta,
      mime: archivo.type,
      // subido_por lo pone el servidor (default auth.uid(); fuera del grant de INSERT, 0022).
    })
    .select("id")
    .single();

  if (error) {
    // Si no se pudo registrar, no dejamos el archivo huérfano.
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error);
  }

  revalidatePath("/mi-cuenta");
  revalidatePath(`/clientes/${cliente.id}`);
  return ok({ id: data.id });
}

const TIPOS_SOLICITUD = ["solicitud", "informe", "reclamo", "consulta"] as const;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;
type SolicitudSocioCreada = { id: string; numero: number; repetido: boolean };

/** Reintento después de un corte: la solicitud que ya se guardó con esta clave (o null). */
async function solicitudSocioConRef(
  supabase: Supabase,
  orgId: string,
  ref: string | null
): Promise<SolicitudSocioCreada | null> {
  if (!ref) return null;
  const { data } = await supabase
    .from("solicitudes")
    .select("id, numero")
    .eq("org_id", orgId)
    .eq("ref", ref)
    .maybeSingle();
  return data ? { id: data.id, numero: data.numero, repetido: true } : null;
}

/**
 * El socio crea una solicitud desde el portal: siempre sobre su propio puesto
 * (`cliente_id` propio) y con origen `portal` (la RLS lo exige).
 * Con `ref` (clave del formulario, uuid por intento) un reintento tras un corte devuelve la
 * que ya se guardó (`repetido: true`) en vez de crear otra igual (índice único org_id + ref).
 */
export async function crearSolicitudSocio(
  formData: FormData
): Promise<ActionResult<SolicitudSocioCreada>> {
  const perfil = await requireRol("socio");

  const parsed = z
    .object({
      tipo: z.enum(TIPOS_SOLICITUD, { error: "Elegí qué tipo de solicitud es" }),
      asunto: z
        .string()
        .trim()
        .min(1, "Poné un asunto corto (ej.: Pérdida de agua en el puesto)")
        .max(200, "El asunto es demasiado largo"),
      detalle: z
        .string()
        .trim()
        .max(6000, "El detalle es demasiado largo")
        .optional()
        .transform((v) => (v ? v : null)),
      ref: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => v === null || RE_UUID.test(v), "Recargá la página y probá de nuevo"),
    })
    .safeParse({
      tipo: formData.get("tipo"),
      asunto: formData.get("asunto"),
      detalle: formData.get("detalle") ?? undefined,
      ref: formData.get("ref") ?? undefined,
    });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  const previa = await solicitudSocioConRef(supabase, perfil.org_id, parsed.data.ref);
  if (previa) return ok(previa);

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .select("id")
    .eq(...filtroClientePortal(perfil))
    .maybeSingle();
  if (errorCliente) return fallo(errorCliente);
  if (!cliente)
    return fallo(
      "Tu usuario no está vinculado a un puesto. Consultá en administración."
    );

  // Adjunto opcional (foto o PDF).
  let adjuntoPath: string | null = null;
  const archivo = formData.get("adjunto");
  if (archivo instanceof File && archivo.size > 0) {
    if (!MIME_PERMITIDOS.includes(archivo.type))
      return fallo("El adjunto tiene que ser PDF o imagen (JPG, PNG o WEBP).");
    if (archivo.size > TAMANO_MAX_BYTES)
      return fallo("El adjunto no puede pesar más de 20 MB.");
    adjuntoPath = rutaAdjuntoSolicitud(perfil.org_id, archivo.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(adjuntoPath, archivo, { contentType: archivo.type });
    if (errorSubida)
      return fallo("No pudimos subir el adjunto. Probá de nuevo.");
  }

  const { data, error } = await supabase
    .from("solicitudes")
    .insert({
      org_id: perfil.org_id,
      tipo: parsed.data.tipo,
      asunto: parsed.data.asunto,
      detalle: parsed.data.detalle,
      cliente_id: cliente.id,
      origen: "portal",
      adjunto_path: adjuntoPath,
      creada_por: perfil.user_id,
      ref: parsed.data.ref,
    })
    .select("id, numero")
    .single();

  if (error) {
    if (adjuntoPath)
      await supabase.storage.from("documentos").remove([adjuntoPath]);
    // Dos toques a la vez con la misma clave: ganó el otro, se devuelve esa.
    if (error.code === "23505") {
      const otra = await solicitudSocioConRef(supabase, perfil.org_id, parsed.data.ref);
      if (otra) return ok(otra);
    }
    return fallo(error);
  }

  revalidatePath("/mi-cuenta");
  revalidatePath("/solicitudes");
  return ok({ id: data.id, numero: data.numero, repetido: false });
}
