"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { clientePerteneceAOrg } from "@/lib/actions/helpers";
import {
  rutaDocumentoCliente,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";

const CATEGORIAS = [
  "habilitacion_municipal",
  "senasa",
  "apto_electrico",
  "otro",
] as const;

/** Sube un archivo a la carpeta del cliente y registra el documento. */
export async function subirDocumento(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");

  const parsed = z
    .object({
      clienteId: z.string().min(1),
      titulo: z
        .string()
        .trim()
        .min(1, "Poné un título para el documento (ej.: Habilitación 2026)")
        .max(200, "El título es demasiado largo"),
      categoria: z.enum(CATEGORIAS, { error: "Elegí la categoría" }),
    })
    .safeParse({
      clienteId: formData.get("clienteId"),
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
  if (!(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))) {
    return fallo("Cliente inexistente.");
  }
  const ruta = rutaDocumentoCliente(
    perfil.org_id,
    parsed.data.clienteId,
    archivo.name
  );

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida)
    return fallo("No pudimos subir el archivo. Probá de nuevo.");

  const { data, error } = await supabase
    .from("documentos_cliente")
    .insert({
      org_id: perfil.org_id,
      cliente_id: parsed.data.clienteId,
      titulo: parsed.data.titulo,
      categoria: parsed.data.categoria,
      storage_path: ruta,
      mime: archivo.type,
      subido_por: perfil.user_id,
    })
    .select("id")
    .single();

  if (error) {
    // Si no se pudo registrar, no dejamos el archivo huérfano.
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error);
  }

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok({ id: data.id });
}

/** Borra un documento de la carpeta (solo administración y consejo). */
export async function borrarDocumento(
  input: unknown
): Promise<ActionResult<void>> {
  await requireRol("admin", "consejo");
  const parsed = z
    .object({ id: z.string().min(1), clienteId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: doc, error: errorBusqueda } = await supabase
    .from("documentos_cliente")
    .select("id, storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (errorBusqueda) return fallo(errorBusqueda);
  if (!doc) return fallo("El documento ya no existe.");

  const { error } = await supabase
    .from("documentos_cliente")
    .delete()
    .eq("id", doc.id);
  if (error) return fallo(error);

  // Mejor esfuerzo: si falla, el registro ya no apunta al archivo.
  await supabase.storage.from("documentos").remove([doc.storage_path]);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}
