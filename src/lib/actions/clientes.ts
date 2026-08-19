"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { formatFraccion, hoyISO, OPCIONES_CUOTAS_MES, PASO_CANTIDAD } from "@/lib/format";
import { clientePerteneceAOrg } from "@/lib/actions/helpers";

/* ------------------------------------------------------------------ */
/* Aprobación obligatoria (contrato Fase 2 §2)                         */
/* ------------------------------------------------------------------ */

/**
 * Resultado de toda escritura sobre clientes / conceptos del cliente:
 * el Líder de Procesos aplica en el acto ("aplicado"); los demás roles dejan
 * el cambio esperando aprobación ("pendiente"). `id` es el registro
 * resultante cuando se aplicó (p. ej. el id del cliente nuevo).
 */
export type ResultadoCambio = {
  estado: "aplicado" | "pendiente";
  id?: string;
  cambioId: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Entidad = "cliente" | "cliente_concepto" | "concepto";
type Accion = "alta" | "modificacion" | "baja";

/** Llama a la RPC `solicitar_cambio` y normaliza la respuesta. */
async function solicitarCambio(
  supabase: Supabase,
  cambio: {
    entidad: Entidad;
    accion: Accion;
    entidadId: string | null;
    datos: Record<string, Json>;
    resumen: string;
    clienteId?: string | null;
  }
): Promise<ActionResult<ResultadoCambio>> {
  const { data, error } = await supabase.rpc("solicitar_cambio", {
    p_entidad: cambio.entidad,
    p_accion: cambio.accion,
    // El tipo generado marca p_entidad_id como obligatorio (no tiene default
    // en SQL), pero la función acepta NULL en las altas.
    p_entidad_id: cambio.entidadId as unknown as string,
    p_datos: cambio.datos,
    p_resumen: cambio.resumen,
    ...(cambio.clienteId ? { p_cliente_id: cambio.clienteId } : {}),
  });
  if (error) {
    // El Líder aplica en el acto: si el N° de carpeta ya está usado, la
    // unicidad salta acá y el mensaje crudo de Postgres no sirve de nada.
    if (error.code === "23505" && cambio.entidad === "cliente")
      return fallo(
        "Ya existe otro cliente con ese número de carpeta. Fijate el número y probá de nuevo."
      );
    return fallo(error);
  }

  const r = (data ?? {}) as {
    estado?: string;
    cambio_id?: string;
    resultado_id?: string | null;
  };
  return ok({
    estado: r.estado === "aplicado" ? "aplicado" : "pendiente",
    id: r.resultado_id ?? undefined,
    cambioId: r.cambio_id ?? "",
  });
}

/** Nombre corto para los resúmenes ("Verdulería Juárez (N° 12)"). */
async function nombreCliente(
  supabase: Supabase,
  clienteId: string,
  orgId: string
): Promise<{ nombre: string; etiqueta: string } | null> {
  const { data } = await supabase
    .from("clientes")
    .select("nombre, codigo")
    .eq("id", clienteId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  return { nombre: data.nombre, etiqueta: `${data.nombre} (N° ${data.codigo})` };
}

/** "teléfono", "teléfono y email", "teléfono, email y dirección". */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function revalidarCliente(clienteId?: string | null) {
  revalidatePath("/clientes");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/aprobaciones");
}

/* ------------------------------------------------------------------ */
/* Esquemas                                                            */
/* ------------------------------------------------------------------ */

const textoOpcional = z
  .string()
  .trim()
  .max(300, "Es demasiado largo")
  .optional()
  .transform((v) => (v ? v : null));

const schemaCuotasMes = z.coerce
  .number({ error: "Poné en cuántas veces paga el mes" })
  .int("Las cuotas van en números enteros")
  .min(1, "Como mínimo paga en 1 vez")
  .max(10, "Como máximo 10 veces por mes");

const schemaDatosCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Poné el nombre del cliente")
    .max(200, "El nombre es demasiado largo"),
  apodo: z
    .string()
    .trim()
    .max(80, "El apodo es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
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
  cuotas_mes: schemaCuotasMes,
  notas: z
    .string()
    .trim()
    .max(2000, "Las notas son demasiado largas")
    .optional()
    .transform((v) => (v ? v : null)),
});

type DatosClienteValidados = z.infer<typeof schemaDatosCliente>;

/** Cantidad de un concepto: de cuarto en cuarto (¼ · ½ · ¾ · 1 · 1¼…). */
const schemaCantidad = z.coerce
  .number({ error: "Poné una cantidad válida" })
  .min(PASO_CANTIDAD, "La cantidad mínima es ¼")
  .max(99, "La cantidad es demasiado grande")
  .refine(
    (v) => Number.isInteger(Math.round(v * 100) / (PASO_CANTIDAD * 100)),
    "La cantidad va de cuarto en cuarto (¼ · ½ · ¾ · 1...)"
  );

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

/** Etiquetas humanas de los campos del cliente, para los resúmenes. */
const LABEL_CAMPO: Record<keyof DatosClienteValidados, string> = {
  nombre: "nombre",
  apodo: "apodo",
  tipo_persona: "tipo de persona",
  cuit: "CUIT/DNI",
  telefono: "teléfono",
  email: "email",
  direccion: "dirección",
  codigo: "N° de carpeta",
  cuotas_mes: "cuotas del mes",
  notas: "notas",
};

/* ------------------------------------------------------------------ */
/* Cliente: alta, edición, baja                                        */
/* ------------------------------------------------------------------ */

export async function crearCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = schemaDatosCliente
    .extend({ conceptos: schemaConceptosAlta })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { conceptos: conceptosAlta, ...datos } = parsed.data;
  const supabase = await createClient();

  // Un renglón por concepto (si viniera repetido, gana el último) y
  // pertenencia a MI organización antes de proponer nada.
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

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "alta",
    entidadId: null,
    datos: {
      ...datos,
      conceptos: conceptoIds.map((concepto_id) => ({
        concepto_id,
        cantidad: cantidadPorConcepto.get(concepto_id) ?? 1,
      })),
    },
    resumen: `Alta de cliente ${datos.nombre} (N° ${datos.codigo})`,
  });
  if (!res.ok) return res;

  revalidarCliente(res.data.id);
  return res;
}

