"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { requireRol, type Perfil } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import {
  CUOTAS_TODOS_LOS_DIAS,
  formatFraccion,
  hoyISO,
  OPCIONES_CUOTAS_MES,
  PASO_CANTIDAD,
  formatPorcentaje,
} from "@/lib/format";
import {
  categoriasDeRol,
  LABEL_CATEGORIA,
  tienePortal,
  type CategoriaCliente,
} from "@/lib/segmentos";
import { etiquetaEspacio } from "@/components/mapa/geometria";
import { conceptoSigueConCategoria } from "@/components/clientes/constantes";

/* ------------------------------------------------------------------ */
/* Aprobación obligatoria (contrato Fase 2 §2, Fase 3 §4.7)            */
/* ------------------------------------------------------------------ */

/**
 * Resultado de toda escritura sobre clientes / conceptos del cliente:
 * el Líder de Procesos aplica en el acto ("aplicado"); Administración y el Jefe
 * de Portería dejan el cambio esperando aprobación ("pendiente"). Excepción
 * (§1.3 D-P1): el alta de un ambulante del Jefe se aplica en el acto.
 * `id` es el registro resultante cuando se aplicó (p. ej. el id del cliente nuevo).
 */
export type ResultadoCambio = {
  estado: "aplicado" | "pendiente";
  id?: string;
  cambioId: string;
  /** Altas: el N° de carpeta con el que quedó (puede no ser el sugerido si otro lo tomó antes). */
  codigo?: number;
  /** Altas: la categoría con la que quedó. */
  categoria?: CategoriaCliente;
  /** El alta ya se había registrado con el mismo `ref` (doble toque): no se hizo nada nuevo. */
  repetido?: boolean;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Los errores de la base se pasan como TEXTO a `fallo`: los mensajes de las RPC ya vienen en
// castellano y muchos tienen ":" ("…portal: quitale el acceso primero"); `fallo(error)` recorta
// todo lo que está antes del primer ": " (pedido a Fundación en el resumen de M4).

type Entidad = "cliente" | "cliente_concepto" | "concepto";
type Accion = "alta" | "modificacion" | "baja";

const ROLES_GESTION = ["admin", "guardia", "lider"] as const;

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
    // Red de seguridad: la RPC ya valida el N° antes de insertar.
    if (error.code === "23505" && cambio.entidad === "cliente")
      return fallo(
        "Ya existe otro cliente con ese número de carpeta. Fijate el número y probá de nuevo."
      );
    return fallo(error.message);
  }

  const r = (data ?? {}) as {
    estado?: string;
    cambio_id?: string;
    resultado_id?: string | null;
    repetido?: boolean;
  };
  return ok({
    estado: r.estado === "aplicado" ? "aplicado" : "pendiente",
    id: r.resultado_id ?? undefined,
    cambioId: r.cambio_id ?? "",
    ...(r.repetido ? { repetido: true } : {}),
  });
}

/** Mensaje cuando la categoría del cliente no es del rol (mismo texto que la RPC). */
function mensajeCategoriaAjena(rol: Perfil["rol"]): string {
  return rol === "guardia"
    ? "Desde Portería solo se gestionan quinteros y ambulantes"
    : "A quinteros y ambulantes los gestiona el Jefe de Portería";
}

/**
 * El cliente es de MI organización y de una categoría que mi rol gestiona
 * (Administración: puesteros; Jefe: quinteros y ambulantes; Líder: todos).
 * Equivalente local de `clienteGestionable` (§5.6) hasta que Fundación lo sume a
 * helpers.ts. La base (solicitar_cambio, RLS) es la autoridad final.
 */
async function clienteGestionable(
  supabase: Supabase,
  clienteId: string,
  perfil: Perfil
): Promise<
  | { ok: true; nombre: string; codigo: number; categoria: CategoriaCliente; etiqueta: string }
  | { ok: false; error: string }
> {
  const { data } = await supabase
    .from("clientes")
    .select("nombre, codigo, categoria")
    .eq("id", clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!data) return { ok: false, error: "Ese cliente no existe" };
  const categoria = data.categoria as CategoriaCliente;
  if (!categoriasDeRol(perfil.rol).includes(categoria))
    return { ok: false, error: mensajeCategoriaAjena(perfil.rol) };
  return {
    ok: true,
    nombre: data.nombre,
    codigo: data.codigo,
    categoria,
    etiqueta: `${data.nombre} (N° ${data.codigo})`,
  };
}

