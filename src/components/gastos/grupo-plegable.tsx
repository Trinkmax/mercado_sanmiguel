"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const LISTA = "divide-y overflow-hidden rounded-xl border bg-card";

/**
 * Grupo de gastos que se puede cerrar (Pagados), con el total siempre a la vista.
 * `aLaVista` no se pliega nunca: lo pagado hoy, para adjuntar la factura o deshacer
 * un pago recién hecho sin tener que abrir el grupo y buscarlo.
 * Se abre solo cuando `abrir` pasa a true (ya no queda nada por pagar), pero nunca se
 * cierra solo: si se deshace un pago, la lista que se estaba mirando sigue abierta.
 */
export function GrupoPlegable({
  titulo,
  detalle,
  textoVer,
  abrir,
  aLaVista,
  children,
}: {
  titulo: string;
  detalle: React.ReactNode;
  /** Texto del botón para abrir ("Ver los 12 pagados"). */
  textoVer: string;
  abrir: boolean;
  /** Filas que quedan afuera del plegable (null = ninguna). */
  aLaVista?: React.ReactNode;
  /** Filas plegables. */
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abrir);
  const [abrirAntes, setAbrirAntes] = useState(abrir);
  if (abrir !== abrirAntes) {
    setAbrirAntes(abrir);
    if (abrir) setAbierto(true);
  }

  return (
    <section aria-label={titulo}>
      <Collapsible open={abierto} onOpenChange={setAbierto} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{detalle}</p>
          </div>
          <CollapsibleTrigger className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border bg-card px-4 text-base font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30">
            <span className="group-data-[state=open]:hidden">{textoVer}</span>
            <span className="hidden group-data-[state=open]:inline">Ocultar</span>
            <ChevronDown
              className="size-4 transition-transform group-data-[state=open]:rotate-180"
              strokeWidth={2}
            />
          </CollapsibleTrigger>
        </div>
        {aLaVista ? <ul className={LISTA}>{aLaVista}</ul> : null}
        <CollapsibleContent>
          <ul className={LISTA}>{children}</ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
