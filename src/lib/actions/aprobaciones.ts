"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/** Lo que devuelve la RPC `aprobar_cambio`. `revisada` = era un alta aplicada en el acto
 * por el Jefe (D-P1) y solo quedó marcada como revisada. */
export type ResultadoAprobacion = {
  resultado_id: string | null;
  entidad: "cliente" | "cliente_concepto" | "concepto";
  accion: "alta" | "modificacion" | "baja";
  revisada?: boolean;
};

/** Las pantallas que cambian cuando se aplica (o se rechaza) un cambio. */
function revalidarTodo() {
  revalidatePath("/aprobaciones");
  revalidatePath("/clientes", "layout");
  revalidatePath("/cobranza", "layout");
  revalidatePath("/configuracion");
  revalidatePath("/energia");
  revalidatePath("/facturacion");
  revalidatePath("/mapa");
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
  if (error) return fallo(error.message);

  revalidarTodo();
  return ok(data as unknown as ResultadoAprobacion);
}

/**
 * "Marcar revisada" un alta de ambulante que el Jefe aplicó en el acto (§1.3 D-P1).
 * Es la misma RPC `aprobar_cambio`: no vuelve a aplicar nada, solo firma la revisión.
 */
export async function marcarRevisada(
  input: unknown
): Promise<ActionResult<ResultadoAprobacion>> {
  return aprobarCambio(input);
}

const bajaRevisionSchema = z.object({
  cambio_id: z.uuid("No encontramos el cambio. Recargá la página."),
  cliente_id: z.uuid("No encontramos al ambulante. Recargá la página."),
  motivo: z
    .string("Contá por qué lo das de baja.")
    .trim()
    .min(3, "Contá por qué lo das de baja: queda en el registro.")
    .max(300, "El motivo puede tener hasta 300 caracteres."),
});

/**
 * El Líder no está de acuerdo con un alta aplicada por el Jefe: da de baja al ambulante
 * con un cambio normal (que él aplica en el acto) y deja la revisión firmada.
 * Si la baja sale y la firma no, el alta sigue en la lista para marcarla revisada.
 */
export async function darDeBajaRevisada(input: unknown): Promise<ActionResult> {
  await requireRol("lider");
  const parsed = bajaRevisionSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre, codigo, activo")
    .eq("id", parsed.data.cliente_id)
    .maybeSingle();
  if (!cliente) return fallo("Ese ambulante ya no existe.");

  if (cliente.activo) {
    const { error } = await supabase.rpc("solicitar_cambio", {
      p_entidad: "cliente",
      p_accion: "baja",
      p_entidad_id: parsed.data.cliente_id,
      p_datos: { activo: false, motivo: parsed.data.motivo },
      p_resumen: `Dar de baja a ${cliente.nombre} (N° ${cliente.codigo}): ${parsed.data.motivo}`,
    });
    if (error) return fallo(error.message);
  }

  const { error: errorRevision } = await supabase.rpc("aprobar_cambio", {
    p_cambio: parsed.data.cambio_id,
  });
  revalidarTodo();
  if (errorRevision)
    return fallo(
      `${cliente.nombre} quedó dado de baja, pero no se pudo marcar el alta como revisada. Tocá "Marcar revisada".`
    );
  return ok(undefined);
}

const rechazarSchema = z.object({
  cambio_id: z.uuid("No encontramos el cambio. Recargá la página."),
  motivo: z
    .string("Contá por qué lo rechazás.")
    .trim()
    .min(3, "Contá por qué lo rechazás: así quien lo pidió sabe qué corregir.")
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
  if (error) return fallo(error.message);

  revalidarTodo();
  return ok(undefined);
}
