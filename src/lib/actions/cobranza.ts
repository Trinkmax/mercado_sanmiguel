"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { anularCobro as anularCobroCaja } from "@/lib/actions/cajas";
import {
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
  rutaComprobanteTransferencia,
} from "@/lib/storage";
import type { Json } from "@/lib/database.types";

/** Detalle de a qué cargos se imputó un cobro (lo devuelve la RPC). */
export type ImputacionCobro = {
  cargo_id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  monto: number;
  saldado: boolean;
};

export type ResultadoCobro = {
  pago_id: string;
  numero: number;
  imputaciones: ImputacionCobro[];
  /** Lo que sobró del cobro y quedó como crédito del cliente (0 si no sobró). */
  saldo_favor: number;
};

const chequeSchema = z.object({
  numero: z.string().trim().min(1, "Poné el número del cheque"),
  banco: z.string().trim().max(80).optional(),
  titular: z.string().trim().min(1, "Poné a nombre de quién está el cheque"),
  es_tercero: z.boolean(),
  fecha_cobro: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné la fecha en que se puede cobrar el cheque"),
});

const transferenciaSchema = z.object({
  titular: z
    .string()
    .trim()
    .min(1, "Poné a nombre de quién está la cuenta que transfirió")
    .max(120, "El nombre del titular es demasiado largo"),
});

const cobroSchema = z
  .object({
    clienteId: z.uuid("No pudimos identificar al cliente. Volvé a la lista y probá de nuevo."),
    monto: z.number().positive("El monto debe ser mayor a cero"),
    medio: z.enum(["efectivo", "transferencia", "cheque"]),
    cheque: chequeSchema.optional(),
    transferencia: transferenciaSchema.optional(),
    notas: z.string().trim().max(500, "La nota es demasiado larga").optional(),
    permitirSaldoFavor: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.medio === "cheque" && !v.cheque) {
      ctx.addIssue({
        code: "custom",
        message: "Faltan los datos del cheque (número y titular)",
      });
    }
    if (v.medio === "transferencia" && !v.transferencia) {
      ctx.addIssue({
        code: "custom",
        message: "Poné a nombre de quién está la cuenta que transfirió",
      });
    }
  });

export type InputCobro = z.input<typeof cobroSchema>;

/**
 * Registra un cobro. Recibe FormData: `datos` (JSON con InputCobro) y, si fue
 * por transferencia, `comprobante` (foto o PDF, opcional). Abre (o recupera)
 * la caja de hoy según el rol, sube el comprobante y llama a `registrar_pago`,
 * que imputa solo (deuda más vieja primero, orden de prioridad, beneficio por
 * pago en término). Si sobra plata y `permitirSaldoFavor` es true, el sobrante
 * queda como saldo a favor del cliente. Si la RPC falla, el comprobante subido
 * se borra (no quedan archivos huérfanos).
 */
