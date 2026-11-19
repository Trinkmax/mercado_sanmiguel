import { enviarMensaje } from "@/lib/actions/solicitudes";
import { llamarAccion, SIN_RESPUESTA } from "@/lib/llamar-accion";
import { MIME_PERMITIDOS, TAMANO_MAX_SUBIDA } from "@/lib/storage";
import { uuidV4 } from "@/lib/utils";
import { errorPesoAdjunto, explicarFalloEnvio, prepararAdjuntos } from "@/components/comunicaciones/adjuntos";

/**
 * Varias fotos o PDF en una solicitud (pedido de Franco del 18/11/2026: un puestero tuvo que
 * hacer una solicitud por cada archivo). Cada archivo viaja en SU pedido: el primero con el
 * texto y los demás como mensajes sueltos del hilo, de a uno y en orden. Así nunca se pasa el
 * tope de 4 MB por pedido de Vercel, aunque sean muchos PDF, y la base no cambia (un mensaje,
 * un adjunto).
 */

/** Hasta cuántos archivos se mandan de una vez. */
export const MAX_ARCHIVOS = 10;

/** Ayuda debajo de un campo de varios archivos (en el panel). El tope es por archivo: cada uno
 * viaja en su pedido. */
export const AYUDA_VARIOS_ARCHIVOS = `Hasta ${MAX_ARCHIVOS}, de hasta ${TAMANO_MAX_SUBIDA / 1024 / 1024} MB cada uno. Las fotos se achican solas; si es un PDF escaneado muy pesado, sacale una foto.`;

/** Un archivo elegido para mandar. `ref` es la clave de idempotencia de su mensaje: si se
 * corta la conexión y se manda de nuevo, el que ya había llegado no se repite. */
export type ArchivoElegido = { ref: string; archivo: File };

/** "1 archivo" / "3 archivos". */
export function cuantosArchivos(n: number): string {
  return n === 1 ? "1 archivo" : `${n} archivos`;
}

/**
 * Suma a la lista los archivos que se acaban de elegir: deja afuera los que no son foto o PDF,
 * los PDF de más de 4 MB (las fotos se achican solas al mandar) y los repetidos, hasta `max`.
 * Devuelve la lista nueva y, si alguno quedó afuera, por qué.
 */
export function sumarArchivos(
  actuales: ArchivoElegido[],
  elegidos: Iterable<File>,
  max = MAX_ARCHIVOS
): { lista: ArchivoElegido[]; error: string | null } {
  const lista = [...actuales];
  let error: string | null = null;
  for (const f of elegidos) {
    if (f.size === 0) continue;
    if (!MIME_PERMITIDOS.includes(f.type)) {
      error = `«${f.name}» no se puede mandar: tiene que ser una foto (JPG, PNG o WEBP) o un PDF.`;
      continue;
    }
    const pesado = errorPesoAdjunto(f);
    if (pesado) {
      error = `«${f.name}»: ${pesado}`;
      continue;
    }
    // Mismo nombre y mismo peso: es el mismo (la fecha no sirve: el iPhone pone la de cada vez
    // que se elige una foto de la galería).
    const repetido = lista.some((a) => a.archivo.name === f.name && a.archivo.size === f.size);
    if (repetido) continue;
    if (lista.length >= max) {
      error =
        max === 1
          ? "Acá va un archivo solo: quitá el que está para poner otro."
          : `Van hasta ${max} archivos por vez. Mandá estos y después sumá los que faltan.`;
      break;
    }
    lista.push({ ref: uuidV4(), archivo: f });
  }
  return { lista, error };
}

/**
 * Manda cada archivo como un mensaje sin texto de la solicitud, de a uno y en orden. Un corte
 * se reintenta una vez solo, con la misma clave. Se corta en el primero que falla: devuelve
 * las claves de los que llegaron y el error (los que faltan se mandan después con su misma
 * clave, sin repetir ninguno).
 */
export async function mandarArchivosSueltos(
  solicitudId: string,
  archivos: ArchivoElegido[],
  {
    desdePortal,
    interno = false,
    alLlegar,
  }: {
    /** Escribe el cliente (el socio, o alguien del equipo en su carpeta, 0066). */
    desdePortal: boolean;
    /** Nota interna del equipo: los archivos de una nota interna también lo son (el socio no
     * los ve). Desde el portal nunca (el servidor y la RLS tampoco lo dejan). */
    interno?: boolean;
    /** Después de cada uno que llega (para mostrar cuántos van). */
    alLlegar?: (a: ArchivoElegido) => void;
  }
): Promise<{ llegaron: string[]; error: string | null }> {
  const llegaron: string[] = [];
  for (const a of archivos) {
    const fd = new FormData();
    fd.set("solicitudId", solicitudId);
    fd.set("mensaje", "");
    fd.set("interno", interno && !desdePortal ? "true" : "false");
    if (desdePortal) fd.set("desde", "portal");
    fd.set("ref", a.ref);
    fd.set("adjunto", a.archivo, a.archivo.name);
    const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
    if (errorPeso) return { llegaron, error: `«${a.archivo.name}»: ${errorPeso}` };
    let res = await llamarAccion(() => enviarMensaje(fd));
    if (!res.ok && res.error === SIN_RESPUESTA) res = await llamarAccion(() => enviarMensaje(fd));
    if (!res.ok) return { llegaron, error: explicarFalloEnvio(res.error, fd, ["adjunto"]) };
    llegaron.push(a.ref);
    alLlegar?.(a);
  }
  return { llegaron, error: null };
}
