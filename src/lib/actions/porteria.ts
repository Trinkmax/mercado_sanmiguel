"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { rutaFirmaIngreso } from "@/lib/storage";
import { TZ_AR } from "@/lib/format";

/** Ingresos del personal en la garita: Portería y el Líder (A4, G10: ni Administración ni el Jefe). */
const ROLES_INGRESOS = ["porteria", "lider"] as const;
/** Canon de transporte: Portería y el Líder (§1.3 D-P2: el Líder opera todo). */
const ROLES_CANON = ["porteria", "lider"] as const;
/** Anular canon: Portería (lo suyo, 15 min), el Jefe (caja abierta), Tesorería y el Líder. */
const ROLES_ANULAR_CANON = ["porteria", "guardia", "tesoreria", "lider"] as const;

/** Una firma dibujada en el canvas no debería pesar más que esto. */
const TAMANO_MAX_FIRMA = 2 * 1024 * 1024; // 2 MB

/** Minutos antes de la hora de entrada que todavía cuentan como "en horario"
 * (llegar un rato antes del turno es lo normal, no una irregularidad). */
const TOLERANCIA_ANTES_MIN = 30;

/** Tolerancia de reloj para "la salida no puede ser futura" (igual que el trigger proteger_ingreso). */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/** Mensaje de un error de la base para mostrar tal cual: las RPC y triggers ya hablan en
 * castellano; los errores de permisos o de red se traducen. */
function mensajeBase(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado. Probá de nuevo.";
  if (error.code === "42501") return "No tenés permiso para hacer esto.";
  if (error.code === "23505") return "Ya existe uno igual. Revisá la lista.";
  const m = (error.message ?? "").trim();
  if (!m || /fetch failed|network|timeout/i.test(m)) {
    return "No se pudo guardar. Revisá la conexión y probá de nuevo.";
  }
  return m;
}

// ============================================================ Ingresos del personal

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
  const perfil = await requireRol(...ROLES_INGRESOS);
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
  if (error) return fallo(mensajeBase(error));
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
 * horarios cargados por el Líder y guarda el ingreso. La hora de entrada y
 * quién lo registró los pone el servidor (defaults de la base; grants de 0022).
 * FormData: dni, nombre, apellido, empleado_id?, notas?, firma (Blob PNG).
 */
export async function registrarIngreso(
  formData: FormData
): Promise<ActionResult<IngresoRegistrado>> {
  const perfil = await requireRol(...ROLES_INGRESOS);

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
    })
    .select("id, ingreso_en")
    .single();

  if (error) {
    await supabase.storage.from("documentos").remove([ruta]);
    return fallo(mensajeBase(error));
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

const schemaEgreso = z.object({
  id: z.uuid("No encontramos ese ingreso. Recargá la página."),
  /** ISO con zona ("2026-09-28T16:30:00-03:00"). Sin valor = ahora. */
  egresoEn: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Elegí una hora válida"),
});

/**
 * Marca la salida de un ingreso (ahora o a la hora elegida: ≥ entrada y ≤ ahora).
 * Corregir una salida ya marcada: solo el Líder (lo impone el trigger proteger_ingreso).
 */
export async function marcarEgreso(
  input: unknown
): Promise<ActionResult<{ egreso_en: string }>> {
  const perfil = await requireRol(...ROLES_INGRESOS);
  const parsed = schemaEgreso.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data: ingreso } = await supabase
    .from("ingresos_personal")
    .select("id, ingreso_en, egreso_en")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!ingreso) return fallo("Ese ingreso ya no existe.");
  if (ingreso.egreso_en && perfil.rol !== "lider")
    return fallo("La salida ya estaba marcada: pedile al Líder de Procesos que la corrija");

  const egreso = parsed.data.egresoEn ? new Date(parsed.data.egresoEn) : new Date();
  if (egreso.getTime() > Date.now() + TOLERANCIA_FUTURO_MS)
    return fallo("La hora de salida no puede ser futura");
  if (egreso.getTime() < new Date(ingreso.ingreso_en).getTime())
    return fallo("La salida no puede ser antes de la entrada");

  const egresoEn = egreso.toISOString();
  const { data: actualizado, error } = await supabase
    .from("ingresos_personal")
    .update({ egreso_en: egresoEn })
    .eq("id", ingreso.id)
    .eq("org_id", perfil.org_id)
    .select("egreso_en")
    .maybeSingle();
  if (error) return fallo(mensajeBase(error));
  if (!actualizado) return fallo("No tenés permiso para marcar esa salida.");

  revalidatePath("/porteria");
  return ok({ egreso_en: actualizado.egreso_en ?? egresoEn });
}

