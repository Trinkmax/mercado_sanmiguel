import { cn } from "@/lib/utils";
import { formatMoneda, type Moneda } from "@/lib/format";
import { Money } from "@/components/shared/money";

/**
 * Importe con su moneda. Pesos → <Money> (regla del sistema); dólares → "US$ 1.234"
 * con `formatMoneda` (Fundación). Los dólares nunca se muestran con "$" solo.
 * (Cuando <Money> sume la prop `moneda` (§5.6), esto pasa a ser un alias.)
 */
export function MontoMoneda({
  monto,
  moneda = "ARS",
  className,
}: {
  monto: number | string | null | undefined;
  moneda?: Moneda;
  className?: string;
}) {
  if (moneda === "ARS") return <Money monto={monto} className={className} />;
  return <span className={cn("tabular", className)}>{formatMoneda(monto, "USD")}</span>;
}
