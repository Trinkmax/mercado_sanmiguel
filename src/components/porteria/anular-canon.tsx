"use client";

import { useEffect, useState, useTransition } from "react";
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
import { llamarAccion } from "@/lib/llamar-accion";

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
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [vencido, setVencido] = useState(false);
  const [enviando, startTransition] = useTransition();

  useEffect(() => {
    if (!venceEn) return;
    const ms = new Date(venceEn).getTime() - Date.now();
    const t = setTimeout(() => setVencido(true), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [venceEn]);

  if (vencido && !abierto) return null;

  function confirmar() {
    const limpio = motivo.trim();
    if (!limpio) {
      setError("Contá por qué lo anulás (tocá un motivo o escribilo).");
      return;
    }
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof anularCanon>>;
      try {
        res = await llamarAccion(() => anularCanon({ id, motivo: limpio }));
      } catch {
        setError("No se pudo anular. Revisá la conexión y probá de nuevo.");
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`Cobro N° ${numero} anulado: ya no cuenta en la caja.`);
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
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
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
              if (error) setError(null);
            }}
            maxLength={500}
            placeholder="O escribilo con tus palabras"
            className="min-h-20 text-base md:text-base"
          />
          {venceEn ? (
            <p className="text-sm text-muted-foreground">
              Podés anularlo hasta las {formatSoloHora(venceEn)}; después lo anula el Jefe de Portería.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => setAbierto(false)}
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
