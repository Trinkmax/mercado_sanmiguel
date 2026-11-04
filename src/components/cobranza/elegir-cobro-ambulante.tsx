"use client";

import { useState, type ReactNode } from "react";
import { Car, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { OtrasDeudas } from "@/components/cobranza/otras-deudas";

type Que = "otras" | "dias";

/**
 * Pedido del mercado (04/11/2026): al ambulante que alquila cochera se le quería cobrar la
 * cochera y la pantalla abría en «cobrar por día»: se le generaba un día de ambulante (cargo
 * y cobro) y la cochera seguía debiéndose. Si debe la cochera o la quinta, o entró desde la
 * pestaña «Cocheras», primero se elige qué paga.
 *
 * Los dos cobros quedan siempre montados (solo se ocultan): la confirmación con el recibo no
 * se pierde cuando la página se actualiza y ya no debe.
 */
export function ElegirCobroAmbulante({
  pideElegir,
  inicial = null,
  tituloOtras,
  deuda,
  detalleOtras,
  mostrarOtras,
  dias,
  otras,
}: {
  /** Debe la cochera o la quinta, o entró a cobrar la cochera. */
  pideElegir: boolean;
  /** "otras" = entró desde la pestaña «Cocheras». */
  inicial?: Que | null;
  /** "La cochera", "La cochera y la quinta". */
  tituloOtras: string;
  deuda: number;
  detalleOtras?: string;
  mostrarOtras: boolean;
  dias: ReactNode;
  otras: ReactNode;
}) {
  const [que, setQue] = useState<Que | null>(inicial);
  const conEleccion = pideElegir || que !== null;
  const opciones = [
    {
      valor: "otras" as const,
      titulo: tituloOtras,
      detalle: deuda > 0.009 ? `Debe ${formatARS(deuda)}` : "Al día",
      icono: Car,
    },
    { valor: "dias" as const, titulo: "Días de ambulante", detalle: "Se cobra por día", icono: Footprints },
  ];

  return (
    <>
      {conEleccion ? (
        <fieldset className="space-y-3" data-tour="cobranza-que-paga">
          <legend className="text-base font-medium">¿Qué te paga?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {opciones.map((o) => {
              const Icono = o.icono;
              const elegida = que === o.valor;
              return (
                <Button
                  key={o.valor}
                  type="button"
                  variant={elegida ? "default" : "outline"}
                  aria-pressed={elegida}
                  onClick={() => setQue(o.valor)}
                  className={cn(
                    "h-auto min-h-16 w-full items-start justify-start gap-3 px-4 py-3 text-left whitespace-normal",
                    !elegida && "bg-card"
                  )}
                >
                  <Icono className={cn("mt-0.5 size-5 shrink-0", !elegida && "text-primary")} strokeWidth={2} />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{o.titulo}</span>
                    <span className={cn("block text-sm font-normal", !elegida && "text-muted-foreground")}>
                      {o.detalle}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div hidden={conEleccion && que !== "dias"}>{dias}</div>

      {mostrarOtras ? (
        <div hidden={conEleccion && que === null}>
          <OtrasDeudas deuda={deuda} detalle={detalleOtras} abierta={que === "otras"}>
            {otras}
          </OtrasDeudas>
        </div>
      ) : null}
    </>
  );
}
