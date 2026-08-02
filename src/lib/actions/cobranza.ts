"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import type { Json } from "@/lib/database.types";

/** Detalle de a qué cargos se imputó un cobro (lo devuelve la RPC). */
export type ImputacionCobro = {
  cargo_id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  monto: number;
  saldado: boolean;
};

export type ResultadoCobro = {
  pago_id: string;
  numero: number;
  imputaciones: ImputacionCobro[];
};

const chequeSchema = z.object({
  numero: z.string().trim().min(1, "Poné el número del cheque"),
  banco: z.string().trim().max(80).optional(),
  titular: z.string().trim().min(1, "Poné a nombre de quién está el cheque"),
  es_tercero: z.boolean(),
  fecha_cobro: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha en que se puede cobrar el cheque"),
});

const cobroSchema = z
  .object({
    clienteId: z.uuid("No pudimos identificar al cliente. Volvé a la lista y probá de nuevo."),
    monto: z.number().positive("El monto debe ser mayor a cero"),
    medio: z.enum(["efectivo", "transferencia", "cheque"]),
    cheque: chequeSchema.optional(),
    notas: z.string().trim().max(500, "La nota es demasiado larga").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.medio === "cheque" && !v.cheque) {
      ctx.addIssue({
        code: "custom",
        message: "Faltan los datos del cheque (número y titular)",
      });
    }
  });

/**
 * Registra un cobro: abre (o recupera) la caja de hoy según el rol y llama a
 * `registrar_pago`, que imputa solo (deuda más vieja primero, orden de
 * prioridad, descuento por pronto pago). La lógica vive en la RPC.
 */
export async function registrarCobro(
  input: unknown
): Promise<ActionResult<ResultadoCobro>> {
  const perfil = await requireRol("admin", "guardia", "tesoreria");
  const parsed = cobroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { clienteId, monto, medio, cheque, notas } = parsed.data;

  const supabase = await createClient();

  const tipoCaja = perfil.rol === "guardia" ? "guardia" : "administracion";
  const { data: cajaId, error: errorCaja } = await supabase.rpc("abrir_caja", {
    p_tipo: tipoCaja,
  });
  if (errorCaja) return fallo(errorCaja.message);
  if (!cajaId) return fallo("No se pudo abrir la caja de hoy. Probá de nuevo.");

  const chequeJson: Json | undefined =
    medio === "cheque" && cheque
      ? {
          numero: cheque.numero,
          banco: cheque.banco ?? null,
          titular: cheque.titular,
          es_tercero: cheque.es_tercero,
          fecha_cobro: cheque.fecha_cobro,
        }
      : undefined;

  const { data, error } = await supabase.rpc("registrar_pago", {
    p_cliente: clienteId,
    p_monto: monto,
    p_medio: medio,
    p_caja: cajaId,
    p_cheque: chequeJson,
    p_notas: notas || undefined,
  });
  if (error) return fallo(error.message);

  revalidatePath("/cobranza");
  revalidatePath("/caja");
  revalidatePath("/inicio");
  return ok(data as unknown as ResultadoCobro);
}

/** Anula un cobro (revierte las imputaciones). La usa la pantalla de caja. */
export async function anularCobro(
  pagoId: string,
  motivo: string
): Promise<ActionResult> {
  await requireRol("admin", "guardia", "tesoreria");
  if (!pagoId) return fallo("No pudimos identificar el cobro a anular.");
  const motivoLimpio = motivo?.trim();
  if (!motivoLimpio) return fallo("Contá por qué anulás el cobro");

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_pago", {
    p_pago: pagoId,
    p_motivo: motivoLimpio,
  });
  if (error) return fallo(error.message);

  revalidatePath("/caja");
  revalidatePath("/cobranza");
  revalidatePath("/inicio");
  return ok(undefined);
}
