"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Perfil } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { categoriasDeRol, type CategoriaCliente } from "@/lib/segmentos";
import {
  rutaDocumentoCliente,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";
import {
  CATEGORIA_DOCUMENTO_MAX,
  normalizarCategoriaDocumento,
} from "@/components/clientes/constantes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** La carpeta es de un cliente de MI organización que mi rol gestiona
 * (Administración: puesteros; Jefe: quinteros y ambulantes; Líder: todos). */
async function carpetaGestionable(
  supabase: Supabase,
  clienteId: string,
  perfil: Perfil
): Promise<string | null> {
  const { data } = await supabase
    .from("clientes")
    .select("categoria")
    .eq("id", clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!data) return "Ese cliente no existe";
  if (!categoriasDeRol(perfil.rol).includes(data.categoria as CategoriaCliente))
    return perfil.rol === "guardia"
      ? "Desde Portería solo se gestionan quinteros y ambulantes"
      : "A quinteros y ambulantes los gestiona el Jefe de Portería";
  return null;
}

/** Sube un archivo a la carpeta del cliente y registra el documento. La categoría es
 * texto libre (C7): "Habilitación municipal", "Contrato de alquiler"… */
export async function subirDocumento(
  formData: FormData
): Promise<ActionResult<{ id: string; categoria: string }>> {
  const perfil = await requireRol("admin", "guardia", "lider");

  const parsed = z
    .object({
      clienteId: z.string().min(1),
      titulo: z
        .string({ error: "Poné un título para el documento (ej.: Habilitación 2026)" })
        .trim()
        .min(1, "Poné un título para el documento (ej.: Habilitación 2026)")
        .max(200, "El título es demasiado largo"),
      categoria: z
        .string({ error: "Elegí o escribí la categoría" })
        .transform(normalizarCategoriaDocumento)
        .pipe(
          z
            .string()
            .min(1, "Elegí o escribí la categoría")
            .max(CATEGORIA_DOCUMENTO_MAX, "La categoría es demasiado larga")
        ),
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
  const error0 = await carpetaGestionable(supabase, parsed.data.clienteId, perfil);
  if (error0) return fallo(error0);
  const ruta = rutaDocumentoCliente(
    perfil.org_id,
    parsed.data.clienteId,
    archivo.name
  );

  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida)
    return fallo("No pudimos subir el archivo. Revisá la conexión y probá de nuevo.");

  // `subido_por` lo pone la base (default auth.uid(); no está en el grant, 0022).
  const { data, error } = await supabase
    .from("documentos_cliente")
    .insert({
      org_id: perfil.org_id,
      cliente_id: parsed.data.clienteId,
      titulo: parsed.data.titulo,
      categoria: parsed.data.categoria,
      storage_path: ruta,
      mime: archivo.type,
    })
    .select("id")
    .single();

  if (error) {
    // Si no se pudo registrar, no dejamos el archivo huérfano.
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error.message);
  }

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok({ id: data.id, categoria: parsed.data.categoria });
}

/** Borra un documento de la carpeta (quien gestiona al cliente). */
export async function borrarDocumento(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "guardia", "lider");
  const parsed = z
    .object({ id: z.string().min(1), clienteId: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const error0 = await carpetaGestionable(supabase, parsed.data.clienteId, perfil);
  if (error0) return fallo(error0);

  const { data: doc, error: errorBusqueda } = await supabase
    .from("documentos_cliente")
    .select("id, storage_path")
    .eq("id", parsed.data.id)
    .eq("cliente_id", parsed.data.clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errorBusqueda) return fallo(errorBusqueda.message);
  if (!doc) return fallo("El documento ya no existe.");

  const { error } = await supabase
    .from("documentos_cliente")
    .delete()
    .eq("id", doc.id);
  if (error) return fallo(error.message);

  // Mejor esfuerzo: si falla, el registro ya no apunta al archivo.
  await supabase.storage.from("documentos").remove([doc.storage_path]);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}
