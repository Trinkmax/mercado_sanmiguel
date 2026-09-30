"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** "70" · "70,5" · "70.5" → número (NaN si no se entiende). */
function parsear(texto: string): number {
  const limpio = texto.trim().replace("%", "").replace(",", ".").trim();
  if (!limpio) return NaN;
  return Number(limpio);
}

/** Tope del porcentaje (igual que la base, 0035): 1000 % = diez veces el precio. */
export const PORCENTAJE_MAXIMO = 1000;

/** Deja el porcentaje entre 1 y 1000 con hasta 2 decimales (vacío o inválido = 100). */
export function normalizarPorcentaje(n: number): number {
  if (Number.isNaN(n)) return 100;
  return Math.min(PORCENTAJE_MAXIMO, Math.max(1, Math.round(n * 100) / 100));
}

/**
 * Qué porcentaje del precio paga el cliente por un concepto (100 = entero; 70 = el 70 %;
 * 150 = uno y medio; 400 = cuatro veces). Se escribe el número (acepta coma) y al salir
 * del campo se acomoda entre 1 y 1000.
 */
export function CampoPorcentaje({
  id,
  valor,
  onCambiar,
  nombre,
  disabled = false,
  className,
}: {
  id?: string;
  valor: number;
  onCambiar: (porcentaje: number) => void;
  /** Para la etiqueta accesible ("Porcentaje que paga de Expensas"). */
  nombre: string;
  disabled?: boolean;
  className?: string;
}) {
  // null = no está escribiendo: se muestra el valor guardado.
  const [texto, setTexto] = useState<string | null>(null);
  const mostrado = texto ?? valor.toLocaleString("es-AR", { maximumFractionDigits: 2 });

  function confirmar() {
    if (texto === null) return;
    onCambiar(normalizarPorcentaje(parsear(texto)));
    setTexto(null);
  }

  return (
    <div className={cn("relative w-[7rem]", className)}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={mostrado}
        aria-label={`Porcentaje que paga de ${nombre}`}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9,.]/g, "").slice(0, 7);
          setTexto(t);
          const n = parsear(t);
          // Mientras escribe, si ya es un número válido se refleja (el monto se actualiza).
          if (!Number.isNaN(n) && n >= 1 && n <= PORCENTAJE_MAXIMO) onCambiar(Math.round(n * 100) / 100);
        }}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          }
        }}
        className="h-11 pr-8 text-right text-base tabular"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-base text-muted-foreground">
        %
      </span>
    </div>
  );
}
