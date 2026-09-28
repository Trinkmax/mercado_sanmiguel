import { cn } from "@/lib/utils";

/**
 * "La vieron X de Y": relleno verde (la vieron) sobre pista roja suave (con portal, todavía no)
 * y, al final, un tramo gris rayado para los que no tienen usuario del portal (hay que
 * avisarles en persona). Misma regla que las barras de cobranza.
 * `soloBarra` omite el texto (la fila ya lo dice).
 */
export function BarraRecepcion({
  recibidas,
  total,
  sinPortal = 0,
  className,
  compacta = false,
  soloBarra = false,
}: {
  recibidas: number;
  total: number;
  /** Del total, cuántos no tienen usuario del portal (y todavía no la vieron). */
  sinPortal?: number;
  className?: string;
  compacta?: boolean;
  soloBarra?: boolean;
}) {
  const pct = total > 0 ? (recibidas / total) * 100 : 0;
  const pctSinPortal = total > 0 ? (Math.min(sinPortal, total - recibidas) / total) * 100 : 0;
  const completa = total > 0 && recibidas >= total;
  return (
    <div className={cn("space-y-1", className)}>
      {!soloBarra ? (
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn("tabular", compacta ? "text-xs" : "text-sm")}>
            <span className="text-muted-foreground">La vieron </span>
            <span
              className={cn(
                "font-semibold",
                completa ? "text-pagado" : recibidas === 0 ? "text-pendiente" : "text-foreground"
              )}
            >
              {recibidas}
            </span>
            <span className="text-muted-foreground"> de {total}</span>
          </p>
          {!compacta ? (
            <p className="tabular text-xs text-muted-foreground">{Math.round(pct)}%</p>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full",
          total > 0 ? "bg-pendiente-suave" : "bg-muted",
          compacta ? "h-1.5" : "h-3"
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={recibidas}
        aria-label={`La vieron ${recibidas} de ${total}`}
      >
        <div className="h-full rounded-full bg-pagado transition-[width]" style={{ width: `${pct}%` }} />
        {pctSinPortal > 0 ? (
          <div
            className="absolute inset-y-0 right-0 bg-muted-foreground/25 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.55)_3px_6px)]"
            style={{ width: `${pctSinPortal}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
