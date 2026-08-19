"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/** Límites del plano (viewBox del SVG del mapa). */
const VB_W = 1000;
const VB_H = 640;

const tipoSchema = z.enum(["puesto", "quinta", "local", "deposito"], {
  message: "El tipo de espacio no es válido.",
});

const posicionSchema = z.object({
  cliente_id: z.uuid("No reconocemos el espacio. Recargá la página."),
  tipo: tipoSchema,
  x: z.number().min(0).max(VB_W, "La posición se sale del plano."),
  y: z.number().min(0).max(VB_H, "La posición se sale del plano."),
});

const claveSchema = z.object({
  cliente_id: z.uuid("No reconocemos el espacio. Recargá la página."),
  tipo: tipoSchema,
});

/**
 * Guarda dónde quedó una celda del plano tras arrastrarla (drag & drop).
 * Upsert por (org, cliente, tipo): una sola posición por espacio.
 * Solo Administración y el Líder de Procesos mueven puestos (RLS lo exige igual).
 */
export async function guardarPosicionMapa(
  input: unknown
): Promise<ActionResult<{ x: number; y: number }>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = posicionSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  // Dos decimales alcanzan (la columna es numeric(7,2)).
  const x = Math.round(parsed.data.x * 100) / 100;
  const y = Math.round(parsed.data.y * 100) / 100;

  const supabase = await createClient();
  const { error } = await supabase.from("mapa_posiciones").upsert(
    {
      org_id: perfil.org_id,
      cliente_id: parsed.data.cliente_id,
      tipo: parsed.data.tipo,
      x,
      y,
      actualizado_por: perfil.user_id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "org_id,cliente_id,tipo" }
  );
  if (error) return fallo(error);

  revalidatePath("/mapa");
  return ok({ x, y });
}

/** Borra la posición guardada: la celda vuelve a su lugar automático. */
export async function restablecerPosicionMapa(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = claveSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("mapa_posiciones")
    .delete()
    .eq("org_id", perfil.org_id)
    .eq("cliente_id", parsed.data.cliente_id)
    .eq("tipo", parsed.data.tipo);
  if (error) return fallo(error);

  revalidatePath("/mapa");
  return ok(undefined);
}
