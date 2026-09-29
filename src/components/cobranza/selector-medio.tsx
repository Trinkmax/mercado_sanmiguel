"use client";

import { cn } from "@/lib/utils";
import { MEDIOS, type MedioPago } from "@/components/cobranza/tipos";

/**
 * Chips grandes de medio de pago. El Jefe de Portería ve solo Efectivo y Transferencia
 * (G2): no existe el botón, no un botón deshabilitado.
 */
export function SelectorMedio({
  medios,
  valor,
  onCambio,
  compacto = false,
  etiqueta = "Medio de pago",
}: {
  medios: MedioPago[];
  valor: MedioPago;
  onCambio: (medio: MedioPago) => void;
  compacto?: boolean;
  etiqueta?: string;
}) {
  const opciones = MEDIOS.filter((m) => medios.includes(m.valor));
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={cn("grid gap-2", opciones.length === 2 ? "grid-cols-2" : "grid-cols-3")}
    >
      {opciones.map(({ valor: v, label, Icono }) => {
        const activo = valor === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(v)}
            className={cn(
              "flex min-w-0 items-center justify-center rounded-lg border-2 px-1.5 py-1.5 text-center text-sm leading-tight font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              // Compacto (cobro mixto): ícono al lado del nombre solo desde tablet; en un celular
              // tres botones de ~100 px no alcanzan para "Transferencia" con el ícono al costado.
              // min-h (no h fija): en 360 px la palabra puede cortarse en sílabas y el botón crece.
              compacto ? "min-h-14 flex-col gap-1 sm:min-h-11 sm:flex-row sm:gap-1.5" : "min-h-14 flex-col gap-1",
              activo
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Icono className="size-5 shrink-0" strokeWidth={2} />
            <span className="max-w-full hyphens-auto">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
