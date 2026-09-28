"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO } from "@/lib/format";
import {
  rutaFacturaGasto,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";

/* Gastos (E3, E4, J5): Administración, Tesorería y el Líder (§1.3 D-P2). */

/** Lo que devuelve `pagar_gasto` (contrato §4.9), en camelCase. */
export type ResultadoPagoGasto = {
  cajaId: string | null;
  cajaFecha: string | null;
  cajaEstado: string | null;
  /** Efectivo que tiene que tener la caja después del pago (null si no se pudo calcular). */
  efectivoCaja: number | null;
  fechaPago: string;
  arqueoRecalculado: boolean;
};

function revalidarGastos() {
  revalidatePath("/gastos");
  revalidatePath("/tesoreria");
  revalidatePath("/caja");
  revalidatePath("/inicio");
}

const periodoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-01$/, "Elegí el mes del gasto.");

const fechaNoFutura = z.iso
  .date("La fecha no es válida.")
  .refine((f) => f <= hoyISO(), "La fecha de pago no puede ser futura.");

const pagoSchema = z
  .object({
    id: z.uuid("No se reconoce el gasto. Actualizá la página."),
    origen: z.enum(["caja", "tesoreria"], "Elegí de dónde sale la plata."),
    /** null = la caja de administración de hoy (Administración y el Líder la abren al pagar). */
    cajaId: z.uuid("La caja no es válida. Actualizá la página.").nullable().optional(),
    medio: z.enum(["efectivo", "transferencia"], "Elegí efectivo o banco."),
    fecha: fechaNoFutura.nullable().optional(),
  })
  .refine((d) => d.origen !== "caja" || d.medio === "efectivo", {
    message: "De la caja del día solo sale efectivo.",
  });

type EntradaPago = z.infer<typeof pagoSchema>;

async function llamarPagarGasto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: EntradaPago
): Promise<ActionResult<ResultadoPagoGasto>> {
  const { data, error } = await supabase.rpc("pagar_gasto", {
    p_gasto: d.id,
    p_origen: d.origen,
    p_medio: d.medio,
    ...(d.origen === "tesoreria" && d.fecha ? { p_fecha: d.fecha } : {}),
    ...(d.origen === "caja" && d.cajaId ? { p_caja: d.cajaId } : {}),
  });
  if (error) return fallo(error);
  const r = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return ok({
    cajaId: (r.caja_id as string | null) ?? null,
    cajaFecha: (r.caja_fecha as string | null) ?? null,
    cajaEstado: (r.caja_estado as string | null) ?? null,
    efectivoCaja: num(r.efectivo_caja),
    fechaPago: String(r.fecha_pago ?? hoyISO()),
    arqueoRecalculado: Boolean(r.arqueo_recalculado),
  });
}

/* ---------------- Cargar gasto ---------------- */

const gastoSchema = z.object({
  rubro_id: z.uuid("Elegí el rubro del gasto."),
  tipo: z.enum(["fijo", "variable"], "Elegí si se repite todos los meses o no."),
  descripcion: z
    .string()
    .trim()
    .max(200, "La descripción es muy larga (máximo 200 letras).")
    .nullable(),
  monto: z
    .string()
    .regex(/^\d+$/, "Poné el monto del gasto, solo números.")
    .transform(Number)
    .refine((n) => n > 0, "El monto tiene que ser mayor a cero."),
  vencimiento: z.iso.date("La fecha de vencimiento no es válida.").nullable(),
  notas: z.string().trim().max(500, "La nota es muy larga.").nullable(),
  periodo: periodoSchema,
});

/**
 * Carga un gasto del mes (descripción y factura opcionales). Si viene
 * `pagar_origen`, además lo paga en el mismo paso ("¿Ya lo pagaste?"). Si el
 * pago falla, el gasto queda cargado como pendiente y se avisa el motivo.
 */
export async function crearGasto(
  formData: FormData
): Promise<
  ActionResult<{ id: string; pago: ResultadoPagoGasto | null; errorPago: string | null }>
