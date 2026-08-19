"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Paperclip, Send } from "lucide-react";
import { enviarMensaje } from "@/lib/actions/solicitudes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPT_ADJUNTO } from "./constantes";

/**
 * Caja para escribir en el hilo: texto + adjunto opcional + (solo staff)
 * switch "Mensaje interno". El socio nunca ve el switch.
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
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("solicitudId", solicitudId);
    fd.set("interno", interno ? "true" : "false");
    startTransition(async () => {
      const res = await enviarMensaje(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(interno ? "Nota interna guardada" : "Mensaje enviado");
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
          required
          placeholder={placeholder}
          className="min-h-24 bg-card text-base md:text-base"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Label
            htmlFor={`adjunto-${solicitudId}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <Paperclip className="size-4" strokeWidth={2} />
            {nombreAdjunto ?? "Adjuntar foto o PDF"}
          </Label>
          <Input
            id={`adjunto-${solicitudId}`}
            name="adjunto"
            type="file"
            accept={ACCEPT_ADJUNTO}
            className="sr-only"
            onChange={(e) =>
              setNombreAdjunto(e.target.files?.[0]?.name ?? null)
            }
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
    </form>
  );
}
