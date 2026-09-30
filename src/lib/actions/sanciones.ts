"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Perfil } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { rutaAdjuntoRegistro, MIME_PERMITIDOS, TAMANO_MAX_BYTES } from "@/lib/storage";
import { categoriasDeRol, type CategoriaCliente } from "@/lib/segmentos";
import type { TablesInsert } from "@/lib/database.types";

/**
 * Registros del cliente (tabla `sanciones`): notificación, apercibimiento o sanción.
 * Staff (Administración y Líder): emitirRegistro, responderRegistro, dejarSinEfectoMulta.
 * Socio: presentarDescargo / responderComoSocio, marcarRegistroVisto.
 * Todo lo que toca plata o estado pasa por RPC (contrato §4.8); el hilo es insert directo
 * en `registro_mensajes` (RLS + triggers de 0017 fijan autor, descargo y estado).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TIPOS = ["notificacion", "apercibimiento", "sancion"] as const;

/** uuid "de forma" (los ids de la semilla demo no siempre son RFC 4122 estrictos). */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (msg: string) => z.string().regex(RE_UUID, msg);

/**
 * Fila del hilo tal como la manda el cliente: el grant de INSERT es solo
 * (org_id, registro_id, mensaje, adjunto_path, ref). autor_* y es_descargo los fijan los
 * triggers (fijar_autor_registro + registro_mensaje_descargo): por eso el cast.
 */
function filaMensaje(f: {
  org_id: string;
  registro_id: string;
  mensaje: string;
  adjunto_path: string | null;
  ref: string | null;
}): TablesInsert<"registro_mensajes"> {
  return f as TablesInsert<"registro_mensajes">;
}

/**
 * Inserta el mensaje del hilo. Con `ref` (uuid por intento, 0025) un reintento después de
 * un corte de wifi choca con registro_mensajes_ref_unq: el mensaje ya había llegado, así
 * que se toma como enviado y se borra el adjunto de este intento (sobra).
 */
async function insertarMensaje(
  supabase: Supabase,
  fila: Parameters<typeof filaMensaje>[0]
): Promise<{ ok: true; repetido: boolean } | { ok: false; error: unknown }> {
  const { error } = await supabase.from("registro_mensajes").insert(filaMensaje(fila));
  if (!error) return { ok: true, repetido: false };
  await borrarAdjunto(supabase, fila.adjunto_path);
  if (error.code === "23505" && fila.ref) return { ok: true, repetido: true };
  return { ok: false, error };
}

/** El cliente es de mi org y su categoría la gestiona mi rol (la base es la autoridad final). */
async function clienteDeMiRol(
  supabase: Supabase,
  clienteId: string,
  perfil: Perfil
): Promise<{ ok: true; categoria: CategoriaCliente } | { ok: false; error: string }> {
  const { data } = await supabase
    .from("clientes")
    .select("id, categoria")
    .eq("id", clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!data) return { ok: false, error: "Ese cliente no existe" };
  const categoria = data.categoria as CategoriaCliente;
  if (!categoriasDeRol(perfil.rol).includes(categoria)) {
    return {
      ok: false,
      error:
        perfil.rol === "admin"
          ? "A quinteros y ambulantes los gestiona el Jefe de Portería"
          : "No tenés permiso sobre los registros de este cliente",
    };
  }
  return { ok: true, categoria };
}

/** Valida y sube un adjunto a la carpeta de registros del cliente. */
async function subirAdjunto(
  supabase: Supabase,
  orgId: string,
  clienteId: string,
  archivo: FormDataEntryValue | null
): Promise<{ ok: true; path: string | null } | { ok: false; error: string }> {
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: true, path: null };
  if (!MIME_PERMITIDOS.includes(archivo.type))
    return { ok: false, error: "El adjunto tiene que ser una foto (JPG, PNG o WEBP) o un PDF." };
  if (archivo.size > TAMANO_MAX_BYTES)
    return { ok: false, error: "El adjunto no puede pesar más de 20 MB." };
  const path = rutaAdjuntoRegistro(orgId, clienteId, archivo.name || "adjunto");
  const { error } = await supabase.storage
    .from("documentos")
    .upload(path, archivo, { contentType: archivo.type });
  if (error) return { ok: false, error: "No pudimos subir el adjunto. Revisá la conexión y probá de nuevo." };
  return { ok: true, path };
}

async function borrarAdjunto(supabase: Supabase, path: string | null) {
  if (path) await supabase.storage.from("documentos").remove([path]);
}

function revalidarRegistro(clienteId: string, registroId?: string) {
  revalidatePath("/comunicaciones");
  if (registroId) revalidatePath(`/comunicaciones/registros/${registroId}`);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/mi-cuenta", "layout");
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const fechaISO = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "La fecha no es válida");

