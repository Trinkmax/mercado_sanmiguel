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

/** Conceptos de Portería: sus precios los propone el Jefe (G7) y los aprueba el Líder. */
const SEGMENTOS_PORTERIA = ["quinteros", "ambulantes"];

/* ---------- Precios (conceptos) ---------- */

const conceptoSchema = z.object({
  id: z.uuid("No encontramos el concepto."),
  /** Sin precio: conceptos que no lo toman del catálogo (deudas, eventuales, el ambulante). */
  precio: z
    .number("Poné el precio en números.")
    .min(0, "El precio no puede ser negativo.")
    .max(1_000_000_000, "Ese precio es demasiado grande. Revisalo.")
    .optional(),
  descuento_pronto_pago: z
    .number("Poné el beneficio en números.")
    .min(0, "El beneficio va de 0 a 100.")
    .max(100, "El beneficio va de 0 a 100.")
    .optional(),
  orden_imputacion: z
    .number("Poné el orden en números.")
    .int("El orden tiene que ser un número entero.")
    .min(1, "El orden empieza en 1.")
    .max(999, "El orden puede ser de 1 a 999.")
    .optional(),
});

/**
 * Cambia precio / beneficio por pago en término / orden de un concepto.
 * Pasa por `solicitar_cambio` con SOLO las claves que cambian: el Líder aplica
 * en el acto; los demás roles dejan el cambio esperando aprobación.
 * - Jefe de Portería: solo el PRECIO de Quintas (EXPQ). El ambulante (AMB, tipo diario) no
 *   tiene precio fijo: cuánto paga por día se pone en cada cobro (cobrar_diario, p_precio).
 * - Administración: todo menos Quintas, Ambulantes y el bono camioneros (BC).
 * La base (solicitar_cambio) repite estas reglas: esto es para avisar claro y antes.
 */
export async function actualizarConcepto(
  input: unknown
): Promise<ActionResult<ResultadoSolicitud>> {
  const perfil = await requireRol("admin", "guardia", "lider");
  const parsed = conceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...nuevos } = parsed.data;
  const supabase = await createClient();

  const { data: actual, error: errActual } = await supabase
    .from("conceptos")
    .select("codigo, nombre, tipo, segmento, precio, descuento_pronto_pago, orden_imputacion")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errActual) return fallo(errActual);
  if (!actual) return fallo("No encontramos el concepto.");

  const esDePorteria = SEGMENTOS_PORTERIA.includes(actual.segmento ?? "");
  if (actual.codigo === "BC") {
    return fallo(
      "El bono camioneros se cobra por tarifa: cambialo en Configuración → Tarifas de transporte."
    );
  }
  // El ambulante no tiene precio fijo: cuánto paga por día se pone en cada cobro.
  const precioEnCadaCobro = actual.tipo === "diario";
  if (precioEnCadaCobro) delete nuevos.precio;
  if (perfil.rol === "guardia") {
    if (precioEnCadaCobro) {
      return fallo("El ambulante no tiene un precio fijo: cuánto paga por día se pone en cada cobro.");
    }
    if (!esDePorteria) {
      return fallo("Desde Portería solo se cambia el precio de la quinta.");
    }
    // El Jefe cambia solo el precio: el beneficio y el orden no se tocan.
    delete nuevos.descuento_pronto_pago;
    delete nuevos.orden_imputacion;
  }
  if (perfil.rol === "admin" && esDePorteria) {
    return fallo("Ese precio lo maneja el Jefe de Portería.");
  }

  // Solo lo que cambia (así el diff que ve el Líder es el real).
  const datos: Record<string, number> = {};
  const partes: { campo: string; valor: string }[] = [];
  if (nuevos.precio !== undefined && Number(actual.precio) !== nuevos.precio) {
    datos.precio = nuevos.precio;
    partes.push({ campo: "precio", valor: formatARS(nuevos.precio) });
  }
  if (
    nuevos.descuento_pronto_pago !== undefined &&
    Number(actual.descuento_pronto_pago) !== nuevos.descuento_pronto_pago
  ) {
    datos.descuento_pronto_pago = nuevos.descuento_pronto_pago;
    partes.push({
      campo: "beneficio por pago en término",
      valor: `${String(nuevos.descuento_pronto_pago).replace(".", ",")} %`,
    });
  }
  if (
    nuevos.orden_imputacion !== undefined &&
    Number(actual.orden_imputacion) !== nuevos.orden_imputacion
  ) {
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
  revalidatePath("/cobranza");
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
  const perfil = await requireRol("admin", "lider");
  const parsed = activoConceptoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: actual, error: errActual } = await supabase
    .from("conceptos")
    .select("codigo, nombre, activo, segmento")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errActual) return fallo(errActual);
  if (!actual) return fallo("No encontramos el concepto.");
  if (perfil.rol === "admin" && SEGMENTOS_PORTERIA.includes(actual.segmento ?? "")) {
    return fallo("Ese concepto lo maneja el Jefe de Portería.");
  }
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
 * Guarda el día de vencimiento y/o la impresión directa (Administración y Líder).
 * Solo esas columnas y la firma (grants de 0022): las cuotas de los quinteros van
 * por `guardarCuotasQuinteros` y los precios del canon por las tarifas de transporte.
 */
