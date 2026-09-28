import { comprimirImagen } from "@/lib/imagen";
import { SIN_RESPUESTA } from "@/lib/llamar-accion";
import { TAMANO_MAX_BYTES } from "@/lib/storage";

/**
 * Adjuntos de Comunicaciones y del portal (foto o PDF), del lado del navegador.
 * El servidor corta en 20 MB por archivo y la server action en 25 MB por pedido: si el
 * archivo es más grande, el pedido ni llega y la pantalla solo diría "se cortó la conexión".
 */

/** Sirve para PDF y para fotos (las fotos se achican solas, así que casi siempre es un PDF). */
export const ERROR_PESO_ADJUNTO =
  "El archivo pesa más de 20 MB: elegí uno más liviano (si es un PDF, pedí una versión más chica).";

/**
 * Arriba de esto, según dónde esté publicado el sistema, el pedido puede no llegar aunque
 * pase el control de 20 MB (en Vercel el tope por pedido es 4,5 MB). Solo se usa para
 * explicar un corte; el límite del negocio sigue siendo 20 MB.
 */
const PESO_PEDIDO_SEGURO = 4 * 1024 * 1024;

/** Al elegir el archivo: un PDF (u otro no-foto) de más de 20 MB no se puede subir. Las fotos se achican solas. */
export function adjuntoMuyPesado(archivo: File | null | undefined): boolean {
  if (!archivo) return false;
  return archivo.size > TAMANO_MAX_BYTES && !archivo.type.startsWith("image/");
}

/**
 * Antes de mandar el formulario: achica las fotos de esos campos (comprimirImagen, ~400 KB)
 * y controla que lo adjunto no pase de 20 MB en total. Devuelve el mensaje de error o null.
 */
export async function prepararAdjuntos(fd: FormData, campos: string[]): Promise<string | null> {
  let total = 0;
  for (const campo of campos) {
    const valor = fd.get(campo);
    if (!(valor instanceof File) || valor.size === 0) continue;
    const archivo = await comprimirImagen(valor);
    if (archivo !== valor) fd.set(campo, archivo, archivo.name);
    total += archivo.size;
  }
  return total > TAMANO_MAX_BYTES ? ERROR_PESO_ADJUNTO : null;
}

/** Lo que suman los archivos de esos campos (después de prepararAdjuntos, ya achicados). */
function pesoAdjuntos(fd: FormData, campos: string[]): number {
  let total = 0;
  for (const campo of campos) {
    const valor = fd.get(campo);
    if (valor instanceof File) total += valor.size;
  }
  return total;
}

/**
 * Mensaje para un envío que falló. Si fue un corte (SIN_RESPUESTA) usa `textoCorte` (si la
 * pantalla tiene uno propio) y, si lo adjunto pesa más de 4 MB, avisa que el archivo puede ser
 * demasiado pesado: si no, un PDF grande que el servidor rechaza se lee como "se cortó la
 * conexión, tocá de nuevo" y la persona reintenta sin fin. Otros errores pasan tal cual.
 */
export function explicarFalloEnvio(
  error: string,
  fd: FormData,
  campos: string[],
  textoCorte?: string
): string {
  if (error !== SIN_RESPUESTA) return error;
  const base = textoCorte ?? error;
  const total = pesoAdjuntos(fd, campos);
  if (total <= PESO_PEDIDO_SEGURO) return base;
  const mb = (total / 1024 / 1024).toLocaleString("es-AR", { maximumFractionDigits: 1 });
  return `${base} Si vuelve a pasar, puede ser que el archivo sea muy pesado (${mb} MB): probá con uno de menos de 4 MB.`;
}

/**
 * Qué se manda en un mensaje del hilo (texto + adjunto elegido). Sirve para saber, cuando
 * un reintento vuelve "repetido", si lo que llegó es lo mismo que está escrito ahora.
 */
export function firmaMensaje(mensaje: string, adjunto: FormDataEntryValue | null): string {
  const archivo = adjunto instanceof File && adjunto.size > 0 ? `${adjunto.name}:${adjunto.size}` : "";
  return `${mensaje}\u0000${archivo}`;
}
