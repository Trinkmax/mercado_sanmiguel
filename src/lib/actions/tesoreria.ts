"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO } from "@/lib/format";
import type { TablesInsert } from "@/lib/database.types";

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
 * Efecto en el flujo (flujo_caja, 0018): ajuste (con signo) e ingreso suman en su
 * cuenta; comisión, impuesto, débito fiscal y egreso restan; depósito saca del
 * efectivo y pone en el banco; extracción al revés. Los dólares van aparte.
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

const movimientoSchema = z
  .object({
    tipo: z.enum(TIPOS_MOVIMIENTO, "Elegí qué pasó."),
    moneda: z.enum(["ARS", "USD"], "Elegí pesos o dólares."),
    cuenta: z.enum(["efectivo", "banco"], "Elegí efectivo o banco."),
    monto: z.number("Poné el monto.").positive("El monto tiene que ser mayor a cero."),
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
    comision: z.number().min(0, "La comisión no puede ser negativa.").optional(),
  })
  .refine((d) => d.tipo !== "deposito" || (d.comision ?? 0) < d.monto, {
    message: "La comisión no puede ser mayor que el depósito.",
  });

export async function crearMovimiento(
  input: unknown
): Promise<ActionResult<{ filas: number }>> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;

  // Depósito siempre efectivo → banco; extracción banco → efectivo (check mov_tes_cuentas).
  const cuenta =
    d.tipo === "deposito" ? "efectivo" : d.tipo === "extraccion" ? "banco" : d.cuenta;
  const cuentaDestino: "efectivo" | "banco" | null =
    d.tipo === "deposito" ? "banco" : d.tipo === "extraccion" ? "efectivo" : null;
  const monto = d.tipo === "ajuste" && d.resta ? -d.monto : d.monto;
  const conComision = d.tipo === "deposito" && (d.comision ?? 0) > 0;
  const grupoId = conComision ? crypto.randomUUID() : null;

  const filas: TablesInsert<"movimientos_tesoreria">[] = [
    {
      org_id: perfil.org_id,
      fecha: d.fecha,
      tipo: d.tipo,
      descripcion: d.descripcion || null,
      monto,
      moneda: d.moneda,
      cuenta,
      cuenta_destino: cuentaDestino,
      grupo_id: grupoId,
    },
  ];
  if (conComision) {
    filas.push({
      org_id: perfil.org_id,
      fecha: d.fecha,
      tipo: "comision",
      descripcion: "Comisión por el depósito",
      monto: d.comision ?? 0,
      moneda: d.moneda,
      cuenta: "banco",
      cuenta_destino: null,
      grupo_id: grupoId,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("movimientos_tesoreria").insert(filas);
  if (error) return fallo(error);

  revalidarTesoreria();
  return ok({ filas: filas.length });
}

/** Borra un movimiento (y su comisión asociada, si la tiene). Los ajustes de caja no se borran acá. */
export async function borrarMovimiento(id: string): Promise<ActionResult<{ borrados: number }>> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = z.uuid("El movimiento no es válido. Actualizá la página.").safeParse(id);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: mov, error: errorLeer } = await supabase
    .from("movimientos_tesoreria")
    .select("id, grupo_id, caja_id")
    .eq("id", parsed.data)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errorLeer) return fallo(errorLeer);
  if (!mov) return fallo("No encontramos el movimiento. Actualizá la página.");
  if (mov.caja_id) {
    return fallo("Es un ajuste de caja: se borra desde la caja de ese día, con motivo.");
  }

  let consulta = supabase
    .from("movimientos_tesoreria")
    .delete({ count: "exact" })
    .eq("org_id", perfil.org_id)
    .is("caja_id", null);
  consulta = mov.grupo_id ? consulta.eq("grupo_id", mov.grupo_id) : consulta.eq("id", mov.id);
  const { error, count } = await consulta;
  if (error) return fallo(error);
  if (!count) return fallo("No se pudo borrar el movimiento. Actualizá la página.");

  revalidarTesoreria();
  return ok({ borrados: count });
}

/* ---------------- Saldos iniciales (por cuenta y moneda) ---------------- */

const saldoSchema = z.object({
  medio: z.enum(["efectivo", "transferencia"], "Elegí efectivo o banco."),
  moneda: z.enum(["ARS", "USD"], "Elegí pesos o dólares."),
  monto: z.number("Poné el monto que había.").min(0, "El monto no puede ser negativo."),
  fecha: z.iso
    .date("Elegí desde qué día.")
    .refine((f) => f <= hoyISO(), "La fecha no puede ser futura."),
  notas: z
    .string()
    .trim()
    .max(300, "La nota es muy larga (máximo 300 letras).")
    .optional(),
});

/**
 * Saldo al comenzar el día `fecha`: el flujo de esa cuenta cuenta desde ese día
 * inclusive. `medio` "transferencia" = banco.
 */
export async function guardarSaldoInicial(
  medio: "efectivo" | "transferencia",
  moneda: "ARS" | "USD",
  monto: number,
  fecha: string,
  notas?: string
): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria", "lider");
  const parsed = saldoSchema.safeParse({ medio, moneda, monto, fecha, notas });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("saldos_iniciales").upsert(
    {
      org_id: perfil.org_id,
      medio: parsed.data.medio,
      moneda: parsed.data.moneda,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      notas: parsed.data.notas || null,
    },
    { onConflict: "org_id,medio,moneda" }
  );
  if (error) return fallo(error);

  revalidarTesoreria();
  return ok(undefined);
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
