"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import {
  rutaContratoEmpleado,
  MIME_PERMITIDOS,
  TAMANO_MAX_BYTES,
} from "@/lib/storage";
import { hoyISO } from "@/lib/format";

const TIPOS_CONTRATO = [
  "planta_permanente",
  "contratado",
  "eventual",
  "monotributista",
  "pasantia",
] as const;

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const textoOpcional = (max: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(max, mensaje)
    .optional()
    .transform((v) => (v ? v : null));

const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || REGEX_FECHA.test(v), "La fecha no es válida");

/** Datos del empleado: mismos campos en el alta y en la edición. */
const schemaEmpleado = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre del empleado")
    .max(120, "El nombre es demasiado largo"),
  apellido: z
    .string()
    .trim()
    .min(1, "Poné el apellido del empleado")
    .max(120, "El apellido es demasiado largo"),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, "El DNI tiene que tener 7 u 8 números, sin puntos"),
  cuil: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || /^\d{2}-?\d{7,8}-?\d$/.test(v),
      "El CUIL no es válido (ej.: 20-12345678-3)"
    ),
  cargo: textoOpcional(120, "El cargo es demasiado largo"),
  telefono: textoOpcional(40, "El teléfono es demasiado largo"),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine(
      (v) => v === null || z.email().safeParse(v).success,
      "El email no es válido"
    ),
  tipo_contrato: z.enum(TIPOS_CONTRATO, { error: "Elegí el tipo de contrato" }),
  fecha_ingreso: fechaOpcional,
  fecha_egreso: fechaOpcional,
  observaciones: textoOpcional(4000, "Las observaciones son demasiado largas"),
});

function leerDatos(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return schemaEmpleado.safeParse({
    nombre: get("nombre"),
    apellido: get("apellido"),
    dni: get("dni"),
    cuil: get("cuil"),
    cargo: get("cargo"),
    telefono: get("telefono"),
    email: get("email"),
    tipo_contrato: get("tipo_contrato"),
    fecha_ingreso: get("fecha_ingreso"),
    fecha_egreso: get("fecha_egreso"),
    observaciones: get("observaciones"),
  });
}

/** Valida el archivo del contrato (opcional). Devuelve null si no vino ninguno. */
function leerContrato(formData: FormData): File | null | { error: string } {
  const archivo = formData.get("contrato");
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (!MIME_PERMITIDOS.includes(archivo.type))
    return { error: "El contrato tiene que ser PDF o imagen (JPG, PNG o WEBP)." };
  if (archivo.size > TAMANO_MAX_BYTES)
    return { error: "El contrato no puede pesar más de 20 MB." };
  return archivo;
}

function esDuplicadoDni(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /empleados_org_id_dni_key/.test(error.message ?? "");
}

const MENSAJE_DNI_DUPLICADO = "Ya hay un empleado con ese DNI";

/** Alta de empleado (solo Líder de Procesos). Contrato opcional como PDF/imagen. */
export async function crearEmpleado(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("lider");
  const parsed = leerDatos(formData);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const contrato = leerContrato(formData);
  if (contrato && "error" in contrato) return fallo(contrato.error);

  const datos = parsed.data;
  if (datos.fecha_egreso && datos.fecha_ingreso && datos.fecha_egreso < datos.fecha_ingreso)
    return fallo("La fecha de egreso no puede ser anterior a la de ingreso");

  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("empleados")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("dni", datos.dni)
    .maybeSingle();
  if (existente) return fallo(MENSAJE_DNI_DUPLICADO);

  let contratoPath: string | null = null;
  if (contrato) {
    contratoPath = rutaContratoEmpleado(perfil.org_id, contrato.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(contratoPath, contrato, { contentType: contrato.type });
    if (errorSubida) return fallo("No pudimos subir el contrato. Probá de nuevo.");
  }

  const { data, error } = await supabase
    .from("empleados")
    .insert({
      org_id: perfil.org_id,
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      cuil: datos.cuil,
      cargo: datos.cargo,
      telefono: datos.telefono,
      email: datos.email,
      tipo_contrato: datos.tipo_contrato,
      fecha_ingreso: datos.fecha_ingreso,
      fecha_egreso: datos.fecha_egreso,
      observaciones: datos.observaciones,
      contrato_path: contratoPath,
      // Si ya tiene fecha de egreso pasada, entra como inactivo.
      activo: !(datos.fecha_egreso && datos.fecha_egreso <= hoyISO()),
      creado_por: perfil.user_id,
    })
    .select("id")
    .single();

  if (error) {
    if (contratoPath) await supabase.storage.from("documentos").remove([contratoPath]);
    if (esDuplicadoDni(error)) return fallo(MENSAJE_DNI_DUPLICADO);
    return fallo(error);
  }

  revalidatePath("/personal");
  return ok({ id: data.id });
}

/** Edición de datos y contrato. Si viene un contrato nuevo, reemplaza al anterior. */
export async function editarEmpleado(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("lider");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return fallo("Empleado inexistente.");
  const parsed = leerDatos(formData);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const contrato = leerContrato(formData);
  if (contrato && "error" in contrato) return fallo(contrato.error);

  const datos = parsed.data;
  if (datos.fecha_egreso && datos.fecha_ingreso && datos.fecha_egreso < datos.fecha_ingreso)
    return fallo("La fecha de egreso no puede ser anterior a la de ingreso");

  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("empleados")
    .select("id, contrato_path")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!actual) return fallo("Empleado inexistente.");

  const { data: otro } = await supabase
    .from("empleados")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("dni", datos.dni)
    .neq("id", id)
    .maybeSingle();
  if (otro) return fallo(MENSAJE_DNI_DUPLICADO);

  let contratoPath = actual.contrato_path;
  if (contrato) {
    contratoPath = rutaContratoEmpleado(perfil.org_id, contrato.name);
    const { error: errorSubida } = await supabase.storage
      .from("documentos")
      .upload(contratoPath, contrato, { contentType: contrato.type });
    if (errorSubida) return fallo("No pudimos subir el contrato. Probá de nuevo.");
  }

  const { error } = await supabase
    .from("empleados")
    .update({
      nombre: datos.nombre,
      apellido: datos.apellido,
      dni: datos.dni,
      cuil: datos.cuil,
      cargo: datos.cargo,
      telefono: datos.telefono,
      email: datos.email,
      tipo_contrato: datos.tipo_contrato,
      fecha_ingreso: datos.fecha_ingreso,
      fecha_egreso: datos.fecha_egreso,
      observaciones: datos.observaciones,
      contrato_path: contratoPath,
    })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (error) {
    if (contrato && contratoPath)
      await supabase.storage.from("documentos").remove([contratoPath]);
    if (esDuplicadoDni(error)) return fallo(MENSAJE_DNI_DUPLICADO);
    return fallo(error);
  }

  // Mejor esfuerzo: el contrato viejo ya no se referencia.
  if (contrato && actual.contrato_path && actual.contrato_path !== contratoPath) {
    await supabase.storage.from("documentos").remove([actual.contrato_path]);
  }

  revalidatePath("/personal");
  revalidatePath(`/personal/${id}`);
  return ok({ id });
}

