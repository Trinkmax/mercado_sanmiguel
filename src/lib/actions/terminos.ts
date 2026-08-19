"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const schemaPublicar = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Poné el título (ej.: Términos y condiciones del portal de socios)")
    .max(200, "El título es demasiado largo"),
  contenido: z
    .string()
    .trim()
    .min(20, "Escribí el texto completo de los términos")
    .max(60000, "El texto es demasiado largo"),
});

/**
 * Publica una nueva versión de los términos: la vigente deja de serlo y se
 * inserta `version + 1` como vigente. Cada socio tendrá que aceptarla la
 * próxima vez que entre al portal. Solo el Líder de Procesos.
 */
export async function publicarTerminos(
  input: unknown
): Promise<ActionResult<{ id: string; version: number }>> {
  const perfil = await requireRol("lider");
  const parsed = schemaPublicar.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  const { data: ultima, error: errorUltima } = await supabase
    .from("terminos")
    .select("id, version, vigente")
    .eq("org_id", perfil.org_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errorUltima) return fallo(errorUltima);

  // Un solo vigente por organización (índice único): primero se baja la actual.
  const { error: errorBaja } = await supabase
    .from("terminos")
    .update({ vigente: false })
    .eq("org_id", perfil.org_id)
    .eq("vigente", true);
  if (errorBaja) return fallo(errorBaja);

  const version = Number(ultima?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("terminos")
    .insert({
      org_id: perfil.org_id,
      version,
      titulo: parsed.data.titulo,
      contenido: parsed.data.contenido,
      vigente: true,
      creado_por: perfil.user_id,
    })
    .select("id, version")
    .single();

  if (error) {
    // Si no pudo insertar, volvemos a dejar vigente la versión anterior.
    if (ultima?.vigente) {
      await supabase
        .from("terminos")
        .update({ vigente: true })
        .eq("id", ultima.id);
    }
    return fallo(error);
  }

  revalidatePath("/comunicaciones");
  revalidatePath("/mi-cuenta", "layout");
  return ok({ id: data.id, version: data.version });
}

/** El socio acepta la versión vigente de los términos (gate del portal). */
export async function aceptarTerminos(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("socio");
  const parsed = z
    .object({
      terminosId: z.string().min(1),
      acepta: z.literal(true, {
        error: "Tenés que marcar que leíste y aceptás los términos",
      }),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

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

  const { data: vigente } = await supabase
    .from("terminos")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("vigente", true)
    .maybeSingle();
  if (!vigente || vigente.id !== parsed.data.terminosId)
    return fallo(
      "Los términos cambiaron mientras los leías. Recargá la página y aceptá la versión nueva."
    );

  const { error } = await supabase.from("aceptaciones_terminos").insert({
    org_id: perfil.org_id,
    terminos_id: vigente.id,
    cliente_id: cliente.id,
    user_id: perfil.user_id,
  });
  // Ya aceptados (doble toque): seguimos adelante.
  if (error && error.code !== "23505") return fallo(error);

  revalidatePath("/mi-cuenta", "layout");
  revalidatePath("/comunicaciones");
  return ok(undefined);
}
