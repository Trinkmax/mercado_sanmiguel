"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { anularCanon } from "@/lib/actions/porteria";
import { formatARS, formatSoloHora } from "@/lib/format";
import { cn } from "@/lib/utils";
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

const MOTIVOS_RAPIDOS = [
  "Se cargó dos veces",
  "Me equivoqué de vehículo",
  "Me equivoqué en la cantidad",
  "No pagó",
];

/**
 * "Anular" un cobro de canon: confirmación destructiva con motivo obligatorio (atajos de un
 * toque). Queda tachado con quién, cuándo y por qué; nunca se borra. Con `venceEn` (Portería:
 * 15 minutos desde que cobró) el botón desaparece solo cuando se cierra la ventana.
 */
export function AnularCanon({
  id,
  numero,
  texto,
  monto,
  creadoEn,
  venceEn,
}: {
  id: string;
  numero: number;
  /** "Camioneta × 2". */
  texto: string;
  monto: number;
  creadoEn: string;
  /** ISO: después de esta hora Portería ya no puede anularlo (lo hace el Jefe). */
  venceEn?: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vencido, setVencido] = useState(false);
  const [enviando, startTransition] = useTransition();
  // Un intento anterior se quedó sin respuesta (corte de red): si ahora la base dice que ya
  // estaba anulado, fue ese intento el que lo anuló.
  const huboCorte = useRef(false);

  useEffect(() => {
    if (!venceEn) return;
    const ms = new Date(venceEn).getTime() - Date.now();
    const t = setTimeout(() => setVencido(true), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [venceEn]);

  if (vencido && !abierto) return null;

  function terminar() {
    huboCorte.current = false;
    setAbierto(false);
    setMotivo("");
    setFaltaMotivo(false);
    setError(null);
  }

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setFaltaMotivo(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => anularCanon({ id, motivo: limpio }));
      if (!res.ok) {
        if (huboCorte.current && res.error.startsWith("Ese cobro ya estaba anulado")) {
          toast.info(`Ya había quedado anulado: el cobro N° ${numero} no cuenta en la caja.`);
          terminar();
          router.refresh();
          return;
        }
        if (res.error === SIN_RESPUESTA) huboCorte.current = true;
        setError(res.error);
        return;
      }
      toast.success(`Cobro N° ${numero} anulado: ya no cuenta en la caja.`);
      terminar();
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        // Mientras se anula no se cierra: el resultado tiene que verse.
        if (enviando) return;
        setAbierto(v);
        if (!v) {
          setMotivo("");
          setFaltaMotivo(false);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Anular el cobro N° ${numero}`}
        >
          <Ban className="size-4" strokeWidth={2} />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">¿Anulás el cobro N° {numero}?</DialogTitle>
          <DialogDescription className="text-base">
            {texto} · {formatARS(monto)} · {formatSoloHora(creadoEn)}. Queda tachado en la lista,
            con tu nombre y el motivo, y no cuenta en la caja.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-base font-medium" id={`motivos-${id}`}>
            ¿Por qué lo anulás?
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`motivos-${id}`}>
            {MOTIVOS_RAPIDOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMotivo(m);
                  setFaltaMotivo(false);
                  setError(null);
                }}
                className={cn(
                  "min-h-11 rounded-full border-2 px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  motivo === m
                    ? "border-primary bg-primary/[0.08] text-primary"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Label htmlFor={`motivo-canon-${id}`} className="sr-only">
            Motivo
          </Label>
          <Textarea
            id={`motivo-canon-${id}`}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setFaltaMotivo(false);
              if (error) setError(null);
            }}
            aria-invalid={faltaMotivo}
            maxLength={500}
            placeholder="O escribilo con tus palabras"
            className="min-h-20 text-base md:text-base"
          />
          {venceEn ? (
            <p className="text-sm text-muted-foreground">
              Podés anularlo hasta las {formatSoloHora(venceEn)}; después lo anula el Jefe de Portería.
            </p>
          ) : null}
          {faltaMotivo ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              Contá por qué lo anulás (tocá un motivo o escribilo).
            </p>
          ) : null}
          {error ? <AlertaError error={error} titulo="No se pudo anular" /> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => {
              setAbierto(false);
              setMotivo("");
              setFaltaMotivo(false);
              setError(null);
            }}
            disabled={enviando}
          >
            Volver
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmar}
            disabled={enviando}
          >
            {enviando ? <Spinner className="size-5" /> : <Ban className="size-5" strokeWidth={2} />}
            Anular cobro N° {numero}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
