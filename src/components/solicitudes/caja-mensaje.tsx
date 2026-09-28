"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Paperclip, Send, X } from "lucide-react";
import { enviarMensaje } from "@/lib/actions/solicitudes";
import { cn, uuidV4 } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ADJUNTO, firmaFormulario } from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";
import {
  adjuntoMuyPesado,
  ERROR_PESO_ADJUNTO,
  explicarFalloEnvio,
  prepararAdjuntos,
} from "@/components/comunicaciones/adjuntos";

/**
 * Caja para escribir en el hilo: texto + adjunto opcional + (solo staff)
 * switch "Mensaje interno". El socio nunca ve el switch.
 * Si se corta la red, lo escrito queda y el reintento no duplica el mensaje (misma clave).
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
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const adjuntoRef = useRef<HTMLInputElement>(null);
  // Clave de idempotencia del mensaje: la misma mientras el texto no cambie y hasta que se
  // guarde (si la persona lo corrige después de un corte, es otro mensaje).
  const claveRef = useRef<{ firma: string; ref: string } | null>(null);

  function quitarAdjunto() {
    if (adjuntoRef.current) adjuntoRef.current.value = "";
    setNombreAdjunto(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pendiente) return;
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("mensaje") ?? "").trim()) {
      setError("Escribí el mensaje antes de enviarlo.");
      return;
    }
    setError(null);
    fd.set("solicitudId", solicitudId);
    fd.set("interno", interno ? "true" : "false");
    const firma = firmaFormulario(fd);
    if (claveRef.current?.firma !== firma) claveRef.current = { firma, ref: uuidV4() };
    fd.set("ref", claveRef.current.ref);
    startTransition(async () => {
      const errorPeso = await prepararAdjuntos(fd, ["adjunto"]);
      if (errorPeso) {
        setError(errorPeso);
        return;
      }
      const res = await llamarAccion(() => enviarMensaje(fd));
      if (!res.ok) {
        setError(explicarFalloEnvio(res.error, fd, ["adjunto"]));
        return;
      }
      claveRef.current = null;
      toast.success(
        res.data.repetido ? "Ya se había enviado" : interno ? "Nota interna guardada" : "Mensaje enviado"
      );
      formRef.current?.reset();
      setNombreAdjunto(null);
      setInterno(false);
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <Label
              htmlFor={`adjunto-${solicitudId}`}
              className="inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              <Paperclip className="size-4 shrink-0" strokeWidth={2} />
              <span className="min-w-0 truncate">{nombreAdjunto ?? "Adjuntar foto o PDF"}</span>
            </Label>
            {nombreAdjunto ? (
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 p-0"
                onClick={quitarAdjunto}
                aria-label="Quitar el archivo"
              >
                <X className="size-4" strokeWidth={2} />
              </Button>
            ) : null}
          </div>
          <Input
            ref={adjuntoRef}
            id={`adjunto-${solicitudId}`}
            name="adjunto"
            type="file"
            accept={ACCEPT_ADJUNTO}
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0] ?? null;
              if (adjuntoMuyPesado(archivo)) {
                e.target.value = "";
                setNombreAdjunto(null);
                setError(ERROR_PESO_ADJUNTO);
                return;
              }
              setError(null);
              setNombreAdjunto(archivo?.name ?? null);
            }}
          />
          {esStaff ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium select-none">
              <Switch checked={interno} onCheckedChange={setInterno} />
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
          {interno ? "Guardar nota interna" : "Enviar mensaje"}
        </Button>
      </div>

      {error ? <AlertaError error={error} titulo="No se pudo enviar" /> : null}
    </form>
  );
}
