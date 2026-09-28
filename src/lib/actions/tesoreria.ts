"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO } from "@/lib/format";

/* Tesorería (J2, J3, J6): Tesorería y el Líder de Procesos (§1.3 D-P2). */

function revalidarTesoreria() {
  revalidatePath("/tesoreria");
  revalidatePath("/inicio");
}

/* ---------------- Validar caja (cuenta, ajuste y OK en un paso) ---------------- */

const validarSchema = z.object({
  cajaId: z.uuid("La caja no es válida. Actualizá la página."),
  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones son muy largas (máximo 500 letras).")
    .optional(),
  efectivoContado: z
    .number("Poné cuánto efectivo contaste.")
    .min(0, "El efectivo contado no puede ser negativo.")
    .optional(),
});

/**
 * Validar = cierre definitivo de la caja. Si se manda el efectivo contado y no
 * coincide con el arqueo, la base registra el faltante o sobrante como ajuste en
 * el mismo acto (validar_caja, M2).
 */
export async function validarCaja(
  cajaId: string,
  observaciones?: string,
  efectivoContado?: number
): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = validarSchema.safeParse({ cajaId, observaciones, efectivoContado });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("validar_caja", {
    p_caja: parsed.data.cajaId,
    ...(parsed.data.observaciones ? { p_observaciones: parsed.data.observaciones } : {}),
    ...(parsed.data.efectivoContado !== undefined
      ? { p_efectivo_contado: parsed.data.efectivoContado }
      : {}),
  });
  if (error) return fallo(error);

  revalidatePath("/caja");
  revalidarTesoreria();
  return ok(undefined);
}

/* ---------------- Movimientos de tesorería (J6) ---------------- */
/*
 * Efecto en el flujo (flujo_caja): ajuste (con signo) e ingreso suman en su
 * cuenta; comisión, impuesto, débito fiscal y egreso restan; depósito saca del
 * efectivo y pone en el banco; extracción al revés. Los dólares van aparte.
 * Todo pasa por RPC (0026): nada se borra, se anula con motivo y queda el rastro.
 */

const TIPOS_MOVIMIENTO = [
  "deposito",
  "extraccion",
  "comision",
  "impuesto",
  "debito_fiscal",
  "ajuste",
  "ingreso",
  "egreso",
] as const;

/** Pesos o dólares con hasta 2 decimales. */
const montoSchema = z
  .number("Poné el monto.")
  .positive("El monto tiene que ser mayor a cero.")
  .max(999_999_999_999, "El monto es demasiado grande.")
  .transform((n) => Math.round(n * 100) / 100);

const motivoSchema = z
  .string()
  .trim()
  .min(3, "Contá por qué (por ejemplo: se cargó dos veces).")
  .max(300, "El motivo es muy largo (máximo 300 letras).");

const movimientoSchema = z
  .object({
    tipo: z.enum(TIPOS_MOVIMIENTO, "Elegí qué pasó."),
    moneda: z.enum(["ARS", "USD"], "Elegí pesos o dólares."),
    cuenta: z.enum(["efectivo", "banco"], "Elegí efectivo o banco."),
    monto: montoSchema,
    /** Solo ajustes: true = resta, false = suma. */
    resta: z.boolean().optional(),
    fecha: z.iso
      .date("Elegí la fecha del movimiento.")
      .refine((f) => f <= hoyISO(), "La fecha no puede ser futura."),
    descripcion: z
      .string()
      .trim()
      .max(200, "La descripción es muy larga (máximo 200 letras).")
      .optional(),
    /** Solo depósitos: comisión que cobró el banco por el depósito (misma moneda, sale del banco). */
    comision: z
      .number()
      .min(0, "La comisión no puede ser negativa.")
      .transform((n) => Math.round(n * 100) / 100)
      .optional(),
    /** Clave del formulario: un reintento después de un corte de red no duplica el movimiento. */
    ref: z.uuid("Actualizá la página y probá de nuevo."),
  })
  .refine((d) => d.tipo !== "deposito" || (d.comision ?? 0) < d.monto, {
    message: "La comisión no puede ser mayor que el depósito.",
  });

