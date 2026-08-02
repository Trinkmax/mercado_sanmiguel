"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/* ---------------- Validar caja (traspaso de responsabilidad) ---------------- */

const validarSchema = z.object({
  cajaId: z.uuid("La caja no es válida. Actualizá la página."),
  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones son muy largas (máximo 500 caracteres).")
    .optional(),
});

export async function validarCaja(
  cajaId: string,
  observaciones?: string
): Promise<ActionResult> {
  await requireRol("tesoreria");
  const parsed = validarSchema.safeParse({ cajaId, observaciones });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("validar_caja", {
    p_caja: parsed.data.cajaId,
    ...(parsed.data.observaciones
      ? { p_observaciones: parsed.data.observaciones }
      : {}),
  });
  if (error) return fallo(error);

  revalidatePath("/tesoreria");
  revalidatePath("/inicio");
  return ok(undefined);
}

/* ---------------- Movimientos bancarios (impuestos, comisiones, ajustes) ---------------- */

const movimientoSchema = z.object({
  tipo: z.enum(["impuesto", "comision", "ajuste"], "Elegí el tipo de movimiento."),
  descripcion: z
    .string()
    .trim()
    .min(1, "Poné una descripción, por ejemplo “IIBB SIRCREB”.")
    .max(200, "La descripción es muy larga (máximo 200 caracteres)."),
  monto: z
    .number("Poné el monto.")
    .positive("El monto tiene que ser mayor a cero."),
  /** Solo para ajustes: true = resta plata del banco, false = suma. */
  resta: z.boolean().optional(),
  fecha: z.iso.date("Elegí la fecha del movimiento."),
});

export async function crearMovimiento(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("tesoreria");
  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { tipo, descripcion, monto, resta, fecha } = parsed.data;
  // Impuestos y comisiones se guardan en positivo (el flujo de caja los resta solo).
  // El ajuste guarda el signo: "resta" → negativo, "suma" → positivo.
  const montoFinal = tipo === "ajuste" && resta ? -monto : monto;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("movimientos_tesoreria")
    .insert({
      org_id: perfil.org_id,
      tipo,
      descripcion,
      monto: montoFinal,
      fecha,
    })
    .select("id")
    .single();
  if (error) return fallo(error);

  revalidatePath("/tesoreria");
  return ok({ id: data.id });
}

export async function borrarMovimiento(id: string): Promise<ActionResult> {
  await requireRol("tesoreria");
  const parsed = z.uuid("El movimiento no es válido. Actualizá la página.").safeParse(id);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("movimientos_tesoreria")
    .delete({ count: "exact" })
    .eq("id", parsed.data);
  if (error) return fallo(error);
  if (!count) return fallo("No encontramos el movimiento. Actualizá la página.");

  revalidatePath("/tesoreria");
  return ok(undefined);
}

/* ---------------- Saldos iniciales (una sola vez por medio) ---------------- */

const saldoSchema = z.object({
  medio: z.enum(["efectivo", "transferencia"], "Elegí efectivo o banco."),
  monto: z
    .number("Poné el monto que había.")
    .min(0, "El monto no puede ser negativo."),
  fecha: z.iso.date("Elegí la fecha del saldo."),
  notas: z
    .string()
    .trim()
    .max(300, "La nota es muy larga (máximo 300 caracteres).")
    .optional(),
});

export async function guardarSaldoInicial(
  medio: "efectivo" | "transferencia",
  monto: number,
  fecha: string,
  notas?: string
): Promise<ActionResult> {
  const perfil = await requireRol("tesoreria");
  const parsed = saldoSchema.safeParse({ medio, monto, fecha, notas });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("saldos_iniciales").upsert(
    {
      org_id: perfil.org_id,
      medio: parsed.data.medio,
      monto: parsed.data.monto,
      fecha: parsed.data.fecha,
      notas: parsed.data.notas || null,
    },
    { onConflict: "org_id,medio" }
  );
  if (error) return fallo(error);

  revalidatePath("/tesoreria");
  return ok(undefined);
}
