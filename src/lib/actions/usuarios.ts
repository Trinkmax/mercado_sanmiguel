"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hayClaveAdmin } from "@/lib/supabase/admin";
import { requireRol } from "@/lib/auth";
import { ok, fallo, type ActionResult } from "@/lib/actions/result";

/* ---------- Activar / desactivar usuarios del panel ---------- */

const activoSchema = z.object({
  user_id: z.uuid("No encontramos el usuario."),
  activo: z.boolean(),
});

export async function cambiarActivoUsuario(
  input: unknown
): Promise<ActionResult> {
  // Solo admin/consejo: la RLS de perfiles no deja escribir a tesorería.
  const perfil = await requireRol("admin", "consejo");
  const parsed = activoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);

  if (parsed.data.user_id === perfil.user_id && !parsed.data.activo) {
    return fallo("No podés desactivar tu propio usuario.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .update({ activo: parsed.data.activo })
    .eq("user_id", parsed.data.user_id)
    .eq("org_id", perfil.org_id)
    .select("user_id");
  if (error) return fallo(error);
  if (!data || data.length === 0) {
    return fallo("No tenés permiso para modificar este usuario.");
  }

  revalidatePath("/configuracion");
  return ok(undefined);
}

/* ---------- Acceso al portal para un socio ---------- */

const accesoSchema = z.object({
  cliente_id: z.uuid("Elegí el cliente."),
  email: z.email("Poné un email válido."),
  password: z
    .string("Poné la contraseña.")
    .min(8, "La contraseña tiene que tener al menos 8 caracteres."),
  nombre: z
    .string("Poné el nombre del socio.")
    .trim()
    .min(1, "Poné el nombre del socio."),
});

export async function crearAccesoSocio(
  input: unknown
): Promise<ActionResult<{ email: string }>> {
  const perfil = await requireRol("admin", "tesoreria", "consejo");
  if (!hayClaveAdmin()) {
    return fallo(
      "Para crear accesos de socios, cargá la SUPABASE_SECRET_KEY en el servidor (ver .env.local)."
    );
  }

  const parsed = accesoSchema.safeParse(input);
  if (!parsed.success) return fallo(parsed.error.issues[0].message);
  const { cliente_id, password, nombre } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  // El cliente tiene que ser de la organización y no tener acceso todavía.
  const supabase = await createClient();
  const { data: cliente, error: errCliente } = await supabase
    .from("clientes")
    .select("id, nombre, auth_user_id")
    .eq("id", cliente_id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();
  if (errCliente) return fallo(errCliente);
  if (!cliente) return fallo("No encontramos ese cliente.");
  if (cliente.auth_user_id) {
    return fallo("Ese cliente ya tiene acceso al portal.");
  }

  const admin = createAdminClient();

  // Crea el usuario. Si el email ya existe, avisamos claro.
  const { data: creado, error: errUsuario } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
    }
  );
  if (errUsuario || !creado?.user) {
    const codigo = errUsuario && "code" in errUsuario ? errUsuario.code : "";
    const mensaje = errUsuario?.message ?? "";
    if (
      codigo === "email_exists" ||
      mensaje.toLowerCase().includes("already")
    ) {
      return fallo("Ya existe un usuario con ese email. Usá otro.");
    }
    return fallo("No pudimos crear el usuario. Probá de nuevo.");
  }
  const userId = creado.user.id;

  // Perfil con rol socio.
  const { error: errPerfil } = await admin.from("perfiles").insert({
    user_id: userId,
    org_id: perfil.org_id,
    nombre,
    rol: "socio",
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(userId);
    return fallo(errPerfil);
  }

  // Vincula el usuario con el cliente.
  const { error: errVinculo } = await admin
    .from("clientes")
    .update({ auth_user_id: userId })
    .eq("id", cliente_id)
    .eq("org_id", perfil.org_id);
  if (errVinculo) {
    await admin.from("perfiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return fallo(errVinculo);
  }

  revalidatePath("/configuracion");
  revalidatePath("/clientes");
  return ok({ email });
}
