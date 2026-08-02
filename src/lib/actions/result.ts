/** Resultado uniforme de toda server action del sistema. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fallo<T = void>(error: unknown): ActionResult<T> {
  if (typeof error === "string") return { ok: false, error };
  if (error instanceof Error) {
    // Los mensajes de las funciones de negocio ya vienen en castellano.
    return { ok: false, error: error.message.replace(/^.*?: /, "") };
  }
  return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo." };
}
