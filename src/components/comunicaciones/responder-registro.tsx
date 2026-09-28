"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Send, X } from "lucide-react";
import { responderRegistro } from "@/lib/actions/sanciones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ADJUNTO_REGISTRO } from "./constantes";

/**
 * Respuesta de Administración o del Líder en el hilo del registro (D5). Si el socio presentó
 * su descargo, la caja se destaca: responder lo pasa a "Respondido".
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
  const [pendiente, startTransition] = useTransition();

  function quitarArchivo() {
    if (archivoRef.current) archivoRef.current.value = "";
    setNombreArchivo(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("registroId", registroId);
    startTransition(async () => {
      const res = await responderRegistro(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Respuesta enviada a ${nombreSocio}`);
      formRef.current?.reset();
      setNombreArchivo(null);
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
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
        required
        maxLength={4000}
        placeholder={esperaRespuesta ? "Respondé su descargo…" : "Escribí tu mensaje…"}
        className="min-h-24 text-base md:text-base"
        onChange={() => error && setError(null)}
      />
      {error ? (
        <p role="alert" className="text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Label
            htmlFor={`adjunto-${registroId}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4" strokeWidth={2} />
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
            onChange={(e) => setNombreArchivo(e.target.files?.[0]?.name ?? null)}
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
