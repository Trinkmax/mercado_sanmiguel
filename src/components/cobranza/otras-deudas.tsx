"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

/**
 * Ambulante con otras deudas (la cochera o la quinta del mes, si alquila, o una multa): el cobro por
 * días es la acción principal y el cobro de lo demás queda plegado. Se monta siempre (aunque
 * ya no deba) para que la confirmación del cobro de adentro no se pierda cuando la página se
 * actualiza.
 */
export function OtrasDeudas({
  deuda,
  detalle = "Multas u otros cargos: tocá para cobrarlos",
  children,
}: {
  deuda: number;
  /** Qué debe, en una línea (cuando debe): "La cochera: tocá para cobrarla", "La cochera y la
   * quinta: tocá para cobrarlas". */
  detalle?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const debe = deuda > 0.009;
  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="rounded-lg border bg-card">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {debe ? "Tiene otras deudas" : "Otras deudas"}
            </span>
            <span className="block text-sm text-muted-foreground">
              {debe ? detalle : "No debe nada más"}
            </span>
          </span>
          {debe ? (
            <Money monto={deuda} className="shrink-0 text-lg font-bold text-pendiente" />
          ) : (
            <Sello estado="al_dia" className="shrink-0" />
          )}
          <ChevronDown
            className={cn("size-5 shrink-0 text-muted-foreground transition-transform", abierto && "rotate-180")}
            strokeWidth={2}
          />
        </button>
      </CollapsibleTrigger>
      {/* forceMount: plegado se oculta pero no se desmonta (el cobro en curso no se pierde). */}
      <CollapsibleContent forceMount className="space-y-5 border-t px-5 pt-5 pb-5 data-[state=closed]:hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
