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
              "flex items-center justify-center rounded-lg border-2 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              compacto ? "h-11 gap-1.5 text-sm" : "h-14 flex-col gap-1 text-sm",
              activo
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Icono className="size-5" strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
