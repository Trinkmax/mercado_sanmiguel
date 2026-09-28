"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO } from "@/lib/format";

/*
 * Cheques (E1, E2): el módulo es de Tesorería y del Líder (§1.3 D-P2).
 * Depositar y acreditar son updates directos: el trigger proteger_cheque valida
 * las transiciones y las fechas. Entregar, vincular, rechazar y todo lo que
 * DESHACE un paso van por RPC, con motivo y rastro (0026): lo ve el Líder en
 * Correcciones.
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

const motivoSchema = z
  .string()
  .trim()
  .min(3, "Contá por qué lo deshacés (por ejemplo: lo marqué por error).")
  .max(300, "El motivo es muy largo (máximo 300 letras).");

const deshacerSchema = z.object({ id: idSchema, motivo: motivoSchema });

/**
 * Lo que devuelven las RPC de deshacer. `reunido`: el cheque había dividido el gasto y se
 * juntó de nuevo (monto completo del gasto; el "Resto" pendiente se anuló).
 */
type ResultadoDeshacer = { repetido: boolean; gasto: string | null; vueltoAnulado: boolean; reunido: number | null };

function leerDeshacer(data: unknown): ResultadoDeshacer {
  const r = (data ?? {}) as {
    repetido?: boolean;
    gasto?: string | null;
    vuelto_anulado?: boolean;
    reunido?: number | string | null;
  };
  const reunido = r.reunido === null || r.reunido === undefined ? null : Number(r.reunido);
  return {
    repetido: Boolean(r.repetido),
    gasto: r.gasto ?? null,
    vueltoAnulado: Boolean(r.vuelto_anulado),
    reunido: reunido !== null && Number.isFinite(reunido) ? reunido : null,
  };
}

/** Deshace un depósito marcado por error: vuelve a "Por cobrar" (con motivo y rastro). */
export async function deshacerDeposito(input: unknown): Promise<ActionResult<ResultadoDeshacer>> {
  await requireRol("tesoreria", "lider");
  const parsed = deshacerSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deshacer_deposito_cheque", {
    p_cheque: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCheques();
  return ok(leerDeshacer(data));
}

/** "Se acreditó" tocado por error: vuelve a Depositados y el banco baja. */
export async function deshacerAcreditacion(input: unknown): Promise<ActionResult<ResultadoDeshacer>> {
  await requireRol("tesoreria", "lider");
  const parsed = deshacerSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deshacer_acreditacion_cheque", {
    p_cheque: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCheques();
  return ok(leerDeshacer(data));
}

/**
 * Entregado → Por cobrar (el proveedor lo devolvió sano o se marcó por error). El gasto
 * que pagaba vuelve a Por pagar; el cobro del cliente no se toca (eso es Rechazar).
 */
export async function devolverChequeACartera(input: unknown): Promise<ActionResult<ResultadoDeshacer>> {
  await requireRol("tesoreria", "lider");
  const parsed = deshacerSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("devolver_cheque_a_cartera", {
    p_cheque: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCheques();
  revalidatePath("/gastos");
  return ok(leerDeshacer(data));
}

/** Se eligió mal el gasto que pagó: el gasto vuelve a Por pagar y el cheque queda "sin gasto". */
export async function desvincularChequeGasto(input: unknown): Promise<ActionResult<ResultadoDeshacer>> {
  await requireRol("tesoreria", "lider");
  const parsed = deshacerSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("desvincular_cheque_gasto", {
    p_cheque: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCheques();
  revalidatePath("/gastos");
  return ok(leerDeshacer(data));
}

/**
 * Qué pasó con la diferencia cuando el cheque y el gasto no son del mismo monto:
 * "dividir" (cheque menor: el resto queda como otro gasto pendiente), "vuelto_efectivo"
 * (cheque mayor: el proveedor dio el vuelto, entra al efectivo) o "a_favor" (cheque
 * mayor: queda a favor con el proveedor).
 */
const diferenciaSchema = z
  .enum(["dividir", "vuelto_efectivo", "a_favor"], "Elegí qué pasó con la diferencia.")
  .nullable()
  .optional();

export type DiferenciaCheque = "dividir" | "vuelto_efectivo" | "a_favor";

/** Lo que devuelven entregar_cheque / vincular_cheque_gasto. */
export type ResultadoPagoCheque = {
  repetido: boolean;
  diferencia: "dividido" | "vuelto_efectivo" | "a_favor" | null;
  /** Lo que quedó por pagar en otro gasto (cheque menor que el gasto). */
  resto: number | null;
  /** Vuelto o saldo a favor (cheque mayor que el gasto). */
  sobrante: number | null;
};

function leerPagoCheque(data: unknown): ResultadoPagoCheque {
  const r = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const dif = r.diferencia;
  return {
    repetido: Boolean(r.repetido),
    diferencia: dif === "dividido" || dif === "vuelto_efectivo" || dif === "a_favor" ? dif : null,
    resto: num(r.resto),
    sobrante: num(r.sobrante),
  };
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
  diferencia: diferenciaSchema,
});

/** Endosa el cheque a un proveedor; si se elige un gasto pendiente, queda pagado con el cheque. */
export async function entregarCheque(input: unknown): Promise<ActionResult<ResultadoPagoCheque>> {
  await requireRol("tesoreria", "lider");
  const parsed = entregarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("entregar_cheque", {
    p_cheque: parsed.data.id,
    p_proveedor: parsed.data.proveedor,
    ...(parsed.data.fecha ? { p_fecha: parsed.data.fecha } : {}),
    ...(parsed.data.gastoId ? { p_gasto: parsed.data.gastoId } : {}),
    ...(parsed.data.gastoId && parsed.data.diferencia ? { p_diferencia: parsed.data.diferencia } : {}),
  });
  if (error) return fallo(error);

  revalidarCheques();
  if (parsed.data.gastoId) revalidatePath("/gastos");
  return ok(leerPagoCheque(data));
}

const vincularSchema = z.object({
  chequeId: idSchema,
  gastoId: z.uuid("Elegí el gasto que pagó ese cheque."),
  diferencia: diferenciaSchema,
});

/** Cheque que nació "Entregado a proveedor" en el cobro → el gasto que canceló queda pagado con cheque. */
export async function vincularChequeGasto(input: unknown): Promise<ActionResult<ResultadoPagoCheque>> {
  await requireRol("tesoreria", "lider");
  const parsed = vincularSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vincular_cheque_gasto", {
    p_cheque: parsed.data.chequeId,
    p_gasto: parsed.data.gastoId,
    ...(parsed.data.diferencia ? { p_diferencia: parsed.data.diferencia } : {}),
  });
  if (error) return fallo(error);

  revalidarCheques();
  revalidatePath("/gastos");
  return ok(leerPagoCheque(data));
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
 * Rechazo del banco (o el proveedor lo devolvió porque rebotó): anula la línea del cobro que
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
