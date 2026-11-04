"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Send, X } from "lucide-react";
import { enviarMensaje } from "@/lib/actions/solicitudes";
import { presentarDescargo } from "@/lib/actions/sanciones";
import { Spinner } from "@/components/ui/spinner";
import { ACCEPT_ADJUNTO } from "@/components/solicitudes/constantes";
import {
  errorPesoAdjunto,
  explicarFalloEnvio,
  firmaMensaje,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import { llamarAccion } from "@/lib/llamar-accion";
import { cn, uuidV4 } from "@/lib/utils";

/**
 * Donde se escribe, abajo de la conversación, como en WhatsApp: el texto, una foto si hace
 * falta y «Enviar». Si se corta el wifi, lo escrito queda con la MISMA clave aunque después se
 * corrija: tocar de nuevo nunca lo manda dos veces. Si el reintento vuelve "repetido" pero lo
 * escrito cambió, lo nuevo no llegó: queda en la caja con un aviso, para que decida si lo manda.
 */
export function CajaChat({
  destino,
  etiqueta,
  placeholder,
  ayuda,
  boton = "Enviar",
  listo,
  pegada = true,
}: {
  destino: { tipo: "solicitud"; id: string } | { tipo: "registro"; id: string };
  etiqueta?: string;
  placeholder: string;
  ayuda?: string;
  boton?: string;
  /** Lo que dice al enviarse bien. */
  listo: string;
  /** Pegada abajo de la pantalla, como en WhatsApp. En un aviso, con el papel arriba, no: taparía. */
  pegada?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ref, setRef] = useState(uuidV4);
  const primerIntento = useRef<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idTexto = `chat-${destino.id}`;

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
      document.getElementById(idTexto)?.focus();
      return;
    }
    const firma = firmaMensaje(mensaje, fd.get("adjunto"));
    fd.set(destino.tipo === "solicitud" ? "solicitudId" : "registroId", destino.id);
    fd.set("ref", ref);
    if (destino.tipo === "solicitud") fd.set("interno", "false");
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      if (primerIntento.current === null) primerIntento.current = firma;
      const res = await llamarAccion<{ repetido: boolean }>(() =>
        destino.tipo === "solicitud" ? enviarMensaje(fd) : presentarDescargo(fd)
      );
      if (!res.ok) {
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      if (res.data.repetido && primerIntento.current !== firma) {
        setRef(uuidV4());
        primerIntento.current = null;
        setAviso(
          "Tu mensaje anterior ya había llegado (lo ves arriba). Lo que cambiaste después todavía no se mandó: si querés agregarlo, tocá de nuevo el botón para enviar."
        );
        router.refresh();
        return;
      }
      if (res.data.repetido) toast.info("Ya lo habíamos recibido: no se mandó dos veces.");
      else toast.success(listo);
      formRef.current?.reset();
      setNombreArchivo(null);
      setRef(uuidV4());
      primerIntento.current = null;
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate data-tour="chat-caja" className={cn("chat-caja flex flex-col gap-2", pegada && "chat-caja-pegada")}>
      {etiqueta ? (
        <label htmlFor={idTexto} className="text-[1.12rem] font-extrabold [font-stretch:92%]">
          {etiqueta}
        </label>
      ) : (
        <label htmlFor={idTexto} className="sr-only">
          Tu mensaje
        </label>
      )}
      {ayuda ? <p className="-mt-1.5 text-[0.98rem] leading-snug text-tinta-2 text-pretty">{ayuda}</p> : null}
      <textarea
        id={idTexto}
        name="mensaje"
        rows={pegada ? 1 : 3}
        maxLength={4000}
        placeholder={placeholder}
        className="campo-portal resize-none [field-sizing:content] max-h-[30svh]"
        onChange={() => {
          if (error) setError(null);
          if (aviso) setAviso(null);
        }}
      />
      {error ? <AvisoError mensaje={error} /> : null}
      {aviso ? <AvisoError mensaje={aviso} tono="atencion" /> : null}
      <div className="flex items-stretch gap-2">
        <label
          htmlFor={`foto-${destino.id}`}
          className="boton boton-suave min-w-0 flex-1 cursor-pointer !px-3 !text-[1rem]"
        >
          <Camera aria-hidden strokeWidth={2.2} />
          <span className="truncate">{nombreArchivo ?? "Sumar una foto"}</span>
        </label>
        {nombreArchivo ? (
          <button
            type="button"
            onClick={quitarArchivo}
            aria-label="Quitar la foto"
            className="boton boton-suave !px-3"
          >
            <X aria-hidden strokeWidth={2.4} />
          </button>
        ) : null}
        <input
          ref={archivoRef}
          id={`foto-${destino.id}`}
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            const pesado = errorPesoAdjunto(f);
            if (pesado) {
              quitarArchivo();
              setError(pesado);
              return;
            }
            setError(null);
            setNombreArchivo(f?.name ?? null);
          }}
        />
        <button type="submit" disabled={pendiente} className="boton boton-primario shrink-0">
          {pendiente ? <Spinner className="size-5" /> : <Send aria-hidden strokeWidth={2.3} />}
          {boton}
        </button>
      </div>
    </form>
  );
}
