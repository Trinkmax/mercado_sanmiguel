"use client";

import { Codigo } from "@/components/shared/codigo";
import { StepperCantidad } from "@/components/clientes/stepper-cantidad";
import { cn } from "@/lib/utils";

export type ConceptoRecurrente = { id: string; codigo: string; nombre: string };

export { normalizarCantidad } from "@/components/clientes/stepper-cantidad";

/**
 * Sección "¿Qué paga?" del alta de cliente: un renglón por concepto
 * recurrente con stepper de cantidad de cuarto en cuarto. 0 = no paga ese concepto.
 */
export function ConceptosAlta({
  conceptos,
  cantidades,
  onCambiar,
}: {
  conceptos: ConceptoRecurrente[];
  cantidades: Record<string, number>;
  onCambiar: (conceptoId: string, cantidad: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-medium">¿Qué paga?</p>
        <p className="text-sm text-muted-foreground">
          Dejá en 0 lo que no paga. Se aceptan cuartos: ¼ · ½ · ¾ · 1 · 1¼...
        </p>
      </div>

      <div className="divide-y rounded-lg border">
        {conceptos.map((c) => {
          const cantidad = cantidades[c.id] ?? 0;
          const paga = cantidad > 0;
          return (
            <div
              key={c.id}
              className="flex min-h-12 items-center gap-3 px-3 py-1.5"
            >
              <Codigo codigo={c.codigo} />
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  paga ? "font-medium" : "text-muted-foreground"
                )}
              >
                {c.nombre}
              </p>
              <StepperCantidad
                valor={cantidad}
                nombre={c.nombre}
                onCambiar={(n) => onCambiar(c.id, n)}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Un quintero es un cliente con Expensas Quinteros; un puesto con
        cocheras suma Alquiler Cocheras con su cantidad (medio galpón = ½).
        Después podés cambiarlo desde la pestaña Conceptos de su carpeta.
      </p>
    </div>
  );
}
