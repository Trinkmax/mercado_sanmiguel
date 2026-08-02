"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatARS, formatFecha } from "@/lib/format";
import type { PuntoCobranza } from "@/components/charts/serie-cobranza";
import { AZUL_SERIE, abreviarARS, diaMes } from "@/components/charts/utils";

export type { PuntoCobranza };

/** Área "cobranza por día": serie única azul, sin leyenda (el título la nombra).
 * `mini`: versión compacta para el inicio (sin eje Y, eje X mínimo). */
export function ChartCobranzaDiaria({
  data,
  mini = false,
}: {
  data: PuntoCobranza[];
  mini?: boolean;
}) {
  const gradId = `grad-cobranza-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  if (data.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">Sin datos para mostrar.</p>
    );
  }

  // Pocas marcas en el eje X: un día cada 5 (mini: solo primero y último).
  const ticks = mini
    ? [data[0].fecha, data[data.length - 1].fecha]
    : data.filter((_, i) => i % 5 === 0).map((p) => p.fecha);

  return (
    <div
      role="img"
      aria-label={`Cobranza por día, del ${formatFecha(data[0].fecha)} al ${formatFecha(
        data[data.length - 1].fecha
      )}`}
    >
      <ResponsiveContainer width="100%" height={mini ? 120 : 240}>
        <AreaChart
          data={data}
          margin={
            mini
              ? { top: 6, right: 18, left: 18, bottom: 0 }
              : { top: 8, right: 12, left: 0, bottom: 0 }
          }
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AZUL_SERIE} stopOpacity={0.25} />
              <stop offset="100%" stopColor={AZUL_SERIE} stopOpacity={0} />
            </linearGradient>
          </defs>
          {mini ? null : <CartesianGrid vertical={false} stroke="var(--border)" />}
          <XAxis
            dataKey="fecha"
            ticks={ticks}
            tickFormatter={diaMes}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />
          {mini ? null : (
            <YAxis
              domain={[0, "auto"]}
              tickCount={5}
              tickFormatter={(v: number) => abreviarARS(v)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
          )}
          <Tooltip
            cursor={{
              stroke: "var(--muted-foreground)",
              strokeWidth: 1,
              strokeOpacity: 0.45,
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <p className="text-xs text-muted-foreground">
                    {formatFecha(String(label))}
                  </p>
                  <p className="font-semibold tabular">
                    {formatARS(Number(payload[0].value))}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="monto"
            stroke={AZUL_SERIE}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: AZUL_SERIE, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
