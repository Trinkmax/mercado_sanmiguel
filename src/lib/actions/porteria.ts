"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { rutaFirmaIngreso } from "@/lib/storage";
import { TZ_AR } from "@/lib/format";

/** Roles que operan la garita (portería, Jefe de Portería, administración, líder). */
const ROLES_PORTERIA = ["porteria", "guardia", "admin", "lider"] as const;

/** Una firma dibujada en el canvas no debería pesar más que esto. */
const TAMANO_MAX_FIRMA = 2 * 1024 * 1024; // 2 MB

/** Minutos antes de la hora de entrada que todavía cuentan como "en horario"
 * (llegar un rato antes del turno es lo normal, no una irregularidad). */
const TOLERANCIA_ANTES_MIN = 30;

export type EmpleadoBusqueda = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  cargo: string | null;
};

/** Autocompletado de la garita: busca empleados activos por DNI (prefijo) o
 * por apellido/nombre (contiene). Devuelve hasta 8 coincidencias. */
export async function buscarEmpleados(
  texto: string
): Promise<ActionResult<EmpleadoBusqueda[]>> {
  const perfil = await requireRol(...ROLES_PORTERIA);
  const q = String(texto ?? "").trim();
  if (q.length < 2) return ok([]);

  const supabase = await createClient();
  let consulta = supabase
    .from("empleados")
    .select("id, nombre, apellido, dni, cargo")
    .eq("org_id", perfil.org_id)
    .eq("activo", true)
    .order("apellido")
    .order("nombre")
    .limit(8);

  if (/^\d+$/.test(q)) {
    consulta = consulta.like("dni", `${q}%`);
  } else {
    const patron = `%${q.replace(/[,()"\\%_]/g, " ").trim()}%`;
    consulta = consulta.or(`apellido.ilike.${patron},nombre.ilike.${patron}`);
  }

  const { data, error } = await consulta;
  if (error) return fallo(error);
  return ok(data ?? []);
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) y hora "HH:MM" en huso argentino. */
function ahoraAR(): { diaSemana: number; hora: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ_AR,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dias: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    diaSemana: dias[get("weekday")] ?? 1,
    hora: `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`,
  };
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

/**
 * ¿El ingreso cae fuera del horario de trabajo del empleado?
 * - Sin horarios cargados (ninguno en la semana): no se puede juzgar → false.
 * - Con horarios pero ninguno para hoy: vino en un día que no trabaja → true.
 * - Con franjas hoy: en horario si la hora actual está entre
 *   (hora_desde − tolerancia) y hora_hasta de alguna franja.
 */
function calcularFueraDeHorario(
  franjas: { dia_semana: number; hora_desde: string; hora_hasta: string }[]
): boolean {
  if (franjas.length === 0) return false;
  const { diaSemana, hora } = ahoraAR();
  const hoy = franjas.filter((f) => f.dia_semana === diaSemana);
  if (hoy.length === 0) return true;
  const ahora = minutos(hora);
  return !hoy.some(
    (f) =>
      ahora >= minutos(f.hora_desde) - TOLERANCIA_ANTES_MIN &&
      ahora <= minutos(f.hora_hasta)
  );
}

const schemaIngreso = z.object({
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, "El DNI tiene que tener 7 u 8 números, sin puntos"),
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre")
    .max(120, "El nombre es demasiado largo"),
  apellido: z
    .string()
    .trim()
    .min(1, "Poné el apellido")
    .max(120, "El apellido es demasiado largo"),
  empleado_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  notas: z
    .string()
    .trim()
    .max(500, "La nota es demasiado larga")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type IngresoRegistrado = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  cargo: string | null;
  ingreso_en: string;
  fuera_de_horario: boolean;
  en_padron: boolean;
};

/**
 * Registra el ingreso de una persona por portería: sube la firma (PNG del
 * canvas) a `{org}/firmas/…`, calcula si llegó fuera de horario según los
 * horarios cargados por el Líder y guarda el ingreso.
 * FormData: dni, nombre, apellido, empleado_id?, notas?, firma (Blob PNG).
 */
