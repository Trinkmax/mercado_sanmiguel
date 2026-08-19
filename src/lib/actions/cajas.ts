"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import type { Enums } from "@/lib/database.types";

/** Arqueo que devuelve la RPC cerrar_caja (incluye lo rendido por portería). */
export type Arqueo = {
  efectivo: number;
  transferencia: number;
  cheques: number;
  canon: number;
  gastos_pagados: number;
  rendido_efectivo: number;
  rendido_transferencia: number;
};

/** Lo que devuelve integrar_caja_porteria. */
export type ResultadoIntegracion = {
  caja_destino: string;
  efectivo: number;
  transferencia: number;
  canon: number;
};

const tipoCajaSchema = z.enum(["administracion", "guardia"]);
const uuidSchema = z.uuid();
const motivoOpcionalSchema = z
  .string()
  .trim()
  .max(500, "El motivo es demasiado largo.")
  .optional();

/** Las pantallas que muestran cajas o dependen de su estado. */
function revalidarCajas() {
  revalidatePath("/caja");
  revalidatePath("/tesoreria");
  revalidatePath("/inicio");
}

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

  revalidarCajas();
  return ok({ cajaId: data });
}

/** Cierra (rinde) la caja y devuelve el arqueo automático. */
export async function cerrarCaja(cajaId: string): Promise<ActionResult<Arqueo>> {
  await requireRol("admin", "guardia", "tesoreria");
  const parsed = uuidSchema.safeParse(cajaId);
  if (!parsed.success) return fallo("La caja no es válida.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_caja: parsed.data,
  });
  if (error) return fallo(error);

  revalidarCajas();
  const arqueo = (data ?? {}) as Record<string, number | undefined>;
  return ok({
    efectivo: Number(arqueo.efectivo ?? 0),
    transferencia: Number(arqueo.transferencia ?? 0),
    cheques: Number(arqueo.cheques ?? 0),
    canon: Number(arqueo.canon ?? 0),
    gastos_pagados: Number(arqueo.gastos_pagados ?? 0),
    rendido_efectivo: Number(arqueo.rendido_efectivo ?? 0),
    rendido_transferencia: Number(arqueo.rendido_transferencia ?? 0),
  });
}

/**
 * Administración recibe la rendición de portería: la caja de portería cerrada
 * pasa a `integrada` dentro de la caja de administración de hoy.
 */
export async function integrarCajaPorteria(
  cajaId: string,
  observaciones?: string
): Promise<ActionResult<ResultadoIntegracion>> {
  await requireRol("admin", "tesoreria");
  const parsedId = uuidSchema.safeParse(cajaId);
  if (!parsedId.success) return fallo("La caja no es válida.");
  const parsedObs = motivoOpcionalSchema.safeParse(observaciones);
  if (!parsedObs.success) return fallo(parsedObs.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("integrar_caja_porteria", {
    p_caja: parsedId.data,
    p_observaciones: parsedObs.data || undefined,
  });
  if (error) return fallo(error);

  revalidarCajas();
  const r = (data ?? {}) as Record<string, unknown>;
  return ok({
    caja_destino: String(r.caja_destino ?? ""),
    efectivo: Number(r.efectivo ?? 0),
    transferencia: Number(r.transferencia ?? 0),
    canon: Number(r.canon ?? 0),
  });
}

/** El dueño de una caja cerrada pide que se la reabran (con motivo obligatorio). */
export async function solicitarReaperturaCaja(
  cajaId: string,
  motivo: string
): Promise<ActionResult> {
  await requireRol("admin", "guardia");
  const parsedId = uuidSchema.safeParse(cajaId);
  if (!parsedId.success) return fallo("La caja no es válida.");
  const parsedMotivo = z
    .string()
    .trim()
    .min(1, "Contá qué pasó para pedir la reapertura.")
    .max(500, "El motivo es demasiado largo.")
    .safeParse(motivo);
  if (!parsedMotivo.success) return fallo(parsedMotivo.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_reapertura_caja", {
    p_caja: parsedId.data,
    p_motivo: parsedMotivo.data,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok(undefined);
}

/**
 * Reabre una caja cerrada (administración) o integrada (tesorería). Si no se
 * pasa motivo, la RPC usa el del pedido de reapertura pendiente.
 */
export async function reabrirCaja(
  cajaId: string,
  motivo?: string
): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsedId = uuidSchema.safeParse(cajaId);
  if (!parsedId.success) return fallo("La caja no es válida.");
  const parsedMotivo = motivoOpcionalSchema.safeParse(motivo);
  if (!parsedMotivo.success) return fallo(parsedMotivo.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reabrir_caja", {
    p_caja: parsedId.data,
    p_motivo: parsedMotivo.data || undefined,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok(undefined);
}

/** Rechaza un pedido de reapertura (motivo opcional; queda en la bitácora). */
export async function rechazarReaperturaCaja(
  cajaId: string,
  motivo?: string
): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsedId = uuidSchema.safeParse(cajaId);
  if (!parsedId.success) return fallo("La caja no es válida.");
  const parsedMotivo = motivoOpcionalSchema.safeParse(motivo);
  if (!parsedMotivo.success) return fallo(parsedMotivo.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("rechazar_reapertura_caja", {
    p_caja: parsedId.data,
    p_motivo: parsedMotivo.data || undefined,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok(undefined);
}

const canonSchema = z.object({
  cajaId: z.uuid("La caja no es válida."),
  tipo: z.enum(["camion", "ambulante", "quintero"], {
    error: "Elegí qué entró: camión, ambulante o quintero.",
  }),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha del canon.")
    .refine((f) => f <= hoyISO(), "La fecha no puede ser futura."),
  monto: z.coerce.number().positive("Poné el monto cobrado."),
  medio: z.enum(["efectivo", "transferencia"]),
  notas: z.string().trim().max(300, "Las notas son muy largas.").optional(),
});

/**
 * Carga una entrada de canon del día (camión, ambulante o quintero por día).
 * Cantidad fija en 1: cada entrada es un ingreso. La RLS exige caja abierta.
 */
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
      tipo: parsed.data.tipo,
      fecha: parsed.data.fecha,
      cantidad: 1,
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

  revalidarCajas();
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

  revalidarCajas();
  return ok(undefined);
}

/**
 * Anula un cobro con motivo obligatorio. Única implementación del sistema
 * (cobranza.ts la reexpone); la lógica vive en la RPC anular_pago.
 */
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

  revalidarCajas();
  revalidatePath("/cobranza");
  return ok(undefined);
}