/** Un concepto mensual que no es de la categoría del cliente (misma regla que 0024/0040/0045/0047). */
function mensajeNoCorresponde(categoria: CategoriaCliente): string {
  return categoria === "ambulante"
    ? "Al ambulante se le cobra por día: por mes solo se le cobra la cochera o la quinta."
    : categoria === "empleado"
      ? "A un empleado solo se le cobra la cochera."
      : `Ese concepto no le corresponde a un ${LABEL_CATEGORIA[categoria].toLowerCase()}. Solo se puede dejar de facturar.`;
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
  revalidatePath("/cobranza");
}

/** "todo junto" · "en 4 veces (semanal)" · "todos los días" · "en 17 veces" */
function textoCuotas(cuotas: number): string {
  if (cuotas === 1) return "todo junto";
  if (cuotas === CUOTAS_TODOS_LOS_DIAS) return "todos los días";
  const opcion = OPCIONES_CUOTAS_MES.find((o) => o.valor === cuotas);
  return `en ${cuotas} veces${opcion ? ` (${opcion.ayuda.toLowerCase()})` : ""}`;
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
  .max(31, "Como máximo 31 veces por mes (todos los días)");

const schemaCategoria = z.enum(["puestero", "quintero", "ambulante", "empleado"], {
  error: "Elegí qué es: puestero, quintero, ambulante o empleado",
});

/** N° de carpeta: vacío = automático (el que sigue). */
const schemaCodigo = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce
    .number({ error: "Poné el número de carpeta" })
    .int("El número de carpeta va sin comas ni puntos")
    .min(1, "El número de carpeta tiene que ser mayor a cero")
    .max(999_999_999, "El número de carpeta es demasiado largo")
    .optional()
);

