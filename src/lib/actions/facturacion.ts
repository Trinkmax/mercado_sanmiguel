"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "El período a generar no es válido."),
});

export type ResultadoGeneracion = {
  periodo: string;
  vencimiento: string;
  /** Cargos recurrentes nuevos (expensas, cocheras, quinta…). */
  cargos: number;
  /** Abonos mensuales de energía (ABEN) nuevos (I1). */
  abonos?: number;
  /** Consumos de luz (kWh) de las lecturas ya cargadas. */
  energia: number;
  /** Saldo a favor de clientes que se aplicó solo a los cargos nuevos. */
  saldo_favor_aplicado?: number;
};

/**
 * Genera los cargos del mes llamando a la RPC `generar_periodo` (recurrentes, abono de
 * energía y consumos). Es idempotente: si se corre dos veces solo agrega lo que falta.
 * J5: Tesorería ya no genera.
 */
export async function generarPeriodo(
  input: unknown
): Promise<ActionResult<ResultadoGeneracion>> {
  await requireRol("admin", "lider");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_periodo", {
    p_periodo: parsed.data.periodo,
  });
  if (error) return fallo(error);

  revalidatePath("/facturacion");
  revalidatePath("/energia");
  revalidatePath("/reportes");
  revalidatePath("/inicio");
  revalidatePath("/cobranza", "layout");
  revalidatePath("/mapa");
  revalidatePath("/clientes", "layout");
  return ok(data as unknown as ResultadoGeneracion);
}

export type ResultadoAbonos = {
  /** Abonos (ABEN) nuevos del mes. */
  abonos: number;
  /** Plata que suman esos abonos. */
  monto: number;
};

/**
 * Energía (I1): suma SOLO los abonos que faltan del mes en curso ya generado (medidores
 * cargados después de generar). RPC `sumar_abonos_energia` (0024): no genera expensas ni
 * cambia quién generó el mes, a diferencia de volver a generar el período entero.
 */
export async function sumarAbonosEnergia(
  input: unknown
): Promise<ActionResult<ResultadoAbonos>> {
  await requireRol("admin", "lider");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sumar_abonos_energia", {
    p_periodo: parsed.data.periodo,
  });
  if (error) return fallo(error);

  const r = (data ?? {}) as { abonos?: number | string; monto?: number | string };
  revalidatePath("/energia");
  revalidatePath("/facturacion");
  revalidatePath("/reportes");
  revalidatePath("/inicio");
  revalidatePath("/cobranza", "layout");
  revalidatePath("/clientes", "layout");
  return ok({ abonos: Number(r.abonos ?? 0), monto: Number(r.monto ?? 0) });
}
