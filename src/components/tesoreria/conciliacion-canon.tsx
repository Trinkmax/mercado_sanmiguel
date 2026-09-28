"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, Undo2 } from "lucide-react";
import { conciliarCanon, desconciliarCanon } from "@/lib/actions/tesoreria";
import { formatARS, formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { AlertaError } from "@/components/cobranza/alerta-error";
import { llamarAccion } from "@/lib/llamar-accion";

export type FilaCanon = {
  id: string;
  numero: number;
  fecha: string;
  /** "Camión grande × 2", "Bono camioneros". */
  detalle: string;
  patente: string | null;
  cobro: string | null;
  monto: number;
};

/**
 * Bono camioneros cobrado por transferencia (J2): Tesorería marca cada uno cuando lo
 * ve acreditado en el resumen del banco (de a uno o varios con los casilleros).
 */
export function ConciliacionCanon({ filas }: { filas: FilaCanon[] }) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [enCurso, setEnCurso] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const idsVisibles = useMemo(() => new Set(filas.map((f) => f.id)), [filas]);
  const seleccionadas = filas.filter((f) => seleccion.has(f.id));
  const totalSeleccion = seleccionadas.reduce((acc, f) => acc + f.monto, 0);
  const todas = filas.length > 0 && seleccionadas.length === filas.length;
  const conCasilleros = filas.length > 1;

  function alternar(id: string, marcada: boolean) {
    setSeleccion((prev) => {
      const next = new Set([...prev].filter((x) => idsVisibles.has(x)));
      if (marcada) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function conciliar(ids: string[]) {
    if (ids.length === 0) return;
    setError(null);
    setEnCurso(ids);
    startTransition(async () => {
      const res = await llamarAccion(() => conciliarCanon(ids));
      setEnCurso([]);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const n = res.data.conciliadas;
      toast.success(n === 1 ? "Bono camioneros conciliado." : `${n} cobros de bono camioneros conciliados.`);
      setSeleccion((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    });
  }

  return (
    <div className="space-y-3">
      {error ? <AlertaError error={error} titulo="No se pudo conciliar" /> : null}
      <div className="overflow-hidden rounded-xl border bg-card">
        {conCasilleros ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-muted/40 px-4 py-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={todas}
                onCheckedChange={(v) => setSeleccion(v === true ? new Set(filas.map((f) => f.id)) : new Set())}
                aria-label="Seleccionar todos los cobros de bono camioneros"
                className="size-5"
                disabled={pendiente}
              />
              {seleccionadas.length === 0
                ? "Seleccioná los que ya viste en el banco"
                : `${seleccionadas.length} ${seleccionadas.length === 1 ? "seleccionado" : "seleccionados"} · ${formatARS(totalSeleccion)}`}
            </label>
            <Button
              className="h-auto min-h-11 px-5 py-2 text-base font-semibold whitespace-normal"
              disabled={pendiente || seleccionadas.length === 0}
              onClick={() => conciliar(seleccionadas.map((f) => f.id))}
            >
              {pendiente && enCurso.length > 1 ? (
                <Spinner className="size-5" />
              ) : (
                <CheckCheck className="size-5" strokeWidth={2} />
              )}
              Conciliar los seleccionados{seleccionadas.length > 0 ? ` (${seleccionadas.length})` : ""}
            </Button>
          </div>
        ) : null}
        <ul className="divide-y">
          {filas.map((f) => {
            const marcada = seleccion.has(f.id);
            return (
              <li
                key={f.id}
                className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", marcada && "bg-accent/50")}
              >
                {conCasilleros ? (
                  <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(v) => alternar(f.id, v === true)}
                      aria-label={`Seleccionar bono N° ${f.numero}`}
                      className="size-5"
                      disabled={pendiente}
                    />
                  </label>
                ) : null}
                <div className="min-w-0 flex-1 basis-48 space-y-0.5">
                  <p className="text-base font-medium break-words">
                    <span className="tabular">N° {f.numero}</span> · {f.detalle}
                  </p>
                  <p className="text-sm break-words text-muted-foreground">
                    {formatFecha(f.fecha).slice(0, 5)}
                    {f.patente ? ` · Patente ${f.patente}` : ""}
                    {f.cobro ? ` · Cobró ${f.cobro}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Money monto={f.monto} className="text-base font-semibold" />
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm font-semibold"
                    disabled={pendiente}
                    onClick={() => conciliar([f.id])}
                    aria-label={`Conciliar bono N° ${f.numero}`}
                  >
                    {enCurso.length === 1 && enCurso[0] === f.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Check className="size-4" strokeWidth={2.2} />
                    )}
                    Conciliar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** "Deshacer" de un bono camioneros conciliado por error. */
export function BotonDesconciliarCanon({ id, numero }: { id: string; numero: number }) {
  const [pendiente, startTransition] = useTransition();

  function deshacer() {
    startTransition(async () => {
      const res = await llamarAccion(() => desconciliarCanon(id));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`El bono N° ${numero} vuelve a "sin conciliar".`);
    });
  }

  return (
    <Button
      variant="ghost"
      className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
      disabled={pendiente}
      onClick={deshacer}
      aria-label={`Deshacer conciliación del bono N° ${numero}`}
    >
      {pendiente ? <Spinner className="size-4" /> : <Undo2 className="size-4" strokeWidth={2} />}
      Deshacer
    </Button>
  );
}
