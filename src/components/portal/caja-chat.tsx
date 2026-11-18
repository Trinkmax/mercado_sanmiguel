"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { enviarMensaje } from "@/lib/actions/solicitudes";
import { presentarDescargo } from "@/lib/actions/sanciones";
import { Spinner } from "@/components/ui/spinner";
import {
  explicarFalloEnvio,
  firmaMensaje,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";
import { AvisoError } from "@/components/comunicaciones/aviso-error";
import {
  cuantosArchivos,
  mandarArchivosSueltos,
  MAX_ARCHIVOS,
  type ArchivoElegido,
} from "@/components/solicitudes/archivos-sueltos";
import { BotonSumarArchivos, ListaArchivos } from "@/components/portal/elegir-archivos";
import { llamarAccion } from "@/lib/llamar-accion";
import { cn, uuidV4 } from "@/lib/utils";

/**
 * Donde se escribe, abajo de la conversación, como en WhatsApp: el texto, fotos si hacen
 * falta y «Enviar». Si se corta el wifi, lo escrito queda con la MISMA clave aunque después se
 * corrija: tocar de nuevo nunca lo manda dos veces. Si el reintento vuelve "repetido" pero lo
 * escrito cambió, lo nuevo no llegó: queda en la caja con un aviso, para que decida si lo manda.
 * En una solicitud van varias fotos o PDF (hasta 10): el primero con el texto y los demás
 * sueltos, cada uno en su pedido y con su clave (archivos-sueltos.ts); también se pueden
 * mandar sin texto. Los que no llegan quedan en la caja para tocar «Enviar» de nuevo. En un
 * descargo, un archivo solo y el texto es obligatorio, como siempre.
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
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** «2 de 5» mientras se mandan varios archivos. */
  const [avance, setAvance] = useState<string | null>(null);
  const [ref, setRef] = useState(uuidV4);
  const primerIntento = useRef<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idTexto = `chat-${destino.id}`;
  const esSolicitud = destino.tipo === "solicitud";
  const max = esSolicitud ? MAX_ARCHIVOS : 1;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    setError(null);
    setAviso(null);
    const fd = new FormData(e.currentTarget);
    const mensaje = String(fd.get("mensaje") ?? "").trim();
    // En una solicitud alcanza con una foto; un descargo necesita lo que cuenta.
    if (!mensaje && !(esSolicitud && archivos.length > 0)) {
      setError(
        esSolicitud
          ? "Escribí lo que querés contar o sumá una foto antes de enviarlo."
          : "Escribí lo que querés contar antes de enviarlo."
      );
      document.getElementById(idTexto)?.focus();
      return;
    }
    const total = archivos.length;
    // Con texto, el primer archivo va con él (un mensaje, como siempre); sin texto, todos sueltos.
    const [primero, ...resto] = mensaje ? archivos : [];
    const sueltos = mensaje ? resto : archivos;

    startTransition(async () => {
      if (mensaje) {
        if (primero) fd.set("adjunto", primero.archivo, primero.archivo.name);
        const firma = firmaMensaje(mensaje, fd.get("adjunto"));
        fd.set(esSolicitud ? "solicitudId" : "registroId", destino.id);
        fd.set("ref", ref);
        if (esSolicitud) {
          fd.set("interno", "false");
          // Escribe el cliente (también alguien del equipo en su propia carpeta, 0066).
          fd.set("desde", "portal");
        }
        if (total > 1) setAvance(`1 de ${total}`);
        const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
        if (errorPeso) {
          setAvance(null);
          setError(errorPeso);
          return;
        }
        if (primerIntento.current === null) primerIntento.current = firma;
        const res = await llamarAccion<{ repetido: boolean }>(() =>
          esSolicitud ? enviarMensaje(fd) : presentarDescargo(fd)
        );
        if (!res.ok) {
          setAvance(null);
          setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
          return;
        }
        if (res.data.repetido && primerIntento.current !== firma) {
          setAvance(null);
          setRef(uuidV4());
          primerIntento.current = null;
          setAviso(
            "Tu mensaje anterior ya había llegado (lo ves arriba). Lo que cambiaste después todavía no se mandó: si querés agregarlo, tocá de nuevo el botón para enviar."
          );
          router.refresh();
          return;
        }
        // Llegó el texto (y el primer archivo): de acá en más solo quedan archivos sueltos.
        formRef.current?.reset();
        setRef(uuidV4());
        primerIntento.current = null;
        setArchivos(resto);
        if (sueltos.length === 0) {
          setAvance(null);
          if (res.data.repetido) toast.info("Ya lo habíamos recibido: no se mandó dos veces.");
          else toast.success(listo);
          router.refresh();
          return;
        }
      }

      let van = total - sueltos.length;
      setAvance(total > 1 ? `${van + 1} de ${total}` : null);
      const r = await mandarArchivosSueltos(destino.id, sueltos, {
        desdePortal: true,
        alLlegar: (a) => {
          van += 1;
          setArchivos((lista) => lista.filter((x) => x.ref !== a.ref));
          if (van < total) setAvance(`${van + 1} de ${total}`);
        },
      });
      setAvance(null);
      router.refresh();
      if (r.error) {
        const faltan = sueltos.length - r.llegaron.length;
        setError(
          `${faltan === 1 ? "Falta mandar 1 archivo: quedó" : `Faltan mandar ${cuantosArchivos(faltan)}: quedaron`} acá abajo, tocá «${boton}» de nuevo. ${r.error}`
        );
        return;
      }
      toast.success(listo);
    });
  }

  const lleno = archivos.length >= max;

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
      <ListaArchivos
        archivos={archivos}
        acotada={pegada}
        deshabilitado={pendiente}
        onQuitar={(r) => {
          setArchivos((lista) => lista.filter((a) => a.ref !== r));
          setError(null);
        }}
      />
      {error ? <AvisoError mensaje={error} /> : null}
      {aviso ? <AvisoError mensaje={aviso} tono="atencion" /> : null}
      <div className="flex items-stretch gap-2">
        <BotonSumarArchivos
          id={`foto-${destino.id}`}
          archivos={archivos}
          max={max}
          deshabilitado={pendiente}
          texto={esSolicitud ? "Sumar fotos o PDF" : "Sumar una foto"}
          textoOtro="Sumar otra"
          className="flex-1 !px-3 !text-[1rem]"
          onCambio={setArchivos}
          onError={setError}
        />
        <button type="submit" disabled={pendiente} className={cn("boton boton-primario shrink-0", lleno && max === 1 && "flex-1")}>
          {pendiente ? <Spinner className="size-5" /> : <Send aria-hidden strokeWidth={2.3} />}
          {avance ?? boton}
        </button>
      </div>
    </form>
  );
}