const schemaDatosCliente = z.object({
  nombre: z
    .string({ error: "Poné el nombre del cliente" })
    .trim()
    .min(1, "Poné el nombre del cliente")
    .max(200, "El nombre es demasiado largo"),
  apodo: z
    .string()
    .trim()
    .max(80, "El apodo es demasiado largo")
    .optional()
    .transform((v) => (v ? v : null)),
  tipo_persona: z
    .enum(["fisica", "juridica"], { error: "Elegí si es persona o empresa" })
    .optional(),
  cuit: textoOpcional,
  telefono: textoOpcional,
  email: textoOpcional.refine(
    (v) => v === null || /^\S+@\S+\.\S+$/.test(v),
    "El email no parece válido (ej.: nombre@correo.com)"
  ),
  direccion: textoOpcional,
  codigo: schemaCodigo,
  cuotas_mes: schemaCuotasMes.optional(),
  notas: z
    .string()
    .trim()
    .max(2000, "Las notas son demasiado largas")
    .optional()
    .transform((v) => (v ? v : null)),
  categoria: schemaCategoria.optional(),
  es_socio: z.boolean({ error: "Elegí si es socio: Sí o No" }).optional(),
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

/** Porcentaje del precio que paga el cliente (1 a 1000, hasta 2 decimales; acepta "70,5").
 * Más de 100 = más que un concepto entero (125 = una y cuarto; 400 = cuatro galpones). */
const schemaPorcentaje = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce
    .number({ error: "Poné el porcentaje (de 1 a 1000)" })
    .min(1, "El porcentaje va de 1 a 1000")
    .max(1000, "El porcentaje va de 1 a 1000")
    .refine((v) => Math.round(v * 100) === v * 100, "El porcentaje admite hasta 2 decimales")
);

/** Conceptos que se cargan junto con el alta (cantidad 0 = no se manda). */
const schemaConceptosAlta = z
  .array(
    z.object({
      concepto_id: z.string().min(1, "Falta el concepto"),
      cantidad: schemaCantidad,
      porcentaje: schemaPorcentaje.optional(),
    })
  )
  .max(30, "Son demasiados conceptos")
  .optional();

/** Etiquetas humanas de los campos del cliente, para los resúmenes. */
const LABEL_CAMPO: Record<keyof DatosClienteValidados, string> = {
  nombre: "nombre",
  apodo: "apodo",
  tipo_persona: "persona",
  cuit: "CUIT/DNI",
  telefono: "teléfono",
  email: "email",
  direccion: "dirección",
  codigo: "N° de carpeta",
  cuotas_mes: "cuotas del mes",
  notas: "notas",
  categoria: "categoría",
  es_socio: "si es socio",
};

/* ------------------------------------------------------------------ */
/* Cliente: alta, edición, baja                                        */
/* ------------------------------------------------------------------ */

export async function crearCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = schemaDatosCliente
    .extend({
      conceptos: schemaConceptosAlta,
      // Un uuid por intento: doble toque o reintento sin red = una sola alta (§4.0-5).
      ref: z.uuid("Recargá la página y probá de nuevo.").optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { conceptos: conceptosAlta, codigo: codigoElegido, ref, ...datos } = parsed.data;
  const categoria: CategoriaCliente =
    datos.categoria ?? (perfil.rol === "guardia" ? "quintero" : "puestero");
  if (!categoriasDeRol(perfil.rol).includes(categoria))
    return fallo(mensajeCategoriaAjena(perfil.rol));
  const esAmbulante = categoria === "ambulante";
  // Empleado (0040): solo alquila cochera. Alcanza con el nombre; no es socio ni paga en cuotas.
  const esEmpleado = categoria === "empleado";

  const supabase = await createClient();

  // Un renglón por concepto (si viniera repetido, gana el último) y pertenencia a MI
  // organización antes de proponer nada. El alta del ambulante va sin conceptos (paga por
  // día); si alquila cochera o quinta, se le agrega después desde su carpeta.
  const cantidadPorConcepto = new Map(
    esAmbulante ? [] : (conceptosAlta ?? []).map((c) => [c.concepto_id, c.cantidad])
  );
  const porcentajePorConcepto = new Map(
    esAmbulante ? [] : (conceptosAlta ?? []).map((c) => [c.concepto_id, c.porcentaje ?? 100])
  );
  const conceptoIds = [...cantidadPorConcepto.keys()];
  if (conceptoIds.length > 0) {
    const { data: propios, error: errorConceptos } = await supabase
      .from("conceptos")
      .select("id")
      .in("id", conceptoIds)
      .eq("org_id", perfil.org_id);
    if (errorConceptos) return fallo(errorConceptos.message);
    if ((propios ?? []).length !== conceptoIds.length)
      return fallo(
        "Alguno de los conceptos elegidos no existe. Recargá la página y probá de nuevo."
      );
  }

  // N° de carpeta: el elegido o el que sigue. Si es automático y otro lo tomó en el
  // medio, la RPC dice cuál usar y se reintenta una vez con ese.
  let codigo = codigoElegido;
  if (codigo === undefined) {
    const { data: siguiente, error: errorCodigo } = await supabase.rpc("siguiente_codigo_cliente");
    if (errorCodigo) return fallo(errorCodigo.message);
    codigo = Number(siguiente);
  }

  const payload = (n: number): Record<string, Json> => ({
    codigo: n,
    nombre: datos.nombre,
    apodo: datos.apodo,
    tipo_persona: esAmbulante || esEmpleado ? "fisica" : (datos.tipo_persona ?? "fisica"),
    cuit: esEmpleado ? null : datos.cuit,
    telefono: esEmpleado ? null : datos.telefono,
    email: esAmbulante || esEmpleado ? null : datos.email,
    direccion: esAmbulante || esEmpleado ? null : datos.direccion,
    notas: datos.notas,
    categoria,
    es_socio: esAmbulante || esEmpleado ? false : (datos.es_socio ?? false),
    ...(esAmbulante || esEmpleado
      ? {}
      : datos.cuotas_mes !== undefined
        ? { cuotas_mes: datos.cuotas_mes }
        : {}),
    conceptos: conceptoIds.map((concepto_id) => {
      const porcentaje = porcentajePorConcepto.get(concepto_id) ?? 100;
      return {
        concepto_id,
        cantidad: cantidadPorConcepto.get(concepto_id) ?? 1,
        ...(porcentaje !== 100 ? { porcentaje } : {}),
      };
    }),
    ...(ref ? { ref } : {}),
  });
  const resumen = (n: number) =>
    `Alta de ${LABEL_CATEGORIA[categoria].toLowerCase()} ${datos.nombre} (N° ${n})`;

  let res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "alta",
    entidadId: null,
    datos: payload(codigo),
    resumen: resumen(codigo),
  });
  const sugerido = !res.ok && codigoElegido === undefined ? /usá el (\d+)/.exec(res.error) : null;
  if (sugerido) {
    codigo = Number(sugerido[1]);
    res = await solicitarCambio(supabase, {
      entidad: "cliente",
      accion: "alta",
      entidadId: null,
      datos: payload(codigo),
      resumen: resumen(codigo),
    });
  }
  if (!res.ok) return res;

  revalidarCliente(res.data.id);
  revalidatePath("/inicio");
  // Repetido: el N° es el del primer intento (no lo sabemos acá); no se muestra uno equivocado.
  return ok({ ...res.data, codigo: res.data.repetido ? undefined : codigo, categoria });
}

