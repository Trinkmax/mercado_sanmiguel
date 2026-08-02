"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
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
    .eq("auth_user_id", perfil.user_id)
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
      subido_por: perfil.user_id,
    })
    .select("id")
    .single();

  if (error) {
    // Si no se pudo registrar, no dejamos el archivo huérfano.
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error);
  }

  revalidatePath("/mi-cuenta");
  return ok({ id: data.id });
}
