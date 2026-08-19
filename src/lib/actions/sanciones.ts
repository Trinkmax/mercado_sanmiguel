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
import { hoyISO } from "@/lib/format";

/**
 * Registro documental del cliente: notificación, apercibimiento o sanción,
 * con documento adjunto opcional (administración, consejo y líder).
 */
export async function crearSancion(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "consejo", "lider");

  const parsed = z
    .object({
      clienteId: z.string().min(1),
      tipo: z.enum(["notificacion", "apercibimiento", "sancion"], {
        error: "Elegí si es notificación, apercibimiento o sanción",
      }),
      titulo: z
        .string()
        .trim()
        .min(1, "Poné un título (ej.: Falta de limpieza del puesto)")
        .max(200, "El título es demasiado largo"),
      detalle: z
        .string()
        .trim()
        .max(4000, "El detalle es demasiado largo")
        .optional()
        .transform((v) => (v ? v : null)),
      fecha: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : hoyISO()))
        .refine(
          (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
          "La fecha no es válida"
        ),
    })
    .safeParse({
      clienteId: formData.get("clienteId"),
      tipo: formData.get("tipo"),
      titulo: formData.get("titulo"),
      detalle: formData.get("detalle") ?? undefined,
      fecha: formData.get("fecha") ?? undefined,
    });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  if (!(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))) {
    return fallo("Cliente inexistente.");
  }

  // Adjunto opcional: mismo bucket y carpeta que los documentos del cliente.
  let storagePath: string | null = null;
  const archivo = formData.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    if (!MIME_PERMITIDOS.includes(archivo.type))
      return fallo("El adjunto tiene que ser PDF o imagen (JPG, PNG o WEBP).");
    if (archivo.size > TAMANO_MAX_BYTES)
      return fallo("El adjunto no puede pesar más de 20 MB.");

    storagePath = rutaDocumentoCliente(
      perfil.org_id,
      parsed.data.clienteId,
      archivo.name
    );
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(storagePath, archivo, { contentType: archivo.type });
    if (errorSubida)
      return fallo("No pudimos subir el adjunto. Probá de nuevo.");
  }

  const { data, error } = await supabase
    .from("sanciones")
    .insert({
      org_id: perfil.org_id,
      cliente_id: parsed.data.clienteId,
      tipo: parsed.data.tipo,
      titulo: parsed.data.titulo,
      detalle: parsed.data.detalle,
      fecha: parsed.data.fecha,
      storage_path: storagePath,
      creado_por: perfil.user_id,
    })
    .select("id")
    .single();

  if (error) {
    if (storagePath)
      await supabase.storage.from("documentos").remove([storagePath]);
    return fallo(error);
  }

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok({ id: data.id });
}