export async function editarCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = schemaDatosCliente
    .partial()
    .extend({ id: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const { id, ...datos } = parsed.data;
  // Solo se comparan las claves que mandó el formulario (los opcionales vacíos se
  // transforman en null y, si no, "borrarían" datos que ni se mostraron).
  const enviadas = new Set(input && typeof input === "object" ? Object.keys(input) : []);
  const supabase = await createClient();
  const gestion = await clienteGestionable(supabase, id, perfil);
  if (!gestion.ok) return fallo(gestion.error);

  // Solo viajan las claves que cambian: así el Líder ve un diff limpio.
  const { data: actual } = await supabase
    .from("clientes")
    .select(
      "nombre, apodo, tipo_persona, cuit, telefono, email, direccion, codigo, cuotas_mes, notas, categoria, es_socio, auth_user_id"
    )
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!actual) return fallo("Ese cliente no existe");

  if (datos.categoria && datos.categoria !== actual.categoria) {
    if (!categoriasDeRol(perfil.rol).includes(datos.categoria))
      return fallo(mensajeCategoriaAjena(perfil.rol));
    if (!tienePortal(datos.categoria) && actual.auth_user_id)
      return fallo(
        `Un ${LABEL_CATEGORIA[datos.categoria].toLowerCase()} no puede tener acceso al portal: quitale el acceso primero`
      );
  }
  const categoriaFinal = datos.categoria ?? actual.categoria;
  // Ni el ambulante ni el empleado son socios (no se les pregunta): si pasa a serlo, deja de ser socio.
  if (categoriaFinal === "ambulante" || categoriaFinal === "empleado") {
    datos.es_socio = false;
    enviadas.add("es_socio");
  }

  const cambios: Record<string, Json> = {};
  const camposCambiados: (keyof DatosClienteValidados)[] = [];
  for (const campo of Object.keys(datos) as (keyof DatosClienteValidados)[]) {
    const nuevo = datos[campo];
    if (nuevo === undefined || !enviadas.has(campo)) continue;
    const viejo = actual[campo] ?? null;
    if ((nuevo ?? null) !== viejo) {
      cambios[campo] = nuevo ?? null;
      camposCambiados.push(campo);
    }
  }
  if (camposCambiados.length === 0)
    return fallo("No cambiaste ningún dato. Corregí algo y volvé a guardar.");

  // Resumen humano: lo que el Líder lee en Aprobaciones sin abrir el detalle.
  let resumen: string;
  if (camposCambiados.length === 1 && camposCambiados[0] === "es_socio") {
    resumen = cambios.es_socio
      ? `Marcar a ${actual.nombre} como socio de la cooperativa`
      : `${actual.nombre} deja de ser socio de la cooperativa`;
  } else if (camposCambiados.includes("categoria")) {
    const de = LABEL_CATEGORIA[actual.categoria as CategoriaCliente].toLowerCase();
    const a = LABEL_CATEGORIA[categoriaFinal as CategoriaCliente].toLowerCase();
    const resto = camposCambiados.filter((c) => c !== "categoria" && c !== "es_socio");
    // Lo mensual que deja de facturarse al aplicarse (private.aplicar_cambio, 0024): el
    // Líder lo lee en Aprobaciones antes de aprobar.
    const { data: activos } = await supabase
      .from("cliente_conceptos")
      .select("conceptos(codigo, tipo, segmento)")
      .eq("cliente_id", id)
      .eq("activo", true);
    const dejaDe = (activos ?? [])
      .flatMap((i) => (i.conceptos ? [i.conceptos] : []))
      .filter(
        (c) =>
          c.tipo === "recurrente" &&
          !conceptoSigueConCategoria(c.segmento, categoriaFinal as CategoriaCliente)
      )
      .map((c) => c.codigo);
    const efectos = dejaDe.length > 0 ? [`deja de facturarse ${enumerar(dejaDe)}`] : [];
    if (categoriaFinal === "ambulante" || categoriaFinal === "empleado") {
      // También se liberan sus lugares del plano y se desactivan sus medidores (0024). El
      // Jefe no lee espacios: lugares_del_cliente devuelve los del cliente que gestiona.
      // El empleado conserva sus cocheras (0040); el ambulante, sus cocheras y sus quintas
      // (0045, 0047).
      const [{ data: todos }, { data: medidores }] = await Promise.all([
        supabase.rpc("lugares_del_cliente", { p_cliente: id }),
        supabase.from("medidores").select("numero").eq("cliente_id", id).eq("activo", true).order("numero"),
      ]);
      const seQueda = categoriaFinal === "ambulante" ? ["cochera", "quinta"] : ["cochera"];
      const lugares = (todos ?? []).filter((e) => !seQueda.includes(e.tipo));
      const conserva = (todos ?? []).filter((e) => seQueda.includes(e.tipo));
      if (lugares.length > 0)
        efectos.push(
          `se libera${lugares.length > 1 ? "n" : ""} ${enumerar(lugares.map((e) => etiquetaEspacio(e)))}`
        );
      if (conserva.length > 0) efectos.push(`conserva ${enumerar(conserva.map((e) => etiquetaEspacio(e)))}`);
      if (medidores && medidores.length > 0)
        efectos.push(
          `se desactiva${medidores.length > 1 ? "n los medidores" : " el medidor"} N° ${enumerar(medidores.map((m) => m.numero))}`
        );
    }
    resumen = `Pasar a ${actual.nombre} de ${de} a ${a}${
      resto.length > 0 ? ` y cambiar ${enumerar(resto.map((c) => LABEL_CAMPO[c]))}` : ""
    }${efectos.length > 0 ? ` (${efectos.join("; ")})` : ""}`;
  } else {
    resumen = `Cambiar ${enumerar(camposCambiados.map((c) => LABEL_CAMPO[c]))} de ${actual.nombre}`;
  }

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "modificacion",
    entidadId: id,
    datos: cambios,
    resumen,
  });
  if (!res.ok) return res;

  revalidarCliente(id);
  return ok({ ...res.data, id });
}

