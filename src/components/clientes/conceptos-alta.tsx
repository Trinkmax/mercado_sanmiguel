"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Codigo } from "@/components/shared/codigo";
import { cn } from "@/lib/utils";

export type ConceptoRecurrente = { id: string; codigo: string; nombre: string };

/** Redondea a medios (0 · 0,5 · 1 · 1,5…) dentro de 0–99. */
export function normalizarCantidad(v: number): number {
  if (Number.isNaN(v) || v < 0) return 0;
  return Math.min(Math.round(v * 2) / 2, 99);
}

/**
 * Sección "¿Qué paga?" del alta de cliente: un renglón por concepto
 * recurrente con stepper de cantidad. 0 = no paga ese concepto.
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
          Dejá en 0 lo que no paga. Se aceptan medios: 0,5 · 1 · 1,5.
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
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={cantidad <= 0}
                  onClick={() => onCambiar(c.id, normalizarCantidad(cantidad - 0.5))}
                  aria-label={`Restar medio de ${c.nombre}`}
                >
                  <Minus className="size-4" strokeWidth={2} />
                </Button>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={99}
                  step={0.5}
                  value={cantidad}
                  onChange={(e) => {
                    const v = e.currentTarget.valueAsNumber;
                    onCambiar(
                      c.id,
                      Number.isNaN(v) ? 0 : Math.max(0, Math.min(v, 99))
                    );
                  }}
                  onBlur={() => onCambiar(c.id, normalizarCantidad(cantidad))}
                  aria-label={`Cantidad de ${c.nombre}`}
                  className={cn(
                    "h-11 w-16 text-center text-base tabular",
                    !paga && "text-muted-foreground"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={cantidad >= 99}
                  onClick={() => onCambiar(c.id, normalizarCantidad(cantidad + 0.5))}
                  aria-label={`Sumar medio a ${c.nombre}`}
                >
                  <Plus className="size-4" strokeWidth={2} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Un quintero es un cliente con Expensas Quinteros; un puesto con
        cocheras suma Alquiler Cocheras con su cantidad. Después podés
        cambiarlo desde la pestaña Conceptos de su carpeta.
      </p>
    </div>
  );
}
