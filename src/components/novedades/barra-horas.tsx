import { TriangleAlert } from "lucide-react";
import { formatNumero } from "@/lib/format";
import { cn } from "@/lib/utils";
import { nivelHoras, porcentajeHoras } from "./constantes";

/** 150 → "150" · 32.46 → "32,5" (una décima alcanza para leer horas). */
export function horasCortas(h: number | string | null | undefined): string {
  return formatNumero(Math.round(Number(h ?? 0) * 10) / 10);
}

const RELLENO = {
  pagado: "bg-pagado",
  parcial: "bg-parcial",
  pendiente: "bg-pendiente",
} as const;

const TEXTO = {
  pagado: "text-pagado",
  parcial: "text-parcial",
  pendiente: "text-pendiente",
} as const;

/**
 * "Registró 150 h de 176 h" con barra: verde ≥ 100 %, ámbar ≥ 90 %, rojo < 90 %.
 * Sin horas de contrato ni horario: aviso ámbar (no hay contra qué comparar).
 */
export function BarraHoras({
  registradas,
  esperadas,
  horasSemanales,
  hastaHoy = false,
  className,
}: {
  registradas: number;
  esperadas: number;
  horasSemanales: number | null;
  /** Mes en curso: lo esperado se cuenta hasta hoy. */
  hastaHoy?: boolean;
  className?: string;
}) {
  const nivel = nivelHoras(registradas, esperadas);
  const pct = porcentajeHoras(registradas, esperadas);

  if (!nivel) {
    return (
      <p className={cn("flex items-center gap-1.5 text-sm font-medium text-parcial", className)}>
        <TriangleAlert className="size-4 shrink-0" strokeWidth={2} />
        {horasSemanales ? (
          <>Registró {horasCortas(registradas)} h · todavía no hay días para comparar</>
        ) : (
          <>Sin horas de contrato ni horario: no hay contra qué comparar</>
        )}
      </p>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span>
          Registró{" "}
          <span className="font-display text-lg font-bold tabular">{horasCortas(registradas)} h</span>{" "}
          de <span className="font-semibold tabular">{horasCortas(esperadas)} h</span>
        </span>
        <span className={cn("text-sm font-semibold tabular", TEXTO[nivel])}>{pct} %</span>
        {hastaHoy ? <span className="text-xs text-muted-foreground">hasta hoy</span> : null}
      </p>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-label={`Registró ${horasCortas(registradas)} de ${horasCortas(esperadas)} horas`}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", RELLENO[nivel])}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