export async function registrarIngreso(
  formData: FormData
): Promise<ActionResult<IngresoRegistrado>> {
  const perfil = await requireRol(...ROLES_PORTERIA);

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = schemaIngreso.safeParse({
    dni: get("dni"),
    nombre: get("nombre"),
    apellido: get("apellido"),
    empleado_id: get("empleado_id"),
    notas: get("notas"),
  });
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const firma = formData.get("firma");
  if (!(firma instanceof Blob) || firma.size === 0)
    return fallo("Falta la firma: pedile que firme en el recuadro.");
  if (firma.type && firma.type !== "image/png")
    return fallo("La firma tiene que ser una imagen PNG.");
  if (firma.size > TAMANO_MAX_FIRMA)
    return fallo("La firma pesa demasiado. Borrala y volvé a firmar.");

  const supabase = await createClient();
  const datos = parsed.data;

  // Empleado del padrón: el elegido en el autocompletado o, si no, el que
  // tenga ese DNI (por si tipearon el número completo sin elegir).
  let empleado: { id: string; cargo: string | null } | null = null;
  if (datos.empleado_id) {
    const { data } = await supabase
      .from("empleados")
      .select("id, cargo, dni")
      .eq("id", datos.empleado_id)
      .eq("org_id", perfil.org_id)
      .maybeSingle();
    if (!data) return fallo("El empleado elegido ya no está en el padrón.");
    if (data.dni !== datos.dni)
      return fallo("El DNI no coincide con el empleado elegido. Revisalo.");
    empleado = { id: data.id, cargo: data.cargo };
  } else {
    const { data } = await supabase
      .from("empleados")
      .select("id, cargo")
      .eq("org_id", perfil.org_id)
      .eq("dni", datos.dni)
      .eq("activo", true)
      .maybeSingle();
    if (data) empleado = { id: data.id, cargo: data.cargo };
  }

  let fueraDeHorario = false;
  if (empleado) {
    const { data: franjas } = await supabase
      .from("empleado_horarios")
      .select("dia_semana, hora_desde, hora_hasta")
      .eq("empleado_id", empleado.id);
    fueraDeHorario = calcularFueraDeHorario(franjas ?? []);
  }

  const ruta = rutaFirmaIngreso(perfil.org_id);
  const { error: errorSubida } = await supabase.storage
    .from("documentos")
    .upload(ruta, firma, { contentType: "image/png" });
  if (errorSubida) return fallo("No pudimos guardar la firma. Probá de nuevo.");

  const { data, error } = await supabase
    .from("ingresos_personal")
    .insert({
      org_id: perfil.org_id,
      empleado_id: empleado?.id ?? null,
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      firma_path: ruta,
      fuera_de_horario: fueraDeHorario,
      notas: datos.notas,
      registrado_por: perfil.user_id,
    })
    .select("id, ingreso_en")
    .single();

  if (error) {
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(error);
  }

  revalidatePath("/porteria");
  return ok({
    id: data.id,
    nombre: datos.nombre,
    apellido: datos.apellido,
    dni: datos.dni,
    cargo: empleado?.cargo ?? null,
    ingreso_en: data.ingreso_en,
    fuera_de_horario: fueraDeHorario,
    en_padron: Boolean(empleado),
  });
}

/** Marca la salida de un ingreso que todavía está adentro. */
export async function marcarEgreso(
  input: unknown
): Promise<ActionResult<{ egreso_en: string }>> {
  const perfil = await requireRol(...ROLES_PORTERIA);
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: ingreso } = await supabase
    .from("ingresos_personal")
    .select("id, egreso_en")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!ingreso) return fallo("Ese ingreso ya no existe.");
  if (ingreso.egreso_en) return fallo("La salida ya estaba marcada.");

  const egresoEn = new Date().toISOString();
  const { error } = await supabase
    .from("ingresos_personal")
    .update({ egreso_en: egresoEn })
    .eq("id", ingreso.id)
    .eq("org_id", perfil.org_id);
  if (error) return fallo(error);

  revalidatePath("/porteria");
  return ok({ egreso_en: egresoEn });
}
