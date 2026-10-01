"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hayClaveAdmin } from "@/lib/supabase/admin";
import { requireRol, type Perfil, type Rol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";
import { ROLES_ASIGNABLES_STAFF, puedeGestionarRol, LABEL_ROL } from "@/lib/roles";
import { esDniValido, formatDni, normalizarDni } from "@/lib/format";
import {
  categoriasDeRol,
  LABEL_CATEGORIA_PLURAL,
  tienePortal,
  type CategoriaCliente,
} from "@/lib/segmentos";

/*
 * Gestión de usuarios (F1–F5, contrato §4.11):
 *  - Líder: todo el staff y los socios. Administración: socios. Jefe de Portería: Portería.
 *  - Todo lo que toca Auth con el service role (crear, contraseña, cortar la sesión) pasa
 *    PRIMERO por la base con el cliente del USUARIO: la RLS de perfiles (altas) o
 *    `autorizar_gestion_usuario` (el rol del objetivo se lee de la base, nunca del cliente).
 *  - El perfil siempre se escribe con el cliente del usuario (RLS + trigger proteger_perfiles:
 *    deja `creado_por` y `desactivado_por/en`). Si el perfil falla, se borra el usuario de Auth.
 *  - El usuario entra con su DNI. Si no hay email real, se usa uno técnico que nunca se muestra.
 */

const DOMINIO_TECNICO = "usuarios.sanmiguel.coop";
const SIN_CLAVE =
  "Para crear usuarios o cambiar contraseñas falta la SUPABASE_SECRET_KEY en el servidor. Avisale al que instaló el sistema.";
/** "Quitar acceso" corta también la sesión abierta (ban largo; "Devolver acceso" lo levanta). */
const BAN_SIN_ACCESO = "876000h";

type ClienteServidor = Awaited<ReturnType<typeof createClient>>;

function emailTecnico(dni: string, sufijo?: string): string {
  return sufijo ? `${dni}.${sufijo}@${DOMINIO_TECNICO}` : `${dni}@${DOMINIO_TECNICO}`;
}

function esEmailTecnico(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${DOMINIO_TECNICO}`));
}

/* ---------- Validaciones comunes ---------- */

const dniSchema = z
  .string("Poné el DNI.")
  .transform((v) => normalizarDni(v))
  .refine((v) => esDniValido(v), "El DNI tiene 7 u 8 números.");

const passwordSchema = z
  .string("Poné la contraseña.")
  .min(8, "La contraseña tiene que tener al menos 8 letras o números.")
  .max(72, "La contraseña es demasiado larga.");

const nombreSchema = z
  .string("Poné el nombre y apellido.")
  .trim()
  .min(3, "Poné el nombre y apellido.")
  .max(80, "El nombre es demasiado largo.");

const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.email().safeParse(v).success, "Ese email no parece válido.");

/** Mensaje amable para errores de la base al escribir perfiles. */
function errorPerfil(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "Ya hay un usuario con ese DNI.";
  if (error.code === "42501") return "No podés gestionar a ese usuario.";
  return error.message?.replace(/^.*?: /, "") || "No pudimos guardar el usuario. Probá de nuevo.";
}

/**
 * ¿El DNI ya tiene usuario? Se mira con el cliente admin (la RLS esconde socios al Jefe).
 * `rolNuevo` es el rol del usuario que se está creando o editando: un mismo DNI no
 * puede tener dos usuarios (perfiles_dni_unq), así que alguien del equipo no puede
 * tener además el portal de socio (ni al revés): se explica en vez de mandar a
 * "devolverle el acceso", que no le daría lo que busca.
 */
async function dniOcupado(
  dni: string,
  perfil: Perfil,
  rolNuevo: Rol,
  excluirUserId?: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("perfiles")
    .select("user_id, nombre, rol, org_id")
    .eq("dni", dni)
    .maybeSingle();
  if (!data || data.user_id === excluirUserId) return null;
  const dniTexto = formatDni(dni);

  if (data.org_id !== perfil.org_id) return `Ya hay un usuario con el DNI ${dniTexto}.`;

  // Socio contra equipo: con el mismo DNI no puede haber otro usuario.
  // Solo el Líder ve quién es y con qué rol entra. A Administración y al Jefe no se
  // les dice ni el rol ni el tipo (equipo o portal): probando DNIs podrían averiguar
  // quién es socio o qué rol tiene alguien del equipo. Reciben el mismo texto que
  // cuando el DNI es de alguien que no gestionan.
  if ((data.rol === "socio") !== (rolNuevo === "socio")) {
    if (perfil.rol !== "lider") {
      return `Ya hay un usuario con el DNI ${dniTexto}. Un mismo DNI no puede tener dos usuarios: consultalo con el Líder de Procesos.`;
    }
    const loQueFalta = rolNuevo === "socio" ? "el acceso al portal" : "un usuario del equipo";
    return `${data.nombre} ya entra al sistema como ${LABEL_ROL[data.rol]} con el DNI ${dniTexto}. Un mismo DNI no puede tener dos usuarios: por ahora no se le puede dar ${loQueFalta}.`;
  }

  // Mismo tipo: el nombre solo si es alguien que este rol ve y gestiona (no filtra socios al Jefe).
  return puedeGestionarRol(perfil.rol, data.rol)
    ? `Ya hay un usuario con el DNI ${dniTexto}: ${data.nombre}. Si es la misma persona, devolvele el acceso o dale una contraseña nueva.`
    : perfil.rol === "lider"
      ? `Ya hay un usuario con el DNI ${dniTexto}.`
      : `Ya hay un usuario con el DNI ${dniTexto}. Un mismo DNI no puede tener dos usuarios: consultalo con el Líder de Procesos.`;
}

/** Crea el usuario de Auth (email real o técnico). Devuelve el id o un error legible. */
async function crearUsuarioAuth(
  dni: string,
  nombre: string,
  password: string,
  email: string | undefined
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const intentos = email ? [email] : [emailTecnico(dni), emailTecnico(dni, crypto.randomUUID().slice(0, 6))];
  for (const [i, direccion] of intentos.entries()) {
    const { data, error } = await admin.auth.admin.createUser({
      email: direccion,
      password,
      email_confirm: true,
      user_metadata: { nombre, dni },
    });
    if (!error && data?.user) return { ok: true, userId: data.user.id };
    const codigo = error && "code" in error ? String(error.code) : "";
    const yaExiste =
      codigo === "email_exists" || (error?.message ?? "").toLowerCase().includes("already");
    if (yaExiste && email) {
      return { ok: false, error: "Ya hay un usuario con ese email. Dejalo vacío o usá otro." };
    }
    // El email técnico quedó tomado (un DNI que se cambió): se reintenta con un sufijo.
    if (yaExiste && i < intentos.length - 1) continue;
    if (codigo === "weak_password") {
      return { ok: false, error: "Esa contraseña es muy fácil. Generá otra." };
    }
    return { ok: false, error: "No pudimos crear el usuario. Probá de nuevo en un momento." };
  }
  return { ok: false, error: "No pudimos crear el usuario. Probá de nuevo en un momento." };
}

/** El candado de la base antes de todo auth.admin.* (§4.11). Devuelve el rol del objetivo. */
async function autorizar(
  supabase: ClienteServidor,
  userId: string,
  accion: "resetear_contrasena" | "quitar_acceso" | "devolver_acceso" | "editar"
): Promise<{ ok: true; rol: Rol } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("autorizar_gestion_usuario", {
    p_user: userId,
    p_accion: accion,
  });
  if (error || !data) {
    // Los mensajes de la función ya vienen en castellano ("No podés gestionar a ese usuario").
    return { ok: false, error: error?.message || "No podés gestionar a ese usuario." };
  }
  return { ok: true, rol: data };
}

function revalidarUsuarios() {
  revalidatePath("/configuracion");
  revalidatePath("/inicio");
}

/* ---------- Alta de usuario del equipo (Líder: todo el staff · Jefe: Portería) ---------- */

const nuevoUsuarioSchema = z.object({
  nombre: nombreSchema,
  dni: dniSchema,
  rol: z.enum(ROLES_ASIGNABLES_STAFF as [Rol, ...Rol[]], "Elegí qué hace en la cooperativa."),
  password: passwordSchema,
  email: emailOpcional,
});

export type UsuarioCreado = { user_id: string; nombre: string; dni: string };

export async function crearUsuario(input: unknown): Promise<ActionResult<UsuarioCreado>> {
  const perfil = await requireRol("lider", "guardia");
  const parsed = nuevoUsuarioSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { nombre, dni, rol, password, email } = parsed.data;

  if (!puedeGestionarRol(perfil.rol, rol)) {
    return fallo(
      perfil.rol === "guardia"
        ? "Desde Portería solo se crean usuarios de Portería."
        : `No podés crear usuarios de ${LABEL_ROL[rol]}.`
    );
  }
  if (!hayClaveAdmin()) return fallo(SIN_CLAVE);

  const ocupado = await dniOcupado(dni, perfil, rol);
  if (ocupado) return fallo(ocupado);

  const auth = await crearUsuarioAuth(dni, nombre, password, email);
  if (!auth.ok) return fallo(auth.error);

  // El perfil con el cliente del usuario: la RLS "alta de perfiles" decide si puede
  // crear ese rol y la base firma el alta (creado_por).
  const supabase = await createClient();
  const { error } = await supabase.from("perfiles").insert({
    user_id: auth.userId,
    org_id: perfil.org_id,
    nombre,
    rol,
    activo: true,
    dni,
  });
  if (error) {
    await createAdminClient().auth.admin.deleteUser(auth.userId);
    return fallo(errorPerfil(error));
  }

  revalidarUsuarios();
  return ok({ user_id: auth.userId, nombre, dni });
}

/* ---------- Acceso al portal para un socio (Administración: puesteros · Líder: todos) ---------- */

const accesoSchema = z.object({
  cliente_id: z.uuid("Elegí el cliente."),
  nombre: nombreSchema,
  dni: dniSchema,
  password: passwordSchema,
  email: emailOpcional,
});

export async function crearAccesoSocio(input: unknown): Promise<ActionResult<UsuarioCreado>> {
  const perfil = await requireRol("admin", "lider");
  const parsed = accesoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { cliente_id, nombre, dni, password, email } = parsed.data;
  if (!hayClaveAdmin()) return fallo(SIN_CLAVE);

  const supabase = await createClient();
  const { data: cliente, error: errCliente } = await supabase
    .from("clientes")
    .select("id, nombre, categoria, auth_user_id, activo")
    .eq("id", cliente_id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errCliente) return fallo(errCliente);
  if (!cliente) return fallo("No encontramos ese cliente.");
  const categoria = cliente.categoria as CategoriaCliente;
  if (!tienePortal(categoria)) {
    return fallo(
      `Los ${LABEL_CATEGORIA_PLURAL[categoria].toLowerCase()} no tienen acceso al portal: es solo para puesteros y quinteros.`
    );
  }
  if (!categoriasDeRol(perfil.rol).includes(categoria)) {
    return fallo("A quinteros y ambulantes los gestiona el Jefe de Portería.");
  }
  if (!cliente.activo) return fallo("Ese cliente está dado de baja.");
  if (cliente.auth_user_id) return fallo(`${cliente.nombre} ya tiene acceso al portal.`);

  const ocupado = await dniOcupado(dni, perfil, "socio");
  if (ocupado) return fallo(ocupado);

  const auth = await crearUsuarioAuth(dni, nombre, password, email);
  if (!auth.ok) return fallo(auth.error);
  const admin = createAdminClient();

  // Perfil socio con el cliente del usuario (RLS: Administración y Líder gestionan socios).
  const { error: errPerfil } = await supabase.from("perfiles").insert({
    user_id: auth.userId,
    org_id: perfil.org_id,
    nombre,
    rol: "socio",
    activo: true,
    dni,
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(auth.userId);
    return fallo(errorPerfil(errPerfil));
  }

  // El vínculo cliente ↔ usuario lo escribe el servidor (la RLS de clientes es del Líder).
  // Solo si el cliente sigue sin acceso (dos altas a la vez no pisan una a la otra).
  const { data: vinculado, error: errVinculo } = await admin
    .from("clientes")
    .update({ auth_user_id: auth.userId })
    .eq("id", cliente_id)
    .eq("org_id", perfil.org_id)
    .is("auth_user_id", null)
    .select("id");
  if (errVinculo || !vinculado || vinculado.length === 0) {
    // Borrar el usuario de Auth borra el perfil en cascada.
    await admin.auth.admin.deleteUser(auth.userId);
    return fallo(
      errVinculo ? errVinculo : `${cliente.nombre} ya tiene acceso al portal (lo dio otra persona recién).`
    );
  }

  revalidarUsuarios();
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cliente_id}`);
  return ok({ user_id: auth.userId, nombre, dni });
}

