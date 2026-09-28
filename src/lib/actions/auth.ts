"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hayClaveAdmin } from "@/lib/supabase/admin";
import { destinoTrasEntrar, getPerfil, rutaInicio } from "@/lib/auth";
import { esDniValido, normalizarDni } from "@/lib/format";
import { modoDemoActivo } from "@/lib/demo";

/** `usuario` vuelve al formulario para no hacerle tipear el DNI de nuevo. */
export type EstadoLogin = { error: string; usuario?: string } | null;

/** Error único: nunca se dice si el DNI existe o si falló la contraseña. */
const ERROR_CREDENCIALES = "El DNI o la contraseña no son correctos.";
/** Si el DNI no existe se intenta igual con un email que no existe: misma respuesta, mismo tiempo. */
const EMAIL_INEXISTENTE = "no-existe@usuarios.sanmiguel.coop";
/** Tiempo mínimo de respuesta de un intento fallido (no filtra por tiempo si el DNI existe). */
const DEMORA_MINIMA_MS = 700;

async function completarDemora(inicio: number): Promise<void> {
  const falta = DEMORA_MINIMA_MS - (Date.now() - inicio);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
}

/**
 * Login por DNI (F4) o por email (compatibilidad).
 * El DNI se resuelve a email SOLO en el servidor, con el cliente admin y
 * `email_para_login` (que no está expuesta a nadie más): no hay forma de
 * preguntar desde afuera si un DNI tiene usuario.
 */
export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const inicio = Date.now();
  const usuario = String(formData.get("usuario") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const volver = formData.get("volver");

  if (!usuario) return { error: "Poné tu DNI.", usuario };
  if (!password) return { error: "Poné tu contraseña.", usuario };

  // Con letras o "@" es un email; si no, un DNI (acepta puntos y espacios).
  const esEmail = /[a-z@]/i.test(usuario);
  let email: string;
  if (esEmail) {
    email = usuario.toLowerCase();
  } else {
    const dni = normalizarDni(usuario);
    if (!esDniValido(dni)) {
      return { error: "El DNI tiene 7 u 8 números. Revisalo y probá de nuevo.", usuario };
    }
    if (!hayClaveAdmin()) {
      return {
        error: "El ingreso con DNI no está configurado. Entrá con tu email.",
        usuario,
      };
    }
    const { data, error } = await createAdminClient().rpc("email_para_login", { p_dni: dni });
    if (error) {
      await completarDemora(inicio);
      return { error: "No pudimos iniciar sesión. Probá de nuevo en un momento.", usuario };
    }
    email = data ?? EMAIL_INEXISTENTE;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await completarDemora(inicio);
    // "Quitar acceso" banea la sesión en Auth: se avisa lo mismo que con el perfil inactivo.
    if (error.code === "user_banned") {
      return { error: "Tu usuario está desactivado. Consultá en Administración.", usuario };
    }
    const credenciales = error.code === "invalid_credentials" || error.status === 400;
    return {
      error: credenciales
        ? esEmail
          ? "El email o la contraseña no son correctos."
          : ERROR_CREDENCIALES
        : "No pudimos iniciar sesión. Probá de nuevo en un momento.",
      usuario,
    };
  }

  const perfil = await getPerfil();
  if (!perfil) {
    // Contraseña correcta pero sin acceso (desactivado o Consejo): se cierra la sesión.
    await supabase.auth.signOut({ scope: "local" });
    await completarDemora(inicio);
    return { error: "Tu usuario está desactivado. Consultá en Administración.", usuario };
  }

  redirect(destinoTrasEntrar(perfil.rol, volver));
}

/**
 * "Salir" cierra SOLO la sesión de este dispositivo (scope local). El default de
 * Supabase es global: cerraba la misma cuenta en todas las tablets y PCs donde
 * estuviera abierta, y a la otra persona le aparecía un error y después el login.
 */
export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Acceso rápido de demo: entrar con un toque a cualquier rol.         */
/* Prendido salvo MODO_DEMO=0 en el servidor (src/lib/demo.ts).        */
/* El Consejo ya no tiene usuario (F5).                                */
/* ------------------------------------------------------------------ */

const USUARIOS_DEMO = {
  lider: "lider@sanmiguel.coop",
  admin: "admin@sanmiguel.coop",
  tesoreria: "tesorera@sanmiguel.coop",
  guardia: "guardia@sanmiguel.coop",
  porteria: "porteria@sanmiguel.coop",
  socio: "socio@sanmiguel.coop",
} as const;

export type RolDemo = keyof typeof USUARIOS_DEMO;

export async function entrarComoDemo(rol: RolDemo): Promise<EstadoLogin> {
  // No alcanza con esconder las tarjetas: la acción se puede llamar a mano.
  if (!modoDemoActivo()) {
    return { error: "El acceso de demo está apagado. Entrá con tu DNI y tu contraseña." };
  }
  const email = USUARIOS_DEMO[rol];
  if (!email) return { error: "Rol de demo desconocido." };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: "SanMiguel2026",
  });
  if (error) {
    return { error: "No se pudo entrar con el usuario de demo." };
  }

  const perfil = await getPerfil();
  if (!perfil) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Ese usuario de demo está desactivado." };
  }
  redirect(rutaInicio(perfil.rol));
}
