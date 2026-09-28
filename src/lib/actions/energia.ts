"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { formatARS } from "@/lib/format";
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
 * y rechaza la corrección si el cargo ya tiene cobros. No genera el abono (§1.2-11).
 * J5: Administración y el Líder (Tesorería ya no).
 */
export async function registrarLectura(input: {
  medidorId: string;
  periodo: string;
  anterior: number;
  actual: number;
}): Promise<ActionResult<{ lecturaId: string }>> {
  await requireRol("admin", "lider");
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
  revalidatePath("/facturacion");
  return ok({ lecturaId: data });
}

const precioSchema = z.object({
  precio: z
    .number("Poné el precio en pesos")
    .int("Poné el precio en pesos, sin centavos")
    .positive("El precio tiene que ser mayor que cero"),
});

/** Resultado del cambio de precio: "aplicado" (Líder) o "pendiente" de aprobación. */
export type ResultadoPrecioKwh = {
  estado: "aplicado" | "pendiente" | "sin_cambios";
  precio: number;
};

/** Conceptos de energía cuyo precio se cambia desde /energia. */
export type ConceptoEnergia = "ENER" | "ABEN";

const RESUMEN_PRECIO: Record<ConceptoEnergia, (precio: number) => string> = {
  ENER: (p) => `Cambiar precio del kWh a ${formatARS(p)}`,
  ABEN: (p) => `Cambiar el abono mensual de energía a ${formatARS(p)}`,
};

const conceptoSchema = z.object({
  codigo: z.enum(["ENER", "ABEN"], { error: "No reconocemos el concepto. Recargá la página." }),
});

/**
 * Cambia el precio del kWh (ENER) o del abono mensual (ABEN, I1) con `solicitar_cambio`:
 * el Líder de Procesos lo aplica en el acto; Administración lo deja esperando su
 * aprobación. El kWh vale para las próximas lecturas; el abono, para la próxima
 * generación del mes. Lo ya cargado no cambia.
 */
export async function cambiarPrecioConcepto(input: {
  codigo: ConceptoEnergia;
  precio: number;
}): Promise<ActionResult<ResultadoPrecioKwh>> {
  const perfil = await requireRol("admin", "lider");
  const concepto = conceptoSchema.safeParse(input);
  if (!concepto.success) return fallo(concepto.error.issues[0].message);
  const parsed = precioSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const codigo = concepto.data.codigo;

  const supabase = await createClient();
  const { data: fila, error: errConcepto } = await supabase
    .from("conceptos")
    .select("id, precio")
    .eq("org_id", perfil.org_id)
    .eq("codigo", codigo)
    .maybeSingle();
  if (errConcepto) return fallo(errConcepto);
  if (!fila) {
    return fallo(
      codigo === "ENER"
        ? "No encontramos el concepto de energía (ENER)."
        : "No encontramos el abono mensual de energía (ABEN) en Configuración."
    );
  }

  const precio = parsed.data.precio;
  if (Number(fila.precio) === precio) {
    return ok({ estado: "sin_cambios", precio });
  }

  const { data, error } = await supabase.rpc("solicitar_cambio", {
    p_entidad: "concepto",
    p_accion: "modificacion",
    p_entidad_id: fila.id,
    p_datos: { precio },
    p_resumen: RESUMEN_PRECIO[codigo](precio),
  });
  if (error) return fallo(error);

  const respuesta = data as unknown as { estado: "aplicado" | "pendiente" };

  revalidatePath("/energia");
  revalidatePath("/facturacion");
  revalidatePath("/configuracion");
  revalidatePath("/aprobaciones");
  return ok({ estado: respuesta.estado, precio });
}

/** Precio del kWh (ENER). Se mantiene por compatibilidad: usa `cambiarPrecioConcepto`. */
export async function cambiarPrecioKwh(input: {
  precio: number;
}): Promise<ActionResult<ResultadoPrecioKwh>> {
  return cambiarPrecioConcepto({ codigo: "ENER", precio: input.precio });
}