/* ---------- Quitar / devolver acceso ---------- */

const activoSchema = z.object({
  user_id: z.uuid("No encontramos el usuario."),
  activo: z.boolean(),
});

export async function cambiarActivoUsuario(
  input: unknown
): Promise<ActionResult<{ sesionCortada: boolean }>> {
  const perfil = await requireRol("lider", "admin", "guardia");
  const parsed = activoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { user_id, activo } = parsed.data;

  if (user_id === perfil.user_id && !activo) {
    return fallo("No podés quitarte el acceso a vos mismo.");
  }

  const supabase = await createClient();
  // 1) Candado de la base (rol del objetivo leído de la base).
  const permiso = await autorizar(supabase, user_id, activo ? "devolver_acceso" : "quitar_acceso");
  if (!permiso.ok) return fallo(permiso.error);

  // 2) La tabla con el cliente del usuario: RLS + trigger (deja desactivado_por/en).
  const { data, error } = await supabase
    .from("perfiles")
    .update({ activo })
    .eq("user_id", user_id)
    .eq("org_id", perfil.org_id)
    .select("user_id");
  if (error) return fallo(error);
  if (!data || data.length === 0) return fallo("No podés gestionar a ese usuario.");

  // 3) Auth: cortar (o devolver) la sesión abierta. Si falla, el acceso a los datos
  //    igual quedó cortado (toda la RLS mira perfiles.activo).
  let sesionCortada = false;
  if (hayClaveAdmin()) {
    const { error: errBan } = await createAdminClient().auth.admin.updateUserById(user_id, {
      ban_duration: activo ? "none" : BAN_SIN_ACCESO,
    });
    sesionCortada = !errBan;
  }

  revalidarUsuarios();
  if (permiso.rol === "socio") revalidatePath("/clientes");
  return ok({ sesionCortada });
}

