"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Send, X } from "lucide-react";
import { responderRegistro } from "@/lib/actions/sanciones";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ADJUNTO_REGISTRO } from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import {
  AYUDA_PESO_ADJUNTO,
  errorPesoAdjunto,
  explicarFalloEnvio,
  firmaMensaje,
  prepararAdjuntos,
} from "./adjuntos";
import { AvisoError } from "./aviso-error";

/**
 * Respuesta de Administración o del Líder en el hilo del registro (D5). Si el socio presentó
 * su descargo, la caja se destaca: responder lo pasa a "Respondido".
 * `ref` por intento (0025): si se corta el wifi, el texto queda con la MISMA clave aunque
 * se corrija, y tocar de nuevo nunca duplica el mensaje. Si el reintento vuelve "repetido"
 * pero lo escrito cambió, lo nuevo no llegó: queda en la caja con un aviso y clave nueva.
 * La clave cambia al enviarse bien.
 */
export function ResponderRegistro({
  registroId,
  esperaRespuesta,
  nombreSocio,
  sinPortal,
}: {
  registroId: string;
  esperaRespuesta: boolean;
  nombreSocio: string;
  sinPortal: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Aviso ámbar: el mensaje anterior había llegado y lo corregido todavía no se mandó. */
  const [aviso, setAviso] = useState<string | null>(null);
  const [ref, setRef] = useState(uuidV4);
  /** Lo que se mandó la primera vez con esta clave (null = todavía no se usó). */
  const primerIntento = useRef<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function quitarArchivo() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreArchivo(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    setAviso(null);
    const fd = new FormData(e.currentTarget);
    const mensaje = String(fd.get("mensaje") ?? "").trim();
    if (!mensaje) {
      setError("Escribí el mensaje antes de enviarlo.");
      document.getElementById(`respuesta-${registroId}`)?.focus();
      return;
    }
    const firma = firmaMensaje(mensaje, fd.get("adjunto"));
    fd.set("registroId", registroId);
    fd.set("ref", ref);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      // Lo que sale con esta clave por primera vez (si no salió, no cuenta).
      if (primerIntento.current === null) primerIntento.current = firma;
      const res = await llamarAccion(() => responderRegistro(fd));
      if (!res.ok) {
        // El texto y la clave quedan (aunque lo corrija): tocar "Enviar" de nuevo no lo duplica.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      if (res.data.repetido && primerIntento.current !== firma) {
        // Lo primero había llegado antes del corte y después cambió el texto o el adjunto:
        // eso no se mandó. Queda escrito, con clave nueva, y se decide si se manda.
        setRef(uuidV4());
        primerIntento.current = null;
        setAviso(
          "Tu mensaje anterior ya había llegado (está arriba). Lo que cambiaste después todavía no se mandó: si querés agregarlo, tocá de nuevo el botón para enviar."
        );
        router.refresh();
        return;
      }
      if (res.data.repetido) toast.info("Ese mensaje ya había llegado: no se mandó dos veces");
      else toast.success(`Respuesta enviada a ${nombreSocio}`);
      formRef.current?.reset();
      setNombreArchivo(null);
      setRef(uuidV4());
      primerIntento.current = null;
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className={cn(
        "space-y-3 rounded-xl border bg-card p-4",
        esperaRespuesta && "border-2 border-pendiente/40"
      )}
    >
      <div className="space-y-1">
        <Label htmlFor={`respuesta-${registroId}`} className="text-base font-semibold">
          {esperaRespuesta ? `${nombreSocio} espera tu respuesta` : "Escribirle"}
        </Label>
        {sinPortal ? (
          <p className="text-sm text-parcial">
            No tiene usuario del portal: queda registrado, pero avisale en persona.
          </p>
        ) : null}
      </div>
      <Textarea
        id={`respuesta-${registroId}`}
        name="mensaje"
        rows={3}
        maxLength={4000}
        placeholder={esperaRespuesta ? "Respondé su descargo…" : "Escribí tu mensaje…"}
        className="min-h-24 text-base md:text-base"
        onChange={() => {
          if (error) setError(null);
          if (aviso) setAviso(null);
        }}
      />
      {error ? <AvisoError mensaje={error} /> : null}
      {aviso ? <AvisoError mensaje={aviso} tono="atencion" /> : null}
      <p className="text-sm text-muted-foreground">Podés adjuntar una foto o un PDF. {AYUDA_PESO_ADJUNTO}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-1">
          <Label
            htmlFor={`adjunto-${registroId}`}
            className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4 shrink-0" strokeWidth={2} />
            <span className="max-w-48 truncate">{nombreArchivo ?? "Adjuntar foto o PDF"}</span>
          </Label>
          {nombreArchivo ? (
            <Button type="button" variant="ghost" className="min-h-11" onClick={quitarArchivo} aria-label="Quitar el adjunto">
              <X className="size-4" strokeWidth={2} />
            </Button>
          ) : null}
          <input
            ref={archivoRef}
            id={`adjunto-${registroId}`}
            name="adjunto"
            type="file"
            accept={ACCEPT_ADJUNTO_REGISTRO}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              const pesado = errorPesoAdjunto(f);
              if (pesado) {
                quitarArchivo();
                setError(pesado);
                return;
              }
              setNombreArchivo(f?.name ?? null);
            }}
          />
        </div>
        <Button type="submit" size="lg" disabled={pendiente} className="h-12 px-5 text-base font-semibold">
          {pendiente ? <Spinner className="size-5" /> : <Send className="size-5" strokeWidth={2} />}
          {esperaRespuesta ? "Enviar respuesta" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
