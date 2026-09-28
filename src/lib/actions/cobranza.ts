"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Rol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { anularCobro as anularCobroCaja } from "@/lib/actions/cajas";
import {
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
  rutaComprobanteTransferencia,
} from "@/lib/storage";
import { cuitTieneOnceDigitos, hoyISO, limpiarCuit } from "@/lib/format";
import type { Json } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Tipos que devuelve la base (private.resumen_lote, §4.1 del contrato fase 3)
// ---------------------------------------------------------------------------

export type MedioPago = "efectivo" | "transferencia" | "cheque";

/** A qué cargo fue la plata del cobro (agrupado por cargo, todas las líneas vigentes). */
export type ImputacionCobro = {
  cargo_id: string;
  codigo: string;
  descripcion: string;
  periodo: string;
  monto: number;
  saldado: boolean;
};

/** Una línea (medio) del cobro. Todas comparten el N° de recibo. */
export type LineaCobrada = {
  pago_id: string;
  numero: number;
  linea: number;
  medio: MedioPago;
  monto: number;
  anulado: boolean;
};

export type ResultadoCobro = {
  lote_id: string;
  numero: number;
  /** Línea 1: para /recibos/{pago_id} (cualquier línea del lote sirve). */
  pago_id: string;
  total: number;
  pagos: LineaCobrada[];
  imputaciones: ImputacionCobro[];
  /** Lo que sobró y quedó como crédito del cliente (0 si no sobró). */
  saldo_favor: number;
  /** El mismo lote ya estaba registrado (doble toque): no se cobró dos veces. */
  repetido: boolean;
};

export type ResultadoCobroDiario = ResultadoCobro & {
  cargo_id: string;
  desde: string;
  hasta: string;
  dias: number;
  precio_dia: number;
};

// ---------------------------------------------------------------------------
// Validación (espejo de registrar_cobro / cobrar_diario: la base es la autoridad)
// ---------------------------------------------------------------------------

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha válida");

const idLinea = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "No pudimos leer el cobro. Probá de nuevo.");

const montoLinea = z
  .number({ error: "Poné cuánto te pagan" })
  .positive("Cada medio de pago necesita un monto mayor a cero")
  .max(999_999_999_999, "El monto es demasiado grande: revisalo");

const lineaEfectivo = z.object({
  id: idLinea,
  medio: z.literal("efectivo"),
  monto: montoLinea,
});

const lineaTransferencia = z.object({
  id: idLinea,
  medio: z.literal("transferencia"),
  monto: montoLinea,
  transferencia: z.object({
    titular: z
      .string()
      .trim()
      .min(1, "Poné a nombre de quién está la cuenta que transfirió")
      .max(120, "El nombre del titular es demasiado largo"),
  }),
});

const chequeSchema = z
  .object({
    numero: z
      .string()
      .trim()
      .regex(/^\d{1,20}$/, "Poné el número del cheque (solo números)"),
    cuit: z
      .string()
      .transform((v) => limpiarCuit(v))
      .refine((v) => cuitTieneOnceDigitos(v), "El CUIT del cheque tiene que tener 11 números"),
    recibido_de: z.string().trim().max(120, "El nombre es demasiado largo: acortalo").optional(),
    fecha_recepcion: fechaISO.optional(),
    fecha_cobro: fechaISO,
    estado: z.enum(["en_cartera", "entregado"]),
    proveedor: z.string().trim().max(120, "El nombre es demasiado largo: acortalo").optional(),
  })
  .superRefine((c, ctx) => {
    if (c.estado === "entregado" && !c.proveedor) {
      ctx.addIssue({ code: "custom", message: "Poné a qué proveedor se le entregó el cheque" });
    }
    if (c.fecha_recepcion && c.fecha_recepcion > hoyISO()) {
      ctx.addIssue({ code: "custom", message: "La fecha de recepción no puede ser futura" });
    }
  });

const lineaCheque = z.object({
  id: idLinea,
  medio: z.literal("cheque"),
  monto: montoLinea,
  cheque: chequeSchema,
});

