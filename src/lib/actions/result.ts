/** Resultado uniforme de toda server action del sistema. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

const ERROR_GENERICO = "Ocurrió un error inesperado. Probá de nuevo.";

/** Errores técnicos de Postgres/PostgREST traducidos a algo que se entienda.
 * Los mensajes de las funciones de negocio (RAISE EXCEPTION, código P0001) ya
 * vienen en castellano y se muestran tal cual. */
const MENSAJE_POR_CODIGO: Record<string, string> = {
  "42501": "No tenés permiso para hacer esto.",
  "23505": "Eso ya está cargado: revisá la lista antes de repetirlo.",
  "23503": "Falta un dato relacionado (puede que lo hayan borrado). Recargá la página y probá de nuevo.",
  "23514": "Algún dato no es válido. Revisalo y probá de nuevo.",
  "23502": "Falta completar un dato obligatorio.",
  "22P02": "Algún dato tiene un formato inválido. Revisalo y probá de nuevo.",
  PGRST116: "No encontramos lo que buscabas. Recargá la página y probá de nuevo.",
};

/**
 * Error de una acción → texto para mostrar en la pantalla.
 * Acepta un string, un `Error` o el error de supabase-js (objeto plano
 * `{ message, code, details, hint }`, que NO es instancia de Error). Nunca
 * recorta el mensaje en el primer ":" (los mensajes de negocio lo usan:
 * "La caja ya está cerrada: pedí la reapertura…").
 */
export function mensajeDeError(error: unknown): string {
  if (typeof error === "string") return error.trim() || ERROR_GENERICO;
  if (!error || typeof error !== "object") return ERROR_GENERICO;

  const { message, code } = error as { message?: unknown; code?: unknown };
  if (typeof code === "string" && MENSAJE_POR_CODIGO[code]) {
    return MENSAJE_POR_CODIGO[code];
  }
  if (typeof message !== "string" || !message.trim()) return ERROR_GENERICO;
  if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT|Failed to fetch/i.test(message)) {
    return "No hay conexión con el servidor. Revisá internet y probá de nuevo.";
  }
  // Solo se sacan prefijos técnicos conocidos ("Error: …", "TypeError: …").
  return message.replace(/^(?:[A-Za-z]*Error|PostgrestError|AuthApiError):\s+/, "").trim();
}

export function fallo<T = void>(error: unknown): ActionResult<T> {
  return { ok: false, error: mensajeDeError(error) };
}
