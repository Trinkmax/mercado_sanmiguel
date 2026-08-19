"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { formatARS } from "@/lib/format";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/** Resultado de un cambio que pasa por `solicitar_cambio`:
 * el Líder de Procesos aplica directo ("aplicado"); el resto queda "pendiente"
 * hasta que el Líder lo apruebe. "sin_cambios" = no había nada que cambiar. */
export type EstadoSolicitud = "aplicado" | "pendiente" | "sin_cambios";
export type ResultadoSolicitud = { estado: EstadoSolicitud };

type RespuestaRpcSolicitud = {
  estado: "aplicado" | "pendiente";
  cambio_id: string;
  resultado_id: string | null;
};

/* ---------- Precios (conceptos) ---------- */

const conceptoSchema = z.object({
  id: z.uuid("No encontramos el concepto."),
  precio: z
    .number("Poné el precio en números.")
    .min(0, "El precio no puede ser negativo."),
  descuento_pronto_pago: z
    .number("Poné el beneficio en números.")
    .min(0, "El beneficio va de 0 a 100.")
    .max(100, "El beneficio va de 0 a 100."),
  orden_imputacion: z
    .number("Poné el orden en números.")
    .int("El orden tiene que ser un número entero.")
    .min(1, "El orden empieza en 1.")
    .max(999, "El orden puede ser de 1 a 999."),
});

/**
 * Cambia precio / beneficio por pago en término / orden de un concepto.
 * Pasa por `solicitar_cambio` con SOLO las claves que cambian: el Líder aplica
 * en el acto; los demás roles dejan el cambio esperando aprobación.
 */
export async function actualizarConcepto(
  input: unknown
): Promise<ActionResult<ResultadoSolicitud>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = conceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...nuevos } = parsed.data;
  const supabase = await createClient();

  const { data: actual, error: errActual } = await supabase
    .from("conceptos")
    .select("codigo, nombre, precio, descuento_pronto_pago, orden_imputacion")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errActual) return fallo(errActual);
  if (!actual) return fallo("No encontramos el concepto.");

  // Solo lo que cambia (así el diff que ve el Líder es el real).
  const datos: Record<string, number> = {};
  const partes: { campo: string; valor: string }[] = [];
  if (Number(actual.precio) !== nuevos.precio) {
    datos.precio = nuevos.precio;
    partes.push({ campo: "precio", valor: formatARS(nuevos.precio) });
  }
  if (Number(actual.descuento_pronto_pago) !== nuevos.descuento_pronto_pago) {
    datos.descuento_pronto_pago = nuevos.descuento_pronto_pago;
    partes.push({
      campo: "beneficio por pago en término",
      valor: `${nuevos.descuento_pronto_pago} %`,
    });
  }
  if (Number(actual.orden_imputacion) !== nuevos.orden_imputacion) {
    datos.orden_imputacion = nuevos.orden_imputacion;
    partes.push({ campo: "orden de imputación", valor: String(nuevos.orden_imputacion) });
  }
  if (partes.length === 0) return ok({ estado: "sin_cambios" });

  const resumen = resumirCambioConcepto(actual.codigo, partes);

  const { data, error } = await supabase.rpc("solicitar_cambio", {
    p_entidad: "concepto",
    p_accion: "modificacion",
    p_entidad_id: id,
    p_datos: datos,
    p_resumen: resumen,
  });
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  revalidatePath("/energia");
  revalidatePath("/facturacion");
  revalidatePath("/aprobaciones");
  return ok({ estado: (data as unknown as RespuestaRpcSolicitud).estado });
}

/**
 * "Cambiar precio de EXPP a $X" ·
 * "Cambiar precio de EXPP a $X y orden de imputación a 40" ·
 * "Cambiar precio de EXPP a $X, beneficio por pago en término a 10 % y orden de imputación a 40"
 */
function resumirCambioConcepto(
  codigo: string,
  partes: { campo: string; valor: string }[]
): string {
  const [primera, ...resto] = partes;
  const cabeza = `Cambiar ${primera.campo} de ${codigo} a ${primera.valor}`;
  if (resto.length === 0) return cabeza;
  const otras = resto.map((p) => `${p.campo} a ${p.valor}`);
  if (otras.length === 1) return `${cabeza} y ${otras[0]}`;
  return `${cabeza}, ${otras.slice(0, -1).join(", ")} y ${otras[otras.length - 1]}`;
}

const activoConceptoSchema = z.object({
  id: z.uuid("No encontramos el concepto."),
  activo: z.boolean(),
});