const lineaCobro = z.discriminatedUnion("medio", [lineaEfectivo, lineaTransferencia, lineaCheque]);
const lineaSinCheque = z.discriminatedUnion("medio", [lineaEfectivo, lineaTransferencia]);

const idCliente = z.uuid("No pudimos identificar al cliente. Volvé a la lista y probá de nuevo.");
const idLote = z.uuid("No pudimos preparar el cobro. Recargá la página y probá de nuevo.");
const notas = z.string().trim().max(500, "La nota es demasiado larga").optional();

const cobroSchema = z.object({
  clienteId: idCliente,
  loteId: idLote,
  lineas: z
    .array(lineaCobro)
    .min(1, "Agregá al menos un medio de pago")
    .max(6, "Un mismo cobro admite hasta 6 medios de pago"),
  notas,
  permitirSaldoFavor: z.boolean().optional(),
});

const diarioSchema = z.object({
  clienteId: idCliente,
  loteId: idLote,
  dias: z
    .number()
    .int("Elegí entre 1 y 31 días")
    .min(1, "Elegí entre 1 y 31 días")
    .max(31, "Elegí entre 1 y 31 días"),
  desde: fechaISO.optional(),
  lineas: z.array(lineaSinCheque).min(1, "Elegí cómo te paga").max(3, "Elegí cómo te paga"),
  notas,
});

export type InputCobro = z.input<typeof cobroSchema>;
export type InputCobroDiario = z.input<typeof diarioSchema>;
type LineaValida = z.output<typeof lineaCobro>;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>;

function leerDatos(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("datos") ?? ""));
  } catch {
    return null;
  }
}

/** Comprobantes de las transferencias: `comprobante:<idLinea>`. Todos se validan antes de subir nada. */
function leerComprobantes(
  formData: FormData,
  lineas: { id: string; medio: string }[]
): { ok: true; archivos: Map<string, File> } | { ok: false; error: string } {
  const archivos = new Map<string, File>();
  for (const l of lineas) {
    if (l.medio !== "transferencia") continue;
    const archivo = formData.get(`comprobante:${l.id}`);
    if (!(archivo instanceof File) || archivo.size === 0) continue;
    if (!MIME_PERMITIDOS.includes(archivo.type)) {
      return { ok: false, error: "La foto del comprobante tiene que ser JPG, PNG, WEBP o PDF." };
    }
    if (archivo.size > TAMANO_MAX_BYTES) {
      return { ok: false, error: "El comprobante no puede pesar más de 20 MB." };
    }
    archivos.set(l.id, archivo);
  }
  return { ok: true, archivos };
}

/** Sube los comprobantes en paralelo. Si uno falla, borra los que sí subió. */
async function subirComprobantes(
  supabase: Supabase,
  orgId: string,
  archivos: Map<string, File>
): Promise<{ ok: true; rutas: Map<string, string> } | { ok: false; error: string }> {
  const entradas = [...archivos.entries()];
  const resultados = await Promise.all(
    entradas.map(async ([id, archivo]) => {
      const ruta = rutaComprobanteTransferencia(orgId, archivo.name || "comprobante.jpg");
      const { error } = await supabase.storage
        .from("documentos")
        .upload(ruta, archivo, { contentType: archivo.type });
      return { id, ruta, error };
    })
  );
  const rutas = new Map<string, string>();
  for (const r of resultados) if (!r.error) rutas.set(r.id, r.ruta);
  if (resultados.some((r) => r.error)) {
    await borrarComprobantes(supabase, [...rutas.values()]);
    return {
      ok: false,
      error:
        "No pudimos subir la foto del comprobante. Probá de nuevo o registrá el cobro sin foto.",
    };
  }
  return { ok: true, rutas };
}

async function borrarComprobantes(supabase: Supabase, rutas: string[]) {
  if (rutas.length === 0) return;
  await supabase.storage.from("documentos").remove(rutas);
}