export async function crearMovimiento(
  input: unknown
): Promise<ActionResult<{ filas: number; repetido: boolean }>> {
  await requireRol("tesoreria", "lider");
  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_movimiento_tesoreria", {
    p_tipo: d.tipo,
    p_moneda: d.moneda,
    p_cuenta: d.cuenta,
    p_monto: d.tipo === "ajuste" && d.resta ? -d.monto : d.monto,
    p_fecha: d.fecha,
    ...(d.descripcion ? { p_descripcion: d.descripcion } : {}),
    ...(d.tipo === "deposito" && (d.comision ?? 0) > 0 ? { p_comision: d.comision } : {}),
    p_ref: d.ref,
  });
  if (error) return fallo(error);

  const r = (data ?? {}) as { filas?: number; repetido?: boolean };
  revalidarTesoreria();
  return ok({ filas: Number(r.filas ?? 1), repetido: Boolean(r.repetido) });
}

/**
 * Anula un movimiento con motivo (no se borra: queda tachado, con quién y por qué, y
 * lo ve el Líder en Correcciones). La comisión de un depósito se anula sola; el
 * depósito se lleva su comisión. Los ajustes de caja se borran desde la caja.
 */
export async function anularMovimiento(
  input: unknown
): Promise<ActionResult<{ anulados: number; comision: number | null; repetido: boolean }>> {
  await requireRol("tesoreria", "lider");
  const parsed = z
    .object({
      id: z.uuid("El movimiento no es válido. Actualizá la página."),
      motivo: motivoSchema,
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("anular_movimiento_tesoreria", {
    p_id: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  const r = (data ?? {}) as { anulados?: number; comision?: number | null; repetido?: boolean };
  revalidarTesoreria();
  return ok({
    anulados: Number(r.anulados ?? 1),
    comision: r.comision === null || r.comision === undefined ? null : Number(r.comision),
    repetido: Boolean(r.repetido),
  });
}

/* ---------------- Saldos iniciales (por cuenta y moneda) ---------------- */

const saldoSchema = z.object({
  medio: z.enum(["efectivo", "transferencia"], "Elegí efectivo o banco."),
  moneda: z.enum(["ARS", "USD"], "Elegí pesos o dólares."),
  monto: z
    .number("Poné el monto que había.")
    .min(0, "El monto no puede ser negativo.")
    .max(999_999_999_999, "El monto es demasiado grande.")
    .transform((n) => Math.round(n * 100) / 100),
  fecha: z.iso
    .date("Elegí desde qué día.")
    .refine((f) => f <= hoyISO(), "La fecha no puede ser futura."),
  notas: z
    .string()
    .trim()
    .max(300, "La nota es muy larga (máximo 300 letras).")
    .optional(),
  /** Obligatorio al corregir el monto o la fecha de un saldo ya cargado (lo exige la base). */
  motivo: z.string().trim().max(300, "El motivo es muy largo (máximo 300 letras).").optional(),
});

/**
 * Saldo al comenzar el día `fecha`: el flujo de esa cuenta cuenta desde ese día
 * inclusive. `medio` "transferencia" = banco. Corregirlo pide motivo y deja el
 * valor anterior → nuevo en el rastro.
 */
export async function guardarSaldoInicial(
  medio: "efectivo" | "transferencia",
  moneda: "ARS" | "USD",
  monto: number,
  fecha: string,
  notas?: string,
  motivo?: string
): Promise<ActionResult<{ corregido: boolean }>> {
  await requireRol("tesoreria", "lider");
  const parsed = saldoSchema.safeParse({ medio, moneda, monto, fecha, notas, motivo });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_saldo_inicial", {
    p_medio: parsed.data.medio,
    p_moneda: parsed.data.moneda,
    p_monto: parsed.data.monto,
    p_fecha: parsed.data.fecha,
    ...(parsed.data.notas ? { p_notas: parsed.data.notas } : {}),
    ...(parsed.data.motivo ? { p_motivo: parsed.data.motivo } : {}),
  });
  if (error) return fallo(error);

  revalidarTesoreria();
  return ok({ corregido: Boolean((data as { corregido?: boolean } | null)?.corregido) });
}

/* ---------------- Conciliación bancaria: transferencias ---------------- */

const idsSchema = z
  .array(z.uuid("Hay una transferencia que no se reconoce. Actualizá la página."))
  .min(1, "Elegí al menos una transferencia.")
  .max(200, "Conciliá de a 200 transferencias como máximo.");

/** Marca como conciliadas las transferencias que ya se vieron en el resumen del banco. */
export async function conciliarTransferencias(
  ids: string[]
): Promise<ActionResult<{ conciliadas: number }>> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .update({
      conciliado: true,
      conciliado_por: perfil.user_id,
      conciliado_en: new Date().toISOString(),
    })
    .in("id", parsed.data)
    .eq("org_id", perfil.org_id)
    .eq("medio", "transferencia")
    .eq("anulado", false)
    .eq("conciliado", false)
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Esas transferencias ya estaban conciliadas. Actualizá la página.");

  revalidarTesoreria();
  return ok({ conciliadas: data.length });
}

/** Deshace una conciliación marcada por error (vuelve a "sin conciliar"). */
export async function desconciliarTransferencia(id: string): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = z
    .uuid("La transferencia no se reconoce. Actualizá la página.")
    .safeParse(id);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .update({ conciliado: false, conciliado_por: null, conciliado_en: null })
    .eq("id", parsed.data)
    .eq("org_id", perfil.org_id)
    .eq("conciliado", true)
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Esa transferencia ya no figura como conciliada. Actualizá la página.");

  revalidarTesoreria();
  return ok(undefined);
}