export async function editarCuotasMes(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = z
    .object({ clienteId: z.string().min(1), cuotas_mes: schemaCuotasMes })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);
  if (cliente.categoria === "ambulante")
    return fallo("Al ambulante se le cobra por día: no paga en cuotas.");
  if (cliente.categoria === "empleado")
    return fallo("Al empleado se le cobra la cochera en un solo pago por mes.");

  const res = await solicitarCambio(supabase, {
    entidad: "cliente",
    accion: "modificacion",
    entidadId: parsed.data.clienteId,
    datos: { cuotas_mes: parsed.data.cuotas_mes },
    resumen: `Cambiar cómo paga el mes ${cliente.nombre}: ${textoCuotas(parsed.data.cuotas_mes)}`,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  return res;
}

/** Baja lógica del cliente (activo = false), con el motivo en el resumen. */
export async function darDeBajaCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
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
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);

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
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = z.object({ clienteId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);

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
 * Administración (sobre puesteros) y el Líder (§7.3).
 */
export async function registrarDeudaAnterior(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = schemaDeudaAnterior.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);

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
  if (error) return fallo(error.message);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/cobranza");
  return ok(undefined);
}

/**
 * Anula una deuda anterior (RD) cargada por error, con motivo (RPC anular_cargo_manual,
 * 0024): queda "Anulado", con quién, cuándo y por qué. Si se le había aplicado saldo a
 * favor, vuelve al cliente; si ya se cobró en caja, pide anular primero ese cobro.
 * Administración (sobre puesteros) y el Líder, igual que el alta (§7.3).
 */