/** La caja de hoy de quien cobra (la abre si hace falta). El Líder cobra en la de administración (§1.3). */
async function cajaDeHoy(
  supabase: Supabase,
  rol: Rol
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("abrir_caja", {
    p_tipo: rol === "guardia" ? "guardia" : "administracion",
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No se pudo abrir la caja de hoy. Probá de nuevo." };
  return { ok: true, id: data };
}

/** Línea validada → JSON que espera la RPC (§4.1). */
function lineaParaRpc(l: LineaValida, rutas: Map<string, string>): Json {
  if (l.medio === "efectivo") return { medio: "efectivo", monto: l.monto };
  if (l.medio === "transferencia") {
    return {
      medio: "transferencia",
      monto: l.monto,
      transferencia: {
        titular: l.transferencia.titular,
        comprobante_path: rutas.get(l.id) ?? null,
      },
    };
  }
  return {
    medio: "cheque",
    monto: l.monto,
    cheque: {
      numero: l.cheque.numero,
      cuit: l.cheque.cuit,
      recibido_de: l.cheque.recibido_de || null,
      fecha_recepcion: l.cheque.fecha_recepcion ?? null,
      fecha_cobro: l.cheque.fecha_cobro,
      estado: l.cheque.estado,
      proveedor: l.cheque.estado === "entregado" ? (l.cheque.proveedor ?? null) : null,
    },
  };
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function leerResultado(data: Json | null): ResultadoCobro {
  const r = (data ?? {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    lote_id: String(r.lote_id ?? ""),
    numero: num(r.numero),
    pago_id: String(r.pago_id ?? ""),
    total: num(r.total),
    pagos: lista(r.pagos).map((p) => ({
      pago_id: String(p.pago_id ?? ""),
      numero: num(p.numero),
      linea: num(p.linea),
      medio: String(p.medio ?? "efectivo") as MedioPago,
      monto: num(p.monto),
      anulado: Boolean(p.anulado),
    })),
    imputaciones: lista(r.imputaciones).map((i) => ({
      cargo_id: String(i.cargo_id ?? ""),
      codigo: String(i.codigo ?? ""),
      descripcion: String(i.descripcion ?? ""),
      periodo: String(i.periodo ?? ""),
      monto: num(i.monto),
      saldado: Boolean(i.saldado),
    })),
    saldo_favor: num(r.saldo_favor),
    repetido: Boolean(r.repetido),
  };
}

function revalidarCobro(clienteId: string) {
  // OJO: no revalidar `/cobranza/${clienteId}` (la pantalla actual): la confirmación con el
  // recibo vive en el estado del formulario, que queda montado en el mismo lugar. "Cobrar otra
  // vez" hace router.refresh() para traer la deuda nueva.
  revalidatePath("/cobranza");
  revalidatePath("/caja");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/inicio");
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/**
 * Cobro mixto (A1): una o varias líneas de medio de pago en UN recibo. Recibe FormData:
 * `datos` (JSON con InputCobro) y un archivo por línea de transferencia
 * (`comprobante:<idLinea>`, opcional). Valida todo, abre la caja de hoy de quien cobra,
 * sube los comprobantes y llama a `registrar_cobro` con el `loteId` del formulario
 * (idempotente: un doble toque devuelve el mismo recibo con `repetido`). Si la RPC falla,
 * borra los comprobantes subidos.
 */
export async function registrarCobro(
  formData: FormData
): Promise<ActionResult<ResultadoCobro>> {
  const perfil = await requireRol("admin", "guardia", "lider");

  const parsed = cobroSchema.safeParse(leerDatos(formData));
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { clienteId, loteId, lineas, notas: nota, permitirSaldoFavor } = parsed.data;

  if (new Set(lineas.map((l) => l.id)).size !== lineas.length) {
    return fallo("No pudimos leer el cobro. Probá de nuevo.");
  }
  if (perfil.rol === "guardia" && lineas.some((l) => l.medio === "cheque")) {
    return fallo("En portería se cobra solo en efectivo o transferencia");
  }

  const comprobantes = leerComprobantes(formData, lineas);
  if (!comprobantes.ok) return fallo(comprobantes.error);

  const supabase = await createClient();
  const caja = await cajaDeHoy(supabase, perfil.rol);
  if (!caja.ok) return fallo(caja.error);

  const subida = await subirComprobantes(supabase, perfil.org_id, comprobantes.archivos);
  if (!subida.ok) return fallo(subida.error);
  const subidos = [...subida.rutas.values()];

  const { data, error } = await supabase.rpc("registrar_cobro", {
    p_cliente: clienteId,
    p_caja: caja.id,
    p_lineas: lineas.map((l) => lineaParaRpc(l, subida.rutas)),
    p_notas: nota || undefined,
    p_permitir_saldo_favor: permitirSaldoFavor ?? false,
    p_lote: loteId,
  });
  if (error) {
    await borrarComprobantes(supabase, subidos);
    return fallo(error.message);
  }

  const resultado = leerResultado(data);
  // Doble toque: el recibo ya estaba y conserva sus propias fotos; estas sobran.
  if (resultado.repetido) await borrarComprobantes(supabase, subidos);

  revalidarCobro(clienteId);
  return ok(resultado);
}

/**
 * Cobro por días del ambulante (G5, G6): crea el cargo AMB de esos días y lo paga en el acto.
 * Jefe de Portería (caja de portería) y Líder (caja de administración, §1.3). Mismo formato
 * de líneas que registrarCobro, solo efectivo o transferencia; la suma tiene que ser exacta.
 */
export async function cobrarDiario(
  formData: FormData
): Promise<ActionResult<ResultadoCobroDiario>> {
  const perfil = await requireRol("guardia", "lider");

  const parsed = diarioSchema.safeParse(leerDatos(formData));
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { clienteId, loteId, dias, desde, lineas, notas: nota } = parsed.data;

  if (new Set(lineas.map((l) => l.id)).size !== lineas.length) {
    return fallo("No pudimos leer el cobro. Probá de nuevo.");
  }

  const comprobantes = leerComprobantes(formData, lineas);
  if (!comprobantes.ok) return fallo(comprobantes.error);

  const supabase = await createClient();
  const caja = await cajaDeHoy(supabase, perfil.rol);
  if (!caja.ok) return fallo(caja.error);

  const subida = await subirComprobantes(supabase, perfil.org_id, comprobantes.archivos);
  if (!subida.ok) return fallo(subida.error);
  const subidos = [...subida.rutas.values()];

  const { data, error } = await supabase.rpc("cobrar_diario", {
    p_cliente: clienteId,
    p_caja: caja.id,
    p_dias: dias,
    p_lineas: lineas.map((l) => lineaParaRpc(l, subida.rutas)),
    p_desde: desde,
    p_notas: nota || undefined,
    p_lote: loteId,
  });
  if (error) {
    await borrarComprobantes(supabase, subidos);
    return fallo(error.message);
  }

  const base = leerResultado(data);
  if (base.repetido) await borrarComprobantes(supabase, subidos);
  const r = (data ?? {}) as Record<string, unknown>;

  revalidarCobro(clienteId);
  return ok({
    ...base,
    cargo_id: String(r.cargo_id ?? ""),
    desde: String(r.desde ?? ""),
    hasta: String(r.hasta ?? ""),
    dias: num(r.dias),
    precio_dia: num(r.precio_dia),
  });
}

/**
 * Aplica el saldo a favor del cliente a sus cargos pendientes (sin cobrar nada).
 * Devuelve cuánto se aplicó. Tesorería no (J4); cada rol sobre su categoría (lo valida la base).
 */
export async function aplicarSaldoFavor(
  clienteId: string
): Promise<ActionResult<{ aplicado: number }>> {
  await requireRol("admin", "guardia", "lider");
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

/** Anula el recibo completo (todas sus líneas). Única implementación: la de cajas.ts (M2). */
export async function anularCobro(pagoId: string, motivo: string): Promise<ActionResult> {
  return anularCobroCaja(pagoId, motivo);
}
