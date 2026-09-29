/** Rutas del bucket privado `documentos`. Convención única para todo el sistema.
 *  {org}/clientes/{cliente}/…   carpeta digital del cliente (docs, sanciones)
 *  {org}/clientes/{cliente}/registros/…  adjuntos de notificaciones, apercibimientos y
 *                               sanciones: documento, descargos y respuestas del hilo
 *  {org}/gastos/…               facturas de gastos
 *  {org}/comprobantes/…         foto del comprobante de transferencia (cobros)
 *  {org}/firmas/…               firma digital del ingreso de personal (portería)
 *  {org}/solicitudes/…          adjuntos de solicitudes y mensajes
 *  {org}/circulares/…           PDF de circulares
 *  {org}/empleados/…            contratos de empleados
 *  {org}/novedades/…            certificados y adjuntos de novedades del personal
 * Las políticas de storage (0004/0008/0011/0022) autorizan por carpeta y rol. */

function limpiarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

export function rutaDocumentoCliente(
  orgId: string,
  clienteId: string,
  nombreArchivo: string
): string {
  return `${orgId}/clientes/${clienteId}/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export function rutaFacturaGasto(orgId: string, nombreArchivo: string): string {
  return `${orgId}/gastos/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export function rutaComprobanteTransferencia(orgId: string, nombreArchivo: string): string {
  return `${orgId}/comprobantes/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export function rutaFirmaIngreso(orgId: string): string {
  return `${orgId}/firmas/${crypto.randomUUID()}-firma.png`;
}

export function rutaAdjuntoSolicitud(orgId: string, nombreArchivo: string): string {
  return `${orgId}/solicitudes/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export function rutaCircular(orgId: string, nombreArchivo: string): string {
  return `${orgId}/circulares/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export function rutaContratoEmpleado(orgId: string, nombreArchivo: string): string {
  return `${orgId}/empleados/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

/** Documento, descargo o respuesta de un registro (notificación / apercibimiento / sanción).
 * Vive dentro de la carpeta del cliente: lo cubren las policies del socio (lo propio) y del staff. */
export function rutaAdjuntoRegistro(
  orgId: string,
  clienteId: string,
  nombreArchivo: string
): string {
  return `${orgId}/clientes/${clienteId}/registros/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

/** Certificado o adjunto de una novedad del personal (falta justificada, licencia…). */
export function rutaAdjuntoNovedad(orgId: string, nombreArchivo: string): string {
  return `${orgId}/novedades/${crypto.randomUUID()}-${limpiarNombre(nombreArchivo)}`;
}

export const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Solo imágenes (fotos de comprobantes, firmas). */
export const MIME_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

/** Tope de cada archivo que controla el SERVIDOR (red de seguridad de las acciones). */
export const TAMANO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Tope real de lo que se sube en UN pedido, controlado en el NAVEGADOR antes de mandar (ya
 * con las fotos achicadas por comprimirImagen, ~400 KB) y sobre el total si van varios
 * archivos. En producción (Vercel) un pedido a una server action no puede pasar de 4,5 MB:
 * si pasa, el servidor lo corta sin respuesta, la pantalla dice "Se cortó la conexión" y la
 * persona reintenta sin entender qué pasa. 4 MB deja margen para el resto del formulario.
 * Este módulo no tiene dependencias de servidor: se importa también desde componentes cliente.
 */
export const TAMANO_MAX_SUBIDA = 4 * 1024 * 1024; // 4 MB
