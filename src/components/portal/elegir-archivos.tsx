"use client";

import { Camera, FileText, ImageIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_ARCHIVOS, type ArchivoElegido } from "@/components/solicitudes/archivos-sueltos";
import { EntradaArchivos } from "@/components/solicitudes/entrada-archivos";

/**
 * Las fotos o PDF elegidos para mandar, uno por renglón, cada uno con su cruz para quitarlo.
 * Van aparte del botón para sumar: en la caja del chat la lista queda arriba y el botón al
 * lado de «Enviar».
 */
export function ListaArchivos({
  archivos,
  onQuitar,
  deshabilitado,
  acotada = false,
}: {
  archivos: ArchivoElegido[];
  onQuitar: (ref: string) => void;
  deshabilitado?: boolean;
  /** Con alto máximo y scroll propio: en la caja del chat, que queda pegada abajo. */
  acotada?: boolean;
}) {
  if (archivos.length === 0) return null;
  return (
    <ul
      aria-label="Lo que vas a mandar"
      className={cn("flex flex-col gap-1.5", acotada && "max-h-[32svh] overflow-y-auto")}
    >
      {archivos.map((a) => {
        const Icono = a.archivo.type === "application/pdf" ? FileText : ImageIcon;
        return (
          <li
            key={a.ref}
            className="flex min-h-12 items-center gap-2.5 rounded-xl bg-white pl-3 text-[1rem] font-bold text-tinta ring-1 ring-tinta/15 ring-inset"
          >
            <Icono aria-hidden className="size-5 shrink-0 text-esmalte" strokeWidth={2.2} />
            <span className="min-w-0 flex-1 truncate">{a.archivo.name}</span>
            <button
              type="button"
              onClick={() => onQuitar(a.ref)}
              disabled={deshabilitado}
              aria-label={`Quitar ${a.archivo.name}`}
              className="grid size-12 shrink-0 place-items-center rounded-xl text-esmalte disabled:opacity-50"
            >
              <X aria-hidden className="size-5" strokeWidth={2.4} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** El botón para sumar fotos o PDF (ver EntradaArchivos): se puede tocar de nuevo para sumar otros. */
export function BotonSumarArchivos({
  id,
  archivos,
  onCambio,
  onError,
  max = MAX_ARCHIVOS,
  texto,
  textoOtro,
  deshabilitado,
  className,
}: {
  id: string;
  archivos: ArchivoElegido[];
  onCambio: (lista: ArchivoElegido[]) => void;
  /** Por qué quedó afuera alguno (o null si entraron todos). */
  onError: (error: string | null) => void;
  max?: number;
  /** Lo que dice sin nada elegido ("Sumar fotos o PDF"). */
  texto: string;
  /** Lo que dice con algo elegido ("Sumar otra"). */
  textoOtro: string;
  deshabilitado?: boolean;
  className?: string;
}) {
  if (archivos.length >= max) {
    // Con uno solo permitido, la cruz de la lista es la que deja cambiarlo.
    return max > 1 ? (
      <p className={cn("self-center text-[0.98rem] leading-snug text-tinta-2", className)}>
        Ya sumaste {max}: es lo máximo por vez.
      </p>
    ) : null;
  }
  return (
    <>
      <label
        htmlFor={id}
        aria-disabled={deshabilitado || undefined}
        className={cn(
          "boton boton-suave min-w-0 cursor-pointer !text-[1.02rem]",
          deshabilitado && "pointer-events-none opacity-60",
          className
        )}
      >
        {archivos.length > 0 ? <Plus aria-hidden strokeWidth={2.4} /> : <Camera aria-hidden strokeWidth={2.2} />}
        <span className="truncate">{archivos.length > 0 ? textoOtro : texto}</span>
      </label>
      <EntradaArchivos
        id={id}
        archivos={archivos}
        max={max}
        deshabilitado={deshabilitado}
        onCambio={onCambio}
        onError={onError}
      />
    </>
  );
}
