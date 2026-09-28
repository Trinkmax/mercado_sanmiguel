"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Inbox } from "lucide-react";
import { aprobarNovedades } from "@/lib/actions/novedades";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FilaNovedad } from "./fila-novedad";
import type { NovedadVista } from "./constantes";
import { llamarAccion } from "@/lib/llamar-accion";
import { AlertaError } from "@/components/cobranza/alerta-error";

export type PendienteBandeja = NovedadVista & { nombre: string };

/**
 * Bandeja de Administración (y del Líder): lo que cargó el Jefe de Portería y espera el OK.
 * Aprobar de a una o "Aprobar todas (N)" en un toque.
 */
export function BandejaAprobacion({
  pendientes,
  miUserId,
}: {
  pendientes: PendienteBandeja[];
  miUserId: string;
}) {
  const router = useRouter();
  const [ocultas, setOcultas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  if (pendientes.length === 0) return null;
  const n = pendientes.length;

  function aprobarTodas() {
    setError(null);
    setOcultas(true); // optimista
    startTransition(async () => {
      // Reintento tras un corte: aprobar_novedades saltea las que ya están aprobadas.
      const res = await llamarAccion(() => aprobarNovedades({ ids: pendientes.map((p) => p.id) }));
      if (!res.ok) {
        setOcultas(false);
        setError(res.error);
        return;
      }
      toast.success(
        res.data.cantidad === 0
          ? "Ya estaban aprobadas"
          : res.data.cantidad === 1
            ? "Aprobaste 1 novedad"
            : `Aprobaste ${res.data.cantidad} novedades`
      );
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-xl border border-parcial/40 bg-parcial-suave/70 p-4 sm:p-5"
      aria-label="Novedades para aprobar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-card text-parcial">
            <Inbox className="size-5" strokeWidth={2} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">
              {n === 1
                ? "1 novedad del Jefe de Portería espera tu OK"
                : `${n} novedades del Jefe de Portería esperan tu OK`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Hasta que las apruebes no cuentan en la planilla.
            </p>
          </div>
        </div>
        {n > 1 ? (
          <Button size="lg" className="h-12 px-5 text-base font-semibold" disabled={pendiente} onClick={aprobarTodas}>
            {pendiente ? <Spinner className="size-5" /> : <CheckCheck className="size-5" strokeWidth={2.2} />}
            Aprobar todas ({n})
          </Button>
        ) : null}
      </div>

      {error ? <AlertaError error={error} titulo="No se pudieron aprobar" className="mt-3" /> : null}

      {ocultas ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium">
          <Spinner /> Aprobando…
        </p>
      ) : (
        <div className="mt-3 divide-y rounded-lg border bg-card px-4">
          {pendientes.map((p) => (
            <FilaNovedad
              key={`${p.id}-${p.estado}`}
              n={p}
              nombre={p.nombre}
              puedeRevisar
              miUserId={miUserId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
