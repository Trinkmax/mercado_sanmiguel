"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { hoyISO, periodoActual } from "@/lib/format";
import { clientePerteneceAOrg } from "@/lib/actions/helpers";

/* ------------------------------------------------------------------ */
/* Esquemas                                                            */
/* ------------------------------------------------------------------ */

const textoOpcional = z
  .string()
  .trim()
  .max(300, "Es demasiado largo")
  .optional()
  .transform((v) => (v ? v : null));

const schemaDatosCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre del cliente")
    .max(200, "El nombre es demasiado largo"),
  tipo_persona: z.enum(["fisica", "juridica"], {
    error: "Elegí si es persona física o empresa",
  }),
  cuit: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional.refine(
    (v) => v === null || /^\S+@\S+\.\S+$/.test(v),
    "El email no parece válido (ej.: nombre@correo.com)"
  ),
  direccion: textoOpcional,
  codigo: z.coerce
    .number({ error: "Poné el número de carpeta" })
    .int("El número de carpeta va sin comas ni puntos")
    .min(1, "El número de carpeta tiene que ser mayor a cero"),
  cuotas_mes: z.coerce
    .number({ error: "Poné en cuántas veces paga el mes" })
    .int("Las cuotas van en números enteros")
    .min(1, "Como mínimo paga en 1 vez")
    .max(10, "Como máximo 10 veces por mes"),
  notas: z
    .string()
    .trim()
    .max(2000, "Las notas son demasiado largas")
    .optional()
    .transform((v) => (v ? v : null)),
});

const schemaCantidad = z.coerce
  .number({ error: "Poné una cantidad válida" })
  .min(0.5, "La cantidad mínima es 0,5")
  .max(99, "La cantidad es demasiado grande")
  .refine(
    (v) => Number.isInteger(v * 2),
    "La cantidad va de medio en medio (0,5 · 1 · 1,5…)"
  );

function esDuplicado(error: { code?: string | null }): boolean {
  return error.code === "23505";
}

/** Conceptos que se cargan junto con el alta (cantidad 0 = no se manda). */
const schemaConceptosAlta = z
  .array(
    z.object({
      concepto_id: z.string().min(1, "Falta el concepto"),
      cantidad: schemaCantidad,
    })
  )
  .max(30, "Son demasiados conceptos")
  .optional();

/* ------------------------------------------------------------------ */
/* Cliente: alta y edición                                             */
/* ------------------------------------------------------------------ */

