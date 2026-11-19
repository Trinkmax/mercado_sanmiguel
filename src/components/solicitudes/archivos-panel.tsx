"use client";

import { FileText, ImageIcon, Paperclip, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MAX_ARCHIVOS, type ArchivoElegido } from "./archivos-sueltos";
import { EntradaArchivos } from "./entrada-archivos";

/** Las fotos o PDF elegidos en el panel, uno por renglón, cada uno con su cruz para quitarlo. */
export function ListaArchivosPanel({
  archivos,
  onQuitar,
  deshabilitado,
  className,
}: {
  archivos: ArchivoElegido[];
  onQuitar: (ref: string) => void;
  deshabilitado?: boolean;
  className?: string;
}) {
  if (archivos.length === 0) return null;
  return (
    <ul aria-label="Archivos para mandar" className={cn("flex flex-col gap-1.5", className)}>
      {archivos.map((a) => {
        const Icono = a.archivo.type === "application/pdf" ? FileText : ImageIcon;
        return (
          <li key={a.ref} className="flex min-h-11 items-center gap-2 rounded-md border bg-card pl-3 text-sm font-medium">
            <Icono className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate">{a.archivo.name}</span>
            <Button
              type="button"
              variant="ghost"
              className="size-11 shrink-0 p-0"
              onClick={() => onQuitar(a.ref)}
              disabled={deshabilitado}
              aria-label={`Quitar ${a.archivo.name}`}
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** El botón del panel para sumar fotos o PDF (ver EntradaArchivos): se puede tocar de nuevo para sumar otros. */
export function BotonArchivosPanel({
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
  onError: (error: string | null) => void;
  max?: number;
  /** Lo que dice sin nada elegido ("Adjuntar foto o PDF"). */
  texto: string;
  /** Lo que dice con algo elegido ("Sumar otro"). */
  textoOtro: string;
  deshabilitado?: boolean;
  className?: string;
}) {
  if (archivos.length >= max) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Ya sumaste {max}: es lo máximo por vez.</p>;
  }
  return (
    <>
      <Label
        htmlFor={id}
        aria-disabled={deshabilitado || undefined}
        className={cn(
          "inline-flex min-h-11 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted",
          deshabilitado && "pointer-events-none opacity-60",
          className
        )}
      >
        {archivos.length > 0 ? (
          <Plus className="size-4 shrink-0" strokeWidth={2} />
        ) : (
          <Paperclip className="size-4 shrink-0" strokeWidth={2} />
        )}
        <span className="min-w-0 truncate">{archivos.length > 0 ? textoOtro : texto}</span>
      </Label>
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