/* ---------------- Conciliación: bono camioneros por transferencia (J2) ---------------- */

const idsCanonSchema = z
  .array(z.uuid("Hay una transferencia que no se reconoce. Actualizá la página."))
  .min(1, "Elegí al menos una transferencia.")
  .max(200, "Conciliá de a 200 transferencias como máximo.");

/** Marca como conciliados los cobros de bono camioneros por transferencia ya vistos en el banco. */
export async function conciliarCanon(ids: string[]): Promise<ActionResult<{ conciliadas: number }>> {
  await requireRol("tesoreria", "lider");
  const parsed = idsCanonSchema.safeParse(ids);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conciliar_canon", { p_ids: parsed.data });
  if (error) return fallo(error);

  revalidarTesoreria();
  return ok({ conciliadas: Number((data as { conciliados?: number } | null)?.conciliados ?? 0) });
}

/** Deshace la conciliación de un bono camioneros marcada por error. */
export async function desconciliarCanon(id: string): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = z.uuid("La transferencia no se reconoce. Actualizá la página.").safeParse(id);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("desconciliar_canon", { p_id: parsed.data });
  if (error) return fallo(error);

  revalidarTesoreria();
  return ok(undefined);
}

/* ---------------- Comprobantes de gastos ---------------- */

/** Tesorería da el OK a la factura de un gasto pagado. */
export async function validarComprobanteGasto(id: string): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = z.uuid("El gasto no se reconoce. Actualizá la página.").safeParse(id);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos")
    .update({
      comprobante_validado: true,
      validado_por: perfil.user_id,
      validado_en: new Date().toISOString(),
    })
    .eq("id", parsed.data)
    .eq("org_id", perfil.org_id)
    .eq("estado", "pagado")
    .eq("comprobante_validado", false)
    .not("factura_path", "is", null)
    .select("id");
  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo(
      "Ese gasto no se puede validar: no está pagado, no tiene factura o ya se validó. Actualizá la página."
    );

  revalidarTesoreria();
  revalidatePath("/gastos");
  return ok(undefined);
}
