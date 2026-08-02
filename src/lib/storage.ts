/** Rutas del bucket privado `documentos`. Convención única para todo el sistema. */

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

export const MIME_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const TAMANO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
