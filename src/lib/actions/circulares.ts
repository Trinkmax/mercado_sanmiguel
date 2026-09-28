"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { rutaCircular, TAMANO_MAX_BYTES } from "@/lib/storage";
import { hoyISO } from "@/lib/format";
import { todasLasFilasOError } from "@/components/comunicaciones/datos";
import {
  armarPublico,
  clienteEnPublico,
  OPCIONES_PUBLICO,
  type CategoriaCliente,
  type SegmentoPublico,
} from "@/lib/segmentos";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALORES_SEGMENTO = OPCIONES_PUBLICO.map((o) => o.valor) as [SegmentoPublico, ...SegmentoPublico[]];

const schemaCircular = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Poné el título de la circular (ej.: Horario de ingreso de camiones)")
    .max(200, "El título es demasiado largo"),
  detalle: z
    .string()
    .trim()
    .max(8000, "El detalle es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
  fecha: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : hoyISO()))
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "La fecha no es válida"),
  obligatoria: z.boolean(),
  todos: z.boolean(),
  segmentos: z.array(z.enum(VALORES_SEGMENTO, { error: "Elegí a quién le llega" })),
  soloSocios: z.boolean(),
  /** Clave de idempotencia por intento (0025): un reintento no duplica la circular. */
  ref: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || RE_UUID.test(v), "Recargá la página y probá de nuevo"),
});

export type CircularPublicada = {
  id: string;
  numero: number;
  destinatarios: number;
  /** Ya estaba publicada con esa clave (reintento después de un corte). */
  repetido: boolean;
};

function leerSegmentos(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || !v) return [];
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * Publica una circular para un público (D2): "Todos" o la unión de segmentos elegidos,
 * más el filtro "Solo socios". `publico = armarPublico(elección)` (null = todos).
 */
