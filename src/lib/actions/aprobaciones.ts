"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/** Lo que devuelve la RPC `aprobar_cambio`. */
export type ResultadoAprobacion = {
  resultado_id: string | null;
  entidad: "cliente" | "cliente_concepto" | "concepto";
  accion: "alta" | "modificacion" | "baja";
};

/** Las pantallas que cambian cuando se aplica (o se rechaza) un cambio. */
function revalidarTodo() {
  revalidatePath("/aprobaciones");
  revalidatePath("/clientes", "layout");
  revalidatePath("/configuracion");
  revalidatePath("/energia");
  revalidatePath("/facturacion");
  revalidatePath("/inicio");
}

const aprobarSchema = z.object({
  cambio_id: z.uuid("No encontramos el cambio. Recargá la página."),
});

/**
 * Aplica un cambio propuesto (alta / baja / modificación de cliente, ítem de
 * cliente o concepto). Solo el Líder de Procesos; la lógica vive en la RPC.
 */
export async function aprobarCambio(
  input: unknown
): Promise<ActionResult<ResultadoAprobacion>> {
  await requireRol("lider");
  const parsed = aprobarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprobar_cambio", {
    p_cambio: parsed.data.cambio_id,
  });
  if (error) return fallo(error);

  revalidarTodo();
  return ok(data as unknown as ResultadoAprobacion);
}

const rechazarSchema = z.object({
  cambio_id: z.uuid("No encontramos el cambio. Recargá la página."),
  motivo: z
    .string("Contá por qué lo rechazás.")
    .trim()
    .min(3, "Contá por qué lo rechazás: así Administración sabe qué corregir.")
    .max(500, "El motivo puede tener hasta 500 caracteres."),
});

/** Rechaza un cambio propuesto con un motivo (obligatorio). Solo el Líder. */
export async function rechazarCambio(input: unknown): Promise<ActionResult> {
  await requireRol("lider");
  const parsed = rechazarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_cambio", {
    p_cambio: parsed.data.cambio_id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarTodo();
  return ok(undefined);
}