// ============================================================ Canon de transporte (H1, H2)

const schemaCanon = z.object({
  tarifaId: z.uuid("Elegí qué entró"),
  cantidad: z.coerce
    .number()
    .int("La cantidad va de 1 a 99")
    .min(1, "La cantidad va de 1 a 99")
    .max(99, "La cantidad va de 1 a 99"),
  medio: z.enum(["efectivo", "transferencia"], { message: "Elegí cómo paga" }),
  patente: z
    .string()
    .trim()
    .max(20, "La patente no parece válida (ej.: AB123CD o ABC123)")
    .optional()
    .transform((v) => (v ? v : null)),
  destino: z
    .enum(["puesto", "verdulero", "ambulante"], {
      message: "Elegí a quién viene: puesto, verdulero o ambulante",
    })
    .nullish()
    .transform((v) => v ?? null),
  puesto: z
    .string()
    .trim()
    .max(20, "Ese número de puesto es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
  notas: z
    .string()
    .trim()
    .max(500, "La nota es demasiado larga (hasta 500 letras)")
    .optional()
    .transform((v) => (v ? v : null)),
  ref: z.uuid("Recargá la página y probá de nuevo."),
});

export type CanonRegistrado = {
  id: string;
  numero: number;
  monto: number;
  tarifa: string;
  cantidad: number;
  unidad: "vehiculo" | "dia";
  medio: "efectivo" | "transferencia";
  creado_en: string | null;
  repetido: boolean;
};

/**
 * Cobra el canon de transporte en la caja de portería de hoy (la abre si hace falta).
 * El monto lo calcula la base con la tarifa (nadie tipea montos). `ref` = un
 * `crypto.randomUUID()` por intento: el doble toque o el reintento sin red no cobran dos veces.
 */
export async function registrarCanon(
  input: unknown
): Promise<ActionResult<CanonRegistrado>> {
  await requireRol(...ROLES_CANON);
  const parsed = schemaCanon.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.puesto && d.destino !== "puesto")
    return fallo("El número de puesto va solo si viene a un puesto");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_canon", {
    p_tarifa: d.tarifaId,
    p_cantidad: d.cantidad,
    p_medio: d.medio,
    p_patente: d.patente ?? undefined,
    p_destino: d.destino ?? undefined,
    p_destino_detalle: d.destino === "puesto" ? (d.puesto ?? undefined) : undefined,
    p_notas: d.notas ?? undefined,
    p_ref: d.ref,
  });
  if (error) return fallo(mensajeBase(error));

  const r = (data ?? {}) as Record<string, unknown>;
  revalidatePath("/porteria");
  revalidatePath("/caja");
  revalidatePath("/inicio");
  return ok({
    id: String(r.id),
    numero: Number(r.numero),
    monto: Number(r.monto),
    tarifa: String(r.tarifa ?? ""),
    cantidad: Number(r.cantidad),
    unidad: r.unidad === "dia" ? "dia" : "vehiculo",
    medio: r.medio === "transferencia" ? "transferencia" : "efectivo",
    creado_en: typeof r.creado_en === "string" ? r.creado_en : null,
    repetido: r.repetido === true,
  });
}

const schemaAnularCanon = z.object({
  id: z.uuid("No encontramos ese cobro. Recargá la página."),
  motivo: z
    .string()
    .trim()
    .min(1, "Contá por qué lo anulás")
    .max(500, "El motivo es demasiado largo (hasta 500 letras)"),
});

