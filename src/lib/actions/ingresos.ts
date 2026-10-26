"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { MIME_PERMITIDOS, TAMANO_MAX_BYTES, rutaComprobanteTransferencia } from "@/lib/storage";
import { hoyISO } from "@/lib/format";
import { diaAnteriorValido } from "@/lib/dia-caja";

/**
 * Ingresos sin cliente (0053): lo que entra a la caja sin ser el cobro de un cliente, como la
 * venta de vacíos y tarimas. Los cobra Administración (y el Líder) en la caja de
 * administración del día; con `fechaCaja`, en la de ese día anterior si está abierta (carga
 * atrasada). La base es la autoridad: registrar_ingreso / anular_ingreso.
 */

export type IngresoRegistrado = {
  id: string;
  numero: number;
  monto: number;
  concepto: string;
  detalle: string | null;
  medio: "efectivo" | "transferencia";
  /** El mismo `ref` ya estaba registrado (doble toque): no se cobró dos veces. */
  repetido: boolean;
};

const ingresoSchema = z
  .object({
    conceptoId: z.uuid("Elegí qué se cobra."),
    monto: z
      .number({ error: "Poné cuánto se cobró" })
      .positive("Poné cuánto se cobró")
      .max(999_999_999_999, "El monto es demasiado grande: revisalo"),
    medio: z.enum(["efectivo", "transferencia"], { error: "Elegí cómo te pagan" }),
    titular: z.string().trim().max(120, "El nombre del titular es demasiado largo").optional(),
    detalle: z.string().trim().max(200, "El detalle es demasiado largo (hasta 200 letras)").optional(),
    ref: z.uuid("No pudimos preparar el cobro. Recargá la página y probá de nuevo."),
    fechaCaja: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida")
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (d.medio === "transferencia" && !d.titular) {
      ctx.addIssue({ code: "custom", message: "Poné a nombre de quién está la cuenta que transfirió" });
    }
  });

export type InputIngreso = z.input<typeof ingresoSchema>;

function revalidarIngresos() {
  revalidatePath("/cobranza", "layout");
  revalidatePath("/caja");
  revalidatePath("/inicio");
  revalidatePath("/tesoreria");
  revalidatePath("/facturacion");
  revalidatePath("/reportes");
}

/**
 * Cobra un ingreso sin cliente. FormData: `datos` (JSON con InputIngreso) y, si es por
 * transferencia, la foto del comprobante (`comprobante`, opcional). Idempotente por `ref`:
 * un doble toque o un reintento sin red devuelven el mismo cobro con `repetido`.
 */
export async function registrarIngreso(formData: FormData): Promise<ActionResult<IngresoRegistrado>> {
  const perfil = await requireRol("admin", "lider");
  let crudo: unknown = null;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return fallo("No pudimos leer el cobro. Probá de nuevo.");
  }
  const parsed = ingresoSchema.safeParse(crudo);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;

  const hoy = hoyISO();
  const dia = d.fechaCaja === undefined || d.fechaCaja === hoy ? null : diaAnteriorValido(d.fechaCaja, hoy);
  if (d.fechaCaja !== undefined && d.fechaCaja !== hoy && !dia) {
    return fallo("Ese día ya no se puede cargar. Volvé a Caja y elegí otro.");
  }

  const archivo = formData.get("comprobante");
  const foto = d.medio === "transferencia" && archivo instanceof File && archivo.size > 0 ? archivo : null;
  if (foto && !MIME_PERMITIDOS.includes(foto.type)) {
    return fallo("La foto del comprobante tiene que ser JPG, PNG, WEBP o PDF.");
  }
  if (foto && foto.size > TAMANO_MAX_BYTES) {
    return fallo("El comprobante no puede pesar más de 20 MB.");
  }

  const supabase = await createClient();
  let ruta: string | null = null;
  if (foto) {
    ruta = rutaComprobanteTransferencia(perfil.org_id, foto.name || "comprobante.jpg");
    const { error } = await supabase.storage.from("documentos").upload(ruta, foto, { contentType: foto.type });
    if (error) {
      return fallo("No pudimos subir la foto del comprobante. Probá de nuevo o cobralo sin foto.");
    }
  }

  const { data, error } = await supabase.rpc("registrar_ingreso", {
    p_concepto: d.conceptoId,
    p_monto: d.monto,
    p_medio: d.medio,
    p_detalle: d.detalle || undefined,
    p_titular: d.medio === "transferencia" ? d.titular : undefined,
    p_comprobante: ruta ?? undefined,
    p_ref: d.ref,
    ...(dia ? { p_fecha: dia } : {}),
  });
  const r = (data ?? {}) as Record<string, unknown>;
  // Si no se guardó (o ya estaba: conserva su propia foto), la foto subida sobra.
  if (ruta && (error || r.repetido === true)) {
    await supabase.storage.from("documentos").remove([ruta]);
  }
  if (error) return fallo(error);

  revalidarIngresos();
  return ok({
    id: String(r.id ?? ""),
    numero: Number(r.numero ?? 0),
    monto: Number(r.monto ?? 0),
    concepto: String(r.concepto ?? ""),
    detalle: typeof r.detalle === "string" ? r.detalle : null,
    medio: r.medio === "transferencia" ? "transferencia" : "efectivo",
    repetido: r.repetido === true,
  });
}

/** Anula un ingreso sin cliente con motivo (Administración con la caja abierta; Tesorería y el Líder hasta que se valida). */
export async function anularIngreso(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "tesoreria", "lider");
  const parsed = z
    .object({
      id: z.uuid("No encontramos ese cobro. Recargá la página."),
      motivo: z
        .string("Contá por qué lo anulás")
        .trim()
        .min(1, "Contá por qué lo anulás")
        .max(500, "El motivo es demasiado largo (hasta 500 letras)"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_ingreso", {
    p_id: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarIngresos();
  return ok(undefined);
}
