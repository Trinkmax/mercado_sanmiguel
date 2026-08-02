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
  cargos: number;
  energia: number;
};

/**
 * Genera los cargos del mes llamando a la RPC `generar_periodo`.
 * La RPC es idempotente: si se corre dos veces no duplica nada.
 */
export async function generarPeriodo(
  input: unknown
): Promise<ActionResult<ResultadoGeneracion>> {
  await requireRol("admin", "tesoreria", "consejo");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_periodo", {
    p_periodo: parsed.data.periodo,
  });
  if (error) return fallo(error);

  revalidatePath("/facturacion");
  revalidatePath("/reportes");
  revalidatePath("/inicio");
  return ok(data as unknown as ResultadoGeneracion);
}