export async function crearCircular(
  formData: FormData
): Promise<ActionResult<CircularPublicada>> {
  const perfil = await requireRol("admin", "lider");

  const parsed = schemaCircular.safeParse({
    titulo: formData.get("titulo"),
    detalle: formData.get("detalle") ?? undefined,
    fecha: formData.get("fecha") ?? undefined,
    obligatoria: formData.get("obligatoria") === "true",
    todos: formData.get("todos") === "true",
    segmentos: leerSegmentos(formData.get("segmentos")),
    soloSocios: formData.get("soloSocios") === "true",
    ref: formData.get("ref") ?? undefined,
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;
  if (!d.todos && d.segmentos.length === 0)
    return fallo("Elegí a quién le llega: Todos o al menos un grupo");

  // Sin texto ni PDF el socio vería (y tendría que confirmar) una circular vacía.
  const archivo = formData.get("archivo");
  const conPdf = archivo instanceof File && archivo.size > 0;
  if (!d.detalle && !conPdf) return fallo("Escribí qué dice la circular o adjuntá el PDF");

  const publico = armarPublico({ todos: d.todos, segmentos: d.segmentos, soloSocios: d.soloSocios });

  const supabase = await createClient();

  // Nadie en el público = una circular que no le llega a nadie: se avisa antes de publicar.
  // Paginado: la vista puede pasar las 1000 filas (tope de PostgREST).
  // Si la lectura falla (corte, timeout) se avisa: contar 0 diría "nadie entra" y es falso.
  const { filas: clientes, error: errorClientes } = await todasLasFilasOError((desde, hasta) =>
    supabase
      .from("v_clientes_segmentos")
      .select("cliente_id, categoria, segmentos, activo")
      .eq("activo", true)
      .order("cliente_id")
      .range(desde, hasta)
  );
  if (errorClientes) return fallo(errorClientes);
  const contar = (p: string[] | null) =>
    clientes.filter((c) =>
      c.categoria
        ? clienteEnPublico({ categoria: c.categoria as CategoriaCliente, segmentos: c.segmentos ?? [] }, p)
        : false
    ).length;

  // Reintento después de un corte: si ya se publicó con esta clave, se devuelve esa.
  const yaPublicada = async (): Promise<ActionResult<CircularPublicada> | null> => {
    if (!d.ref) return null;
    const { data: ya } = await supabase
      .from("circulares")
      .select("id, numero, publico")
      .eq("org_id", perfil.org_id)
      .eq("ref", d.ref)
      .maybeSingle();
    return ya ? ok({ id: ya.id, numero: ya.numero, destinatarios: contar(ya.publico), repetido: true }) : null;
  };
  const previa = await yaPublicada();
  if (previa) return previa;

  const destinatarios = contar(publico);
  if (destinatarios === 0) return fallo("Nadie entra en ese público: elegí otros grupos");

  let storagePath: string | null = null;
  if (conPdf) {
    if (archivo.type !== "application/pdf")
      return fallo("La circular adjunta tiene que ser un PDF.");
    if (archivo.size > TAMANO_MAX_BYTES)
      return fallo("El PDF no puede pesar más de 20 MB.");
    storagePath = rutaCircular(perfil.org_id, archivo.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(storagePath, archivo, { contentType: archivo.type });
    if (errorSubida) return fallo("No pudimos subir el PDF. Revisá la conexión y probá de nuevo.");
  }

  const { data, error } = await supabase
    .from("circulares")
    .insert({
      org_id: perfil.org_id,
      titulo: d.titulo,
      detalle: d.detalle,
      fecha: d.fecha,
      obligatoria: d.obligatoria,
      storage_path: storagePath,
      creada_por: perfil.user_id,
      publico,
      ref: d.ref,
    })
    .select("id, numero")
    .single();

  if (error) {
    if (storagePath) await supabase.storage.from("documentos").remove([storagePath]);
    // Dos toques a la vez con la misma clave: ganó el otro, se devuelve esa circular.
    if (error.code === "23505") {
      const otra = await yaPublicada();
      if (otra) return otra;
    }
    return fallo(error);
  }

  revalidatePath("/comunicaciones");
  revalidatePath("/mi-cuenta", "layout");
  return ok({ id: data.id, numero: data.numero, destinatarios, repetido: false });
}

/** Da de baja una circular: deja de mostrarse en el portal y de bloquear. */
export async function desactivarCircular(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("admin", "lider");
  const parsed = z.object({ id: z.string().regex(RE_UUID) }).safeParse(input);
  if (!parsed.success) return fallo("Circular inexistente.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("circulares")
    .update({ activa: false })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/comunicaciones");
  revalidatePath(`/comunicaciones/${parsed.data.id}`);
  revalidatePath("/mi-cuenta", "layout");
  return ok(undefined);
}

/**
 * "La vio": una fila en circular_recepciones (la hora la pone el servidor).
 * La RLS exige que la circular esté activa y le llegue a este socio.
 */
async function registrarRecepcion(circularId: string): Promise<ActionResult> {
  const perfil = await requireRol("socio");
  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("auth_user_id", perfil.user_id)
    .maybeSingle();
  if (!cliente)
    return fallo("Tu usuario no está vinculado a un puesto. Consultá en administración.");

  const { error } = await supabase.from("circular_recepciones").insert({
    org_id: perfil.org_id,
    circular_id: circularId,
    cliente_id: cliente.id,
    recibida_por: perfil.user_id,
  });
  // Ya estaba (doble toque o la abrió antes): no es un error para el socio.
  if (error && error.code !== "23505") {
    if (error.code === "42501") return fallo("Esta circular ya no está disponible. Actualizá la página.");
    return fallo(error);
  }
  return ok(undefined);
}

/** El socio toca "Confirmo que la recibí" (obligatorias). */
export async function confirmarRecepcionCircular(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ circularId: z.string().regex(RE_UUID) }).safeParse(input);
  if (!parsed.success) return fallo("Circular inexistente.");
  const res = await registrarRecepcion(parsed.data.circularId);
  if (!res.ok) return res;
  revalidatePath("/mi-cuenta", "layout");
  revalidatePath("/comunicaciones");
  revalidatePath(`/comunicaciones/${parsed.data.circularId}`);
  return ok(undefined);
}

/** Informativas: se registra "la vio" al abrirla (sin botón). */
export async function registrarVistaCircular(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ circularId: z.string().regex(RE_UUID) }).safeParse(input);
  if (!parsed.success) return fallo("Circular inexistente.");
  const res = await registrarRecepcion(parsed.data.circularId);
  if (!res.ok) return res;
  revalidatePath("/mi-cuenta", "layout");
  revalidatePath(`/comunicaciones/${parsed.data.circularId}`);
  return ok(undefined);
}
