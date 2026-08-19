"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPCIONES_CUOTAS_MES } from "@/lib/format";
import { cn } from "@/lib/utils";

export const CUOTAS_MES_MAX = 10;

/**
 * "Paga el mes en…": chips grandes con las frecuencias habituales (1 vez =
 * todo junto, 2 = quincenal, 3 = cada 10 días, 4 = semanal) y "Otra" para
 * escribir un número de 1 a 10. Un solo camino: tocar un chip.
 */
export function CuotasMesPicker({
  valor,
  onCambiar,
  idPrefix = "cuotas",
  disabled = false,
  className,
}: {
  valor: number;
  /** Se dispara al tocar un chip o al escribir un número válido en "Otra". */
  onCambiar: (cuotas: number) => void;
  idPrefix?: string;
  disabled?: boolean;
  className?: string;
}) {
  const esOpcionFija = OPCIONES_CUOTAS_MES.some((o) => o.valor === valor);
  const [otra, setOtra] = useState(!esOpcionFija);
  const [textoOtra, setTextoOtra] = useState(String(valor));
  const inputOtraRef = useRef<HTMLInputElement>(null);
  const enfocarOtra = useRef(false);

  // Al tocar "Otra" llevamos el foco al número (no en el primer render).
  useEffect(() => {
    if (otra && enfocarOtra.current) {
      enfocarOtra.current = false;
      inputOtraRef.current?.focus();
    }
  }, [otra]);

  function elegir(n: number) {
    setOtra(false);
    onCambiar(n);
  }

  function cambiarOtra(texto: string) {
    const limpio = texto.replace(/[^\d]/g, "").slice(0, 2);
    setTextoOtra(limpio);
    const n = Number(limpio);
    if (n >= 1 && n <= CUOTAS_MES_MAX) onCambiar(n);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-label="Paga el mes en"
        className="flex flex-wrap gap-2"
      >
        {OPCIONES_CUOTAS_MES.map((o) => {
          const activo = !otra && valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              disabled={disabled}
              aria-pressed={activo}
              onClick={() => elegir(o.valor)}
              className={cn(
                "flex h-14 min-w-[6.5rem] flex-col items-center justify-center rounded-lg border px-3 transition-colors disabled:opacity-50",
                activo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              <span className="text-base font-semibold leading-tight">
                {o.label}
              </span>
              <span
                className={cn(
                  "text-xs leading-tight",
                  activo ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                {o.ayuda}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={otra}
          onClick={() => {
            enfocarOtra.current = true;
            setOtra(true);
            setTextoOtra(esOpcionFija ? "" : String(valor));
          }}
          className={cn(
            "flex h-14 min-w-[6.5rem] flex-col items-center justify-center rounded-lg border px-3 transition-colors disabled:opacity-50",
            otra
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-accent"
          )}
        >
          <span className="text-base font-semibold leading-tight">Otra</span>
          <span
            className={cn(
              "text-xs leading-tight",
              otra ? "text-primary-foreground/85" : "text-muted-foreground"
            )}
          >
            Hasta 10 veces
          </span>
        </button>
      </div>

      {otra ? (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={`${idPrefix}-otra`} className="text-base">
            Paga en
          </Label>
          <Input
            id={`${idPrefix}-otra`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            ref={inputOtraRef}
            value={textoOtra}
            disabled={disabled}
            onChange={(e) => cambiarOtra(e.target.value)}
            aria-label="Cantidad de veces por mes"
            className="h-12 w-20 text-center text-base tabular"
          />
          <span className="text-base">
            veces por mes{" "}
            <span className="text-muted-foreground">(de 1 a 10)</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