export async function anularCargoManual(
  input: unknown
): Promise<ActionResult<{ repetido: boolean; creditoDevuelto: number }>> {
  await requireRol("admin", "lider");
  const parsed = z
    .object({
      cargoId: z.uuid("No encontramos ese cargo. Recargá la página."),
      clienteId: z.uuid("No encontramos el cliente. Recargá la página."),
      motivo: z
        .string("Contá por qué se anula (ej.: se tipeó mal el monto).")
        .trim()
        .min(3, "Contá por qué se anula (ej.: se tipeó mal el monto).")
        .max(300, "El motivo es demasiado largo"),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("anular_cargo_manual", {
    p_cargo: parsed.data.cargoId,
    p_motivo: parsed.data.motivo,
  });
  if (error) return fallo(error.message);

  const r = (data ?? {}) as { repetido?: boolean; credito_devuelto?: number | string };
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/cobranza", "layout");
  return ok({ repetido: Boolean(r.repetido), creditoDevuelto: Number(r.credito_devuelto ?? 0) });
}

/** Aplica el saldo a favor del cliente a sus cargos pendientes (RPC). */
export async function aplicarSaldoFavor(
  input: unknown
): Promise<ActionResult<{ aplicado: number }>> {
  await requireRol(...ROLES_GESTION);
  const parsed = z.object({ clienteId: z.uuid() }).safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aplicar_saldo_favor_cliente", {
    p_cliente: parsed.data.clienteId,
  });
  if (error) return fallo(error.message);

  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/cobranza");
  return ok({ aplicado: Number(data ?? 0) });
}

/* ------------------------------------------------------------------ */
/* Conceptos del cliente (qué paga) — firmas congeladas (§6.10, M9)    */
/* ------------------------------------------------------------------ */

export async function agregarConceptoCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      conceptoId: z.string().min(1, "Elegí el concepto que va a pagar"),
      cantidad: schemaCantidad,
      porcentaje: schemaPorcentaje.optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);
  const { data: concepto } = await supabase
    .from("conceptos")
    .select("id, nombre, tipo, segmento")
    .eq("id", parsed.data.conceptoId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!concepto) return fallo("Ese concepto no existe. Recargá la página y probá de nuevo.");
  if (concepto.tipo === "recurrente" && !conceptoSigueConCategoria(concepto.segmento, cliente.categoria))
    return fallo(mensajeNoCorresponde(cliente.categoria));

  const res = await solicitarCambio(supabase, {
    entidad: "cliente_concepto",
    accion: "alta",
    entidadId: null,
    datos: {
      cliente_id: parsed.data.clienteId,
      concepto_id: parsed.data.conceptoId,
      cantidad: parsed.data.cantidad,
      ...(parsed.data.porcentaje !== undefined && parsed.data.porcentaje !== 100
        ? { porcentaje: parsed.data.porcentaje }
        : {}),
    },
    resumen: `Agregar ${concepto.nombre} × ${formatFraccion(parsed.data.cantidad)}${
      parsed.data.porcentaje !== undefined && parsed.data.porcentaje !== 100
        ? ` al ${formatPorcentaje(parsed.data.porcentaje)}`
        : ""
    } a ${cliente.nombre}`,
    clienteId: parsed.data.clienteId,
  });
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  revalidatePath("/mapa");
  return res;
}