export async function registrarCobro(
  formData: FormData
): Promise<ActionResult<ResultadoCobro>> {
  const perfil = await requireRol("admin", "guardia", "tesoreria");

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return fallo("No pudimos leer los datos del cobro. Probá de nuevo.");
  }
  const parsed = cobroSchema.safeParse(crudo);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { clienteId, monto, medio, cheque, transferencia, notas, permitirSaldoFavor } =
    parsed.data;

  // Comprobante de la transferencia (opcional): se valida antes de tocar nada.
  let comprobante: File | null = null;
  const archivo = formData.get("comprobante");
  if (medio === "transferencia" && archivo instanceof File && archivo.size > 0) {
    if (!MIME_PERMITIDOS.includes(archivo.type)) {
      return fallo("La foto del comprobante tiene que ser JPG, PNG, WEBP o PDF.");
    }
    if (archivo.size > TAMANO_MAX_BYTES) {
      return fallo("El comprobante no puede pesar más de 20 MB.");
    }
    comprobante = archivo;
  }

  const supabase = await createClient();

  const tipoCaja = perfil.rol === "guardia" ? "guardia" : "administracion";
  const { data: cajaId, error: errorCaja } = await supabase.rpc("abrir_caja", {
    p_tipo: tipoCaja,
  });
  if (errorCaja) return fallo(errorCaja.message);
  if (!cajaId) return fallo("No se pudo abrir la caja de hoy. Probá de nuevo.");

  const chequeJson: Json | undefined =
    medio === "cheque" && cheque
      ? {
          numero: cheque.numero,
          banco: cheque.banco ?? null,
          titular: cheque.titular,
          es_tercero: cheque.es_tercero,
          fecha_cobro: cheque.fecha_cobro,
        }
      : undefined;

  // Subida del comprobante ANTES de la RPC (la RPC guarda el path).
  let comprobantePath: string | null = null;
  if (comprobante) {
    const ruta = rutaComprobanteTransferencia(
      perfil.org_id,
      comprobante.name || "comprobante.jpg"
    );
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(ruta, comprobante, { contentType: comprobante.type });
    if (errorSubida) {
      return fallo(
        "No pudimos subir la foto del comprobante. Probá de nuevo o registrá el cobro sin foto."
      );
    }
    comprobantePath = ruta;
  }

  const transferenciaJson: Json | undefined =
    medio === "transferencia" && transferencia
      ? { titular: transferencia.titular, comprobante_path: comprobantePath }
      : undefined;

  const { data, error } = await supabase.rpc("registrar_pago", {
    p_cliente: clienteId,
    p_monto: monto,
    p_medio: medio,
    p_caja: cajaId,
    p_cheque: chequeJson,
    p_notas: notas || undefined,
    p_transferencia: transferenciaJson,
    p_permitir_saldo_favor: permitirSaldoFavor ?? false,
  });
  if (error) {
    // Rollback del archivo: el cobro no se registró.
    if (comprobantePath) {
      await supabase.storage.from("documentos").remove([comprobantePath]);
    }
    return fallo(error.message);
  }

  // OJO: no revalidar `/cobranza/${clienteId}` (la página actual): Next
  // re-renderizaría la pantalla y se perdería la confirmación con el sello y
  // el botón "Ver recibo". La página es dinámica: al volver se recalcula sola.
  revalidatePath("/cobranza");
  revalidatePath("/caja");
  revalidatePath("/inicio");

  const r = (data ?? {}) as Record<string, unknown>;
  return ok({
    pago_id: String(r.pago_id ?? ""),
    numero: Number(r.numero ?? 0),
    imputaciones: (Array.isArray(r.imputaciones) ? r.imputaciones : []).map(
      (i) => {
        const imp = i as Record<string, unknown>;
        return {
          cargo_id: String(imp.cargo_id ?? ""),
          codigo: String(imp.codigo ?? ""),
          descripcion: String(imp.descripcion ?? ""),
          periodo: String(imp.periodo ?? ""),
          monto: Number(imp.monto ?? 0),
          saldado: Boolean(imp.saldado),
        };
      }
    ),
    saldo_favor: Number(r.saldo_favor ?? 0),
  });
}

/**
 * Aplica el saldo a favor del cliente a sus cargos pendientes (sin cobrar nada).
 * Devuelve cuánto se aplicó.
 */
export async function aplicarSaldoFavor(
  clienteId: string
): Promise<ActionResult<{ aplicado: number }>> {
  await requireRol("admin", "guardia", "tesoreria", "lider");
  const parsed = z.uuid().safeParse(clienteId);
  if (!parsed.success) return fallo("No pudimos identificar al cliente.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_saldo_favor_cliente", {
    p_cliente: parsed.data,
  });
  if (error) return fallo(error.message);

  revalidatePath("/cobranza");
  revalidatePath(`/cobranza/${parsed.data}`);
  revalidatePath(`/clientes/${parsed.data}`);
  revalidatePath("/inicio");
  return ok({ aplicado: Number(data ?? 0) });
}

/** Anula un cobro (revierte las imputaciones). Única implementación: la de cajas.ts. */
export async function anularCobro(
  pagoId: string,
  motivo: string
): Promise<ActionResult> {
  return anularCobroCaja(pagoId, motivo);
}
