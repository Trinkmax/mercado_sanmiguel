import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/database.types";
import { esFallaPasajera, SIN_CONEXION } from "@/lib/sesion";

export type Rol = Enums<"rol_usuario">;

export type Perfil = {
  user_id: string;
  org_id: string;
  nombre: string;
  rol: Rol;
  /** Email de la sesión. Puede ser técnico ({dni}@usuarios.sanmiguel.coop): no mostrarlo. */
  email: string;
  /** DNI de login (solo dígitos). Null en usuarios viejos sin DNI cargado. */
  dni: string | null;
};

/** Ruta del login cuando hay sesión pero el usuario ya no tiene acceso. */
export const LOGIN_SIN_ACCESO = "/login?motivo=inactivo";

type Sesion = { hayUsuario: boolean; perfil: Perfil | null };

/**
 * Sesión + perfil activo, cacheado por request. El Consejo ya no tiene acceso a
 * ninguna pantalla (F5): se lo trata como sin perfil aunque su fila esté activa.
 */
const leerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await createClient();
  // getClaims valida la firma del token localmente (sin pedirle a Auth en cada render).
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    // Una falla pasajera (red, Supabase lento) NO es "no hay sesión": se lanza para que
    // la pantalla de error reintente sola, en vez de mandar a la persona al login.
    if (error && esFallaPasajera(error)) throw new Error(SIN_CONEXION);
    return { hayUsuario: false, perfil: null };
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("user_id, org_id, nombre, rol, dni")
    .eq("user_id", claims.sub)
    .eq("activo", true)
    .maybeSingle();

  // Si la base no respondió, no se sabe si tiene acceso: reintentar, nunca "desactivado".
  if (errorPerfil) throw new Error(SIN_CONEXION);
  if (!perfil || perfil.rol === "consejo") return { hayUsuario: true, perfil: null };
  return {
    hayUsuario: true,
    perfil: { ...perfil, email: typeof claims.email === "string" ? claims.email : "" },
  };
});

/** Perfil del usuario logueado, cacheado por request. Null si no hay sesión o no tiene acceso. */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  return (await leerSesion()).perfil;
});

/**
 * ¿Hay sesión pero sin acceso? (usuario desactivado con la sesión abierta, o Consejo).
 * El login lo usa para avisar en vez de rebotar en bucle.
 */
export async function sesionSinAcceso(): Promise<boolean> {
  const { hayUsuario, perfil } = await leerSesion();
  return hayUsuario && !perfil;
}

/** Ruta de inicio según el rol. Portería arranca en su propia pantalla. */
export function rutaInicio(rol: Rol): string {
  if (rol === "socio") return "/mi-cuenta";
  if (rol === "porteria") return "/porteria";
  return "/inicio";
}

/**
 * Exige sesión con uno de los roles dados; si no, redirige.
 * Sin sesión → /login. Con sesión pero sin acceso (desactivado) → /login con aviso
 * (el login no redirige de vuelta: no hay bucle).
 */
export async function requireRol(...roles: Rol[]): Promise<Perfil> {
  const { hayUsuario, perfil } = await leerSesion();
  if (!perfil) redirect(hayUsuario ? LOGIN_SIN_ACCESO : "/login");
  if (roles.length > 0 && !roles.includes(perfil.rol)) {
    redirect(rutaInicio(perfil.rol));
  }
  return perfil;
}

/** Cualquier miembro del staff (todo menos socio; el Consejo ya no entra). */
export async function requireStaff(): Promise<Perfil> {
  return requireRol("admin", "guardia", "porteria", "tesoreria", "lider");
}

/** El Líder de Procesos aplica cambios de clientes/conceptos directo; los demás
 * roles de gestión los proponen y esperan aprobación. */
export function aplicaDirecto(rol: Rol): boolean {
  return rol === "lider";
}
