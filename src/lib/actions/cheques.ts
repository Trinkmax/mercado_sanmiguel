"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const schemaConFecha = z.object({
  id: z.uuid("No se reconoce el cheque."),
  fecha: z.iso.date("Poné una fecha válida."),
});

const schemaSoloId = z.object({
  id: z.uuid("No se reconoce el cheque."),
});

/** Marca un cheque en cartera como depositado en el banco. */
export async function depositarCheque(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsed = schemaConFecha.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .update({ estado: "depositado", fecha_depositado: parsed.data.fecha })
    .eq("id", parsed.data.id)
    .eq("estado", "en_cartera")
    .select("id");

  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("El cheque ya no está en cartera. Actualizá la página.");

  revalidatePath("/cheques");
  return ok(undefined);
}

/** Marca un cheque depositado como acreditado (la plata ya está en el banco). */
export async function acreditarCheque(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsed = schemaConFecha.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .update({ estado: "acreditado", fecha_acreditado: parsed.data.fecha })
    .eq("id", parsed.data.id)
    .eq("estado", "depositado")
    .select("id");

  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("El cheque ya no figura como depositado. Actualizá la página.");

  revalidatePath("/cheques");
  return ok(undefined);
}

/**
 * Marca un cheque como rechazado. La RPC además revierte el cobro que ese
 * cheque respaldaba: las imputaciones se deshacen y la deuda del cliente
 * vuelve a existir (el rebote del banco no puede borrar plata por cobrar).
 */
export async function rechazarCheque(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsed = schemaSoloId.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_cheque", {
    p_cheque: parsed.data.id,
  });

  if (error) return fallo(error);

  revalidatePath("/cheques");
  revalidatePath("/cobranza");
  revalidatePath("/clientes");
  revalidatePath("/tesoreria");
  return ok(undefined);
}
