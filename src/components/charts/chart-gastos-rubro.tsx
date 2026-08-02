"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatARS } from "@/lib/format";
import { AZUL_SERIE, abreviarARS } from "@/components/charts/utils";

export type GastoRubro = { codigo: string; nombre: string; total: number };

function nombreCorto(nombre: string): string {
  return nombre.length > 15 ? `${nombre.slice(0, 14).trimEnd()}…` : nombre;
}

/** Barras horizontales "total por rubro" (top 8 + Otros), un solo tono azul.
 * Cada barra lleva su monto directo, así el eje de valores sobra. */
export function ChartGastosRubro({ data }: { data: GastoRubro[] }) {
  const conMonto = [...data]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  let filas = conMonto;
  if (conMonto.length > 9) {
    const resto = conMonto.slice(8).reduce((acc, d) => acc + d.total, 0);
    filas = [
      ...conMonto.slice(0, 8),
      { codigo: "OTROS", nombre: "Otros", total: resto },
    ];
  }

  if (filas.length === 0) return null;

  const filasChart = filas.map((f) => ({ ...f, corto: nombreCorto(f.nombre) }));
  const alto = filas.length * 28 + 12;

  return (
    <div role="img" aria-label={`Gastos por rubro, ${filas.length} rubros`}>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart
          data={filasChart}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, "auto"]} hide />
          <YAxis
            type="category"
            dataKey="corto"
            width={112}
            tick={{ fill: "var(--foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const fila = payload[0].payload as GastoRubro;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                  <p className="font-semibold tabular">{formatARS(fila.total)}</p>
                  <p className="text-xs text-muted-foreground">{fila.nombre}</p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="total"
            fill={AZUL_SERIE}
            barSize={16}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="total"
              position="right"
              formatter={(v: unknown) => abreviarARS(Number(v))}
              fill="var(--muted-foreground)"
              fontSize={12}
              className="tabular"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
