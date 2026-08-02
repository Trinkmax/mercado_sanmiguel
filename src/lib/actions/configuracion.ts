"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/* ---------- Precios (conceptos) ---------- */

const conceptoSchema = z.object({
  id: z.uuid("No encontramos el concepto."),
  precio: z
    .number("Poné el precio en números.")
    .min(0, "El precio no puede ser negativo."),
  descuento_pronto_pago: z
    .number("Poné el descuento en números.")
    .min(0, "El descuento va de 0 a 100.")
    .max(100, "El descuento va de 0 a 100."),
  orden_imputacion: z
    .number("Poné el orden en números.")
    .int("El orden tiene que ser un número entero.")
    .min(1, "El orden empieza en 1.")
    .max(999, "El orden puede ser de 1 a 999."),
});

export async function actualizarConcepto(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = conceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...datos } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("conceptos")
    .update(datos)
    .eq("id", id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok(undefined);
}

const activoConceptoSchema = z.object({
  id: z.uuid("No encontramos el concepto."),
  activo: z.boolean(),
});

export async function cambiarActivoConcepto(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = activoConceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("conceptos")
    .update({ activo: parsed.data.activo })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok(undefined);
}

/* ---------- General (configuracion) ---------- */

const generalSchema = z.object({
  dia_vencimiento: z
    .number("Poné el día en números.")
    .int("El día tiene que ser un número entero.")
    .min(1, "El día va de 1 a 31.")
    .max(31, "El día va de 1 a 31."),
  precio_canon_camion: z
    .number("Poné el precio en números.")
    .min(0, "El precio no puede ser negativo."),
});

export async function guardarConfiguracionGeneral(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(
    {
      org_id: perfil.org_id,
      ...parsed.data,
      actualizado_por: perfil.user_id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok(undefined);
}

/* ---------- Rubros de gasto ---------- */

const rubroSchema = z.object({
  codigo: z
    .string("Poné el código del rubro.")
    .trim()
    .min(1, "Poné el código del rubro.")
    .max(8, "El código puede tener hasta 8 letras.")
    .regex(
      /^[a-zA-Z0-9]+$/,
      "El código lleva solo letras y números, sin espacios."
    )
    .transform((v) => v.toUpperCase()),
  nombre: z
    .string("Poné el nombre del rubro.")
    .trim()
    .min(1, "Poné el nombre del rubro."),
});

export async function crearRubro(input: unknown): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = rubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { codigo, nombre } = parsed.data;
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("rubros_gasto")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("codigo", codigo)
    .maybeSingle();
  if (existente) return fallo(`Ya existe un rubro con el código ${codigo}.`);

  const { data, error } = await supabase
    .from("rubros_gasto")
    .insert({ codigo, nombre, org_id: perfil.org_id })
    .select("id")
    .single();
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok({ id: data.id });
}

const activoRubroSchema = z.object({
  id: z.uuid("No encontramos el rubro."),
  activo: z.boolean(),
});

export async function cambiarActivoRubro(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = activoRubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubros_gasto")
    .update({ activo: parsed.data.activo })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok(undefined);
}
