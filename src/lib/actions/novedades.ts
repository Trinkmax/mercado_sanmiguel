"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Perfil } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import {
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
  rutaAdjuntoNovedad,
} from "@/lib/storage";
import { formatFechaLarga, hoyISO } from "@/lib/format";
import type { TablesInsert } from "@/lib/database.types";
import { LABEL_SECTOR } from "@/components/personal/constantes";
import {
  DEF_TIPO,
  LABEL_TIPO_NOVEDAD,
  diasCorridos,
  sectoresDeRol,
  type EstadoNovedad,
  type TipoNovedad,
} from "@/components/novedades/constantes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TIPOS = [
  "falta",
  "llegada_tarde",
  "feriado_trabajado",
  "vacaciones",
  "licencia",
  "horas_extra",
  "otra",
] as const;

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Datos de la novedad (mismos campos al cargar y al editar). La base vuelve a validar todo. */
const schemaDatos = z
  .object({
    tipo: z.enum(TIPOS, { error: "Elegí qué pasó" }),
    fechaDesde: z.string().trim().regex(REGEX_FECHA, "Elegí la fecha"),
    fechaHasta: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || REGEX_FECHA.test(v), "La fecha de fin no es válida"),
    horas: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v.replace(",", ".")) : null))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 24), "Las horas van de un poco más de 0 a 24"),
    justificada: z
      .enum(["si", "no", ""])
      .optional()
      .transform((v) => (v === "si" ? true : v === "no" ? false : null)),
    detalle: z
      .string()
      .trim()
      .max(2000, "El detalle es demasiado largo")
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((d, ctx) => {
    const def = DEF_TIPO[d.tipo];
    if (!def.futuro && d.fechaDesde > hoyISO())
      ctx.addIssue({ code: "custom", message: "Esa novedad no puede tener fecha futura" });
    if (def.fechas === "rango" && d.fechaHasta && d.fechaHasta < d.fechaDesde)
      ctx.addIssue({ code: "custom", message: "La fecha de fin no puede ser antes del inicio" });
    if (def.fechas === "rango" && d.fechaHasta && diasCorridos(d.fechaDesde, d.fechaHasta) > 366)
      ctx.addIssue({ code: "custom", message: "Revisá las fechas: son más de un año" });
    if (def.horas === "minutos" && d.horas === null)
      ctx.addIssue({ code: "custom", message: "Elegí cuántos minutos llegó tarde" });
    if (def.horas === "horas" && d.horas === null)
      ctx.addIssue({ code: "custom", message: "Elegí cuántas horas extra hizo" });
    if (def.justificada && d.justificada === null)
      ctx.addIssue({ code: "custom", message: "Elegí si está justificada" });
    if (def.detalleObligatorio && !d.detalle)
      ctx.addIssue({ code: "custom", message: "Contá qué pasó" });
  })
  .transform((d) => {
    const def = DEF_TIPO[d.tipo];
    return {
      tipo: d.tipo as TipoNovedad,
      fecha_desde: d.fechaDesde,
      fecha_hasta: def.fechas === "rango" && d.fechaHasta && d.fechaHasta !== d.fechaDesde ? d.fechaHasta : null,
      horas: def.horas === "no" ? null : d.horas,
      justificada: def.justificada ? d.justificada : null,
      detalle: d.detalle,
    };
  });

function leerDatos(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return schemaDatos.safeParse({
    tipo: get("tipo"),
    fechaDesde: get("fechaDesde"),
    fechaHasta: get("fechaHasta"),
    horas: get("horas"),
    justificada: get("justificada") ?? "",
    detalle: get("detalle"),
  });
}

/** Valida el adjunto (certificado). Null si no vino ninguno. */
function leerAdjunto(formData: FormData): File | null | { error: string } {
  const archivo = formData.get("adjunto");
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (!MIME_PERMITIDOS.includes(archivo.type))
    return { error: "El adjunto tiene que ser una foto (JPG, PNG o WEBP) o un PDF." };
  if (archivo.size > TAMANO_MAX_BYTES) return { error: "El adjunto no puede pesar más de 20 MB." };
  return archivo;
}