export async function guardarConfiguracionGeneral(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("admin", "lider");
  const parsed = generalSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: {
    dia_vencimiento?: number;
    impresion_directa?: boolean;
    actualizado_por: string;
    actualizado_en: string;
  } = { actualizado_por: perfil.user_id, actualizado_en: new Date().toISOString() };
  if (parsed.data.dia_vencimiento !== undefined) {
    cambios.dia_vencimiento = parsed.data.dia_vencimiento;
  }
  if (parsed.data.impresion_directa !== undefined) {
    cambios.impresion_directa = parsed.data.impresion_directa;
  }

  // UPDATE (no upsert: el upsert también reescribe org_id, que no está en el grant).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracion")
    .update(cambios)
    .eq("org_id", perfil.org_id)
    .select("org_id");
  if (error) return fallo(error);
  if (!data || data.length === 0) {
    const { error: errAlta } = await supabase
      .from("configuracion")
      .insert({ org_id: perfil.org_id, ...cambios });
    if (errAlta) return fallo(errAlta);
  }

  revalidatePath("/configuracion");
  revalidatePath("/facturacion");
  return ok(undefined);
}

/* ---------- Cuotas por defecto de los quinteros (G7) ---------- */

const cuotasSchema = z.object({
  cuotas: z
    .number("Elegí en cuántos pagos.")
    .int("Elegí en cuántos pagos (de 1 a 31).")
    .min(1, "Elegí en cuántos pagos (de 1 a 31).")
    .max(31, "Elegí en cuántos pagos (de 1 a 31)."),
});

/** En cuántos pagos se cobra la quinta a los quinteros NUEVOS (no cambia a los que ya están). */
export async function guardarCuotasQuinteros(input: unknown): Promise<ActionResult> {
  await requireRol("guardia", "lider");
  const parsed = cuotasSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_cuotas_quinteros", {
    p_cuotas: parsed.data.cuotas,
  });
  if (error) return fallo(error);

  revalidatePath("/configuracion");
  revalidatePath("/clientes/nuevo");
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
  const perfil = await requireRol("admin", "lider");
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
  revalidatePath("/gastos");
  return ok({ id: data.id });
}

const activoRubroSchema = z.object({
  id: z.uuid("No encontramos el rubro."),
  activo: z.boolean(),
});

export async function cambiarActivoRubro(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "lider");
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
  revalidatePath("/gastos");
  return ok(undefined);
}

/* ---------- Rubros de gasto: fijo o variable (0037) ---------- */

const configurarRubroSchema = z.discriminatedUnion("tipo", [
  z.object({ id: z.uuid("No encontramos el rubro."), tipo: z.literal("variable") }),
  z.object({
    id: z.uuid("No encontramos el rubro."),
    tipo: z.literal("fijo"),
    monto: z
      .number("Poné el monto de cada mes.")
      .positive("Poné el monto de cada mes.")
      .max(999_999_999_999, "Revisá el monto: es demasiado grande."),
    dia: z
      .number("Elegí el día del mes en que vence.")
      .int("Elegí el día del mes en que vence (1 a 31).")
      .min(1, "Elegí el día del mes en que vence (1 a 31).")
      .max(31, "Elegí el día del mes en que vence (1 a 31)."),
    /** true: también el mes en curso · false: empieza el que viene · sin mandar: lo de siempre. */
    cargarEsteMes: z.boolean().optional(),
  }),
]);

export type ResultadoConfigurarRubro = {
  /** Mes en curso ("YYYY-MM-01"). */
  periodo: string;
  /** Qué pasó con el gasto del mes en curso (0038): se cargó ahora, se corrigió (sin pagar),
   * ya estaba pagado / anulado / cargado solo / cargado a mano, empieza el mes que viene, o
   * (al pasar a variable) el de este mes quedó pendiente. */
  esteMes:
    | "cargado"
    | "actualizado"
    | "pagado"
    | "anulado"
    | "ya_cargado_solo"
    | "a_mano"
    | "desde_el_proximo"
    | "queda_pendiente"
    | null;
  /** Primer mes en que se carga solo ("YYYY-MM-01"), si es fijo. */
  fijoDesde: string | null;
  /** Vencimiento en el mes en curso ("YYYY-MM-DD"), si es fijo. */
  vencimientoEsteMes: string | null;
};

/**
 * Fijo (con su monto y el día en que vence) o variable. Los fijos se cargan solos en Gastos
 * todos los meses; el del mes en curso se carga (o se corrige, si está sin pagar) en el acto.
 */
export async function configurarRubroGasto(input: unknown): Promise<ActionResult<ResultadoConfigurarRubro>> {
  await requireRol("admin", "lider");
  const parsed = configurarRubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("configurar_rubro_gasto", {
    p_rubro: d.id,
    p_tipo: d.tipo,
    ...(d.tipo === "fijo"
      ? {
          p_monto: Math.round(d.monto * 100) / 100,
          p_dia: d.dia,
          ...(d.cargarEsteMes === undefined ? {} : { p_cargar_este_mes: d.cargarEsteMes }),
        }
      : {}),
  });
  if (error) return fallo(error);

  const r = (data ?? {}) as {
    periodo?: string;
    este_mes?: ResultadoConfigurarRubro["esteMes"];
    fijo_desde?: string | null;
    vencimiento_este_mes?: string | null;
  };
  // Puede cargar o corregir un gasto: se refresca todo lo que muestra gastos.
  for (const ruta of ["/configuracion", "/gastos", "/tesoreria", "/inicio", "/caja"]) revalidatePath(ruta);
  return ok({
    periodo: r.periodo ?? "",
    esteMes: r.este_mes ?? null,
    fijoDesde: r.fijo_desde ?? null,
    vencimientoEsteMes: r.vencimiento_este_mes ?? null,
  });
}
