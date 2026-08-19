"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, rutaInicio } from "@/lib/auth";

export type EstadoLogin = { error: string } | null;

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá el email y la contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.code === "invalid_credentials"
          ? "El email o la contraseña no son correctos."
          : "No pudimos iniciar sesión. Probá de nuevo en un momento.",
    };
  }

  const perfil = await getPerfil();
  if (!perfil) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu usuario no tiene un perfil activo. Consultá en administración.",
    };
  }

  redirect(rutaInicio(perfil.rol));
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Acceso rápido de demo: entrar con un toque a cualquier rol.         */
/* Sacar esto (y los usuarios demo) antes de pasar a producción.       */
/* ------------------------------------------------------------------ */

const USUARIOS_DEMO = {
  admin: "admin@sanmiguel.coop",
  guardia: "guardia@sanmiguel.coop",
  porteria: "porteria@sanmiguel.coop",
  tesoreria: "tesorera@sanmiguel.coop",
  lider: "lider@sanmiguel.coop",
  consejo: "consejo@sanmiguel.coop",
  socio: "socio@sanmiguel.coop",
} as const;

export type RolDemo = keyof typeof USUARIOS_DEMO;

export async function entrarComoDemo(rol: RolDemo): Promise<EstadoLogin> {
  const email = USUARIOS_DEMO[rol];
  if (!email) return { error: "Rol de demo desconocido." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: "SanMiguel2026",
  });
  if (error) {
    return { error: "No se pudo entrar con el usuario de demo." };
  }

  const perfil = await getPerfil();
  redirect(perfil ? rutaInicio(perfil.rol) : "/");
}