async function subirAdjunto(supabase: Supabase, orgId: string, archivo: File): Promise<ActionResult<string>> {
  const ruta = rutaAdjuntoNovedad(orgId, archivo.name);
  const { error } = await supabase.storage
    .from("documentos")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (error) return fallo("No pudimos subir la foto. Revisá la conexión y probá de nuevo.");
  return ok(ruta);
}

/** Borra un adjunto si ya ninguna novedad lo usa (una carga múltiple comparte el certificado). */
async function borrarAdjuntoSiHuerfano(supabase: Supabase, ruta: string | null) {
  if (!ruta) return;
  const { count } = await supabase
    .from("novedades_personal")
    .select("id", { count: "exact", head: true })
    .eq("adjunto_path", ruta);
  if ((count ?? 0) === 0) await supabase.storage.from("documentos").remove([ruta]);
}

type Choque = { empleado_id: string; fecha_desde: string };

/**
 * Aviso amable antes de que la base lo rechace: "Pedro Portero ya tiene una falta cargada el
 * martes 23 de septiembre". La regla la impone el trigger preparar_novedad.
 */
async function buscarChoque(
  supabase: Supabase,
  empleadoIds: string[],
  datos: { tipo: TipoNovedad; fecha_desde: string; fecha_hasta: string | null },
  excluirId?: string
): Promise<Choque | null> {
  if (datos.tipo === "otra") return null;
  const hasta = datos.fecha_hasta ?? datos.fecha_desde;
  let q = supabase
    .from("novedades_personal")
    .select("id, empleado_id, fecha_desde, fecha_hasta")
    .in("empleado_id", empleadoIds)
    .eq("tipo", datos.tipo)
    .in("estado", ["pendiente", "aprobada"])
    .lte("fecha_desde", hasta);
  if (excluirId) q = q.neq("id", excluirId);
  const { data } = await q;
  const choque = (data ?? []).find((n) => (n.fecha_hasta ?? n.fecha_desde) >= datos.fecha_desde);
  return choque ? { empleado_id: choque.empleado_id, fecha_desde: choque.fecha_desde } : null;
}

function revalidarNovedades(empleadoIds: string[]) {
  revalidatePath("/novedades", "layout");
  revalidatePath("/inicio");
  revalidatePath("/personal");
  if (empleadoIds.length === 0) revalidatePath("/personal/[id]", "page");
  for (const id of empleadoIds) revalidatePath(`/personal/${id}`);
}

type EmpleadoAlcance = { id: string; nombre: string; apellido: string; sector: string };

/** Los empleados tienen que ser de mi organización y de un sector que puedo cargar. */
async function empleadosEnAlcance(
  supabase: Supabase,
  perfil: Perfil,
  ids: string[]
): Promise<ActionResult<EmpleadoAlcance[]>> {
  const { data } = await supabase
    .from("empleados")
    .select("id, nombre, apellido, sector")
    .eq("org_id", perfil.org_id)
    .in("id", ids);
  const encontrados = data ?? [];
  if (encontrados.length !== ids.length)
    return fallo("Alguno de los empleados ya no está en el padrón. Actualizá la página.");
  const alcance = sectoresDeRol(perfil.rol);
  const fuera = encontrados.find((e) => !alcance.includes(e.sector as (typeof alcance)[number]));
  if (fuera)
    return fallo(
      `No podés cargar novedades de ${LABEL_SECTOR[fuera.sector as keyof typeof LABEL_SECTOR] ?? "ese sector"} (${fuera.nombre} ${fuera.apellido}).`
    );
  return ok(encontrados);
}

function mensajeChoque(choque: Choque, empleados: EmpleadoAlcance[], tipo: TipoNovedad): string {
  const e = empleados.find((x) => x.id === choque.empleado_id);
  const quien = e ? `${e.nombre} ${e.apellido}` : "Ese empleado";
  const que = LABEL_TIPO_NOVEDAD[tipo].toLowerCase();
  return `${quien} ya tiene ${tipo === "vacaciones" || tipo === "horas_extra" ? que : `una ${que}`} cargada el ${formatFechaLarga(choque.fecha_desde)}. Revisala en la planilla.`;
}