const schemaRegistro = z
  .object({
    clienteId: uuid("Elegí a quién va dirigido"),
    tipo: z.enum(TIPOS, { error: "Elegí si es notificación, apercibimiento o sanción" }),
    titulo: z
      .string()
      .trim()
      .min(1, "Poné un título (ej.: Falta de limpieza del puesto)")
      .max(200, "El título es demasiado largo (hasta 200 letras)"),
    detalle: z
      .string()
      .trim()
      .max(8000, "El detalle es demasiado largo")
      .optional()
      .transform((v) => (v ? v : undefined)),
    fecha: fechaISO,
    espacioId: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || RE_UUID.test(v), "Elegí un puesto de la lista"),
    multa: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, "") : ""))
      .transform((v) => (v ? Number(v) : undefined))
      .refine((v) => v === undefined || v > 0, "La multa tiene que ser mayor a cero"),
    multaVencimiento: fechaISO,
    ref: uuid("Recargá la página y probá de nuevo"),
  })
  .refine((d) => d.multa === undefined || d.tipo !== "notificacion", {
    message: "Las notificaciones no llevan multa",
  });

export type RegistroEmitido = {
  id: string;
  numero: number;
  tipo: (typeof TIPOS)[number];
  multa: number | null;
  repetido: boolean;
};

async function emitir(
  perfil: Perfil,
  formData: FormData
): Promise<ActionResult<RegistroEmitido>> {
  const parsed = schemaRegistro.safeParse({
    clienteId: formData.get("clienteId"),
    tipo: formData.get("tipo"),
    titulo: formData.get("titulo"),
    detalle: formData.get("detalle") ?? undefined,
    fecha: formData.get("fecha") ?? undefined,
    espacioId: formData.get("espacioId") ?? undefined,
    multa: formData.get("multa") ?? undefined,
    multaVencimiento: formData.get("multaVencimiento") ?? undefined,
    ref: formData.get("ref"),
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;

  const supabase = await createClient();
  const gestionable = await clienteDeMiRol(supabase, d.clienteId, perfil);
  if (!gestionable.ok) return fallo(gestionable.error);

  const subida = await subirAdjunto(supabase, perfil.org_id, d.clienteId, formData.get("archivo"));
  if (!subida.ok) return fallo(subida.error);

  const { data, error } = await supabase.rpc("emitir_registro", {
    p_cliente: d.clienteId,
    p_tipo: d.tipo,
    p_titulo: d.titulo,
    p_detalle: d.detalle,
    p_fecha: d.fecha,
    p_storage_path: subida.path ?? undefined,
    p_espacio: d.espacioId,
    p_multa: d.multa,
    p_multa_vencimiento: d.multa !== undefined ? d.multaVencimiento : undefined,
    p_ref: d.ref,
  });
  if (error) {
    await borrarAdjunto(supabase, subida.path);
    return fallo(error);
  }

  const r = data as { id: string; numero: number; multa: number | null; repetido: boolean };
  // Doble toque: el registro ya existía con su propio documento; el archivo de este intento sobra.
  if (r.repetido) await borrarAdjunto(supabase, subida.path);

  revalidarRegistro(d.clienteId, r.id);
  revalidatePath("/cobranza");
  return ok({
    id: r.id,
    numero: Number(r.numero),
    tipo: d.tipo,
    multa: r.multa === null ? null : Number(r.multa),
    repetido: Boolean(r.repetido),
  });
}

/** Emite una notificación, un apercibimiento o una sanción (con multa opcional). */
export async function emitirRegistro(formData: FormData): Promise<ActionResult<RegistroEmitido>> {
  const perfil = await requireRol("admin", "lider");
  return emitir(perfil, formData);
}

/**
 * DEPRECADA (la usa `NuevaSancion` hasta que la ficha monte `RegistrosCliente`).
 * Misma firma de siempre; ahora pasa por `emitir_registro` (las escrituras directas en
 * `sanciones` se cierran en 0022).
 */
export async function crearSancion(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "lider");
  if (!formData.get("ref")) formData.set("ref", crypto.randomUUID());
  const res = await emitir(perfil, formData);
  return res.ok ? ok({ id: res.data.id }) : res;
}

const schemaRespuesta = z.object({
  registroId: uuid("Registro inexistente"),
  mensaje: z
    .string()
    .trim()
    .min(1, "Escribí la respuesta antes de enviarla")
    .max(4000, "El mensaje es demasiado largo (hasta 4000 letras)"),
  /** Clave de idempotencia por intento (opcional: sin ella, cada envío es un mensaje nuevo). */
  ref: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || RE_UUID.test(v), "Recargá la página y probá de nuevo"),
});

function leerRespuesta(formData: FormData) {
  return schemaRespuesta.safeParse({
    registroId: formData.get("registroId"),
    mensaje: formData.get("mensaje"),
    ref: formData.get("ref") ?? undefined,
  });
}