> {
  const perfil = await requireRol("admin", "tesoreria", "lider");
  const texto = (k: string) => String(formData.get(k) ?? "").trim();

  const parsed = gastoSchema.safeParse({
    rubro_id: texto("rubro_id"),
    tipo: texto("tipo"),
    descripcion: texto("descripcion") || null,
    monto: texto("monto"),
    vencimiento: texto("vencimiento") || null,
    notas: texto("notas") || null,
    periodo: texto("periodo"),
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  // Pago en el mismo paso (opcional): se valida antes de tocar nada.
  const origenPago = texto("pagar_origen");
  let pago: Omit<EntradaPago, "id"> | null = null;
  if (origenPago) {
    const p = pagoSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000000",
      origen: origenPago,
      cajaId: texto("pagar_caja") || null,
      medio: texto("pagar_medio") || "efectivo",
      fecha: texto("pagar_fecha") || null,
    });
    if (!p.success) return fallo(p.error.issues[0].message);
    pago = {
      origen: p.data.origen,
      cajaId: p.data.cajaId,
      medio: p.data.medio,
      fecha: p.data.fecha,
    };
  }

  const supabase = await createClient();

  let facturaPath: string | null = null;
  const factura = formData.get("factura");
  if (factura instanceof File && factura.size > 0) {
    if (!MIME_PERMITIDOS.includes(factura.type)) {
      return fallo("La factura tiene que ser un PDF o una foto (JPG, PNG o WEBP).");
    }
    if (factura.size > TAMANO_MAX_BYTES) {
      return fallo("La factura no puede pesar más de 20 MB.");
    }
    const ruta = rutaFacturaGasto(perfil.org_id, factura.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(ruta, factura);
    if (errorSubida) return fallo("No se pudo subir la factura. Probá de nuevo.");
    facturaPath = ruta;
  }

  const { data, error } = await supabase
    .from("gastos")
    .insert({
      org_id: perfil.org_id,
      rubro_id: parsed.data.rubro_id,
      tipo: parsed.data.tipo,
      descripcion: parsed.data.descripcion,
      monto: parsed.data.monto,
      vencimiento: parsed.data.vencimiento,
      notas: parsed.data.notas,
      periodo: parsed.data.periodo,
      factura_path: facturaPath,
    })
    .select("id")
    .single();

  if (error) {
    if (facturaPath) await supabase.storage.from("documentos").remove([facturaPath]);
    return fallo(error);
  }

  let resultadoPago: ResultadoPagoGasto | null = null;
  let errorPago: string | null = null;
  if (pago) {
    const res = await llamarPagarGasto(supabase, { id: data.id, ...pago });
    if (res.ok) resultadoPago = res.data;
    else errorPago = res.error;
  }

  revalidarGastos();
  return ok({ id: data.id, pago: resultadoPago, errorPago });
}

/* ---------------- Pagar / deshacer el pago ---------------- */

/** Paga un gasto pendiente desde la caja de un día (efectivo) o desde Tesorería. */
export async function pagarGasto(
  input: unknown
): Promise<ActionResult<ResultadoPagoGasto>> {
  await requireRol("admin", "tesoreria", "lider");
  const parsed = pagoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const res = await llamarPagarGasto(supabase, parsed.data);
  if (res.ok) revalidarGastos();
  return res;
}

const revertirSchema = z.object({
  id: z.uuid("No se reconoce el gasto. Actualizá la página."),
  motivo: z
    .string()
    .trim()
    .min(3, "Contá por qué deshacés el pago.")
    .max(300, "El motivo es muy largo (máximo 300 letras)."),
});

/** "Deshacer pago": el gasto vuelve a pendiente y queda el rastro (quién, cuándo, por qué). */
export async function revertirPagoGasto(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria", "lider");
  const parsed = revertirSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("revertir_pago_gasto", {
    p_gasto: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarGastos();
  return ok(undefined);
}

/* ---------------- Traer los fijos del mes anterior (E3) ---------------- */

const traerSchema = z
  .object({
    desde: periodoSchema,
    hasta: periodoSchema,
    items: z
      .array(
        z.object({
          origenId: z.uuid("Uno de los gastos no se reconoce. Actualizá la página."),
          monto: z
            .number("Poné el monto de cada gasto.")
            .positive("Cada gasto necesita un monto mayor a cero."),
          vencimiento: z.iso.date("Hay una fecha de vencimiento que no es válida.").nullable(),
          descripcion: z.string().trim().max(200).nullable().optional(),
        })
      )
      .min(1, "Elegí al menos un gasto para traer.")
      .max(200, "Traé hasta 200 gastos por vez."),
  })
  .refine((d) => d.hasta > d.desde, { message: "Los gastos se traen a un mes posterior." });

export async function traerGastosFijos(
  input: unknown
): Promise<ActionResult<{ creados: number; omitidos: number; total: number }>> {
  await requireRol("admin", "tesoreria", "lider");
  const parsed = traerSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("replicar_gastos_fijos", {
    p_desde_periodo: parsed.data.desde,
    p_hasta_periodo: parsed.data.hasta,
    p_items: parsed.data.items.map((i) => ({
      origen_id: i.origenId,
      monto: i.monto,
      vencimiento: i.vencimiento,
      descripcion: i.descripcion ?? null,
    })),
  });
  if (error) return fallo(error);

  const r = (data ?? {}) as { creados?: number; omitidos?: unknown[]; total?: number };
  revalidarGastos();
  return ok({
    creados: Number(r.creados ?? 0),
    omitidos: Array.isArray(r.omitidos) ? r.omitidos.length : 0,
    total: Number(r.total ?? 0),
  });
}

/* ---------------- Anular / factura ---------------- */

const idSchema = z.object({ id: z.uuid("No se reconoce el gasto. Actualizá la página.") });

/** Anula un gasto pendiente (queda registrado como anulado y no suma en el mes). */
export async function anularGasto(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "lider");
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos")
    .update({ estado: "anulado" })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("estado", "pendiente")
    .select("id");

  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Ese gasto ya no se puede anular. Actualizá la página.");

  revalidarGastos();
  return ok(undefined);
}

/**
 * Adjunta (o reemplaza) la factura de un gasto. Si ya estaba pagado vuelve a
 * quedar "sin validar" para que Tesorería controle la factura nueva.
 */
export async function adjuntarFacturaGasto(formData: FormData): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria", "lider");
  const parsedId = z
    .uuid("No se reconoce el gasto.")
    .safeParse(String(formData.get("id") ?? ""));
  if (!parsedId.success) return fallo(parsedId.error.issues[0].message);

  const factura = formData.get("factura");
  if (!(factura instanceof File) || factura.size === 0) {
    return fallo("Elegí el archivo de la factura (PDF o foto).");
  }
  if (!MIME_PERMITIDOS.includes(factura.type)) {
    return fallo("La factura tiene que ser un PDF o una foto (JPG, PNG o WEBP).");
  }
  if (factura.size > TAMANO_MAX_BYTES) {
    return fallo("La factura no puede pesar más de 20 MB.");
  }

  const supabase = await createClient();
  const ruta = rutaFacturaGasto(perfil.org_id, factura.name);
  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, factura);
  if (errorSubida) return fallo("No se pudo subir la factura. Probá de nuevo.");

  const { data, error } = await supabase
    .from("gastos")
    .update({
      factura_path: ruta,
      comprobante_validado: false,
      validado_por: null,
      validado_en: null,
    })
    .eq("id", parsedId.data)
    .eq("org_id", perfil.org_id)
    .neq("estado", "anulado")
    .select("id");
  if (error || !data || data.length === 0) {
    await supabase.storage.from("documentos").remove([ruta]);
    if (error) return fallo(error);
    return fallo("Ese gasto ya no admite factura (está anulado). Actualizá la página.");
  }

  revalidatePath("/gastos");
  revalidatePath("/tesoreria");
  return ok(undefined);
}

