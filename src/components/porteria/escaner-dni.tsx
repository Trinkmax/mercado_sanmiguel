"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export type DatosDni = { dni: string; apellido: string; nombre: string };

// BarcodeDetector todavía no está en lib.dom: tipado mínimo local.
type CodigoDetectado = { rawValue: string; format: string };
type DetectorCodigos = {
  detect: (fuente: HTMLVideoElement) => Promise<CodigoDetectado[]>;
};
type DetectorCtor = {
  new (opciones?: { formats?: string[] }): DetectorCodigos;
  getSupportedFormats?: () => Promise<string[]>;
};

function obtenerCtor(): DetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null;
}

/** "PEREZ GOMEZ" → "Perez Gomez" (el código viene en mayúsculas y sin tildes). */
function capitalizar(texto: string): string {
  return texto
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join("");
}

const ES_DNI = /^\d{7,8}$/;
const ES_TEXTO = /^[A-ZÁÉÍÓÚÜÑ'\- ]+$/i;

/**
 * Lee el PDF417 del DNI argentino. Campos separados por "@":
 * - Formato 2011+: tramite@apellido@nombre@sexo@dni@ejemplar@nacimiento@emision@…
 * - Formato 2009–2011: @dni@ejemplar@?@apellido@nombre@nacionalidad@…
 * Devuelve null si no parece un DNI.
 */
export function parsearDni(raw: string): DatosDni | null {
  const partes = raw.split("@").map((p) => p.trim());
  if (partes.length < 3) return null;

  if (partes.length >= 5 && ES_DNI.test(partes[4]) && ES_TEXTO.test(partes[1]) && ES_TEXTO.test(partes[2])) {
    return { dni: partes[4], apellido: capitalizar(partes[1]), nombre: capitalizar(partes[2]) };
  }
  if (partes[0] === "" && ES_DNI.test(partes[1]) && partes.length >= 6) {
    return { dni: partes[1], apellido: capitalizar(partes[4]), nombre: capitalizar(partes[5]) };
  }
  // Último recurso: el primer número de 7–8 dígitos y los dos primeros campos de texto.
  const dni = partes.find((p) => ES_DNI.test(p));
  if (!dni) return null;
  const textos = partes.filter((p) => p.length > 1 && ES_TEXTO.test(p) && !/^[MF]$/i.test(p));
  if (textos.length < 2) return null;
  return { dni, apellido: capitalizar(textos[0]), nombre: capitalizar(textos[1]) };
}

/**
 * Botón "Escanear DNI": solo aparece si el navegador trae BarcodeDetector
 * con soporte pdf417. Abre la cámara trasera en un diálogo, lee el código
 * del DNI y devuelve dni/apellido/nombre.
 */
export function EscanerDni({
  onLeido,
  disabled = false,
}: {
  onLeido: (datos: DatosDni) => void;
  disabled?: boolean;
}) {
  const [soportado, setSoportado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<"iniciando" | "buscando" | "error">("iniciando");
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const ctor = obtenerCtor();
    if (!ctor || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    let vivo = true;
    const formatos = ctor.getSupportedFormats
      ? ctor.getSupportedFormats()
      : Promise.resolve(["pdf417"]);
    formatos
      .then((lista) => {
        if (vivo) setSoportado(lista.includes("pdf417"));
      })
      .catch(() => {
        if (vivo) setSoportado(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const detener = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!abierto) {
      detener();
      return;
    }
    let cancelado = false;

    async function iniciar() {
      const ctor = obtenerCtor();
      if (!ctor) {
        setEstado("error");
        setMensajeError("Este navegador no puede leer el código del DNI.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setEstado("buscando");

        const detector = new ctor({ formats: ["pdf417"] });
        let ocupado = false;
        timerRef.current = window.setInterval(async () => {
          if (ocupado || cancelado || !videoRef.current || videoRef.current.readyState < 2) return;
          ocupado = true;
          try {
            const codigos = await detector.detect(videoRef.current);
            for (const c of codigos) {
              const datos = parsearDni(c.rawValue);
              if (datos) {
                detener();
                setAbierto(false);
                onLeido(datos);
                return;
              }
            }
          } catch {
            // Un frame que no se pudo analizar: seguimos intentando.
          } finally {
            ocupado = false;
          }
        }, 220);
      } catch {
        if (cancelado) return;
        setEstado("error");
        setMensajeError(
          "No pudimos abrir la cámara. Revisá que el navegador tenga permiso para usarla."
        );
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      detener();
    };
  }, [abierto, detener, onLeido]);

  if (!soportado) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-14 px-5 text-base"
        onClick={() => {
          setEstado("iniciando");
          setMensajeError(null);
          setAbierto(true);
        }}
        disabled={disabled}
      >
        <ScanLine className="size-5" strokeWidth={2} />
        Escanear DNI
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Escanear DNI</DialogTitle>
            <DialogDescription className="text-sm">
              Apuntá la cámara al código de barras del frente del DNI. Se completa solo.
            </DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80"
            />
            {estado !== "error" ? (
              <p className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/60 py-2 text-sm text-white">
                {estado === "iniciando" ? (
                  <>
                    <Spinner className="size-4" /> Abriendo la cámara…
                  </>
                ) : (
                  <>
                    <Camera className="size-4" strokeWidth={2} /> Buscando el código…
                  </>
                )}
              </p>
            ) : null}
          </div>
          {mensajeError ? (
            <p className="text-sm font-medium text-pendiente">{mensajeError}</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full text-base"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
