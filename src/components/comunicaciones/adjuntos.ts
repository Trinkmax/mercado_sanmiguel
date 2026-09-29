import { comprimirImagen } from "@/lib/imagen";
import { SIN_RESPUESTA } from "@/lib/llamar-accion";
import { TAMANO_MAX_SUBIDA } from "@/lib/storage";

/**
 * Adjuntos de todo el sistema (foto o PDF), del lado del navegador.
 * En producción (Vercel) un pedido no puede pasar de 4,5 MB: si pasa, el servidor lo corta
 * sin respuesta y la pantalla solo diría "Se cortó la conexión". Por eso se controla acá,
 * ANTES de mandar y con las fotos ya achicadas, contra TAMANO_MAX_SUBIDA (4 MB en total).
 * El control del servidor (TAMANO_MAX_BYTES, 20 MB) queda como red de seguridad.
 */

/** El tope en MB, para los textos ("4"). */
const MB_MAX = TAMANO_MAX_SUBIDA / 1024 / 1024;

/** Ayuda debajo del campo de archivo (foto o PDF). */
export const AYUDA_PESO_ADJUNTO = `Hasta ${MB_MAX} MB. Las fotos se achican solas; si es un PDF escaneado muy pesado, sacale una foto.`;

/** Ayuda debajo de un campo que acepta solo PDF (circulares). */
export const AYUDA_PESO_PDF = `Hasta ${MB_MAX} MB. Si el PDF pesa más, pedí una versión más liviana.`;

type OpcionesPeso = {
  /** El campo acepta solo PDF: no se sugiere sacar una foto. */
  soloPdf?: boolean;
};

/** "6,2" (MB, un decimal, redondeado para arriba: 4,02 MB dice 4,1 y nunca "pesa 4, máximo 4"). */
export function formatMB(bytes: number): string {
  const mb = Math.ceil((bytes / 1024 / 1024) * 10) / 10;
  return mb.toLocaleString("es-AR", { maximumFractionDigits: 1 });
}

/** "El archivo pesa 6,2 MB y el máximo es 4 MB. …" (y qué hacer). */
export function mensajePesoAdjunto(
  bytes: number,
  { soloPdf = false, varios = false }: OpcionesPeso & { varios?: boolean } = {}
): string {
  const que = varios ? "Los archivos juntos pesan" : soloPdf ? "El PDF pesa" : "El archivo pesa";
  const consejo = soloPdf
    ? "Pedí una versión más liviana del PDF."
    : varios
      ? "Quitá alguno o, si hay un PDF, sacale una foto a la hoja o pedí una versión más liviana."
      : "Si es un PDF, sacale una foto a la hoja o pedí una versión más liviana.";
  return `${que} ${formatMB(bytes)} MB y el máximo es ${MB_MAX} MB. ${consejo}`;
}

/**
 * Al elegir el archivo: un PDF (u otro no-foto) de más de 4 MB ya no va a poder subir, se
 * avisa en el acto. Las fotos se achican solas: se controlan al mandar (prepararAdjuntos).
 * Devuelve el mensaje de error o null.
 */
export function errorPesoAdjunto(
  archivo: File | null | undefined,
  opciones?: OpcionesPeso
): string | null {
  if (!archivo || archivo.type.startsWith("image/")) return null;
  return archivo.size > TAMANO_MAX_SUBIDA ? mensajePesoAdjunto(archivo.size, opciones) : null;
}

/**
 * Antes de mandar el formulario: achica las fotos de esos campos (comprimirImagen, ~400 KB)
 * y controla que lo que va en el pedido no pase de 4 MB en total (si hay varios archivos, se
 * suman). Devuelve el mensaje de error o null.
 */
export async function prepararAdjuntos(
  fd: FormData,
  campos: string[],
  opciones?: OpcionesPeso
): Promise<string | null> {
  let total = 0;
  let cantidad = 0;
  for (const campo of campos) {
    const valor = fd.get(campo);
    if (!(valor instanceof File) || valor.size === 0) continue;
    const archivo = await comprimirImagen(valor);
    if (archivo !== valor) fd.set(campo, archivo, archivo.name);
    total += archivo.size;
    cantidad += 1;
  }
  return total > TAMANO_MAX_SUBIDA
    ? mensajePesoAdjunto(total, { ...opciones, varios: cantidad > 1 })
    : null;
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
 * pantalla tiene uno propio) y, si lo adjunto pasa el tope de 4 MB (una pantalla que no lo
 * controló antes), avisa que puede ser el peso: si no, un archivo que el servidor corta se lee
 * como "se cortó la conexión, tocá de nuevo" y la persona reintenta sin fin. Otros errores
 * pasan tal cual.
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
  if (total <= TAMANO_MAX_SUBIDA) return base;
  return `${base} Si vuelve a pasar, puede ser el peso del archivo: pesa ${formatMB(total)} MB y el máximo es ${MB_MAX} MB.`;
}

/**
 * Qué se manda en un mensaje del hilo (texto + adjunto elegido). Sirve para saber, cuando
 * un reintento vuelve "repetido", si lo que llegó es lo mismo que está escrito ahora.
 */
export function firmaMensaje(mensaje: string, adjunto: FormDataEntryValue | null): string {
  const archivo = adjunto instanceof File && adjunto.size > 0 ? `${adjunto.name}:${adjunto.size}` : "";
  return `${mensaje}\u0000${archivo}`;
}