/** Resultado de un mensaje del hilo: `repetido` = ese intento ya había llegado (misma clave). */
export type MensajeEnviado = { repetido: boolean };

/** Administración o el Líder responden en el hilo del registro (D5, D6). */
export async function responderRegistro(formData: FormData): Promise<ActionResult<MensajeEnviado>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = leerRespuesta(formData);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("sanciones")
    .select("id, cliente_id, org_id")
    .eq("id", parsed.data.registroId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!reg) return fallo("Registro inexistente.");
  const gestionable = await clienteDeMiRol(supabase, reg.cliente_id, perfil);
  if (!gestionable.ok) return fallo(gestionable.error);

  const subida = await subirAdjunto(supabase, perfil.org_id, reg.cliente_id, formData.get("adjunto"));
  if (!subida.ok) return fallo(subida.error);

  const envio = await insertarMensaje(supabase, {
    org_id: perfil.org_id,
    registro_id: reg.id,
    mensaje: parsed.data.mensaje,
    adjunto_path: subida.path,
    ref: parsed.data.ref,
  });
  if (!envio.ok) return fallo(envio.error);

  revalidarRegistro(reg.cliente_id, reg.id);
  return ok({ repetido: envio.repetido });
}

/** Deja sin efecto la multa de un registro (anula el cargo MULT si no tiene cobros). */
export async function dejarSinEfectoMulta(input: unknown): Promise<ActionResult> {
  await requireRol("admin", "lider");
  const parsed = z
    .object({
      registroId: uuid("Registro inexistente"),
      motivo: z
        .string()
        .trim()
        .min(1, "Contá por qué la multa queda sin efecto")
        .max(2000, "El motivo es demasiado largo"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("sanciones")
    .select("cliente_id")
    .eq("id", parsed.data.registroId)
    .maybeSingle();
  if (!reg) return fallo("Registro inexistente.");

  const { error } = await supabase.rpc("dejar_sin_efecto_multa", {
    p_registro: parsed.data.registroId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarRegistro(reg.cliente_id, parsed.data.registroId);
  revalidatePath("/cobranza");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Socio (portal)
// ---------------------------------------------------------------------------

/** El socio presenta su descargo (apercibimiento/sanción) o responde una notificación. */
export async function presentarDescargo(formData: FormData): Promise<ActionResult<MensajeEnviado>> {
  await requireRol("socio");
  const parsed = leerRespuesta(formData);
  if (!parsed.success) {
    const msg = parsed.error.issues[0].message;
    return fallo(msg.startsWith("Escribí") ? "Escribí lo que querés contar antes de enviarlo" : msg);
  }

  const supabase = await createClient();
  // La RLS solo deja ver los registros propios.
  const { data: reg } = await supabase
    .from("sanciones")
    .select("id, cliente_id, org_id")
    .eq("id", parsed.data.registroId)
    .maybeSingle();
  if (!reg) return fallo("Registro inexistente.");

  const subida = await subirAdjunto(supabase, reg.org_id, reg.cliente_id, formData.get("adjunto"));
  if (!subida.ok) return fallo(subida.error);

  const envio = await insertarMensaje(supabase, {
    org_id: reg.org_id,
    registro_id: reg.id,
    mensaje: parsed.data.mensaje,
    adjunto_path: subida.path,
    ref: parsed.data.ref,
  });
  if (!envio.ok) {
    const e = envio.error as { message?: string } | null;
    if (e?.message?.includes("Sin perfil activo"))
      return fallo("Tu acceso al portal está desactivado. Consultá en administración.");
    return fallo(envio.error);
  }

  revalidatePath(`/mi-cuenta/comunicaciones/${reg.id}`);
  revalidatePath("/mi-cuenta", "layout");
  revalidatePath("/comunicaciones");
  revalidatePath(`/comunicaciones/registros/${reg.id}`);
  return ok({ repetido: envio.repetido });
}

/** Alias del contrato (§6 M5): la respuesta del socio a una notificación usa el mismo hilo. */
export async function responderComoSocio(formData: FormData): Promise<ActionResult<MensajeEnviado>> {
  return presentarDescargo(formData);
}

/**
 * El socio abrió el detalle (se llama SIEMPRE al abrir): primera vista y "Respuesta nueva".
 * Revalida el layout del portal para que el contador de "nuevas" quede al día.
 */
export async function marcarRegistroVisto(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("socio");
  // Vista previa del superadministrador: no marca nada en nombre del cliente.
  if (perfil.vistaClienteId) return ok(undefined);
  const parsed = z.object({ registroId: uuid("Registro inexistente") }).safeParse(input);
  if (!parsed.success) return fallo("Registro inexistente.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_registro_visto", {
    p_registro: parsed.data.registroId,
  });
  if (error) return fallo(error);
  revalidatePath("/mi-cuenta", "layout");
  revalidatePath("/comunicaciones");
  return ok(undefined);
}