/** Activa / desactiva un concepto (también pasa por aprobación). */
export async function cambiarActivoConcepto(
  input: unknown
): Promise<ActionResult<ResultadoSolicitud>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = activoConceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: actual, error: errActual } = await supabase
    .from("conceptos")
    .select("codigo, nombre, activo")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errActual) return fallo(errActual);
  if (!actual) return fallo("No encontramos el concepto.");
  if (actual.activo === parsed.data.activo) return ok({ estado: "sin_cambios" });

  const resumen = `${parsed.data.activo ? "Activar" : "Desactivar"} concepto ${actual.codigo} — ${actual.nombre}`;

  const { data, error } = await supabase.rpc("solicitar_cambio", {
    p_entidad: "concepto",
    p_accion: "modificacion",
    p_entidad_id: parsed.data.id,
    p_datos: { activo: parsed.data.activo },
    p_resumen: resumen,
  });
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  revalidatePath("/facturacion");
  revalidatePath("/aprobaciones");
  return ok({ estado: (data as unknown as RespuestaRpcSolicitud).estado });
}

/* ---------- General (configuracion) ---------- */

const generalSchema = z
  .object({
    dia_vencimiento: z
      .number("Poné el día en números.")
      .int("El día tiene que ser un número entero.")
      .min(1, "El día va de 1 a 31.")
      .max(31, "El día va de 1 a 31.")
      .optional(),
    impresion_directa: z.boolean().optional(),
  })
  .refine(
    (v) => v.dia_vencimiento !== undefined || v.impresion_directa !== undefined,
    "No hay nada para guardar."
  );

/**
 * Guarda el día de vencimiento y/o la impresión directa. Los precios del
 * cobro por día en portería los guarda SOLO el Líder (ver guardarPreciosPorteria).
 */
export async function guardarConfiguracionGeneral(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: { dia_vencimiento?: number; impresion_directa?: boolean } = {};
  if (parsed.data.dia_vencimiento !== undefined) {
    cambios.dia_vencimiento = parsed.data.dia_vencimiento;
  }
  if (parsed.data.impresion_directa !== undefined) {
    cambios.impresion_directa = parsed.data.impresion_directa;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(
    {
      org_id: perfil.org_id,
      ...cambios,
      actualizado_por: perfil.user_id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  revalidatePath("/facturacion");
  return ok(undefined);
}

const preciosPorteriaSchema = z.object({
  precio_canon_camion: z
    .number("Poné el precio del canon por camión en números.")
    .min(0, "El precio no puede ser negativo."),
  precio_canon_ambulante: z
    .number("Poné el precio del canon por ambulante en números.")
    .min(0, "El precio no puede ser negativo."),
  precio_canon_quintero_dia: z
    .number("Poné el precio del canon por quintero en números.")
    .min(0, "El precio no puede ser negativo."),
});

/**
 * Precios del cobro por día en portería (camión / ambulante / quintero).
 * Los configura SOLO el Líder de Procesos.
 */
export async function guardarPreciosPorteria(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("lider");
  const parsed = preciosPorteriaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("configuracion").upsert(
    {
      org_id: perfil.org_id,
      ...parsed.data,
      actualizado_por: perfil.user_id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  revalidatePath("/cobranza");
  revalidatePath("/caja");
  return ok(undefined);
}

/* ---------- Rubros de gasto ---------- */

const rubroSchema = z.object({
  codigo: z
    .string("Poné el código del rubro.")
    .trim()
    .min(1, "Poné el código del rubro.")
    .max(8, "El código puede tener hasta 8 letras.")
    .regex(
      /^[a-zA-Z0-9]+$/,
      "El código lleva solo letras y números, sin espacios."
    )
    .transform((v) => v.toUpperCase()),
  nombre: z
    .string("Poné el nombre del rubro.")
    .trim()
    .min(1, "Poné el nombre del rubro."),
});

export async function crearRubro(input: unknown): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = rubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { codigo, nombre } = parsed.data;
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("rubros_gasto")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("codigo", codigo)
    .maybeSingle();
  if (existente) return fallo(`Ya existe un rubro con el código ${codigo}.`);

  const { data, error } = await supabase
    .from("rubros_gasto")
    .insert({ codigo, nombre, org_id: perfil.org_id })
    .select("id")
    .single();
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok({ id: data.id });
}

const activoRubroSchema = z.object({
  id: z.uuid("No encontramos el rubro."),
  activo: z.boolean(),
});

export async function cambiarActivoRubro(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = activoRubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubros_gasto")
    .update({ activo: parsed.data.activo })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  return ok(undefined);
}
