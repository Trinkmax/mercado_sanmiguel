/**
 * Achica las fotos en el navegador antes de subirlas (comprobantes, facturas,
 * documentos, adjuntos). Una foto de tablet pesa 3–8 MB: en producción (Vercel) el
 * límite por pedido es 4,5 MB, así que fallaba al subir; y por la red local tardaba.
 * A 1600 px de lado y JPEG 82 % queda en ~300–600 KB y se lee perfecto.
 * PDFs y archivos chicos pasan sin tocar. Si algo falla, se sube el original.
 */
const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;
const COMPRIMIR_DESDE_BYTES = 900 * 1024;
const TIPOS_COMPRIMIBLES = /^image\/(jpeg|jpg|png|webp|heic|heif)$/i;

export async function comprimirImagen(archivo: File): Promise<File> {
  if (typeof window === "undefined") return archivo;
  if (!TIPOS_COMPRIMIBLES.test(archivo.type) || archivo.size < COMPRIMIR_DESDE_BYTES) {
    return archivo;
  }
  try {
    const bitmap = await cargarImagen(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    ctx.fillStyle = "#fff"; // los PNG con transparencia no quedan negros en JPEG
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", CALIDAD));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return archivo;
  }
}

async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // Respeta la orientación EXIF (fotos de celular giradas).
      return await createImageBitmap(archivo, { imageOrientation: "from-image" });
    } catch {
      // Safari viejo: cae al <img>.
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
