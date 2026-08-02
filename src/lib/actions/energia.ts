"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

const lecturaSchema = z.object({
  medidorId: z.uuid("No se reconoce el medidor. Recargá la página."),
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "El período no es válido. Recargá la página."),
  anterior: z
    .number("Poné la lectura anterior del medidor")
    .int("La lectura anterior tiene que ser un número entero")
    .min(0, "La lectura anterior no puede ser negativa"),
  actual: z
    .number("Poné la lectura actual del medidor")
    .int("La lectura actual tiene que ser un número entero")
    .min(0, "La lectura actual no puede ser negativa"),
});

/**
 * Registra (o corrige) la lectura de un medidor para un período.
 * La lógica vive en la RPC `registrar_lectura`: crea la lectura y su cargo ENER,
 * y rechaza la corrección si el cargo ya tiene cobros.
 */
export async function registrarLectura(input: {
  medidorId: string;
  periodo: string;
  anterior: number;
  actual: number;
}): Promise<ActionResult<{ lecturaId: string }>> {
  await requireRol("admin", "tesoreria", "consejo");
  const parsed = lecturaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { medidorId, periodo, anterior, actual } = parsed.data;
  if (actual < anterior) {
    return fallo(
      `La lectura actual (${actual}) no puede ser menor que la anterior (${anterior}).`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_lectura", {
    p_medidor: medidorId,
    p_periodo: periodo,
    p_anterior: anterior,
    p_actual: actual,
  });
  if (error) return fallo(error);

  revalidatePath("/energia");
  return ok({ lecturaId: data });
}

const precioSchema = z.object({
  precio: z
    .number("Poné el precio del kWh")
    .int("Poné el precio en pesos, sin centavos")
    .positive("El precio tiene que ser mayor que cero"),
});

/**
 * Cambia el precio del kWh (concepto ENER).
 * Vale para las próximas lecturas: las ya cargadas no cambian.
 */
export async function cambiarPrecioKwh(input: {
  precio: number;
}): Promise<ActionResult<{ precio: number }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = precioSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conceptos")
    .update({ precio: parsed.data.precio })
    .eq("org_id", perfil.org_id)
    .eq("codigo", "ENER")
    .select("precio")
    .single();
  if (error) return fallo(error);

  revalidatePath("/energia");
  return ok({ precio: Number(data.precio) });
}
