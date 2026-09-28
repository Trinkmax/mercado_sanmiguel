"use client";

import { useState, useTransition } from "react";
import { Clock, LogOut, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { marcarEgreso } from "@/lib/actions/porteria";
import { TZ_AR, fechaLocal, formatFechaLarga, formatSoloHora, hoyISO } from "@/lib/format";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

/** "YYYY-MM-DD" del día argentino de un timestamptz. */
function diaAR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_AR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function diaSiguiente(fecha: string): string {
  const d = fechaLocal(fecha);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "lun 27/09" */
function diaCorto(fecha: string): string {
  const d = fechaLocal(fecha);
  const dia = d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
  return `${dia} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Argentina no tiene horario de verano: UTC−3 fijo (igual que rangoDiaAR). */
function isoAR(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-03:00`;
}

function duracion(desdeIso: string, hastaIso: string): string | null {
  const min = Math.round((new Date(hastaIso).getTime() - new Date(desdeIso).getTime()) / 60_000);
  if (!Number.isFinite(min) || min < 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Marcar la salida eligiendo la hora (≥ entrada y ≤ ahora), o corregir una ya marcada (solo el
 * Líder: lo impone el trigger proteger_ingreso). Para los que quedaron adentro de días anteriores
 * se elige también el día (el mismo o el siguiente, por los turnos que cruzan la medianoche).
 */
export function SalidaConHora({
  ingresoId,
  nombre,
  ingresoEn,
  egresoEn = null,
  modo,
}: {
  ingresoId: string;
  nombre: string;
  ingresoEn: string;
  egresoEn?: string | null;
  /** "hoy": botón secundario "Otra hora" · "otro_dia": botón "Marcar salida" · "corregir": Líder. */
  modo: "hoy" | "otro_dia" | "corregir";
}) {
  const hoy = hoyISO();
  const diaIngreso = diaAR(ingresoEn);
  const opcionesDia = [diaIngreso, diaSiguiente(diaIngreso)].filter((d) => d <= hoy);

  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(diaIngreso);
  const [hora, setHora] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Lo que contestó el servidor (o el corte de red): va en un cartel, con lo cargado a la vista.
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  const iso = hora ? isoAR(dia, hora) : null;
  const antesDeEntrar = iso ? new Date(iso).getTime() < new Date(ingresoEn).getTime() : false;
  const estuvo = iso && !antesDeEntrar ? duracion(ingresoEn, iso) : null;

  function abrir(v: boolean) {
    if (enviando) return;
    setAbierto(v);
    setError(null);
    setErrorServidor(null);
    if (!v) return;
    if (egresoEn) {
      setDia(diaAR(egresoEn));
      setHora(formatSoloHora(egresoEn));
    } else if (diaIngreso === hoy) {
      setDia(hoy);
      setHora(formatSoloHora(new Date().toISOString()));
    } else {
      setDia(diaIngreso);
      setHora("");
    }
  }

  function confirmar() {
    if (!iso) {
      setError("Poné a qué hora salió.");
      return;
    }
    if (antesDeEntrar) {
      setError(`La salida no puede ser antes de la entrada (${formatSoloHora(ingresoEn)}).`);
      return;
    }
    if (new Date(iso).getTime() > Date.now() + 5 * 60_000) {
      setError("Esa hora todavía no pasó: la salida no puede ser futura.");
      return;
    }
    setErrorServidor(null);
    startTransition(async () => {
      // Reintentar es seguro: si la salida ya quedó con esa hora, el servidor la devuelve.
      const res = await llamarAccion(() => marcarEgreso({ id: ingresoId, egresoEn: iso }));
      if (!res.ok) {
        setErrorServidor(res.error);
        return;
      }
      toast.success(
        `${modo === "corregir" ? "Salida corregida" : "Salida marcada"}: ${nombre} · ${formatSoloHora(res.data.egreso_en)}`
      );
      setAbierto(false);
    });
  }

  const titulo = modo === "corregir" ? `Corregir la salida de ${nombre}` : `Salida de ${nombre}`;

  return (
    <Dialog open={abierto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        {modo === "otro_dia" ? (
          <Button type="button" variant="outline" size="lg" className="h-12 px-4 text-base">
            <LogOut className="size-5" strokeWidth={2} />
            Marcar salida
          </Button>
        ) : modo === "corregir" ? (
          <Button type="button" variant="ghost" size="lg" className="h-11 px-3 text-sm text-muted-foreground">
            <PencilLine className="size-4" strokeWidth={2} />
            Corregir salida
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-12 px-3 text-sm text-muted-foreground"
            aria-label={`Marcar la salida de ${nombre} a otra hora`}
          >
            <Clock className="size-4" strokeWidth={2} />
            Otra hora
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
          <DialogDescription className="text-base">
            Entró el {formatFechaLarga(diaIngreso)} a las {formatSoloHora(ingresoEn)}.
            {modo === "corregir" && egresoEn ? ` Hoy figura que salió a las ${formatSoloHora(egresoEn)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {opcionesDia.length > 1 ? (
          <div className="space-y-2">
            <p className="text-base font-medium" id={`dia-salida-${ingresoId}`}>
              ¿Qué día salió?
            </p>
            <div role="radiogroup" aria-labelledby={`dia-salida-${ingresoId}`} className="grid grid-cols-2 gap-2">
              {opcionesDia.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={dia === d}
                  onClick={() => {
                    setDia(d);
                    setError(null);
                    setErrorServidor(null);
                  }}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center rounded-lg border-2 px-2 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    dia === d ? "border-primary bg-primary/[0.06] text-primary" : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="text-base font-semibold">{i === 0 ? "El mismo día" : "Al día siguiente"}</span>
                  <span className="text-sm text-muted-foreground">{diaCorto(d)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`hora-salida-${ingresoId}`} className="text-base">
            ¿A qué hora salió?
          </Label>
          <Input
            id={`hora-salida-${ingresoId}`}
            type="time"
            value={hora}
            onChange={(e) => {
              setHora(e.target.value);
              setError(null);
              setErrorServidor(null);
            }}
            className="h-14 w-44 text-2xl font-semibold tabular md:text-2xl"
          />
          {antesDeEntrar ? (
            <p className="text-sm font-medium text-pendiente">
              Es antes de la entrada ({formatSoloHora(ingresoEn)}).
            </p>
          ) : estuvo ? (
            <p className="text-sm text-muted-foreground">Estuvo {estuvo} adentro.</p>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {errorServidor ? <AlertaError error={errorServidor} titulo="No se pudo guardar la salida" /> : null}

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
            size="lg"
            className="h-12 px-5 text-base font-semibold"
            onClick={confirmar}
            disabled={enviando || !hora || antesDeEntrar}
          >
            {enviando ? <Spinner className="size-5" /> : <LogOut className="size-5" strokeWidth={2} />}
            {hora ? `${modo === "corregir" ? "Corregir a" : "Marcar salida a"} las ${hora}` : "Marcar salida"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
