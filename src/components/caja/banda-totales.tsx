import { Money } from "@/components/shared/money";
import type { TotalesCaja } from "@/components/caja/datos";

function Bloque({
  label,
  monto,
  destacado = false,
}: {
  label: string;
  monto: number;
  destacado?: boolean;
}) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <Money
        monto={monto}
        className={
          destacado
            ? "mt-1 block truncate text-2xl font-bold sm:text-3xl"
            : "mt-1 block truncate text-xl font-semibold sm:text-2xl"
        }
      />
    </div>
  );
}

/**
 * Banda horizontal única, estilo talonario: los tres medios de cobro
 * separados por el troquelado. Solo para la caja abierta (totales en vivo).
 */
export function BandaTotales({ totales }: { totales: TotalesCaja }) {
  return (
    <div className="overflow-hidden rounded-lg border-2 border-foreground/70 bg-card">
      <p className="font-display border-b border-dashed border-foreground/30 px-4 py-2 text-xs tracking-widest text-muted-foreground uppercase sm:px-6">
        Cobrado hoy — en vivo
      </p>
      <div className="grid grid-cols-3 divide-x divide-dashed divide-foreground/30">
        <Bloque label="Efectivo" monto={totales.efectivo} destacado />
        <Bloque label="Transferencias" monto={totales.transferencia} />
        <Bloque label="Cheques" monto={totales.cheques} />
      </div>
    </div>
  );
}
