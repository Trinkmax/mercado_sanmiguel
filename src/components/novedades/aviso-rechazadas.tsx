"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { ocultarRechazoNovedad } from "@/lib/actions/novedades";
import { llamarAccion } from "@/lib/llamar-accion";
import { Button } from "@/components/ui/button";
import { AlertaError } from "@/components/cobranza/alerta-error";

export type RechazadaAviso = {
  id: string;
  frase: string;
  motivo: string | null;
  /** "Cargarla de nuevo" (con el empleado y el tipo ya elegidos). */
  href: string;
};

/**
 * Aviso al Jefe de Portería: lo que Administración le rechazó (últimos 15 días), con el motivo.
 * Cada una se va sola cuando la vuelve a cargar, o con "Entendido" si no hace falta cargarla.
 */
export function AvisoRechazadas({ rechazadas }: { rechazadas: RechazadaAviso[] }) {
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visibles = rechazadas.filter((r) => !ocultas.has(r.id));
  if (visibles.length === 0) return null;

  function entendido(id: string) {
    setError(null);
    setOcultas((prev) => new Set(prev).add(id)); // optimista
    startTransition(async () => {
      const res = await llamarAccion(() => ocultarRechazoNovedad({ id }));
      if (!res.ok) {
        setOcultas((prev) => {
          const sin = new Set(prev);
          sin.delete(id);
          return sin;
        });
        setError(res.error);
      }
    });
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-pendiente/30 bg-pendiente-suave/70 p-4 sm:p-5"
      aria-label="Novedades rechazadas"
      data-tour="novedades-rechazadas"
    >
      <div className="space-y-0.5">
        <h2 className="font-display text-lg font-bold tracking-tight">
          {visibles.length === 1
            ? "Administración rechazó 1 novedad que cargaste"
            : `Administración rechazó ${visibles.length} novedades que cargaste`}
        </h2>
        <p className="text-sm text-muted-foreground">
          Si hay que corregirla, tocá «Cargarla de nuevo». Si no, tocá «Entendido» y deja de aparecer.
        </p>
      </div>
      <ul className="divide-y rounded-lg border bg-card px-4">
        {visibles.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <p className="text-[15px] font-medium break-words">{r.frase}</p>
              {r.motivo ? (
                <p className="text-sm break-words">
                  <span className="font-semibold">Motivo:</span> {r.motivo}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" className="h-11 px-4">
                <Link href={r.href}>
                  <RotateCcw className="size-4" strokeWidth={2} />
                  Cargarla de nuevo
                </Link>
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-4" onClick={() => entendido(r.id)}>
                <Check className="size-4" strokeWidth={2} />
                Entendido
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <AlertaError error={error} titulo="No se pudo ocultar" /> : null}
    </section>
  );
}
