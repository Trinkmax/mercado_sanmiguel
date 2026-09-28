"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO } from "@/lib/format";

/*
 * Cheques (E1, E2): el módulo es de Tesorería y del Líder (§1.3 D-P2).
 * Depositar / acreditar / deshacer el depósito son updates directos: el trigger
 * proteger_cheque (0018) valida las transiciones y las fechas. Entregar, vincular
 * y rechazar van por RPC.
 */

function revalidarCheques() {
  revalidatePath("/cheques");
  revalidatePath("/tesoreria");
  revalidatePath("/inicio");
}

const idSchema = z.uuid("No se reconoce el cheque. Actualizá la página.");

const fechaNoFutura = z.iso
  .date("Poné una fecha válida.")
  .refine((f) => f <= hoyISO(), "La fecha no puede ser futura.");

const conFechaSchema = z.object({ id: idSchema, fecha: fechaNoFutura });

/** Cheque por cobrar → depositado. Un diferido no se puede depositar antes de su fecha (lo frena la base). */
export async function depositarCheque(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = conFechaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .update({ estado: "depositado", fecha_depositado: parsed.data.fecha })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("estado", "en_cartera")
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Ese cheque ya no está por cobrar. Actualizá la página.");

  revalidarCheques();
  return ok(undefined);
}

/** Depositado → acreditado (la plata ya está en el banco). */
export async function acreditarCheque(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = conFechaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .update({ estado: "acreditado", fecha_acreditado: parsed.data.fecha })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("estado", "depositado")
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Ese cheque ya no figura como depositado. Actualizá la página.");

  revalidarCheques();
  return ok(undefined);
}

/** Deshace un depósito marcado por error: vuelve a "Por cobrar". */
export async function deshacerDeposito(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .update({ estado: "en_cartera" })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("estado", "depositado")
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Ese cheque ya no figura como depositado. Actualizá la página.");

  revalidarCheques();
  return ok(undefined);
}

const entregarSchema = z.object({
  id: idSchema,
  proveedor: z
    .string()
    .trim()
    .min(2, "Poné a qué proveedor se lo entregaste.")
    .max(120, "El nombre del proveedor es muy largo (máximo 120 letras)."),
  fecha: fechaNoFutura.nullable().optional(),
  gastoId: z.uuid("El gasto no se reconoce. Actualizá la página.").nullable().optional(),
});

/** Endosa el cheque a un proveedor; si se elige un gasto pendiente, queda pagado con el cheque. */
export async function entregarCheque(input: unknown): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = entregarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("entregar_cheque", {
    p_cheque: parsed.data.id,
    p_proveedor: parsed.data.proveedor,
    ...(parsed.data.fecha ? { p_fecha: parsed.data.fecha } : {}),
    ...(parsed.data.gastoId ? { p_gasto: parsed.data.gastoId } : {}),
  });
  if (error) return fallo(error);

  revalidarCheques();
  if (parsed.data.gastoId) revalidatePath("/gastos");
  return ok(undefined);
}

const vincularSchema = z.object({
  chequeId: idSchema,
  gastoId: z.uuid("Elegí el gasto que pagó ese cheque."),
});

/** Cheque que nació "Entregado a proveedor" en el cobro → el gasto que canceló queda pagado con cheque. */
export async function vincularChequeGasto(input: unknown): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = vincularSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("vincular_cheque_gasto", {
    p_cheque: parsed.data.chequeId,
    p_gasto: parsed.data.gastoId,
  });
  if (error) return fallo(error);

  revalidarCheques();
  revalidatePath("/gastos");
  return ok(undefined);
}

const rechazoSchema = z.object({
  id: idSchema,
  motivo: z
    .string()
    .trim()
    .min(3, "Contá por qué se rechazó el cheque (por ejemplo: sin fondos).")
    .max(300, "El motivo es muy largo (máximo 300 letras)."),
});

/**
 * Rechazo del banco (o el proveedor lo devolvió): anula la línea del cobro que
 * lo recibió (la deuda del cliente vuelve) y, si había pagado un gasto, el gasto
 * vuelve a pendiente. Queda el rastro de quién, cuándo y por qué.
 */
export async function rechazarCheque(input: unknown): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = rechazoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_cheque", {
    p_cheque: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCheques();
  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/cobranza");
  revalidatePath("/clientes");
  return ok(undefined);
}