/* ---------------- Rubros (Tesorería ya no tiene Configuración) ---------------- */

const rubroSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Poné el nombre del rubro (por ejemplo: Seguridad).")
    .max(60, "El nombre es muy largo (máximo 60 letras)."),
});

/** Código corto a partir del nombre: "Seguridad privada" → "SEGU". */
function codigoDesdeNombre(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim();
  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "RUBRO";
  if (palabras.length === 1) return palabras[0].slice(0, 5);
  return (palabras[0].slice(0, 4) + palabras[1].slice(0, 1)).slice(0, 5);
}

/** "Nuevo rubro" desde Gastos: crea el rubro con un código automático. */
export async function crearRubro(
  input: unknown
): Promise<ActionResult<{ id: string; codigo: string; nombre: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "lider");
  const parsed = rubroSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const nombre =
    parsed.data.nombre.charAt(0).toUpperCase() + parsed.data.nombre.slice(1);

  const supabase = await createClient();
  const { data: existentes, error: errorLeer } = await supabase
    .from("rubros_gasto")
    .select("id, codigo, nombre, activo")
    .eq("org_id", perfil.org_id);
  if (errorLeer) return fallo(errorLeer);

  const mismoNombre = (existentes ?? []).find(
    (r) => r.nombre.trim().toLowerCase() === nombre.toLowerCase()
  );
  if (mismoNombre) {
    if (!mismoNombre.activo) {
      return fallo(`El rubro ${mismoNombre.nombre} existe pero está desactivado: pedile al Líder que lo reactive.`);
    }
    return ok({ id: mismoNombre.id, codigo: mismoNombre.codigo, nombre: mismoNombre.nombre });
  }

  const usados = new Set((existentes ?? []).map((r) => r.codigo));
  const base = codigoDesdeNombre(nombre);
  let codigo = base;
  for (let i = 2; usados.has(codigo) && i < 100; i++) codigo = `${base}${i}`;

  const { data, error } = await supabase
    .from("rubros_gasto")
    .insert({ org_id: perfil.org_id, codigo, nombre })
    .select("id, codigo, nombre")
    .single();
  if (error) return fallo(error);

  revalidatePath("/gastos");
  return ok(data);
}
