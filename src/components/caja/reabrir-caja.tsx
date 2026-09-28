"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { toast } from "sonner";
import { reabrirCaja } from "@/lib/actions/cajas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion, SIN_RESPUESTA } from "@/lib/llamar-accion";

/**
 * Reabre una caja cerrada (administración sobre la suya, o autorizando un
 * pedido de portería). Si hay un pedido pendiente el motivo es opcional: la
 * RPC usa el del pedido.
 */
export function BotonReabrirCaja({
  cajaId,
  etiqueta = "Reabrir caja",
  descripcion,
  motivoObligatorio = true,
  variant = "outline",
  className,
}: {
  cajaId: string;
  etiqueta?: string;
  descripcion: string;
  motivoObligatorio?: boolean;
  variant?: "outline" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  // Un intento anterior se quedó sin respuesta (corte de red): si ahora la base dice que la caja
  // ya está abierta, la reabrió ese intento.
  const huboCorte = useRef(false);

  function terminar() {
    huboCorte.current = false;
    setAbierto(false);
    setMotivo("");
    setError(null);
  }

  function confirmar() {
    const limpio = motivo.trim();
    if (motivoObligatorio && !limpio) {
      setError("Contá por qué la reabrís.");
      return;
    }
    setErrorServidor(null);
    startTransition(async () => {
      const res = await llamarAccion(() => reabrirCaja(cajaId, limpio || undefined));
      if (!res.ok) {
        if (huboCorte.current && res.error.startsWith("La caja ya está abierta")) {
          toast.info("Ya había quedado reabierta. Ya se pueden corregir los movimientos.");
          terminar();
          router.refresh();
          return;
        }
        if (res.error === SIN_RESPUESTA) huboCorte.current = true;
        setErrorServidor(res.error);
        return;
      }
      toast.success("Caja reabierta. Ya se pueden corregir los movimientos.");
      terminar();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (enviando) return;
        setAbierto(v);
        if (!v) {
          setErrorServidor(null);
          setMotivo("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size="lg" className={className ?? "h-12 px-5 text-base"}>
          <LockOpen className="size-5" strokeWidth={2} />
          {etiqueta}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">{etiqueta}</DialogTitle>
          <DialogDescription className="text-base">{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`reabrir-${cajaId}`} className="text-base">
            Motivo{" "}
            {motivoObligatorio ? null : (
              <span className="font-normal text-muted-foreground">(opcional)</span>
            )}
          </Label>
          <Textarea
            id={`reabrir-${cajaId}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej.: faltó cargar un cobro"
            className="min-h-24 text-base md:text-base"
          />
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          {errorServidor ? <AlertaError error={errorServidor} titulo="No se pudo reabrir la caja" /> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => setAbierto(false)}
            disabled={enviando}
          >
            Volver
          </Button>
          <Button
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmar}
            disabled={enviando}
          >
            {enviando ? (
              <Spinner className="size-5" />
            ) : (
              <LockOpen className="size-5" strokeWidth={2} />
            )}
            {etiqueta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
