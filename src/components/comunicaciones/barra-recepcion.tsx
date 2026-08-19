import { cn } from "@/lib/utils";

/**
 * "Recibida por X de Y socios": relleno verde sobre pista roja suave
 * (misma regla que las barras de cobranza). Si nadie tiene acceso al portal,
 * la pista queda neutra. `soloBarra` omite el texto (la fila ya lo dice).
 */
export function BarraRecepcion({
  recibidas,
  total,
  className,
  compacta = false,
  soloBarra = false,
}: {
  recibidas: number;
  total: number;
  className?: string;
  compacta?: boolean;
  soloBarra?: boolean;
}) {
  const pct = total > 0 ? Math.round((recibidas / total) * 100) : 0;
  const completa = total > 0 && recibidas >= total;
  return (
    <div className={cn("space-y-1", className)}>
      {!soloBarra ? (
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn("tabular", compacta ? "text-xs" : "text-sm")}>
            <span
              className={cn(
                "font-semibold",
                completa ? "text-pagado" : recibidas === 0 ? "text-pendiente" : "text-foreground"
              )}
            >
              {recibidas}
            </span>
            <span className="text-muted-foreground"> de {total} socios</span>
          </p>
          {!compacta ? (
            <p className="tabular text-xs text-muted-foreground">{pct}%</p>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full",
          total > 0 ? "bg-pendiente-suave" : "bg-muted",
          compacta ? "h-1.5" : "h-2.5"
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={recibidas}
        aria-label={`Recibida por ${recibidas} de ${total} socios`}
      >
        <div
          className="h-full rounded-full bg-pagado transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
