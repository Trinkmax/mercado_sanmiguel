"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCEPT_COMPROBANTE, MAX_COMPROBANTE } from "@/components/cobranza/tipos";

/**
 * Titular de la cuenta + foto del comprobante (opcional) de una línea de transferencia.
 * La vista previa usa un object URL que se libera al cambiar, quitar o desmontar.
 */
export function DatosTransferencia({
  titular,
  comprobante,
  sugerenciaTitular,
  errorTitular,
  errorComprobante,
  onTitular,
  onComprobante,
  onErrorComprobante,
}: {
  titular: string;
  comprobante: File | null;
  /** Nombre del cliente: un toque lo completa ("Es la cuenta de …"). */
  sugerenciaTitular?: string;
  errorTitular?: string;
  errorComprobante?: string;
  onTitular: (v: string) => void;
  onComprobante: (archivo: File | null) => void;
  onErrorComprobante: (error: string | undefined) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Vista previa: un object URL por archivo, que se libera al reemplazarlo, quitarlo o desmontar.
  const previewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function actualizarPreview(archivo: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = archivo && archivo.type.startsWith("image/") ? URL.createObjectURL(archivo) : null;
    previewRef.current = url;
    setPreview(url);
  }

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null;
    if (!archivo) return;
    if (archivo.size > MAX_COMPROBANTE) {
      onErrorComprobante("La foto pesa más de 20 MB. Sacala de nuevo con menos calidad.");
      e.target.value = "";
      return;
    }
    onErrorComprobante(undefined);
    actualizarPreview(archivo);
    onComprobante(archivo);
  }

  function quitar() {
    actualizarPreview(null);
    onComprobante(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const sugerir =
    sugerenciaTitular && titular.trim() === "" ? sugerenciaTitular : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${id}-titular`} className="text-base font-medium">
          A nombre de quién está la cuenta
        </Label>
        <Input
          id={`${id}-titular`}
          autoComplete="off"
          placeholder="Ej.: Juan Pérez"
          value={titular}
          onChange={(e) => onTitular(e.target.value)}
          aria-invalid={Boolean(errorTitular)}
          className="h-12 text-base md:text-base"
        />
        {sugerir ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 px-3 text-sm"
            onClick={() => onTitular(sugerir)}
          >
            Es la cuenta de {sugerir}
          </Button>
        ) : null}
        {errorTitular ? (
          <p className="text-sm font-medium text-destructive">{errorTitular}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-comprobante`} className="text-base font-medium">
          Foto del comprobante{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <input
          ref={inputRef}
          id={`${id}-comprobante`}
          type="file"
          accept={ACCEPT_COMPROBANTE}
          capture="environment"
          className="sr-only"
          onChange={elegir}
        />
        {comprobante ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Vista previa del comprobante"
                className="size-20 shrink-0 rounded-md border object-cover"
              />
            ) : (
              <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-card">
                <FileText className="size-8 text-muted-foreground" strokeWidth={1.8} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{comprobante.name}</p>
              <p className="text-sm text-muted-foreground">Se guarda junto con el recibo.</p>
            </div>
            <Button type="button" variant="ghost" className="h-11 px-3 text-sm" onClick={quitar}>
              <X className="size-4" strokeWidth={2} />
              Quitar
            </Button>
          </div>
        ) : (
          <label
            htmlFor={`${id}-comprobante`}
            className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 text-base font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Camera className="size-6" strokeWidth={2} />
            Sacar foto del comprobante
          </label>
        )}
        {errorComprobante ? (
          <p className="text-sm font-medium text-destructive">{errorComprobante}</p>
        ) : null}
      </div>
    </div>
  );
}