/**
 * Carga una novedad para uno o varios empleados (un feriado que trabajaron varios = una fila por
 * empleado, en un solo insert: entran todas o ninguna). Lo del Jefe queda "Esperando aprobación";
 * lo de Administración y el Líder, aprobado (lo decide el trigger).
 */
export async function cargarNovedad(
  formData: FormData
): Promise<ActionResult<{ cantidad: number; estado: EstadoNovedad; ids: string[] }>> {
  const perfil = await requireRol("admin", "guardia", "lider");

  const empleadoIds = Array.from(
    new Set(formData.getAll("empleadoId").filter((v): v is string => typeof v === "string" && v.length > 0))
  );
  if (empleadoIds.length === 0) return fallo("Elegí a quién le pasó");
  if (empleadoIds.length > 60) return fallo("Son demasiados empleados juntos: cargalo en dos veces");

  const parsed = leerDatos(formData);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const adjunto = leerAdjunto(formData);
  if (adjunto && "error" in adjunto) return fallo(adjunto.error);

  const supabase = await createClient();
  const empleados = await empleadosEnAlcance(supabase, perfil, empleadoIds);
  if (!empleados.ok) return fallo(empleados.error);

  const choque = await buscarChoque(supabase, empleadoIds, parsed.data);
  if (choque) return fallo(mensajeChoque(choque, empleados.data, parsed.data.tipo));

  let ruta: string | null = null;
  if (adjunto) {
    const subido = await subirAdjunto(supabase, perfil.org_id, adjunto);
    if (!subido.ok) return fallo(subido.error);
    ruta = subido.data;
  }

  // `sector`, `estado` y `cargada_por` los pone el trigger (no están en el grant de INSERT).
  const filas = empleadoIds.map((empleado_id) => ({
    org_id: perfil.org_id,
    empleado_id,
    ...parsed.data,
    adjunto_path: ruta,
  })) as TablesInsert<"novedades_personal">[];

  const { data, error } = await supabase
    .from("novedades_personal")
    .insert(filas)
    .select("id, estado");

  if (error) {
    if (ruta) await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error);
  }

  revalidarNovedades(empleadoIds);
  const estado: EstadoNovedad = data?.[0]?.estado ?? (perfil.rol === "guardia" ? "pendiente" : "aprobada");
  return ok({ cantidad: data?.length ?? filas.length, estado, ids: (data ?? []).map((d) => d.id) });
}

/**
 * Corrige una novedad que todavía espera aprobación (quien la cargó, o Administración / Líder).
 * Una aprobada no se edita: se anula con motivo y se carga de nuevo (queda el rastro).
 */
export async function editarNovedad(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("admin", "guardia", "lider");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return fallo("Esa novedad ya no existe. Actualizá la página.");

  const parsed = leerDatos(formData);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const adjunto = leerAdjunto(formData);
  if (adjunto && "error" in adjunto) return fallo(adjunto.error);
  const quitarAdjunto = formData.get("quitarAdjunto") === "true";

  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("novedades_personal")
    .select("id, empleado_id, estado, cargada_por, adjunto_path, empleado:empleados(id, nombre, apellido, sector)")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!actual) return fallo("Esa novedad ya no existe. Actualizá la página.");
  if (actual.estado !== "pendiente")
    return fallo(
      actual.estado === "aprobada"
        ? "Ya está aprobada: no se cambia. Si está mal, pedí que la anulen y cargala de nuevo."
        : "Esta novedad ya fue revisada: no se puede cambiar."
    );
  if (perfil.rol === "guardia" && actual.cargada_por !== perfil.user_id)
    return fallo("Solo quien la cargó la puede corregir.");

  const empleadoFila = actual.empleado
    ? [{ id: actual.empleado.id, nombre: actual.empleado.nombre, apellido: actual.empleado.apellido, sector: actual.empleado.sector }]
    : [];
  const choque = await buscarChoque(supabase, [actual.empleado_id], parsed.data, actual.id);
  if (choque) return fallo(mensajeChoque(choque, empleadoFila, parsed.data.tipo));

  let rutaNueva: string | null = null;
  if (adjunto) {
    const subido = await subirAdjunto(supabase, perfil.org_id, adjunto);
    if (!subido.ok) return fallo(subido.error);
    rutaNueva = subido.data;
  }
  const adjuntoFinal = rutaNueva ?? (quitarAdjunto ? null : actual.adjunto_path);

  const { data: guardada, error } = await supabase
    .from("novedades_personal")
    .update({ ...parsed.data, adjunto_path: adjuntoFinal })
    .eq("id", actual.id)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();

  if (error || !guardada) {
    if (rutaNueva) await supabase.storage.from("documentos").remove([rutaNueva]);
    return error
      ? fallo(error)
      : fallo("No se pudo guardar: puede que ya la hayan revisado. Actualizá la página.");
  }

  if (actual.adjunto_path && actual.adjunto_path !== adjuntoFinal)
    await borrarAdjuntoSiHuerfano(supabase, actual.adjunto_path);

  revalidarNovedades([actual.empleado_id]);
  return ok({ id: actual.id });
}

