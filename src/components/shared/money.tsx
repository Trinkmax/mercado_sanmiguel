import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/format";

/** Monto en pesos: siempre tabular. Usar dentro de celdas alineadas a la derecha. */
export function Money({
  monto,
  className,
}: {
  monto: number | string | null | undefined;
  className?: string;
}) {
  return <span className={cn("tabular", className)}>{formatARS(monto)}</span>;
}
