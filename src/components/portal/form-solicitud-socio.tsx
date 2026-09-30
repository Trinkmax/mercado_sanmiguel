"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Send, X } from "lucide-react";
import { crearSolicitudSocio } from "@/lib/actions/portal";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPT_ADJUNTO,
  firmaFormulario,
  TIPOS_SOLICITUD,
  type TipoSolicitud,
} from "@/components/solicitudes/constantes";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AvisoError, irAlCampo } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";

/**
 * Alta de solicitud del socio: tipo → asunto → detalle → foto opcional → enviar.
 * Clave de idempotencia (`ref`, como en el panel): la misma mientras no cambie lo escrito y
 * hasta que se guarde. Si se corta el wifi y el socio toca "Enviar" de nuevo, no sale otra
 * solicitud igual: vuelve la que ya había llegado. Si corrige algo, es otro envío.
 */
export function FormSolicitudSocio() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoSolicitud>("solicitud");
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** El aviso de "falta el asunto" va debajo del asunto; los demás, junto al botón. */
  const [faltaAsunto, setFaltaAsunto] = useState(false);
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);

  function quitarAdjunto() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreAdjunto(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    setFaltaAsunto(false);
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("asunto") ?? "").trim()) {
      setFaltaAsunto(true);
      irAlCampo("soc-asunto");
      return;
    }
    fd.set("tipo", tipo);
    const firma = firmaFormulario(fd);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    fd.set("ref", claveRef.current.ref);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => crearSolicitudSocio(fd));
      if (!res.ok) {
        // Lo escrito queda en el formulario y la clave se conserva: tocar "Enviar" de nuevo
        // no la manda dos veces.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      claveRef.current = null;
      if (res.data.repetido) {
        toast.info(`Ya la habíamos recibido: es la solicitud N° ${res.data.numero}. No se mandó dos veces.`);
      } else {
        toast.success(`Solicitud N° ${res.data.numero} enviada`);
      }
      router.push(`/mi-cuenta/solicitudes/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-7">
      <fieldset className="space-y-2" data-tour="solicitudes-socio-tipo">
        <legend className="text-base font-medium">¿Qué querés hacer?</legend>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_SOLICITUD.map((t) => {
            const activo = tipo === t.valor;
            return (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTipo(t.valor)}
                aria-pressed={activo}
                className={cn(
                  "flex min-h-14 items-center justify-center gap-1.5 rounded-md border px-3 text-base font-semibold transition-colors",
                  activo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                {activo ? <Check className="size-4" strokeWidth={2.5} /> : null}
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          {TIPOS_SOLICITUD.find((t) => t.valor === tipo)?.ayuda}
        </p>
      </fieldset>

      <div className="space-y-2" data-tour="solicitudes-socio-asunto">
        <Label htmlFor="soc-asunto" className="text-base">
          Asunto
        </Label>
        <Input
          id="soc-asunto"
          name="asunto"
          maxLength={200}
          autoComplete="off"
          placeholder="En pocas palabras, ¿de qué se trata?"
          className="h-12 text-base md:text-base"
          onChange={() => faltaAsunto && setFaltaAsunto(false)}
        />
        {faltaAsunto ? <AvisoError mensaje="Poné el asunto: en pocas palabras, de qué se trata." /> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="soc-detalle" className="text-base">
          Contanos más
        </Label>
        <Textarea
          id="soc-detalle"
          name="detalle"
          rows={5}
          maxLength={6000}
          placeholder="Qué pasó, desde cuándo, qué necesitás."
          className="min-h-32 text-base md:text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="soc-adjunto" className="text-base">
          Foto o PDF (opcional)
        </Label>
        <div className="flex gap-2">
          <Label
            htmlFor="soc-adjunto"
            className="inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{nombreAdjunto ?? "Sacar una foto o elegir archivo"}</span>
          </Label>
          {nombreAdjunto ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-12"
              onClick={quitarAdjunto}
              aria-label="Quitar el archivo"
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          ) : null}
        </div>
        <Input
          ref={archivoRef}
          id="soc-adjunto"
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            const pesado = errorPesoAdjunto(f);
            if (pesado) {
              quitarAdjunto();
              setError(pesado);
              return;
            }
            setError(null);
            setNombreAdjunto(f?.name ?? null);
          }}
        />
        <p className="text-sm text-muted-foreground">{AYUDA_PESO_ADJUNTO}</p>
      </div>

      {error ? <AvisoError mensaje={error} /> : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-14 w-full text-base font-semibold"
        data-tour="solicitudes-socio-enviar"
      >
        {pendiente ? (
          <Spinner className="size-5" />
        ) : (
          <Send className="size-5" strokeWidth={2} />
        )}
        Enviar solicitud
      </Button>
    </form>
  );
}
