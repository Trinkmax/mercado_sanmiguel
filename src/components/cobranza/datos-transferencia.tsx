"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, FileText, Images, X } from "lucide-react";
import { comprimirImagen } from "@/lib/imagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  ACCEPT_COMPROBANTE,
  MAX_COMPROBANTE,
  MENSAJE_COMPROBANTE_PESADO,
} from "@/components/cobranza/tipos";

const CLASE_OPCION =
  "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-center text-base font-semibold text-primary transition-colors hover:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/30";

/**
 * Titular de la cuenta + foto del comprobante (opcional) de una línea de transferencia.
 * Dos caminos: "Sacar foto" abre la cámara; "Elegir de la galería" deja elegir la captura
 * que mandó el cliente (o un PDF). Las fotos se achican en el navegador (comprimirImagen,
 * ~400 KB) antes de guardarlas en el formulario: así el cobro sube rápido y no choca con el
 * límite del servidor (MAX_COMPROBANTE, 4 MB). Mientras se achica, `onPreparando(true)`: el
 * padre apaga el botón de cobrar para que el cobro no salga sin la foto.
 * La vista previa usa un object URL que se libera al cambiar o desmontar.
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
  onPreparando,
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
  /** true mientras se achica la foto elegida (el padre no deja cobrar hasta que termine). */
  onPreparando?: (preparando: boolean) => void;
}) {
  const id = useId();
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  // Vista previa: un object URL por archivo, que se libera al reemplazarlo, quitarlo o desmontar.
  const previewRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparando, setPreparandoLocal] = useState(false);
  // Si eligen otra foto mientras se achica la anterior, gana la última.
  const eleccionRef = useRef(0);
  // Se desmontó (cambiaron de medio o quitaron la parte): la foto que se estaba achicando no llega.
  const montadoRef = useRef(true);
  // El padre se entera de cuándo se está preparando (y deja de estarlo si esto se desmonta).
  const preparandoRef = useRef(false);
  const onPreparandoRef = useRef(onPreparando);
  useEffect(() => {
    onPreparandoRef.current = onPreparando;
  }, [onPreparando]);

  function setPreparando(valor: boolean) {
    setPreparandoLocal(valor);
    if (preparandoRef.current === valor) return;
    preparandoRef.current = valor;
    onPreparandoRef.current?.(valor);
  }

  function actualizarPreview(archivo: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = archivo && archivo.type.startsWith("image/") ? URL.createObjectURL(archivo) : null;
    previewRef.current = url;
    setPreview(url);
  }

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      // Cambiaron de medio (o quitaron la parte) mientras se achicaba: esa foto ya no llega
      // y el padre vuelve a dejar cobrar.
      montadoRef.current = false;
      if (preparandoRef.current) {
        preparandoRef.current = false;
        onPreparandoRef.current?.(false);
      }
    };
  }, []);

  function limpiarInputs() {
    if (camaraRef.current) camaraRef.current.value = "";
    if (galeriaRef.current) galeriaRef.current.value = "";
  }

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0] ?? null;
    if (!original) return;
    const turno = ++eleccionRef.current;
    onErrorComprobante(undefined);
    setPreparando(true);
    const archivo = await comprimirImagen(original);
    if (turno !== eleccionRef.current || !montadoRef.current) return;
    setPreparando(false);
    limpiarInputs();
    if (archivo.size > MAX_COMPROBANTE) {
      onErrorComprobante(MENSAJE_COMPROBANTE_PESADO);
      return;
    }
    actualizarPreview(archivo);
    onComprobante(archivo);
  }

  function quitar() {
    eleccionRef.current++;
    setPreparando(false);
    actualizarPreview(null);
    onComprobante(null);
    onErrorComprobante(undefined);
    limpiarInputs();
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
            className="h-auto min-h-11 max-w-full px-3 py-2 text-left text-sm whitespace-normal"
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
        <p id={`${id}-comprobante`} className="text-base font-medium">
          Foto del comprobante{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </p>
        {preparando ? (
          <div
            className="flex min-h-14 items-center justify-center gap-2 rounded-lg border bg-muted/30 px-4 text-base"
            role="status"
          >
            <Spinner className="size-5 text-primary" />
            Preparando la foto…
          </div>
        ) : comprobante ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
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
            <div className="min-w-0 flex-1 basis-32">
              <p className="truncate font-medium">{comprobante.name}</p>
              <p className="text-sm text-muted-foreground">Se guarda junto con el recibo.</p>
            </div>
            <Button type="button" variant="outline" className="h-11 px-3 text-sm" onClick={quitar}>
              <X className="size-4" strokeWidth={2} />
              Quitar
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby={`${id}-comprobante`}>
            <label className={CLASE_OPCION}>
              <input
                ref={camaraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={elegir}
              />
              <Camera className="size-6 shrink-0" strokeWidth={2} />
              Sacar foto
            </label>
            <label className={CLASE_OPCION}>
              <input
                ref={galeriaRef}
                type="file"
                accept={ACCEPT_COMPROBANTE}
                className="sr-only"
                onChange={elegir}
              />
              <Images className="size-6 shrink-0" strokeWidth={2} />
              Elegir de la galería
            </label>
          </div>
        )}
        {errorComprobante ? (
          <p className="text-sm font-medium text-destructive">{errorComprobante}</p>
        ) : !comprobante && !preparando ? (
          <p className="text-sm text-muted-foreground">
            Si el cliente te mandó la captura por WhatsApp, elegila de la galería (también sirve un PDF).
          </p>
        ) : null}
      </div>
    </div>
  );
}
