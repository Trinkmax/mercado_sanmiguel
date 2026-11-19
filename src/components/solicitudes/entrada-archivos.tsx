"use client";

import { ACCEPT_ADJUNTO } from "./constantes";
import { MAX_ARCHIVOS, sumarArchivos, type ArchivoElegido } from "./archivos-sueltos";

/**
 * El campo de archivos, oculto: lo abre su <label> (portal y panel le ponen cada uno su
 * botón). Abre el mismo selector de siempre (cámara, galería o archivos) y deja elegir varios
 * de una vez; queda vacío después de cada elección para poder sumar más. No tiene `name`: los
 * archivos viven en la lista (estado) y cada pantalla los pone en el pedido que corresponde.
 * Con `max` 1 (el descargo) es un archivo solo, como antes.
 */
export function EntradaArchivos({
  id,
  archivos,
  max = MAX_ARCHIVOS,
  deshabilitado,
  onCambio,
  onError,
}: {
  id: string;
  archivos: ArchivoElegido[];
  max?: number;
  deshabilitado?: boolean;
  onCambio: (lista: ArchivoElegido[]) => void;
  /** Por qué quedó afuera alguno (o null si entraron todos). */
  onError: (error: string | null) => void;
}) {
  return (
    // <input> nativo: el Input de shadcn trae w-full y, oculto con sr-only, mide todo el ancho de la ventana.
    <input
      id={id}
      type="file"
      multiple={max > 1}
      accept={ACCEPT_ADJUNTO}
      disabled={deshabilitado}
      className="sr-only"
      onChange={(e) => {
        const elegidos = Array.from(e.target.files ?? []);
        // Vacío otra vez: se puede volver a tocar y sumar más (aunque sea el mismo).
        e.target.value = "";
        if (elegidos.length === 0) return;
        const { lista, error } = sumarArchivos(archivos, elegidos, max);
        onCambio(lista);
        onError(error);
      }}
    />
  );
}
