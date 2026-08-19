"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { rutaCircular, TAMANO_MAX_BYTES } from "@/lib/storage";
import { hoyISO } from "@/lib/format";

const schemaCircular = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Poné el título de la circular (ej.: Horario de ingreso de camiones)")
    .max(200, "El título es demasiado largo"),
  detalle: z
    .string()
    .trim()
    .max(8000, "El detalle es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
  fecha: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : hoyISO()))
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "La fecha no es válida"),
  obligatoria: z.boolean(),
});

/** Publica una circular (con PDF opcional). La ven todos los socios del portal. */
export async function crearCircular(
  formData: FormData
): Promise<ActionResult<{ id: string; numero: number }>> {
  const perfil = await requireRol("admin", "lider");

  const parsed = schemaCircular.safeParse({
    titulo: formData.get("titulo"),
    detalle: formData.get("detalle") ?? undefined,
    fecha: formData.get("fecha") ?? undefined,
    obligatoria: formData.get("obligatoria") === "true",
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  let storagePath: string | null = null;
  const archivo = formData.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.type !== "application/pdf")
      return fallo("La circular adjunta tiene que ser un PDF.");
    if (archivo.size > TAMANO_MAX_BYTES)
      return fallo("El PDF no puede pesar más de 20 MB.");
    storagePath = rutaCircular(perfil.org_id, archivo.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(storagePath, archivo, { contentType: archivo.type });
    if (errorSubida) return fallo("No pudimos subir el PDF. Probá de nuevo.");
  }

  const { data, error } = await supabase
    .from("circulares")
    .insert({
      org_id: perfil.org_id,
      titulo: parsed.data.titulo,
      detalle: parsed.data.detalle,
      fecha: parsed.data.fecha,
      obligatoria: parsed.data.obligatoria,
      storage_path: storagePath,
      creada_por: perfil.user_id,
    })
    .select("id, numero")
    .single();

  if (error) {
    if (storagePath)
      await supabase.storage.from("documentos").remove([storagePath]);
    return fallo(error);
  }

  revalidatePath("/comunicaciones");
  revalidatePath("/mi-cuenta");
  return ok({ id: data.id, numero: data.numero });
}

/** Da de baja una circular: deja de mostrarse en el portal y de bloquear. */
export async function desactivarCircular(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("admin", "lider");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo("Circular inexistente.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("circulares")
    .update({ activa: false })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/comunicaciones");
  revalidatePath(`/comunicaciones/${parsed.data.id}`);
  revalidatePath("/mi-cuenta");
  return ok(undefined);
}

/** El socio confirma que recibió (leyó) una circular. */
export async function confirmarRecepcionCircular(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("socio");
  const parsed = z.object({ circularId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo("Circular inexistente.");

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("auth_user_id", perfil.user_id)
    .maybeSingle();
  if (!cliente)
    return fallo(
      "Tu usuario no está vinculado a un puesto. Consultá en administración."
    );

  const { error } = await supabase.from("circular_recepciones").insert({
    org_id: perfil.org_id,
    circular_id: parsed.data.circularId,
    cliente_id: cliente.id,
    recibida_por: perfil.user_id,
  });
  // Si ya estaba confirmada (doble toque), no es un error para el socio.
  if (error && error.code !== "23505") return fallo(error);

  revalidatePath("/mi-cuenta");
  revalidatePath("/comunicaciones");
  revalidatePath(`/comunicaciones/${parsed.data.circularId}`);
  return ok(undefined);
}
