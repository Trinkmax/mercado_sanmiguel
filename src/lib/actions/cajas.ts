"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import type { Enums } from "@/lib/database.types";

/** Arqueo que devuelve la RPC cerrar_caja. */
export type Arqueo = {
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos_pagados: number;
};

const tipoCajaSchema = z.enum(["administracion", "guardia"]);
const uuidSchema = z.uuid();

/** Abre (o recupera) la caja de hoy del tipo dado. La lógica vive en la RPC. */
export async function abrirCaja(
  tipo: Enums<"tipo_caja">
): Promise<ActionResult<{ cajaId: string }>> {
  await requireRol("admin", "guardia", "tesoreria");
  const parsed = tipoCajaSchema.safeParse(tipo);
  if (!parsed.success) return fallo("El tipo de caja no es válido.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abrir_caja", {
    p_tipo: parsed.data,
  });
  if (error) return fallo(error);

  revalidatePath("/caja");
  return ok({ cajaId: data });
}

/** Cierra la caja y devuelve el arqueo automático. */
export async function cerrarCaja(cajaId: string): Promise<ActionResult<Arqueo>> {
  await requireRol("admin", "guardia", "tesoreria");
  const parsed = uuidSchema.safeParse(cajaId);
  if (!parsed.success) return fallo("La caja no es válida.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_caja: parsed.data,
  });
  if (error) return fallo(error);

  revalidatePath("/caja");
  const arqueo = (data ?? {}) as Record<string, number | undefined>;
  return ok({
    efectivo: Number(arqueo.efectivo ?? 0),
    transferencia: Number(arqueo.transferencia ?? 0),
    cheques: Number(arqueo.cheques ?? 0),
    canon: Number(arqueo.canon ?? 0),
    gastos_pagados: Number(arqueo.gastos_pagados ?? 0),
  });
}

const canonSchema = z.object({
  cajaId: z.uuid("La caja no es válida."),
  cantidad: z.coerce
    .number()
    .int("La cantidad tiene que ser un número entero.")
    .min(1, "Poné cuántos camiones entraron."),
  monto: z.coerce.number().positive("Poné el monto cobrado."),
  medio: z.enum(["efectivo", "transferencia", "cheque"]),
  notas: z.string().trim().max(300, "Las notas son muy largas.").optional(),
});

/** Carga una entrada de canon de camiones. La RLS exige caja abierta. */
export async function cargarCanon(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "guardia", "tesoreria");
  const parsed = canonSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canon_camiones")
    .insert({
      org_id: perfil.org_id,
      caja_id: parsed.data.cajaId,
      cantidad: parsed.data.cantidad,
      monto: parsed.data.monto,
      medio: parsed.data.medio,
      notas: parsed.data.notas || null,
      creado_por: perfil.user_id,
    })
    .select("id")
    .single();
  if (error) {
    return fallo("No se pudo cargar el canon. Fijate que la caja esté abierta.");
  }

  revalidatePath("/caja");
  return ok({ id: data.id });
}

/** Borra una entrada de canon. Solo con la caja abierta (lo exige la RLS). */
export async function borrarCanon(id: string): Promise<ActionResult> {
  await requireRol("admin", "guardia", "tesoreria");
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return fallo("La entrada no es válida.");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("canon_camiones")
    .delete({ count: "exact" })
    .eq("id", parsed.data);
  if (error) return fallo(error);
  if (!count) {
    return fallo("No se pudo borrar la entrada. La caja tiene que estar abierta.");
  }

  revalidatePath("/caja");
  return ok(undefined);
}

/** Anula un cobro con motivo obligatorio. La lógica vive en la RPC anular_pago. */
export async function anularCobro(
  pagoId: string,
  motivo: string
): Promise<ActionResult> {
  await requireRol("admin", "guardia", "tesoreria");
  const parsedId = uuidSchema.safeParse(pagoId);
  if (!parsedId.success) return fallo("El cobro no es válido.");
  const parsedMotivo = z
    .string()
    .trim()
    .min(1, "Contá por qué anulás el cobro.")
    .safeParse(motivo);
  if (!parsedMotivo.success) return fallo(parsedMotivo.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_pago", {
    p_pago: parsedId.data,
    p_motivo: parsedMotivo.data,
  });
  if (error) return fallo(error);

  revalidatePath("/caja");
  return ok(undefined);
}
