import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";

export type Rol = Enums<"rol_usuario">;

export type Perfil = {
  user_id: string;
  org_id: string;
  nombre: string;
  rol: Rol;
  email: string;
};

/** Perfil del usuario logueado, cacheado por request. Null si no hay sesión. */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("user_id, org_id, nombre, rol")
    .eq("user_id", user.id)
    .eq("activo", true)
    .maybeSingle();

  if (!perfil) return null;
  return { ...perfil, email: user.email ?? "" };
});

/** Ruta de inicio según el rol. Portería arranca en su propia pantalla. */
export function rutaInicio(rol: Rol): string {
  if (rol === "socio") return "/mi-cuenta";
  if (rol === "porteria") return "/porteria";
  return "/inicio";
}

/** Exige sesión con uno de los roles dados; si no, redirige. */
export async function requireRol(...roles: Rol[]): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  if (roles.length > 0 && !roles.includes(perfil.rol)) {
    redirect(rutaInicio(perfil.rol));
  }
  return perfil;
}

/** Cualquier miembro del staff (todo menos socio). */
export async function requireStaff(): Promise<Perfil> {
  return requireRol("admin", "guardia", "porteria", "tesoreria", "consejo", "lider");
}

/** El Líder de Procesos aplica cambios de clientes/conceptos directo; los demás
 * roles de gestión los proponen y esperan aprobación. */
export function aplicaDirecto(rol: Rol): boolean {
  return rol === "lider";
}