export async function editarConceptoCliente(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol(...ROLES_GESTION);
  const parsed = z
    .object({
      id: z.string().min(1),
      clienteId: z.string().min(1),
      cantidad: schemaCantidad.optional(),
      porcentaje: schemaPorcentaje.optional(),
      activo: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const cambios: Record<string, Json> = {};
  if (parsed.data.cantidad !== undefined) cambios.cantidad = parsed.data.cantidad;
  if (parsed.data.porcentaje !== undefined) cambios.porcentaje = parsed.data.porcentaje;
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;
  if (Object.keys(cambios).length === 0)
    return fallo("No hay cambios para guardar.");

  const supabase = await createClient();
  const cliente = await clienteGestionable(supabase, parsed.data.clienteId, perfil);
  if (!cliente.ok) return fallo(cliente.error);
  const { data: item } = await supabase
    .from("cliente_conceptos")
    .select("id, cliente_id, cantidad, porcentaje, activo, conceptos(nombre, tipo, segmento)")
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!item || item.cliente_id !== parsed.data.clienteId)
    return fallo("Ese concepto ya no está en la carpeta del cliente.");
  // Lo que ya no corresponde a su categoría solo se puede apagar (la base lo rechaza igual).
  const quedaActivo = parsed.data.activo ?? item.activo;
  if (
    quedaActivo &&
    item.conceptos?.tipo === "recurrente" &&
    !conceptoSigueConCategoria(item.conceptos.segmento, cliente.categoria)
  )
    return fallo(mensajeNoCorresponde(cliente.categoria));

  const concepto = item.conceptos?.nombre ?? "el concepto";

  // Resumen humano según qué se toca.
  let resumen: string;
  let accion: Accion = "modificacion";
  const tocaMonto = parsed.data.cantidad !== undefined || parsed.data.porcentaje !== undefined;
  if (parsed.data.activo === false && !tocaMonto) {
    accion = "baja";
    resumen = `Dejar de facturar ${concepto} a ${cliente.nombre}`;
  } else if (parsed.data.activo === true && !tocaMonto) {
    resumen = `Volver a facturar ${concepto} a ${cliente.nombre}`;
  } else {
    // "× 4 al 100 %" → "× 4 al 70 %": se muestra solo lo que cambia.
    const antes: string[] = [];
    const despues: string[] = [];
    if (parsed.data.cantidad !== undefined && parsed.data.cantidad !== Number(item.cantidad)) {
      antes.push(`× ${formatFraccion(item.cantidad)}`);
      despues.push(`× ${formatFraccion(parsed.data.cantidad)}`);
    }
    if (parsed.data.porcentaje !== undefined && parsed.data.porcentaje !== Number(item.porcentaje)) {
      antes.push(`al ${formatPorcentaje(item.porcentaje)}`);
      despues.push(`al ${formatPorcentaje(parsed.data.porcentaje)}`);
    }
    resumen = `Cambiar ${concepto} de ${cliente.nombre}: ${antes.join(" ") || "sin cambios"} → ${despues.join(" ") || "sin cambios"}`;
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
  revalidatePath("/mapa");
  return res;
}

/**
 * "Eximir del abono" de energía (ABEN, I1): un cliente_concepto ABEN con activo = false.
 * Energía es de Administración para todas las categorías (§4.7): por eso no mira la
 * categoría del cliente. Se vuelve a cobrar con `eximir: false`.
 */
export async function eximirAbono(
  input: unknown
): Promise<ActionResult<ResultadoCambio>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = z
    .object({ clienteId: z.uuid("No encontramos el cliente. Recargá la página."), eximir: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  const [clienteRes, abenRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("nombre")
      .eq("id", parsed.data.clienteId)
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
    supabase
      .from("conceptos")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("codigo", "ABEN")
      .maybeSingle(),
  ]);
  if (!clienteRes.data) return fallo("Ese cliente no existe");
  if (!abenRes.data)
    return fallo("Falta el concepto ABEN (Abono mensual de energía) en Configuración.");
  const nombre = clienteRes.data.nombre;

  const { data: item } = await supabase
    .from("cliente_conceptos")
    .select("id, activo")
    .eq("cliente_id", parsed.data.clienteId)
    .eq("concepto_id", abenRes.data.id)
    .maybeSingle();

  let res: ActionResult<ResultadoCambio>;
  if (parsed.data.eximir) {
    if (item && !item.activo) return fallo(`${nombre} ya está eximido del abono.`);
    res = item
      ? await solicitarCambio(supabase, {
          entidad: "cliente_concepto",
          accion: "modificacion",
          entidadId: item.id,
          datos: { activo: false },
          resumen: `Eximir del abono de energía a ${nombre}`,
          clienteId: parsed.data.clienteId,
        })
      : await solicitarCambio(supabase, {
          entidad: "cliente_concepto",
          accion: "alta",
          entidadId: null,
          datos: {
            cliente_id: parsed.data.clienteId,
            concepto_id: abenRes.data.id,
            cantidad: 1,
            activo: false,
          },
          resumen: `Eximir del abono de energía a ${nombre}`,
          clienteId: parsed.data.clienteId,
        });
  } else {
    if (!item || item.activo) return fallo(`${nombre} ya paga el abono.`);
    res = await solicitarCambio(supabase, {
      entidad: "cliente_concepto",
      accion: "modificacion",
      entidadId: item.id,
      datos: { activo: true },
      resumen: `Volver a cobrar el abono de energía a ${nombre}`,
      clienteId: parsed.data.clienteId,
    });
  }
  if (!res.ok) return res;

  revalidarCliente(parsed.data.clienteId);
  revalidatePath("/energia");
  revalidatePath("/facturacion");
  return res;
}

/* ------------------------------------------------------------------ */
/* Medidores de luz (escritura directa: no pasan por aprobación)       */
/* ------------------------------------------------------------------ */

function esDuplicado(error: { code?: string | null }): boolean {
  return error.code === "23505";
}

const schemaEspacioId = z
  .uuid("No reconocemos ese lugar del plano. Recargá la página.")
  .nullable()
  .optional();

/** Lugar del plano de mi organización → "Puesto 58" (lo que se guarda como ubicación legible). */
async function lugarDelPlano(
  supabase: Supabase,
  espacioId: string,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("espacios")
    .select("tipo, numero, medio, propio")
    .eq("id", espacioId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ? etiquetaEspacio(data) : null;
}

export async function crearMedidor(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = z
    .object({
      clienteId: z.string().min(1),
      numero: z
        .string()
        .trim()
        .min(1, "Poné el número del medidor")
        .max(50, "El número es demasiado largo"),
      espacioId: schemaEspacioId,
      ubicacion: textoOpcional,
    })
    .safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  const supabase = await createClient();
  // Energía es de Administración para todos los clientes (no mira la categoría).
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", parsed.data.clienteId)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!cliente) return fallo("Ese cliente no existe");

  let ubicacion = parsed.data.ubicacion;
  const espacioId = parsed.data.espacioId ?? null;
  if (espacioId) {
    const etiqueta = await lugarDelPlano(supabase, espacioId, perfil.org_id);
    if (!etiqueta) return fallo("Ese lugar del plano no existe. Recargá la página y probá de nuevo.");
    ubicacion = etiqueta;
  }

  const { error } = await supabase.from("medidores").insert({
    org_id: perfil.org_id,
    cliente_id: parsed.data.clienteId,
    numero: parsed.data.numero,
    ubicacion,
    espacio_id: espacioId,
  });

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya hay un medidor cargado con ese número.");
    return fallo(error.message);
  }
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/energia");
  return ok(undefined);
}

export async function editarMedidor(
  input: unknown
): Promise<ActionResult<void>> {
  const perfil = await requireRol("admin", "lider");
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
      // undefined = no se toca · null = "Otro lugar (sin plano)" · uuid = lugar del plano
      espacioId: schemaEspacioId,
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

  const supabase = await createClient();
  const cambios: {
    numero?: string;
    ubicacion?: string | null;
    espacio_id?: string | null;
    activo?: boolean;
  } = {};
  if (parsed.data.numero !== undefined) cambios.numero = parsed.data.numero;
  if (parsed.data.ubicacion !== undefined) cambios.ubicacion = parsed.data.ubicacion;
  if (parsed.data.espacioId !== undefined) {
    cambios.espacio_id = parsed.data.espacioId;
    if (parsed.data.espacioId) {
      const etiqueta = await lugarDelPlano(supabase, parsed.data.espacioId, perfil.org_id);
      if (!etiqueta)
        return fallo("Ese lugar del plano no existe. Recargá la página y probá de nuevo.");
      cambios.ubicacion = etiqueta;
    }
  }
  if (parsed.data.activo !== undefined) cambios.activo = parsed.data.activo;
  if (Object.keys(cambios).length === 0)
    return fallo("No hay cambios para guardar.");

  const { data, error } = await supabase
    .from("medidores")
    .update(cambios)
    .eq("id", parsed.data.id)
    .eq("org_id", perfil.org_id)
    .eq("cliente_id", parsed.data.clienteId)
    .select("id");

  if (error) {
    if (esDuplicado(error))
      return fallo("Ya hay un medidor cargado con ese número.");
    return fallo(error.message);
  }
  if (!data || data.length === 0)
    return fallo("Ese medidor ya no está en la carpeta. Recargá la página.");
  revalidatePath(`/clientes/${parsed.data.clienteId}`);
  revalidatePath("/energia");
  return ok(undefined);
}