export async function editarCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = schemaDatosCliente
    .extend({ id: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...datos } = parsed.data;
  const supabase = await createClient();

  // Solo viajan las claves que cambian: así el Líder ve un diff limpio.
  const { data: actual } = await supabase
    .from("clientes")
    .select(
      "nombre, apodo, tipo_persona, cuit, telefono, email, direccion, codigo, cuotas_mes, notas"
    )
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!actual) return fallo("Cliente inexistente.");

  const cambios: Record<string, Json> = {};
  const camposCambiados: string[] = [];
  for (const campo of Object.keys(datos) as (keyof DatosClienteValidados)[]) {
    const nuevo = datos[campo] ?? null;
    const viejo = actual[campo] ?? null;
    if (nuevo !== viejo) {
      cambios[campo] = nuevo;
      camposCambiados.push(LABEL_CAMPO[campo]);
    }
  }
  if (camposCambiados.length === 0)
    return fallo("No cambiaste ningún dato. Corregí algo y volvé a guardar.");

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "modificacion",
    entidadId: id,
    datos: cambios,
    resumen: `Cambiar ${enumerar(camposCambiados)} de ${actual.nombre}`,
  });
  if (!res.ok) return res;

  revalidarCliente(id);
  return ok({ ...res.data, id });
}

export async function editarCuotasMes(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = z
    .object({ clienteId: z.string().min(1), cuotas_mes: schemaCuotasMes })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await nombreCliente(supabase, parsed.data.clienteId, perfil.org_id);
  if (!cliente) return fallo("Cliente inexistente.");

  const opcion = OPCIONES_CUOTAS_MES.find((o) => o.valor === parsed.data.cuotas_mes);
  const como =
    parsed.data.cuotas_mes === 1
      ? "todo junto"
      : `en ${parsed.data.cuotas_mes} veces${opcion ? ` (${opcion.ayuda.toLowerCase()})` : ""}`;

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "modificacion",
    entidadId: parsed.data.clienteId,
    datos: { cuotas_mes: parsed.data.cuotas_mes },
    resumen: `Cambiar cómo paga el mes ${cliente.nombre}: ${como}`,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

/** Baja lógica del cliente (activo = false), con el motivo en el resumen. */
export async function darDeBajaCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      motivo: z
        .string()
        .trim()
        .min(3, "Contá por qué se da de baja (ej.: dejó el puesto).")
        .max(300, "El motivo es demasiado largo"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await nombreCliente(supabase, parsed.data.clienteId, perfil.org_id);
  if (!cliente) return fallo("Cliente inexistente.");

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "baja",
    entidadId: parsed.data.clienteId,
    datos: { activo: false, motivo: parsed.data.motivo },
    resumen: `Dar de baja a ${cliente.etiqueta}: ${parsed.data.motivo}`,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

/** Vuelve a activar un cliente dado de baja. */
export async function reactivarCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = z.object({ clienteId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await nombreCliente(supabase, parsed.data.clienteId, perfil.org_id);
  if (!cliente) return fallo("Cliente inexistente.");

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "modificacion",
    entidadId: parsed.data.clienteId,
    datos: { activo: true },
    resumen: `Reactivar a ${cliente.etiqueta}`,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

/* ------------------------------------------------------------------ */
/* Deuda anterior (RD) y saldo a favor                                 */
/* ------------------------------------------------------------------ */

const schemaDeudaAnterior = z.object({
  clienteId: z.uuid(),
  monto: z
    .number("Poné el monto de la deuda.")
    .positive("El monto debe ser mayor a cero."),
  detalle: z.string().min(3, "Contá de qué es la deuda (ej.: expensas 2025)."),
  fecha: z
    .string("Poné de qué fecha es la deuda")
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Poné de qué fecha es la deuda")
    .refine((v) => v <= hoyISO(), "La fecha de la deuda no puede ser futura."),
});

/**
 * Reconocimiento de deuda (RD): deuda anterior al sistema que se carga a mano.
 * Queda en el período del mes de la fecha indicada y vence ese mismo día (si
 * la fecha ya pasó, nace vencida), cobrable desde Cobranza como cualquier cargo.
 */
export async function registrarDeudaAnterior(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "tesoreria", "lider");
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

  const fecha = parsed.data.fecha;
  const { error } = await supabase.from("cargos").insert({
    org_id: perfil.org_id,
    periodo: `${fecha.slice(0, 7)}-01`,
    cliente_id: parsed.data.clienteId,
    concepto_id: rd.id,
    codigo: "RD",
    descripcion: `Reconocimiento de deuda · ${parsed.data.detalle.trim()}`,
    cantidad: 1,
    precio_unitario: parsed.data.monto,
    monto: parsed.data.monto,
    descuento_pronto_pago: 0,
    vencimiento: fecha,
    origen: "deuda",
  });
  if (error) return fallo(error);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/cobranza");
  return ok(undefined);
}

/** Aplica el saldo a favor del cliente a sus cargos pendientes (RPC). */
export async function aplicarSaldoFavor(
  input: unknown
): Promise<ActionResult<{ aplicado: number }>> {
  await requireRol("admin", "tesoreria", "lider", "guardia");
  const parsed = z.object({ clienteId: z.uuid() }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_saldo_favor_cliente", {
    p_cliente: parsed.data.clienteId,
  });
  if (error) return fallo(error);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/cobranza");
  return ok({ aplicado: Number(data ?? 0) });
}

/* ------------------------------------------------------------------ */
/* Conceptos del cliente (qué paga)                                    */
/* ------------------------------------------------------------------ */

export async function agregarConceptoCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      conceptoId: z.string().min(1, "Elegí el concepto que va a pagar"),
      cantidad: schemaCantidad,
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await nombreCliente(supabase, parsed.data.clienteId, perfil.org_id);
  if (!cliente) return fallo("Cliente inexistente.");
  const { data: concepto } = await supabase
    .from("conceptos")
    .select("id, nombre")
    .eq("id", parsed.data.conceptoId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!concepto) return fallo("Concepto inexistente.");

  const res = await solicitarCambio(supabase, {
    entidad: "cliente_concepto",
    accion: "alta",
    entidadId: null,
    datos: {
      cliente_id: parsed.data.clienteId,
      concepto_id: parsed.data.conceptoId,
      cantidad: parsed.data.cantidad,
    },
    resumen: `Agregar ${concepto.nombre} × ${formatFraccion(parsed.data.cantidad)} a ${cliente.nombre}`,
    clienteId: parsed.data.clienteId,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

export async function editarConceptoCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
  const parsed = z
    .object({
      id: z.string().min(1),
      clienteId: z.string().min(1),
      cantidad: schemaCantidad.optional(),
      activo: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: Record<string, Json> = {};
  if (parsed.data.cantidad !== undefined) cambios.cantidad = parsed.data.cantidad;
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;
  if (Object.keys(cambios).length === 0)
    return fallo("No hay cambios para guardar.");

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("cliente_conceptos")
    .select("id, cliente_id, cantidad, activo, conceptos(nombre), clientes(nombre)")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!item || item.cliente_id !== parsed.data.clienteId)
    return fallo("Ese concepto ya no está en la carpeta del cliente.");

  const concepto = item.conceptos?.nombre ?? "el concepto";
  const cliente = item.clientes?.nombre ?? "el cliente";

  // Resumen humano según qué se toca.
  let resumen: string;
  let accion: Accion = "modificacion";
  if (parsed.data.activo === false && parsed.data.cantidad === undefined) {
    accion = "baja";
    resumen = `Dar de baja concepto ${concepto} de ${cliente}`;
  } else if (parsed.data.activo === true && parsed.data.cantidad === undefined) {
    resumen = `Volver a facturar ${concepto} a ${cliente}`;
  } else {
    resumen = `Cambiar ${concepto} de ${cliente}: ${formatFraccion(item.cantidad)} → ${formatFraccion(parsed.data.cantidad ?? item.cantidad)}`;
    if (parsed.data.activo === false) resumen += " y dejar de facturarlo";
  }

  const res = await solicitarCambio(supabase, {
    entidad: "cliente_concepto",
    accion,
    entidadId: parsed.data.id,
    datos: cambios,
    resumen,
    clienteId: parsed.data.clienteId,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

/* ------------------------------------------------------------------ */
/* Medidores de luz (escritura directa: no pasan por aprobación)       */
/* ------------------------------------------------------------------ */

function esDuplicado(error: { code?: string | null }): boolean {
  return error.code === "23505";
}

export async function crearMedidor(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo", "lider");
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
  await requireRol("admin", "tesoreria", "consejo", "lider");
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