const schemaId = z.object({ id: z.string().min(1, "Esa novedad ya no existe") });

/**
 * Borra una novedad que todavía espera aprobación, solo quien la cargó (Administración no
 * borra lo del Jefe: lo rechaza con motivo). Lo aprobado no se borra: se anula.
 */
export async function borrarNovedad(input: unknown): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "guardia", "lider");
  const parsed = schemaId.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: borrada, error } = await supabase
    .from("novedades_personal")
    .delete()
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("estado", "pendiente")
    .eq("cargada_por", perfil.user_id)
    .select("id, empleado_id, adjunto_path")
    .maybeSingle();
  if (error) return fallo(error);
  if (!borrada)
    return fallo("No se pudo borrar: ya la revisaron o no la cargaste vos. Actualizá la página.");

  await borrarAdjuntoSiHuerfano(supabase, borrada.adjunto_path);
  revalidarNovedades([borrada.empleado_id]);
  return ok(undefined);
}

const schemaRevisar = z.object({
  id: z.string().min(1, "Esa novedad ya no existe"),
  aprobar: z.boolean(),
  motivo: z
    .string()
    .trim()
    .max(2000, "El motivo es demasiado largo")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

/** Administración (o el Líder) aprueba o rechaza lo que cargó el Jefe de Portería. */
export async function revisarNovedad(input: unknown): Promise<ActionResult<{ estado: EstadoNovedad }>> {
  await requireRol("admin", "lider");
  const parsed = schemaRevisar.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  if (!parsed.data.aprobar && !parsed.data.motivo) return fallo("Contá por qué se rechaza");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revisar_novedad", {
    p_novedad: parsed.data.id,
    p_aprobar: parsed.data.aprobar,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarNovedades([]);
  return ok({ estado: data });
}

const schemaIds = z.object({
  ids: z.array(z.string().min(1)).min(1, "No hay novedades para aprobar").max(500),
});

/** "Aprobar todas (N)": aprueba las pendientes de la lista que estén en mi alcance. */
export async function aprobarNovedades(input: unknown): Promise<ActionResult<{ cantidad: number }>> {
  await requireRol("admin", "lider");
  const parsed = schemaIds.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprobar_novedades", { p_ids: parsed.data.ids });
  if (error) return fallo(error);

  revalidarNovedades([]);
  return ok({ cantidad: data ?? 0 });
}

const schemaAnular = z.object({
  id: z.string().min(1, "Esa novedad ya no existe"),
  motivo: z.string().trim().min(1, "Contá por qué la anulás").max(2000, "El motivo es demasiado largo"),
});

/** Anula una novedad aprobada que resultó errónea: queda quién, cuándo y por qué. */
export async function anularNovedad(input: unknown): Promise<ActionResult<void>> {
  await requireRol("admin", "lider");
  const parsed = schemaAnular.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_novedad", {
    p_novedad: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error);

  revalidarNovedades([]);
  return ok(undefined);
}
