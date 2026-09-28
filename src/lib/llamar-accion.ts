import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/lib/actions/result";

/** Mensaje cuando la llamada al servidor no llegó o no volvió (wifi cortado, tablet
 * que se durmió, versión nueva publicada). Es seguro reintentar: los cobros y cargas
 * importantes llevan su clave de idempotencia y no se duplican. */
export const SIN_RESPUESTA =
  "Se cortó la conexión y no sabemos si llegó. Revisá internet y tocá de nuevo: si ya se había guardado, no se repite.";

/**
 * Llama a una server action desde un componente cliente SIN que un corte de red tire
 * la pantalla entera (ni pierda lo que se cargó en el formulario): si la llamada falla
 * por transporte, devuelve `{ ok: false, error }` como cualquier otro error de negocio.
 * Los redirect()/notFound() de Next se dejan pasar.
 *
 * Uso: `const res = await llamarAccion(() => registrarCobro(fd));`
 */
export async function llamarAccion<T>(
  accion: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await accion();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { ok: false, error: SIN_RESPUESTA };
  }
}
