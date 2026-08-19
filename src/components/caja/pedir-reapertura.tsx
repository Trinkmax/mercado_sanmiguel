"use client";

import { useState, useTransition } from "react";
import { LockOpen } from "lucide-react";
import { toast } from "sonner";
import { solicitarReaperturaCaja } from "@/lib/actions/cajas";
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

/**
 * El dueño de una caja ya rendida/cerrada pide que se la reabran (por ejemplo,
 * un cobro cargado dos veces). Administración autoriza o rechaza.
 */
export function BotonPedirReapertura({
  cajaId,
  destino = "administración",
}: {
  cajaId: string;
  /** Quién resuelve el pedido: administración (caja cerrada) o tesorería (ya integrada). */
  destino?: "administración" | "tesorería";
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("Contá qué pasó para pedir la reapertura.");
      return;
    }
    startTransition(async () => {
      const res = await solicitarReaperturaCaja(cajaId, limpio);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Pedido de reapertura enviado a ${destino}.`);
      setAbierto(false);
      setMotivo("");
      setError(null);
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 px-5 text-base">
          <LockOpen className="size-5" strokeWidth={2} />
          Pedir reapertura
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Pedir la reapertura de la caja</DialogTitle>
          <DialogDescription className="text-base">
            {destino === "tesorería" ? "Tesorería" : "Administración"} va a ver
            tu pedido y, si lo autoriza, la caja vuelve a quedar abierta para
            corregir lo que haga falta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`reapertura-${cajaId}`} className="text-base">
            ¿Qué pasó?
          </Label>
          <Textarea
            id={`reapertura-${cajaId}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej.: cargué un cobro dos veces"
            className="min-h-24 text-base md:text-base"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
            Enviar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
