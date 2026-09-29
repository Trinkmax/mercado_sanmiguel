import { formatARS } from "@/lib/format";
import { AZUL_SERIE, abreviarARS } from "@/components/charts/utils";

export type GastoRubro = { codigo: string; nombre: string; total: number };

/** Barras horizontales "total por rubro" (top 8 + Otros), un solo tono azul.
 * Cada barra lleva su monto directo, así el eje de valores sobra.
 * En HTML (no SVG): el nombre del rubro va entero, en los renglones que haga falta y con
 * la letra de la página (en el celular el SVG la achicaba y cortaba los nombres con "…").
 * Celular: el nombre arriba y la barra debajo, a todo el ancho; desde sm, en columnas. */
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
  const maximo = filas[0].total;

  return (
    <ul aria-label={`Gastos por rubro, ${filas.length} rubros`} className="space-y-3 sm:space-y-2">
      {filas.map((f) => {
        const pct = maximo > 0 ? (f.total / maximo) * 100 : 0;
        return (
          <li
            key={f.codigo}
            className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center"
          >
            <span className="text-sm break-words sm:text-right">{f.nombre}</span>
            {/* pr: lugar reservado para el monto al final de la barra más larga */}
            <div className="pr-20" title={`${f.nombre}: ${formatARS(f.total)}`}>
              <div
                className="relative h-4 min-w-1 rounded-r-[4px]"
                style={{ width: `${pct}%`, backgroundColor: AZUL_SERIE }}
              >
                <span className="absolute top-1/2 left-full ml-2 -translate-y-1/2 text-sm whitespace-nowrap text-muted-foreground tabular">
                  <span aria-hidden>{abreviarARS(f.total)}</span>
                  <span className="sr-only">{formatARS(f.total)}</span>
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
