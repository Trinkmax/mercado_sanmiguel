"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASO_CANTIDAD, formatFraccion, redondearCuarto } from "@/lib/format";
import { cn } from "@/lib/utils";

export const CANTIDAD_MAX = 99;

/** Lleva cualquier número al cuarto más cercano dentro de [min, max]. */
export function normalizarCantidad(
  v: number,
  min = 0,
  max = CANTIDAD_MAX
): number {
  if (Number.isNaN(v)) return min;
  return Math.min(Math.max(redondearCuarto(v), min), max);
}

/** "1,25" · "1.25" · "2" → número (NaN si no se entiende). */
function parsearCantidad(texto: string): number {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return NaN;
  return Number(limpio);
}

/**
 * Cantidad de un concepto, de cuarto en cuarto: botones −/+ de ¼ y el valor
 * en fracción legible ("¼", "½", "¾", "1¼"). Tocando el número se puede
 * escribir directo (acepta coma o punto) y al salir se redondea al cuarto.
 */
export function StepperCantidad({
  id,
  valor,
  onCambiar,
  nombre,
  min = 0,
  max = CANTIDAD_MAX,
  disabled = false,
  className,
}: {
  id?: string;
  valor: number;
  onCambiar: (cantidad: number) => void;
  /** Para las etiquetas accesibles ("Sumar un cuarto a Cocheras"). */
  nombre: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  // null = no está escribiendo: se muestra la fracción.
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? (valor > 0 ? formatFraccion(valor) : "0");

  function fijar(n: number) {
    onCambiar(normalizarCantidad(n, min, max));
  }

  function confirmarTexto() {
    if (texto === null) return;
    const n = parsearCantidad(texto);
    fijar(Number.isNaN(n) ? valor : n);
    setTexto(null);
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        disabled={disabled || valor <= min}
        onClick={() => fijar(valor - PASO_CANTIDAD)}
        aria-label={`Restar un cuarto a ${nombre}`}
      >
        <Minus className="size-4" strokeWidth={2.2} />
      </Button>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={mostrado}
        disabled={disabled}
        onFocus={() => setTexto(valor > 0 ? String(valor).replace(".", ",") : "")}
        onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={confirmarTexto}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label={`Cantidad de ${nombre}`}
        className={cn(
          "h-11 w-16 text-center text-base font-semibold tabular",
          valor <= 0 && "text-muted-foreground"
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        disabled={disabled || valor >= max}
        onClick={() => fijar(valor + PASO_CANTIDAD)}
        aria-label={`Sumar un cuarto a ${nombre}`}
      >
        <Plus className="size-4" strokeWidth={2.2} />
      </Button>
    </div>
  );
}
