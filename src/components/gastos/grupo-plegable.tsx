"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Grupo de gastos que se puede cerrar (Pagados), con el total siempre a la vista.
 * `aLaVista` no se pliega nunca: lo pagado hoy, para adjuntar la factura o deshacer
 * un pago recién hecho sin tener que abrir el grupo y buscarlo. Va en la misma lista,
 * arriba, y el botón para ver el resto queda justo debajo: lo que se abre aparece
 * pegado al botón, no más abajo de las filas de hoy.
 * Se abre solo cuando `abrir` pasa a true (ya no queda nada por pagar), pero nunca se
 * cierra solo: si se deshace un pago, la lista que se estaba mirando sigue abierta.
 */
export function GrupoPlegable({
  titulo,
  detalle,
  textoVer,
  textoOcultar,
  abrir,
  aLaVista,
  children,
}: {
  titulo: string;
  detalle: React.ReactNode;
  /** Texto del botón para abrir ("Ver los 12 pagados"). */
  textoVer: string;
  /** Texto del botón para cerrar ("Ocultar"). */
  textoOcultar: string;
  abrir: boolean;
  /** Filas que quedan afuera del plegable, con su rótulo (null = ninguna). */
  aLaVista?: { rotulo: string; filas: React.ReactNode } | null;
  /** Filas plegables. */
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(abrir);
  const [abrirAntes, setAbrirAntes] = useState(abrir);
  if (abrir !== abrirAntes) {
    setAbrirAntes(abrir);
    if (abrir) setAbierto(true);
  }

  const textos = (
    <>
      <ChevronDown
        className="size-5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
        strokeWidth={2}
      />
      <span className="group-data-[state=open]:hidden">{textoVer}</span>
      <span className="hidden group-data-[state=open]:inline">{textoOcultar}</span>
    </>
  );

  if (aLaVista) {
    return (
      <section className="space-y-3" aria-label={titulo}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-lg font-bold tracking-tight">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{detalle}</p>
        </div>
        <Collapsible open={abierto} onOpenChange={setAbierto}>
          <div className="overflow-hidden rounded-xl border bg-card">
            <p className="border-b bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground">
              {aLaVista.rotulo}
            </p>
            <ul className="divide-y">{aLaVista.filas}</ul>
            {/* Toda la fila es el botón; el contorno de foco va adentro (el recuadro recorta). */}
            <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-center gap-2 border-t bg-muted/40 px-4 py-2 text-base font-medium text-primary hover:bg-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring">
              {textos}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="divide-y border-t">{children}</ul>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </section>
    );
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
            {textos}
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">{children}</ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
