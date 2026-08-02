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

const schemaGasto = z.object({
  rubro_id: z.uuid("Elegí el rubro del gasto."),
  tipo: z.enum(["fijo", "variable"], "Elegí si el gasto es fijo o variable."),
  descripcion: z.string().trim().min(1, "Contá de qué es el gasto."),
  monto: z
    .string()
    .regex(/^\d+$/, "Poné el monto del gasto, solo números.")
    .transform(Number)
    .refine((n) => n > 0, "El monto tiene que ser mayor a cero."),
  vencimiento: z.iso.date("La fecha de vencimiento no es válida.").nullable(),
  notas: z.string().trim().min(1).nullable(),
});

/** Carga un gasto nuevo (con factura opcional en PDF o imagen). */
export async function crearGasto(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "tesoreria");

  const parsed = schemaGasto.safeParse({
    rubro_id: String(formData.get("rubro_id") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
    monto: String(formData.get("monto") ?? ""),
    vencimiento: String(formData.get("vencimiento") ?? "").trim() || null,
    notas: String(formData.get("notas") ?? "").trim() || null,
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  // Factura adjunta (opcional)
  let facturaPath: string | null = null;
  const factura = formData.get("factura");
  if (factura instanceof File && factura.size > 0) {
    if (!MIME_PERMITIDOS.includes(factura.type)) {
      return fallo("La factura tiene que ser un PDF o una imagen (JPG, PNG o WEBP).");
    }
    if (factura.size > TAMANO_MAX_BYTES) {
      return fallo("La factura no puede pesar más de 20 MB.");
    }
    const ruta = rutaFacturaGasto(perfil.org_id, factura.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(ruta, factura);
    if (errorSubida) {
      return fallo("No se pudo subir la factura. Probá de nuevo.");
    }
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
      factura_path: facturaPath,
    })
    .select("id")
    .single();

  if (error) return fallo(error);
  revalidatePath("/gastos");
  return ok({ id: data.id });
}

const schemaPagar = z.object({
  id: z.uuid("No se reconoce el gasto."),
  fecha: z.iso.date("Poné la fecha de pago."),
  // Sin cheque: quedaría fuera del arqueo y del flujo de caja.
  medio: z.enum(["efectivo", "transferencia"], "Elegí el medio de pago."),
  origen: z.enum(["caja", "tesoreria"], "Elegí desde dónde se paga."),
});

/** Marca un gasto pendiente como pagado, desde la caja del día o desde tesorería. */
export async function pagarGasto(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "tesoreria");
  const parsed = schemaPagar.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();

  let cajaId: string | null = null;
  if (parsed.data.origen === "caja") {
    const { data: caja } = await supabase
      .from("cajas")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "administracion")
      .eq("fecha", hoyISO())
      .eq("estado", "abierta")
      .maybeSingle();
    if (!caja) {
      return fallo(
        "No hay una caja de administración abierta hoy. Abrila primero o pagalo desde tesorería."
      );
    }
    cajaId = caja.id;
  }

  const { data, error } = await supabase
    .from("gastos")
    .update({
      estado: "pagado",
      // Si sale de la caja del día, la fecha es la de esa caja: el arqueo y el
      // resumen mensual no pueden contradecirse.
      fecha_pago: parsed.data.origen === "caja" ? hoyISO() : parsed.data.fecha,
      medio_pago: parsed.data.medio,
      pagado_desde: parsed.data.origen === "caja" ? "caja" : "tesoreria",
      caja_id: cajaId,
    })
    .eq("id", parsed.data.id)
    .eq("estado", "pendiente")
    .select("id");

  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("El gasto ya no está pendiente. Actualizá la página.");

  revalidatePath("/gastos");
  return ok(undefined);
}

const schemaAnular = z.object({
  id: z.uuid("No se reconoce el gasto."),
});

/** Anula un gasto pendiente (queda registrado como anulado). */
export async function anularGasto(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria");
  const parsed = schemaAnular.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos")
    .update({ estado: "anulado" })
    .eq("id", parsed.data.id)
    .eq("estado", "pendiente")
    .select("id");

  if (error) return fallo(error);
  if (!data || data.length === 0)
    return fallo("Ese gasto ya no se puede anular. Actualizá la página.");

  revalidatePath("/gastos");
  return ok(undefined);
}
