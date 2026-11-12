"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  clientes: z.array(z.uuid("No se reconoce el cliente. Recargá la página.")).min(1).max(500),
  periodo: z.string().regex(/^\d{4}-\d{2}-01$/, "El mes no es válido. Recargá la página."),
});

/**
 * Anota los libres deuda del mes como impresos (0064): así «Libres deuda» deja de avisarlos.
 * Se llama al tocar «Imprimir» (o al abrirse solo con la impresión directa). Los que deben
 * algo no se anotan: no tienen libre deuda.
 */
export async function marcarLibresDeuda(
  clientes: string[],
  periodo: string
): Promise<ActionResult<{ anotados: number }>> {
  await requireRol("admin", "guardia", "lider");
  const parsed = schema.safeParse({ clientes, periodo });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marcar_libres_deuda", {
    p_clientes: parsed.data.clientes,
    p_periodo: parsed.data.periodo,
  });
  if (error) return fallo(error);

  revalidatePath("/libres-deuda");
  return ok({ anotados: data ?? 0 });
}
