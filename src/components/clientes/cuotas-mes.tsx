"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CUOTAS_TODOS_LOS_DIAS, formatARS, OPCIONES_CUOTAS_MES } from "@/lib/format";
import { cn } from "@/lib/utils";

/** clientes.cuotas_mes admite de 1 a 31 (C5: "hay clientes que pagan por día"). */
export const CUOTAS_MES_MAX = 31;

/** "Son 4 pagos de ≈ $82.500" · "≈ $36.000 por día" · "Un solo pago de $330.000" */
export function textoVistaPrevia(cuotas: number, totalMes: number): string | null {
  if (!(totalMes > 0) || !(cuotas >= 1)) return null;
  if (cuotas === 1) return `Un solo pago de ${formatARS(totalMes)}`;
  const cuota = formatARS(Math.round(totalMes / cuotas));
  if (cuotas === CUOTAS_TODOS_LOS_DIAS) return `≈ ${cuota} por día`;
  return `Son ${cuotas} pagos de ≈ ${cuota}`;
}

/**
 * "Paga el mes en…": chips grandes con las frecuencias habituales (1 vez, 2 = quincenal,
 * 3 = cada 10 días, 4 = semanal, Todos los días) y "Otra cantidad" con − / + (1 a 31).
 * Un solo camino: tocar un chip. Debajo, cuánto es cada pago si se conoce el total del mes.
 * El quintero ve solo 1–4 (G7); el ambulante no lo ve (paga por día).
 */
export function CuotasMesPicker({
  valor,
  onCambiar,
  idPrefix = "cuotas",
  disabled = false,
  className,
  opciones,
  permitirOtra = true,
  totalMes,
}: {
  valor: number;
  /** Se dispara al tocar un chip, al usar − / + o al escribir un número válido. */
  onCambiar: (cuotas: number) => void;
  idPrefix?: string;
  disabled?: boolean;
  className?: string;
  /** Qué chips se ofrecen (default: todos los de OPCIONES_CUOTAS_MES). */
  opciones?: number[];
  /** Muestra "Otra cantidad" (default: sí). */
  permitirOtra?: boolean;
  /** Total del mes, para la vista previa "Son 4 pagos de ≈ $82.500". */
  totalMes?: number;
}) {
  const disponibles = OPCIONES_CUOTAS_MES.filter((o) => !opciones || opciones.includes(o.valor));
  const esOpcionFija = disponibles.some((o) => o.valor === valor);
  const [otra, setOtra] = useState(permitirOtra && !esOpcionFija);
  const [textoOtra, setTextoOtra] = useState(String(valor));
  const inputOtraRef = useRef<HTMLInputElement>(null);
  const enfocarOtra = useRef(false);

  // Al tocar "Otra cantidad" llevamos el foco al número (no en el primer render).
  useEffect(() => {
    if (otra && enfocarOtra.current) {
      enfocarOtra.current = false;
      inputOtraRef.current?.select();
    }
  }, [otra]);

  function elegir(n: number) {
    setOtra(false);
    onCambiar(n);
  }

  function fijarOtra(n: number) {
    const acotado = Math.min(Math.max(n, 1), CUOTAS_MES_MAX);
    setTextoOtra(String(acotado));
    onCambiar(acotado);
  }

  function escribirOtra(texto: string) {
    const limpio = texto.replace(/[^\d]/g, "").slice(0, 2);
    setTextoOtra(limpio);
    const n = Number(limpio);
    if (n >= 1 && n <= CUOTAS_MES_MAX) onCambiar(n);
  }

  const vistaPrevia = totalMes ? textoVistaPrevia(valor, totalMes) : null;
  const claseChip = (activo: boolean) =>
    cn(
      "flex h-14 min-w-[6.5rem] flex-col items-center justify-center rounded-lg border px-3 transition-colors disabled:opacity-50",
      activo
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-accent"
    );
  const claseAyuda = (activo: boolean) =>
    cn("text-xs leading-tight", activo ? "text-primary-foreground/85" : "text-muted-foreground");

  return (
    <div className={cn("space-y-3", className)}>
      <div role="group" aria-label="Paga el mes en" className="flex flex-wrap gap-2">
        {disponibles.map((o) => {
          const activo = !otra && valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              disabled={disabled}
              aria-pressed={activo}
              onClick={() => elegir(o.valor)}
              className={claseChip(activo)}
            >
              <span className="text-base leading-tight font-semibold">{o.label}</span>
              <span className={claseAyuda(activo)}>{o.ayuda}</span>
            </button>
          );
        })}
        {permitirOtra ? (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={otra}
            onClick={() => {
              enfocarOtra.current = true;
              setOtra(true);
              const inicial = esOpcionFija ? 5 : valor;
              setTextoOtra(String(inicial));
              onCambiar(inicial);
            }}
            className={claseChip(otra)}
          >
            <span className="text-base leading-tight font-semibold">Otra cantidad</span>
            <span className={claseAyuda(otra)}>De 1 a {CUOTAS_MES_MAX}</span>
          </button>
        ) : null}
      </div>

      {otra ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12"
            disabled={disabled || valor <= 1}
            onClick={() => fijarOtra(valor - 1)}
            aria-label="Una vez menos por mes"
          >
            <Minus className="size-5" strokeWidth={2.2} />
          </Button>
          <Input
            id={`${idPrefix}-otra`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            ref={inputOtraRef}
            value={textoOtra}
            disabled={disabled}
            onChange={(e) => escribirOtra(e.target.value)}
            onBlur={() => fijarOtra(Number(textoOtra) || valor)}
            aria-label="Cantidad de veces por mes"
            className="h-12 w-20 text-center text-lg font-semibold tabular"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12"
            disabled={disabled || valor >= CUOTAS_MES_MAX}
            onClick={() => fijarOtra(valor + 1)}
            aria-label="Una vez más por mes"
          >
            <Plus className="size-5" strokeWidth={2.2} />
          </Button>
          <span className="text-base">veces por mes</span>
        </div>
      ) : null}

      {vistaPrevia ? (
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {vistaPrevia}
        </p>
      ) : null}
    </div>
  );
}
