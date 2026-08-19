import { AlertTriangle, BadgePercent } from "lucide-react";
import { cn } from "@/lib/utils";
import { diasHasta, formatARS, formatFecha } from "@/lib/format";

/**
 * Banner de deuda activa: lo primero que ve quien cobra.
 *  - Vencidos: rojo — perdió el beneficio por mora, debe el importe completo.
 *  - En término con beneficio: verde (ámbar si vence en ≤ 3 días) — pagando
 *    hasta el vencimiento mantiene el beneficio por pago en término.
 * Los importes ya vienen calculados por la página (misma regla que la RPC).
 */
export function AvisoDeuda({
  hayVencidos,
  recargoPerdido,
  ahorroEnTermino,
  vencimientoBeneficio,
  className,
}: {
  hayVencidos: boolean;
  /** Beneficio que se perdió por pagar fuera de término (0 si no había). */
  recargoPerdido: number;
  /** Beneficio que se mantiene pagando en término (0 si no aplica). */
  ahorroEnTermino: number;
  vencimientoBeneficio: string | null;
  className?: string;
}) {
  if (!hayVencidos && !(ahorroEnTermino > 0 && vencimientoBeneficio)) return null;

  const dias = vencimientoBeneficio ? diasHasta(vencimientoBeneficio) : null;
  const urgente = dias !== null && dias <= 3;
  const cuando =
    dias === null
      ? ""
      : dias === 0
        ? " (vence hoy)"
        : dias === 1
          ? " (vence mañana)"
          : dias <= 3
            ? ` (vence en ${dias} días)`
            : "";

  return (
    <div className={cn("space-y-3", className)}>
      {hayVencidos ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-pendiente/50 bg-pendiente-suave px-4 py-3"
        >
          <AlertTriangle
            className="mt-0.5 size-6 shrink-0 text-pendiente"
            strokeWidth={2}
          />
          <p className="text-base">
            <strong className="text-pendiente">Tiene deuda vencida:</strong>{" "}
            perdió el beneficio por mora y debe el importe completo
            {recargoPerdido > 0 ? (
              <>
                {" "}
                (<span className="tabular font-semibold">{formatARS(recargoPerdido)}</span>{" "}
                de recargo efectivo)
              </>
            ) : null}
            .
          </p>
        </div>
      ) : null}

      {ahorroEnTermino > 0 && vencimientoBeneficio ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            urgente
              ? "border-parcial bg-parcial-suave"
              : "border-pagado/50 bg-pagado-suave"
          )}
        >
          <BadgePercent
            className={cn(
              "mt-0.5 size-6 shrink-0",
              urgente ? "text-parcial" : "text-pagado"
            )}
            strokeWidth={2}
          />
          <p className="text-base">
            Pagando hasta el{" "}
            <strong className="tabular">{formatFecha(vencimientoBeneficio)}</strong>
            {cuando} mantiene el{" "}
            <strong>beneficio por pago en término</strong> (ahorra{" "}
            <span className="tabular font-semibold">{formatARS(ahorroEnTermino)}</span>
            ).
          </p>
        </div>
      ) : null}
    </div>
  );
}
