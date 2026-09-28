"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import type { Enums } from "@/lib/database.types";
import { parsearArqueo, type Arqueo } from "@/components/caja/arqueo-tipos";

/** El tipo vive en components/caja/arqueo-tipos.ts (contrato §6.10); se re-expone por compatibilidad. */
export type { Arqueo } from "@/components/caja/arqueo-tipos";

/** Lo que devuelve integrar_caja_porteria. */
export type ResultadoIntegracion = {
  caja_destino: string;
  efectivo: number;
  transferencia: number;
  canon: number;
  quintas: number;
  ambulantes: number;
  ajustes: number;
};

const tipoCajaSchema = z.enum(["administracion", "guardia"]);
const uuidSchema = z.uuid();
const motivoOpcionalSchema = z
  .string()
  .trim()
  .max(500, "El motivo es demasiado largo.")
  .optional();
const motivoObligatorio = (mensaje: string) =>
  z.string().trim().min(1, mensaje).max(500, "El motivo es demasiado largo: resumilo en una línea.");

/** Las pantallas que muestran cajas o dependen de su estado. */
function revalidarCajas() {
  revalidatePath("/caja");
  revalidatePath("/tesoreria");
  revalidatePath("/inicio");
  revalidatePath("/porteria");
  revalidatePath("/gastos");
}

/** Abre (o recupera) la caja de hoy del tipo dado. Tesorería no abre cajas (la RPC lo rechaza). */
export async function abrirCaja(
  tipo: Enums<"tipo_caja">
): Promise<ActionResult<{ cajaId: string }>> {
  await requireRol("admin", "guardia", "lider");
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

/**
 * Cierra (o rinde) la caja y devuelve el arqueo completo. Tesorería solo cierra
 * cajas de días anteriores que quedaron abiertas (lo controla la RPC).
 */
export async function cerrarCaja(cajaId: string): Promise<ActionResult<Arqueo>> {
  await requireRol("admin", "guardia", "tesoreria", "lider");
  const parsed = uuidSchema.safeParse(cajaId);
  if (!parsed.success) return fallo("La caja no es válida.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_caja: parsed.data,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok(parsearArqueo(data));
}

/**
 * Administración recibe la caja de portería rendida: pasa a `integrada` dentro
 * de la caja de administración de hoy.
 */
export async function integrarCajaPorteria(
  cajaId: string,
  observaciones?: string
): Promise<ActionResult<ResultadoIntegracion>> {
  await requireRol("admin", "tesoreria", "lider");
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
    quintas: Number(r.quintas ?? 0),
    ambulantes: Number(r.ambulantes ?? 0),
    ajustes: Number(r.ajustes ?? 0),
  });
}

/** El dueño de una caja cerrada pide que se la reabran (con motivo obligatorio). */
export async function solicitarReaperturaCaja(
  cajaId: string,
  motivo: string
): Promise<ActionResult> {
  await requireRol("admin", "guardia", "lider");
  const parsedId = uuidSchema.safeParse(cajaId);
  if (!parsedId.success) return fallo("La caja no es válida.");
  const parsedMotivo = motivoObligatorio("Contá qué pasó para pedir la reapertura.").safeParse(motivo);
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
 * Reabre una caja cerrada (Administración) o integrada (Tesorería / Líder). Si no
 * se pasa motivo, la RPC usa el del pedido de reapertura pendiente.
 */
export async function reabrirCaja(
  cajaId: string,
  motivo?: string
): Promise<ActionResult> {
  await requireRol("admin", "tesoreria", "lider");
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
  await requireRol("admin", "tesoreria", "lider");
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

/**
 * Anula un cobro con motivo obligatorio: la RPC anular_pago anula el recibo
 * completo (todas las líneas del lote). Única implementación del sistema:
 * cobranza.ts (M1) la reexpone con la misma firma (contrato §6.10).
 */
export async function anularCobro(
  pagoId: string,
  motivo: string
): Promise<ActionResult> {
  await requireRol("admin", "guardia", "tesoreria", "lider");
  const parsedId = uuidSchema.safeParse(pagoId);
  if (!parsedId.success) return fallo("El cobro no es válido.");
  const parsedMotivo = motivoObligatorio("Contá por qué anulás el cobro.").safeParse(motivo);
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

const ajusteSchema = z.object({
  cajaId: z.uuid("La caja no es válida."),
  cuenta: z.enum(["efectivo", "banco"], { error: "Elegí si es en efectivo o en el banco." }),
  /** Con signo: − falta plata, + sobra plata. */
  monto: z
    .number({ error: "Poné el monto del ajuste." })
    .refine((n) => Math.abs(n) >= 0.01, "Poné el monto del ajuste.")
    .refine((n) => Math.abs(n) <= 100_000_000, "Revisá el monto: es demasiado grande."),
  motivo: motivoObligatorio("Contá el motivo del ajuste.").max(300, "El motivo es muy largo: resumilo en una línea."),
  /** Idempotencia: un UUID por intento (doble toque = un solo ajuste). */
  ref: z.uuid(),
});

/** Tesorería (o el Líder) carga un faltante / sobrante / comisión sobre la caja del día. */
export async function registrarAjusteCaja(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireRol("tesoreria", "lider");
  const parsed = ajusteSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_ajuste_caja", {
    p_caja: parsed.data.cajaId,
    p_cuenta: parsed.data.cuenta,
    p_monto: Math.round(parsed.data.monto * 100) / 100,
    p_motivo: parsed.data.motivo,
    p_ref: parsed.data.ref,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok({ id: data });
}

const borrarAjusteSchema = z.object({
  ajusteId: z.uuid("El ajuste no es válido."),
  motivo: motivoObligatorio("Contá por qué lo borrás."),
});

/** Borra un ajuste de una caja no validada. El motivo queda en la bitácora de la caja. */
export async function borrarAjusteCaja(input: unknown): Promise<ActionResult> {
  await requireRol("tesoreria", "lider");
  const parsed = borrarAjusteSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_ajuste_caja", {
    p_ajuste: parsed.data.ajusteId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarCajas();
  return ok(undefined);
}
