/** Rutas del bucket privado `documentos`. Convención única para todo el sistema.
 *  {org}/clientes/{cliente}/…   carpeta digital del cliente (docs, sanciones)
 *  {org}/gastos/…               facturas de gastos
 *  {org}/comprobantes/…         foto del comprobante de transferencia (cobros)
 *  {org}/firmas/…               firma digital del ingreso de personal (portería)
 *  {org}/solicitudes/…          adjuntos de solicitudes y mensajes
 *  {org}/circulares/…           PDF de circulares
 *  {org}/empleados/…            contratos de empleados
 * Las políticas de storage (0004/0008) autorizan por carpeta y rol. */

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

export const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Solo imágenes (fotos de comprobantes, firmas). */
export const MIME_IMAGEN = ["image/jpeg", "image/png", "image/webp"];

export const TAMANO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