const schemaHorarios = z.object({
  empleadoId: z.string().min(1),
  franjas: z
    .array(
      z.object({
        dia_semana: z.number().int().min(1).max(7),
        hora_desde: z.string().regex(REGEX_HORA, "Poné la hora de entrada"),
        hora_hasta: z.string().regex(REGEX_HORA, "Poné la hora de salida"),
      })
    )
    .max(50, "Son demasiadas franjas"),
});

const NOMBRE_DIA = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Reemplaza TODOS los horarios del empleado por las franjas recibidas
 * (borra e inserta). Valida que cada franja termine después de empezar y que
 * no se pisen dentro del mismo día. */
export async function guardarHorarios(
  input: unknown
): Promise<ActionResult<{ cantidad: number }>> {
  const perfil = await requireRol("lider");
  const parsed = schemaHorarios.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { empleadoId, franjas } = parsed.data;

  const normalizadas = franjas.map((f) => ({
    dia_semana: f.dia_semana,
    hora_desde: f.hora_desde.slice(0, 5),
    hora_hasta: f.hora_hasta.slice(0, 5),
  }));

  for (const f of normalizadas) {
    if (f.hora_hasta <= f.hora_desde)
      return fallo(
        `El ${NOMBRE_DIA[f.dia_semana]}: la hora de salida tiene que ser después de la de entrada`
      );
  }
  for (let d = 1; d <= 7; d++) {
    const delDia = normalizadas
      .filter((f) => f.dia_semana === d)
      .sort((a, b) => a.hora_desde.localeCompare(b.hora_desde));
    for (let i = 1; i < delDia.length; i++) {
      if (delDia[i].hora_desde < delDia[i - 1].hora_hasta)
        return fallo(`El ${NOMBRE_DIA[d]} tiene dos franjas que se pisan`);
    }
  }

  const supabase = await createClient();
  const { data: empleado } = await supabase
    .from("empleados")
    .select("id")
    .eq("id", empleadoId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!empleado) return fallo("Empleado inexistente.");

  const { error: errorBorrado } = await supabase
    .from("empleado_horarios")
    .delete()
    .eq("empleado_id", empleadoId)
    .eq("org_id", perfil.org_id);
  if (errorBorrado) return fallo(errorBorrado);

  if (normalizadas.length > 0) {
    const { error } = await supabase.from("empleado_horarios").insert(
      normalizadas.map((f) => ({
        org_id: perfil.org_id,
        empleado_id: empleadoId,
        dia_semana: f.dia_semana,
        hora_desde: f.hora_desde,
        hora_hasta: f.hora_hasta,
      }))
    );
    if (error) return fallo(error);
  }

  revalidatePath("/personal");
  revalidatePath(`/personal/${empleadoId}`);
  return ok({ cantidad: normalizadas.length });
}

/** Baja lógica: deja de figurar como activo y registra la fecha de egreso. */
export async function darDeBaja(input: unknown): Promise<ActionResult<void>> {
  const perfil = await requireRol("lider");
  const parsed = z
    .object({
      id: z.string().min(1),
      fecha_egreso: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? v : hoyISO()))
        .refine((v) => REGEX_FECHA.test(v), "La fecha de egreso no es válida"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("empleados")
    .update({ activo: false, fecha_egreso: parsed.data.fecha_egreso })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/personal");
  revalidatePath(`/personal/${parsed.data.id}`);
  return ok(undefined);
}

/** Vuelve a dar de alta a un empleado dado de baja. */
export async function reincorporar(input: unknown): Promise<ActionResult<void>> {
  const perfil = await requireRol("lider");
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("empleados")
    .update({ activo: true, fecha_egreso: null })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/personal");
  revalidatePath(`/personal/${parsed.data.id}`);
  return ok(undefined);
}