/* ---------- Nueva contraseña ---------- */

const contrasenaSchema = z.object({
  user_id: z.uuid("No encontramos el usuario."),
  password: passwordSchema,
});

export async function restablecerContrasena(
  input: unknown
): Promise<ActionResult<{ nombre: string; dni: string | null }>> {
  await requireRol("lider", "admin", "guardia");
  const parsed = contrasenaSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { user_id, password } = parsed.data;
  if (!hayClaveAdmin()) return fallo(SIN_CLAVE);

  const supabase = await createClient();
  const permiso = await autorizar(supabase, user_id, "resetear_contrasena");
  if (!permiso.ok) return fallo(permiso.error);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user_id, { password });
  if (error) {
    const codigo = "code" in error ? String(error.code) : "";
    return fallo(
      codigo === "weak_password"
        ? "Esa contraseña es muy fácil. Generá otra."
        : "No pudimos cambiar la contraseña. Probá de nuevo."
    );
  }

  // Rastro para el Líder (Correcciones): quién le cambió la contraseña a quién. Con el
  // cliente del USUARIO (la base vuelve a controlar el permiso y firma con auth.uid()).
  // La contraseña ya cambió: si el rastro falla no se deshace, solo se avisa en el log.
  const { error: errRastro } = await supabase.rpc("registrar_contrasena_nueva", { p_user: user_id });
  if (errRastro) console.error("registrar_contrasena_nueva", errRastro.message);

  const { data: objetivo } = await admin
    .from("perfiles")
    .select("nombre, dni")
    .eq("user_id", user_id)
    .maybeSingle();
  revalidatePath("/inicio");
  return ok({ nombre: objetivo?.nombre ?? "", dni: objetivo?.dni ?? null });
}

