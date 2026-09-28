"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Send, X } from "lucide-react";
import { presentarDescargo } from "@/lib/actions/sanciones";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ADJUNTO_REGISTRO } from "@/components/comunicaciones/constantes";

/**
 * Caja del socio para contestar un registro: "Presentar mi descargo" (apercibimiento o sanción)
 * o "Responder" (notificación). Texto + foto o PDF opcional ("Sacar una foto o elegir archivo").
 */
export function CajaDescargo({
  registroId,
  tipo,
  yaEscribio,
}: {
  registroId: string;
  tipo: string;
  /** Ya mandó algo antes: la caja invita a "agregar algo más". */
  yaEscribio: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const esNotificacion = tipo === "notificacion";
  const titulo = yaEscribio
    ? "¿Querés agregar algo más?"
    : esNotificacion
      ? "Responder"
      : "Presentar mi descargo";
  const boton = esNotificacion ? "Enviar respuesta" : yaEscribio ? "Enviar" : "Enviar mi descargo";

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
      const res = await presentarDescargo(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        esNotificacion
          ? "Listo: enviamos tu respuesta."
          : "Listo: enviamos tu descargo. Te vamos a responder por acá."
      );
      formRef.current?.reset();
      setNombreArchivo(null);
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border-2 border-primary/25 bg-card p-4"
    >
      <div className="space-y-1">
        <Label htmlFor={`descargo-${registroId}`} className="font-display text-lg font-bold">
          {titulo}
        </Label>
        {!yaEscribio && !esNotificacion ? (
          <p className="text-sm text-muted-foreground">
            Contá tu versión de lo que pasó. Si tenés una foto o un papel que lo muestre, sumalo.
          </p>
        ) : null}
      </div>

      <Textarea
        id={`descargo-${registroId}`}
        name="mensaje"
        rows={4}
        required
        maxLength={4000}
        placeholder={esNotificacion ? "Escribí tu respuesta…" : "Contá tu versión…"}
        className="min-h-32 text-base md:text-base"
        onChange={() => error && setError(null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor={`archivo-${registroId}`}
          className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card px-4 text-base font-medium hover:bg-muted sm:flex-none"
        >
          <Camera className="size-5" strokeWidth={2} />
          <span className="truncate">{nombreArchivo ?? "Sacar una foto o elegir archivo"}</span>
        </Label>
        {nombreArchivo ? (
          <Button type="button" variant="ghost" className="min-h-12" onClick={quitarArchivo}>
            <X className="size-4" strokeWidth={2} />
            Quitar
          </Button>
        ) : null}
        <input
          ref={archivoRef}
          id={`archivo-${registroId}`}
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO_REGISTRO}
          className="sr-only"
          onChange={(e) => setNombreArchivo(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-14 w-full text-base font-semibold"
      >
        {pendiente ? <Spinner className="size-5" /> : <Send className="size-5" strokeWidth={2} />}
        {boton}
      </Button>
    </form>
  );
}
