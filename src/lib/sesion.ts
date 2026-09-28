import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/**
 * ¿El error de Supabase Auth es PASAJERO (se cortó la red, Supabase respondió
 * lento o con 5xx, límite de pedidos)? Entonces NO significa "no hay sesión":
 * no hay que mandar a nadie al login, hay que reintentar.
 * Sirve en el proxy (edge) y en el servidor.
 */
export function esFallaPasajera(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && (status === 0 || status === 429 || status >= 500);
}

/** Error que lanzan las páginas cuando Auth o la base no responden: lo atrapa la
 * pantalla de error propia, que reintenta sola sin cerrar la sesión. */
export const SIN_CONEXION = "SIN_CONEXION";