export async function crearCliente(
  input: unknown
): Promise<ActionResult<{ id: string; advertencia?: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = schemaDatosCliente
    .extend({ conceptos: schemaConceptosAlta })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { conceptos: conceptosAlta, ...datos } = parsed.data;
  const supabase = await createClient();

  // Un renglón por concepto (si viniera repetido, gana el último) y
  // pertenencia a MI organización antes de crear nada.
  const cantidadPorConcepto = new Map(
    (conceptosAlta ?? []).map((c) => [c.concepto_id, c.cantidad])
  );
  const conceptoIds = [...cantidadPorConcepto.keys()];
  if (conceptoIds.length > 0) {
    const { data: propios, error: errorConceptos } = await supabase
      .from("conceptos")
      .select("id")
      .in("id", conceptoIds)
      .eq("org_id", perfil.org_id);
    if (errorConceptos) return fallo(errorConceptos);
    if ((propios ?? []).length !== conceptoIds.length)
      return fallo(
        "Alguno de los conceptos elegidos no existe. Recargá la página y probá de nuevo."
      );
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...datos, org_id: perfil.org_id })
    .select("id")
    .single();

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya existe un cliente con ese número de carpeta. Fijate el número y probá de nuevo.");
    return fallo(error);
  }

  // Sus conceptos, en el mismo alta. Si algo falla acá el cliente ya existe:
  // avisamos para terminar la carga desde su carpeta en vez de duplicarlo.
  let advertencia: string | undefined;
  if (conceptoIds.length > 0) {
    const { error: errorItems } = await supabase.from("cliente_conceptos").insert(
      conceptoIds.map((concepto_id) => ({
        org_id: perfil.org_id,
        cliente_id: data.id,
        concepto_id,
        cantidad: cantidadPorConcepto.get(concepto_id) ?? 1,
        activo: true,
      }))
    );
    if (errorItems)
      advertencia =
        "El cliente se creó, pero no pudimos guardar qué paga. Cargalo desde la pestaña Conceptos.";
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.id}`);
  return ok(advertencia ? { id: data.id, advertencia } : { id: data.id });
}

export async function editarCliente(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireRol("admin", "tesoreria", "consejo");
  const parsed = schemaDatosCliente
    .extend({ id: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...datos } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(datos).eq("id", id);

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya existe otro cliente con ese número de carpeta.");
    return fallo(error);
  }
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return ok({ id });
}

export async function editarCuotasMes(
  input: unknown
): Promise<ActionResult<void>> {
  await requireRol("admin", "tesoreria", "consejo");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      cuotas_mes: z.coerce
        .number({ error: "Poné en cuántas veces paga el mes" })
        .int("Las cuotas van en números enteros")
        .min(1, "Como mínimo paga en 1 vez")
        .max(10, "Como máximo 10 veces por mes"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ cuotas_mes: parsed.data.cuotas_mes })
    .eq("id", parsed.data.clienteId);
  if (error) return fallo(error);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}

/* ------------------------------------------------------------------ */
/* Conceptos del cliente (qué paga)                                    */
/* ------------------------------------------------------------------ */

const schemaDeudaAnterior = z.object({
  clienteId: z.uuid(),
  monto: z
    .number("Poné el monto de la deuda.")
    .positive("El monto debe ser mayor a cero."),
  detalle: z.string().min(3, "Contá de qué es la deuda (ej.: expensas 2025)."),
});

/**
 * Reconocimiento de deuda (RD): deuda anterior al sistema que se carga a mano
 * y queda exigible de inmediato, cobrable desde Cobranza como cualquier cargo.
 */
export async function registrarDeudaAnterior(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "tesoreria");
  const parsed = schemaDeudaAnterior.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  if (!(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))) {
    return fallo("Cliente inexistente.");
  }

  const { data: rd } = await supabase
    .from("conceptos")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("codigo", "RD")
    .maybeSingle();
  if (!rd) {
    return fallo("Falta el concepto RD (Reconocimiento de Deuda) en Configuración.");
  }

  const { error } = await supabase.from("cargos").insert({
    org_id: perfil.org_id,
    periodo: periodoActual(),
    cliente_id: parsed.data.clienteId,
    concepto_id: rd.id,
    codigo: "RD",
    descripcion: `Reconocimiento de deuda · ${parsed.data.detalle.trim()}`,
    cantidad: 1,
    precio_unitario: parsed.data.monto,
    monto: parsed.data.monto,
    descuento_pronto_pago: 0,
    vencimiento: hoyISO(),
    origen: "deuda",
  });
  if (error) return fallo(error);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/cobranza");
  return ok(undefined);
}

export async function agregarConceptoCliente(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      conceptoId: z.string().min(1, "Elegí el concepto que va a pagar"),
      cantidad: schemaCantidad,
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  if (!(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))) {
    return fallo("Cliente inexistente.");
  }
  const { data: concepto } = await supabase
    .from("conceptos")
    .select("id")
    .eq("id", parsed.data.conceptoId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!concepto) return fallo("Concepto inexistente.");

  const { error } = await supabase.from("cliente_conceptos").insert({
    org_id: perfil.org_id,
    cliente_id: parsed.data.clienteId,
    concepto_id: parsed.data.conceptoId,
    cantidad: parsed.data.cantidad,
    activo: true,
  });

  if (error) {
    if (esDuplicado(error))
      return fallo("Este cliente ya tiene ese concepto asignado.");
    return fallo(error);
  }
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}

export async function editarConceptoCliente(
  input: unknown
): Promise<ActionResult<void>> {
  await requireRol("admin", "tesoreria", "consejo");
  const parsed = z
    .object({
      id: z.string().min(1),
      clienteId: z.string().min(1),
      cantidad: schemaCantidad.optional(),
      activo: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: { cantidad?: number; activo?: boolean } = {};
  if (parsed.data.cantidad !== undefined) cambios.cantidad = parsed.data.cantidad;
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;
  if (Object.keys(cambios).length === 0)
    return fallo("No hay cambios para guardar.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cliente_conceptos")
    .update(cambios)
    .eq("id", parsed.data.id);
  if (error) return fallo(error);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}

/* ------------------------------------------------------------------ */
/* Medidores de luz                                                    */
/* ------------------------------------------------------------------ */

export async function crearMedidor(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      numero: z
        .string()
        .trim()
        .min(1, "Poné el número del medidor")
        .max(50, "El número es demasiado largo"),
      ubicacion: textoOpcional,
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  if (!(await clientePerteneceAOrg(supabase, parsed.data.clienteId, perfil.org_id))) {
    return fallo("Cliente inexistente.");
  }
  const { error } = await supabase.from("medidores").insert({
    org_id: perfil.org_id,
    cliente_id: parsed.data.clienteId,
    numero: parsed.data.numero,
    ubicacion: parsed.data.ubicacion,
  });

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya hay un medidor cargado con ese número.");
    return fallo(error);
  }
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}

export async function editarMedidor(
  input: unknown
): Promise<ActionResult<void>> {
  await requireRol("admin", "tesoreria", "consejo");
  const parsed = z
    .object({
      id: z.string().min(1),
      clienteId: z.string().min(1),
      numero: z
        .string()
        .trim()
        .min(1, "Poné el número del medidor")
        .max(50, "El número es demasiado largo")
        .optional(),
      // Si no viene, no se toca; si viene vacía, se limpia.
      ubicacion: z
        .string()
        .trim()
        .max(300, "Es demasiado largo")
        .optional()
        .transform((v) => (v === undefined ? undefined : v ? v : null)),
      activo: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: { numero?: string; ubicacion?: string | null; activo?: boolean } =
    {};
  if (parsed.data.numero !== undefined) cambios.numero = parsed.data.numero;
  if (parsed.data.ubicacion !== undefined)
    cambios.ubicacion = parsed.data.ubicacion;
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;
  if (Object.keys(cambios).length === 0)
    return fallo("No hay cambios para guardar.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("medidores")
    .update(cambios)
    .eq("id", parsed.data.id);

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya hay un medidor cargado con ese número.");
    return fallo(error);
  }
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  return ok(undefined);
}
