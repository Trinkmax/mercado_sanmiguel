"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatARS, formatFecha } from "@/lib/format";
import { Money } from "@/components/shared/money";
import type { PuntoCobranza } from "@/components/charts/serie-cobranza";
import { AZUL_SERIE, abreviarARS, diaMes } from "@/components/charts/utils";

export type { PuntoCobranza };

const sinSuscripcion = () => () => {};

/** false en el HTML del servidor y mientras hidrata; true cuando el gráfico ya puede dibujarse. */
function useEnCliente(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  );
}

/** Columnas "cobranza por día": serie única azul, sin leyenda (el título la nombra). Una
 * columna por día (los días sin cobros quedan en cero, sin una línea que los una), y al
 * tocar o pasar por una, su fecha y su monto.
 * `mini` (inicio): sin eje Y, pero con los números arriba (hoy y el total de los días) y el
 * monto del mejor día escrito sobre su columna, para que se lea cuánto entró. */
export function ChartCobranzaDiaria({
  data,
  mini = false,
}: {
  data: PuntoCobranza[];
  mini?: boolean;
}) {
  // El gráfico se dibuja recién en el navegador (mide su ancho): hasta entonces, en vez de
  // una tarjeta en blanco, una silueta que avisa que está cargando.
  const enCliente = useEnCliente();
  const alto = mini ? 120 : 240;

  if (data.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">Sin datos para mostrar.</p>
    );
  }

  const total = data.reduce((acc, p) => acc + p.monto, 0);
  const hoy = data[data.length - 1];
  // El mejor día (el último si hay empate): el único con su monto escrito en el mini.
  const iMejor = data.reduce((mejor, p, i) => (p.monto >= data[mejor].monto ? i : mejor), 0);
  const mejor = data[iMejor];

  // Pocas marcas en el eje X: un día cada 5 (mini: solo primero y último).
  const ticks = mini
    ? [data[0].fecha, data[data.length - 1].fecha]
    : data.filter((_, i) => i % 5 === 0).map((p) => p.fecha);

  return (
    <div className="space-y-3">
      {mini ? (
        // Si un nombre ocupa dos renglones (columna angosta), los dos montos quedan a la misma altura.
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col">
            <dt className="text-sm text-muted-foreground">Hoy</dt>
            <dd className="mt-auto">
              <Money monto={hoy.monto} className="text-lg font-semibold break-words" />
            </dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="text-sm text-muted-foreground">Total de los {data.length} días</dt>
            <dd className="mt-auto">
              <Money monto={total} className="text-lg font-semibold break-words" />
            </dd>
          </div>
        </dl>
      ) : null}
      <div
        role="img"
        aria-label={`Cobranza por día, del ${formatFecha(data[0].fecha)} al ${formatFecha(
          hoy.fecha
        )}: en total ${formatARS(total)}${
          mejor.monto > 0 ? `; el día que más entró, el ${formatFecha(mejor.fecha)}, ${formatARS(mejor.monto)}` : ""
        }.`}
      >
        {enCliente ? (
          <ResponsiveContainer width="100%" height={alto}>
            <BarChart
              data={data}
              margin={
                mini
                  ? { top: 22, right: 8, left: 8, bottom: 0 }
                  : { top: 8, right: 12, left: 0, bottom: 0 }
              }
            >
              {mini ? null : <CartesianGrid vertical={false} stroke="var(--border)" />}
              <XAxis
                dataKey="fecha"
                ticks={ticks}
                tickFormatter={diaMes}
                tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickMargin={6}
                interval={mini ? "preserveStartEnd" : undefined}
              />
              {mini ? null : (
                <YAxis
                  domain={[0, "auto"]}
                  tickCount={5}
                  tickFormatter={(v: number) => abreviarARS(v)}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
                  tickLine={false}
                  axisLine={false}
                  width={66}
                />
              )}
              <Tooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.7 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
                      <p className="text-sm text-muted-foreground">
                        {formatFecha(String(label))}
                      </p>
                      <p className="text-base font-semibold tabular">
                        {formatARS(Number(payload[0].value))}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="monto"
                fill={AZUL_SERIE}
                radius={[4, 4, 0, 0]}
                maxBarSize={mini ? 14 : 18}
                isAnimationActive={false}
              >
                {mini && mejor.monto > 0 ? (
                  <LabelList
                    dataKey="monto"
                    content={(props) => {
                      if (props.index !== iMejor) return null;
                      const x = Number(props.x ?? 0);
                      const y = Number(props.y ?? 0);
                      const ancho = Number(props.width ?? 0);
                      // Pegado a la columna; si es la primera o la última, alineado hacia adentro.
                      const ancla =
                        iMejor === 0 ? "start" : iMejor === data.length - 1 ? "end" : "middle";
                      const xTexto = ancla === "start" ? x : ancla === "end" ? x + ancho : x + ancho / 2;
                      return (
                        <text
                          x={xTexto}
                          y={y - 7}
                          textAnchor={ancla}
                          fill="var(--foreground)"
                          fontSize={13}
                          fontWeight={600}
                        >
                          {abreviarARS(Number(props.value ?? 0))}
                        </text>
                      );
                    }}
                  />
                ) : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex animate-pulse items-center justify-center rounded-md bg-muted text-sm text-muted-foreground"
            style={{ height: alto }}
          >
            Cargando el gráfico…
          </div>
        )}
      </div>
    </div>
  );
}
