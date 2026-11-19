"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Send } from "lucide-react";
import { enviarMensaje } from "@/lib/actions/solicitudes";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { firmaFormulario } from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { explicarFalloEnvio, prepararAdjuntos } from "@/components/comunicaciones/adjuntos";
import {
  AYUDA_VARIOS_ARCHIVOS,
  cuantosArchivos,
  mandarArchivosSueltos,
  type ArchivoElegido,
} from "./archivos-sueltos";
import { BotonArchivosPanel, ListaArchivosPanel } from "./archivos-panel";

/**
 * Caja para escribir en el hilo: texto + fotos o PDF (varios, hasta 10) + (solo staff)
 * switch "Mensaje interno". El socio nunca ve el switch.
 * Si se corta la red, lo escrito queda y el reintento no duplica el mensaje (misma clave).
 * Con varios archivos, el primero va con el texto y los demás sueltos, cada uno en su pedido y
 * con su clave (archivos-sueltos.ts); en una nota interna, los archivos también son internos.
 * Los que no llegan quedan en la caja para tocar el botón de nuevo. Puede ir sin texto.
 */
export function CajaMensaje({
  solicitudId,
  esStaff,
  placeholder = "Escribí tu mensaje…",
  className,
}: {
  solicitudId: string;
  esStaff: boolean;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [interno, setInterno] = useState(false);
  const [archivos, setArchivos] = useState<ArchivoElegido[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** «2 de 5» mientras se mandan varios archivos. */
  const [avance, setAvance] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // Clave de idempotencia del mensaje: la misma mientras el texto no cambie y hasta que se
  // guarde (si la persona lo corrige después de un corte, es otro mensaje).
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);
  const textoBoton = interno ? "Guardar nota interna" : "Enviar mensaje";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    const fd = new FormData(e.currentTarget);
    const mensaje = String(fd.get("mensaje") ?? "").trim();
    if (!mensaje && archivos.length === 0) {
      setError("Escribí el mensaje o adjuntá un archivo antes de enviarlo.");
      return;
    }
    setError(null);
    const total = archivos.length;
    // Con texto, el primer archivo va con él (un mensaje, como siempre); sin texto, todos sueltos.
    const [primero, ...resto] = mensaje ? archivos : [];
    const sueltos = mensaje ? resto : archivos;
    // Lo que se eligió al tocar el botón: los archivos que siguen van igual (interno o no).
    const comoInterno = interno;
    const listo = comoInterno ? "Nota interna guardada" : "Mensaje enviado";

    startTransition(async () => {
      if (mensaje) {
        fd.set("solicitudId", solicitudId);
        fd.set("interno", comoInterno ? "true" : "false");
        if (primero) fd.set("adjunto", primero.archivo, primero.archivo.name);
        const firma = firmaFormulario(fd);
        if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
        fd.set("ref", claveRef.current.ref);
        if (total > 1) setAvance(`1 de ${total}`);
        const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
        if (errorPeso) {
          setAvance(null);
          setError(errorPeso);
          return;
        }
        const res = await llamarAccion(() => enviarMensaje(fd));
        if (!res.ok) {
          setAvance(null);
          setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
          return;
        }
        // Llegó el texto (y el primer archivo): de acá en más solo quedan archivos sueltos.
        claveRef.current = null;
        formRef.current?.reset();
        setArchivos(resto);
        if (sueltos.length === 0) {
          setAvance(null);
          toast.success(res.data.repetido ? "Ya se había enviado" : listo);
          setInterno(false);
          router.refresh();
          return;
        }
      }

      let van = total - sueltos.length;
      setAvance(total > 1 ? `${van + 1} de ${total}` : null);
      const r = await mandarArchivosSueltos(solicitudId, sueltos, {
        desdePortal: false,
        interno: comoInterno,
        alLlegar: (a) => {
          van += 1;
          setArchivos((lista) => lista.filter((x) => x.ref !== a.ref));
          if (van < total) setAvance(`${van + 1} de ${total}`);
        },
      });
      setAvance(null);
      router.refresh();
      if (r.error) {
        // El switch queda como estaba: lo que falta se manda igual (interno o no).
        const faltan = sueltos.length - r.llegaron.length;
        setError(
          `${faltan === 1 ? "Falta mandar 1 archivo: quedó" : `Faltan mandar ${cuantosArchivos(faltan)}: quedaron`} acá abajo, tocá «${comoInterno ? "Guardar nota interna" : "Enviar mensaje"}» de nuevo. ${r.error}`
        );
        return;
      }
      toast.success(listo);
      setInterno(false);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      data-tour="solicitudes-escribir"
      className={cn(
        "space-y-3 rounded-xl border bg-card p-4 transition-colors",
        interno && "border-parcial/50 bg-parcial-suave/60",
        className
      )}
    >
      <div className="space-y-2">
        <Label htmlFor={`mensaje-${solicitudId}`} className="text-base">
          {interno ? "Nota interna (no la ve el socio)" : "Tu mensaje"}
        </Label>
        <Textarea
          id={`mensaje-${solicitudId}`}
          name="mensaje"
          rows={3}
          maxLength={6000}
          placeholder={placeholder}
          onChange={() => {
            if (error) setError(null);
          }}
          className="min-h-24 bg-card text-base md:text-base"
        />
        <p className="text-sm text-muted-foreground">Podés adjuntar fotos o PDF. {AYUDA_VARIOS_ARCHIVOS}</p>
      </div>

      <ListaArchivosPanel
        archivos={archivos}
        deshabilitado={pendiente}
        onQuitar={(ref) => {
          setArchivos((lista) => lista.filter((a) => a.ref !== ref));
          setError(null);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <BotonArchivosPanel
            id={`adjunto-${solicitudId}`}
            archivos={archivos}
            deshabilitado={pendiente}
            texto="Adjuntar foto o PDF"
            textoOtro="Sumar otro"
            onCambio={setArchivos}
            onError={setError}
          />
          {esStaff ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium select-none">
              <Switch checked={interno} onCheckedChange={setInterno} disabled={pendiente} />
              <Lock className="size-4 text-parcial" strokeWidth={2} />
              Mensaje interno
            </label>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={pendiente}
          className="h-12 px-5 text-base font-semibold"
        >
          {pendiente ? (
            <Spinner className="size-5" />
          ) : (
            <Send className="size-5" strokeWidth={2} />
          )}
          {avance ? `Enviando ${avance}…` : textoBoton}
        </Button>
      </div>

      {error ? <AlertaError error={error} titulo="No se pudo enviar" /> : null}
    </form>
  );
}
