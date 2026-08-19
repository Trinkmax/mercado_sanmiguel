"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Send } from "lucide-react";
import { crearSolicitudSocio } from "@/lib/actions/portal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ACCEPT_ADJUNTO,
  TIPOS_SOLICITUD,
  type TipoSolicitud,
} from "@/components/solicitudes/constantes";

/** Alta de solicitud del socio: tipo → asunto → detalle → foto opcional → enviar. */
export function FormSolicitudSocio() {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoSolicitud>("solicitud");
  const [nombreAdjunto, setNombreAdjunto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("tipo", tipo);
    startTransition(async () => {
      const res = await crearSolicitudSocio(fd);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Solicitud N° ${res.data.numero} enviada`);
      router.push(`/mi-cuenta/solicitudes/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7">
      <fieldset className="space-y-2">
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

      <div className="space-y-2">
        <Label htmlFor="soc-asunto" className="text-base">
          Asunto
        </Label>
        <Input
          id="soc-asunto"
          name="asunto"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="En pocas palabras, ¿de qué se trata?"
          className="h-12 text-base md:text-base"
        />
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
        <Label
          htmlFor="soc-adjunto"
          className="inline-flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted"
        >
          <Paperclip className="size-4" strokeWidth={2} />
          <span className="truncate">{nombreAdjunto ?? "Sacar una foto o elegir archivo"}</span>
        </Label>
        <Input
          id="soc-adjunto"
          name="adjunto"
          type="file"
          accept={ACCEPT_ADJUNTO}
          className="sr-only"
          onChange={(e) => setNombreAdjunto(e.target.files?.[0]?.name ?? null)}
        />
        <p className="text-sm text-muted-foreground">Hasta 20 MB.</p>
      </div>

      {error ? (
        <p className="rounded-md bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pendiente}
        className="h-14 w-full text-base font-semibold"
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
