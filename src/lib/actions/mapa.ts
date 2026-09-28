"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { cargarPlano } from "@/components/mapa/datos-plano";
import type { ElementoPlano, Espacio } from "@/components/mapa/tipos";

const idEspacio = z.uuid("No reconocemos el puesto. Recargá la página.");

const asignarSchema = z.object({
  espacios: z
    .array(idEspacio)
    .min(1, "Elegí al menos un puesto.")
    .max(200, "Son demasiados puestos de una vez."),
  // null = liberar
  cliente_id: z.uuid("No reconocemos al cliente. Recargá la página.").nullable(),
  // A quién le figuran hoy esos espacios en la pantalla (null = libres): si
  // otra persona los cambió mientras tanto, la RPC rechaza en vez de pisar.
  actual: z.uuid("No reconocemos al cliente. Recargá la página.").nullable(),
});

const editarSchema = z.object({
  id: idEspacio,
  numero: z
    .string()
    .trim()
    .max(12, "El número puede tener hasta 12 caracteres.")
    .nullable(),
  medio: z.boolean(),
  nota: z.string().trim().max(60, "La nota puede tener hasta 60 caracteres.").nullable(),
  /** C3: puesto propio de la cooperativa (paga EXPP). Sin el campo, no se toca. */
  propio: z.boolean().optional(),
});

/**
 * Asigna uno o varios espacios del plano a un cliente (o los libera con
 * `cliente_id: null`). Solo Administración y el Líder de Procesos: la RPC
 * `asignar_espacios` lo exige igual y valida organización y cliente activo.
 */
export async function asignarEspacios(
  input: unknown
): Promise<ActionResult<{ cambiados: number }>> {
  await requireRol("admin", "lider");
  const parsed = asignarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("asignar_espacios", {
    p_espacios: [...new Set(parsed.data.espacios)],
    // Los tipos generados no admiten null (default en SQL): null = libre.
    p_cliente: parsed.data.cliente_id as unknown as string,
    p_actual: parsed.data.actual as unknown as string,
  });
  if (error) {
    // Si otra persona cambió el plano, la pantalla se refresca con lo nuevo.
    revalidatePath("/mapa");
    return fallo(error);
  }

  revalidatePath("/mapa");
  return ok({ cambiados: Number(data ?? 0) });
}

/** Corrige número, medio puesto, nota y "puesto propio" (C3) de un espacio del plano. */
export async function editarEspacio(input: unknown): Promise<ActionResult<void>> {
  await requireRol("admin", "lider");
  const parsed = editarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("editar_espacio", {
    p_espacio: parsed.data.id,
    p_numero: parsed.data.numero ?? "",
    p_medio: parsed.data.medio,
    p_nota: parsed.data.nota ?? "",
    ...(parsed.data.propio === undefined ? {} : { p_propio: parsed.data.propio }),
  });
  if (error) return fallo(error);

  revalidatePath("/mapa");
  // "Puesto propio 12" se ve en la ficha, en Clientes (segmento) y en las solicitudes.
  if (parsed.data.propio !== undefined) revalidatePath("/clientes", "layout");
  return ok(undefined);
}

/**
 * El plano para elegir un lugar (C8: ubicación del medidor; H3: puesto de una solicitud).
 * Guardia, Portería y Tesorería lo reciben sin clientes ni notas (`espacios_del_plano`);
 * Administración y el Líder, con quién ocupa cada espacio. Interfaz congelada (§6.10).
 */
export async function planoParaSelector(): Promise<
  ActionResult<{ espacios: Espacio[]; elementos: ElementoPlano[] }>
> {
  const perfil = await requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
  const supabase = await createClient();
  const plano = await cargarPlano(supabase, perfil, { conClientes: true });
  if (plano.error) return fallo("No pudimos cargar el plano. Probá de nuevo en un rato.");
  return ok({ espacios: plano.espacios, elementos: plano.elementos });
}
