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
import {
  adjuntoMuyPesado,
  ERROR_PESO_ADJUNTO,
  explicarFalloEnvio,
  firmaMensaje,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";
import { uuidV4 } from "@/lib/utils";

/**
 * Caja del socio para contestar un registro: "Presentar mi descargo" (apercibimiento o sanción)
 * o "Responder" (notificación). Texto + foto o PDF opcional ("Sacar una foto o elegir archivo").
 * Si se corta el wifi, lo escrito queda con la MISMA clave (`ref`, 0025) aunque después se
 * corrija: tocar de nuevo nunca manda el descargo dos veces. Si el reintento vuelve
 * "repetido" pero lo escrito cambió, lo nuevo no llegó: queda en la caja con un aviso y una
 * clave nueva, para que el socio decida si lo manda. La clave cambia al enviarse bien.
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
  /** Aviso ámbar: el mensaje anterior había llegado y lo corregido todavía no se mandó. */
  const [aviso, setAviso] = useState<string | null>(null);
  const [ref, setRef] = useState(uuidV4);
  /** Lo que se mandó la primera vez con esta clave (null = todavía no se usó). */
  const primerIntento = useRef<string | null>(null);
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
    if (pendiente) return;
    setError(null);
    setAviso(null);
    const fd = new FormData(e.currentTarget);
    const mensaje = String(fd.get("mensaje") ?? "").trim();
    if (!mensaje) {
      setError("Escribí lo que querés contar antes de enviarlo.");
      document.getElementById(`descargo-${registroId}`)?.focus();
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
      const res = await llamarAccion(() => presentarDescargo(fd));
      if (!res.ok) {
        // Lo escrito y la clave quedan (aunque lo corrija): tocar de nuevo no lo manda dos veces.
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      if (res.data.repetido && primerIntento.current !== firma) {
        // Lo primero había llegado antes del corte y después cambió el texto o la foto:
        // eso no se mandó. Queda escrito, con clave nueva, y el socio decide.
        setRef(uuidV4());
        primerIntento.current = null;
        setAviso(
          "Tu mensaje anterior ya había llegado (lo ves arriba). Lo que cambiaste después todavía no se mandó: si querés agregarlo, tocá de nuevo el botón para enviar."
        );
        router.refresh();
        return;
      }
      if (res.data.repetido) {
        toast.info("Ya lo habíamos recibido: no se mandó dos veces.");
      } else {
        toast.success(
          esNotificacion
            ? "Listo: enviamos tu respuesta."
            : "Listo: enviamos tu descargo. Te vamos a responder por acá."
        );
      }
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
        maxLength={4000}
        placeholder={esNotificacion ? "Escribí tu respuesta…" : "Contá tu versión…"}
        className="min-h-32 text-base md:text-base"
        onChange={() => {
          if (error) setError(null);
          if (aviso) setAviso(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor={`archivo-${registroId}`}
          className="inline-flex min-h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card px-4 text-base font-medium hover:bg-muted sm:flex-none"
        >
          <Camera className="size-5 shrink-0" strokeWidth={2} />
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
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (adjuntoMuyPesado(f)) {
              quitarArchivo();
              setError(ERROR_PESO_ADJUNTO);
              return;
            }
            setNombreArchivo(f?.name ?? null);
          }}
        />
      </div>

      {error ? <AvisoError mensaje={error} /> : null}
      {aviso ? <AvisoError mensaje={aviso} tono="atencion" /> : null}

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
