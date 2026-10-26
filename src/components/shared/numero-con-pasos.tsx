"use client";

import { useRef, useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Un número entero que se cambia de a uno con − / + o se ESCRIBE directo (23 días no son 22
 * toques de "+"). El número es un campo de verdad y se ve como tal (borde, lápiz y la ayuda
 * "o escribilo"): al tocarlo queda todo seleccionado, así lo que se tipea reemplaza al número
 * que había. Mientras se escribe, el total de la pantalla ya se actualiza; si se pasa del
 * máximo queda en el máximo y lo avisa; vacío, al salir vuelve al número anterior. Enter
 * confirma el número (no manda el formulario).
 */
export function NumeroConPasos({
  id,
  valor,
  onCambiar,
  min = 1,
  max,
  unidad,
  etiquetaMenos = "Uno menos",
  etiquetaMas = "Uno más",
  disabled = false,
  className,
}: {
  id?: string;
  valor: number;
  onCambiar: (n: number) => void;
  min?: number;
  max: number;
  /** "días", "vehículos": va debajo del número, chico (y en lo que se lee en voz alta). */
  unidad?: string;
  etiquetaMenos?: string;
  etiquetaMas?: string;
  disabled?: boolean;
  className?: string;
}) {
  // null = no está escribiendo: se muestra el valor.
  const [texto, setTexto] = useState<string | null>(null);
  const [topeAviso, setTopeAviso] = useState(false);
  // En Chrome y Safari el "mouseup" del mismo toque que enfoca deshace la selección: se frena una vez.
  const recienEnfocado = useRef(false);
  const digitos = String(max).length;

  function fijar(n: number) {
    const v = Math.min(max, Math.max(min, Math.round(n)));
    setTopeAviso(n > max);
    onCambiar(v);
  }

  function escribir(crudo: string) {
    const limpio = crudo.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, digitos + 1);
    setTexto(limpio);
    if (!limpio) return;
    const n = Number(limpio);
    if (n >= min) fijar(n);
  }

  function confirmar() {
    if (texto === null) return;
    const n = Number(texto);
    if (texto !== "" && n >= min) fijar(n);
    setTexto(null);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="size-14 shrink-0 rounded-lg border-2"
          onClick={() => fijar(valor - 1)}
          disabled={disabled || valor <= min}
          aria-label={etiquetaMenos}
        >
          <Minus className="size-6" strokeWidth={2.2} />
        </Button>
        <label
          className={cn(
            "group relative flex h-14 min-w-0 flex-1 cursor-text items-center justify-center rounded-lg border-2 border-input bg-background transition-colors",
            "focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/30 hover:border-primary/50",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            disabled={disabled}
            value={texto ?? String(valor)}
            // Con `id`, lo nombra el rótulo de la pantalla ("¿Cuántos días?").
            aria-label={id ? undefined : unidad ? `Cantidad de ${unidad}` : undefined}
            onFocus={(e) => {
              recienEnfocado.current = true;
              setTexto(String(valor));
              e.currentTarget.select();
            }}
            onMouseUp={(e) => {
              if (recienEnfocado.current) {
                e.preventDefault();
                recienEnfocado.current = false;
              }
            }}
            onChange={(e) => escribir(e.target.value)}
            onBlur={() => {
              recienEnfocado.current = false;
              confirmar();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                fijar(valor + 1);
                setTexto(null);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                fijar(valor - 1);
                setTexto(null);
              }
            }}
            className="h-full w-full min-w-0 bg-transparent px-9 text-center font-display text-3xl font-bold tabular outline-none"
          />
          <Pencil
            className="pointer-events-none absolute right-3 size-4 text-muted-foreground/70 transition-opacity group-focus-within:opacity-0"
            strokeWidth={2}
            aria-hidden
          />
        </label>
        <Button
          type="button"
          variant="outline"
          className="size-14 shrink-0 rounded-lg border-2"
          onClick={() => fijar(valor + 1)}
          disabled={disabled || valor >= max}
          aria-label={etiquetaMas}
        >
          <Plus className="size-6" strokeWidth={2.2} />
        </Button>
      </div>
      <p className={cn("text-center text-sm", topeAviso ? "font-medium text-parcial" : "text-muted-foreground")} aria-live="polite">
        {topeAviso
          ? `Hasta ${max}${unidad ? ` ${unidad}` : ""}: quedó en ${max}.`
          : `${unidad ? `${valor === 1 ? unidadSingular(unidad) : unidad} · ` : ""}tocá el número para escribirlo`}
      </p>
    </div>
  );
}

/** "días" → "día", "vehículos" → "vehículo" (para "1 día · tocá el número…"). */
function unidadSingular(unidad: string): string {
  if (unidad === "días") return "día";
  return unidad.endsWith("s") ? unidad.slice(0, -1) : unidad;
}