/* ---------- Editar nombre, DNI o rol ---------- */

const editarSchema = z.object({
  user_id: z.uuid("No encontramos el usuario."),
  nombre: nombreSchema.optional(),
  dni: dniSchema.optional(),
  rol: z.enum(ROLES_ASIGNABLES_STAFF as [Rol, ...Rol[]]).optional(),
});

export async function editarUsuario(input: unknown): Promise<ActionResult> {
  const perfil = await requireRol("lider", "admin", "guardia");
  const parsed = editarSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { user_id, nombre, dni, rol } = parsed.data;

  if (rol && perfil.rol !== "lider") return fallo("Solo el Líder de Procesos cambia roles.");
  if (rol && user_id === perfil.user_id) return fallo("No podés cambiar tu propio rol.");

  const supabase = await createClient();
  const permiso = await autorizar(supabase, user_id, "editar");
  if (!permiso.ok) return fallo(permiso.error);
  if (rol && permiso.rol === "socio") {
    return fallo("Un socio no puede pasar a ser del equipo: creá otro usuario.");
  }

  const { data: actual } = await supabase
    .from("perfiles")
    .select("nombre, dni, rol")
    .eq("user_id", user_id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (!actual) return fallo("No encontramos el usuario.");

  const cambios: { nombre?: string; dni?: string; rol?: Rol } = {};
  if (nombre && nombre !== actual.nombre) cambios.nombre = nombre;
  if (dni && dni !== actual.dni) cambios.dni = dni;
  if (rol && rol !== actual.rol) cambios.rol = rol;
  if (Object.keys(cambios).length === 0) return ok(undefined);

  if (cambios.dni) {
    if (!hayClaveAdmin()) return fallo(SIN_CLAVE);
    const ocupado = await dniOcupado(cambios.dni, perfil, cambios.rol ?? actual.rol, user_id);
    if (ocupado) return fallo(ocupado);
  }

  const { data, error } = await supabase
    .from("perfiles")
    .update(cambios)
    .eq("user_id", user_id)
    .eq("org_id", perfil.org_id)
    .select("user_id");
  if (error) return fallo(error.code === "23505" ? "Ya hay un usuario con ese DNI." : error);
  if (!data || data.length === 0) return fallo("No podés gestionar a ese usuario.");

  // Con email técnico, el email acompaña al DNI nuevo (el DNI viejo queda libre).
  // El login no depende de esto (resuelve DNI → email por el perfil): si falla, sigue andando.
  if (cambios.dni && hayClaveAdmin()) {
    const admin = createAdminClient();
    const { data: usuario } = await admin.auth.admin.getUserById(user_id);
    if (esEmailTecnico(usuario?.user?.email)) {
      await admin.auth.admin.updateUserById(user_id, {
        email: emailTecnico(cambios.dni),
        email_confirm: true,
      });
    }
  }

  revalidarUsuarios();
  if (permiso.rol === "socio") revalidatePath("/clientes");
  return ok(undefined);
}