/** Anula un cobro de canon (queda tachado, con quién, cuándo y por qué; nunca se borra). */
export async function anularCanon(input: unknown): Promise<ActionResult> {
  await requireRol(...ROLES_ANULAR_CANON);
  const parsed = schemaAnularCanon.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_canon", {
    p_canon: parsed.data.id,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(mensajeBase(error));

  revalidatePath("/porteria");
  revalidatePath("/caja");
  revalidatePath("/inicio");
  return ok(undefined);
}

// ============================================================ Tarifas de transporte (las edita el Líder)

const schemaTarifa = z.object({
  id: z.uuid().optional(),
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre (ej.: Camioneta)")
    .max(40, "El nombre es demasiado largo (hasta 40 letras)"),
  precio: z.coerce
    .number({ message: "Poné el precio" })
    .min(0, "El precio no puede ser negativo")
    .max(100_000_000, "Revisá el precio: es demasiado alto"),
  unidad: z.enum(["vehiculo", "dia"], { message: "Elegí si se cobra por vehículo o por día" }),
  icono: z.enum(["camioneta", "camion", "balancin", "equipo", "estadia"], {
    message: "Elegí un dibujo",
  }),
  activo: z.boolean().optional(),
});

/** Crea o edita una tarifa. El precio nuevo rige desde el próximo cobro (los viejos guardan su copia). */
export async function guardarTarifaTransporte(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const perfil = await requireRol("lider");
  const parsed = schemaTarifa.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const d = parsed.data;
  const precio = Math.round(d.precio * 100) / 100;

  const supabase = await createClient();
  const ahora = new Date().toISOString();

  if (d.id) {
    const { data, error } = await supabase
      .from("tarifas_transporte")
      .update({
        nombre: d.nombre,
        precio,
        unidad: d.unidad,
        icono: d.icono,
        ...(d.activo === undefined ? {} : { activo: d.activo }),
        actualizado_por: perfil.user_id,
        actualizado_en: ahora,
      })
      .eq("id", d.id)
      .eq("org_id", perfil.org_id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return fallo(`Ya hay una tarifa que se llama "${d.nombre}".`);
      return fallo(mensajeBase(error));
    }
    if (!data) return fallo("Esa tarifa ya no existe. Recargá la página.");
    revalidarTarifas();
    return ok({ id: data.id });
  }

  // Alta: va al final de la lista.
  const { data: ultima } = await supabase
    .from("tarifas_transporte")
    .select("orden")
    .eq("org_id", perfil.org_id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("tarifas_transporte")
    .insert({
      org_id: perfil.org_id,
      nombre: d.nombre,
      precio,
      unidad: d.unidad,
      icono: d.icono,
      orden: (ultima?.orden ?? 0) + 10,
      activo: d.activo ?? true,
      actualizado_por: perfil.user_id,
      actualizado_en: ahora,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fallo(`Ya hay una tarifa que se llama "${d.nombre}".`);
    return fallo(mensajeBase(error));
  }
  revalidarTarifas();
  return ok({ id: data.id });
}

/** Activa o desactiva una tarifa (no se borran: los cobros viejos la nombran). */
export async function cambiarActivoTarifaTransporte(
  input: unknown
): Promise<ActionResult> {
  const perfil = await requireRol("lider");
  const parsed = z
    .object({ id: z.uuid("Esa tarifa ya no existe. Recargá la página."), activo: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarifas_transporte")
    .update({
      activo: parsed.data.activo,
      actualizado_por: perfil.user_id,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .select("id")
    .maybeSingle();
  if (error) return fallo(mensajeBase(error));
  if (!data) return fallo("Esa tarifa ya no existe. Recargá la página.");
  revalidarTarifas();
  return ok(undefined);
}

function revalidarTarifas() {
  revalidatePath("/configuracion");
  revalidatePath("/porteria");
}
