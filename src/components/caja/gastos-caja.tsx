import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { labelMedio } from "@/components/caja/medios";
import type { GastoCaja } from "@/components/caja/datos";

/** Lista informativa de los gastos pagados desde esta caja (si hay). */
export function GastosCaja({ gastos }: { gastos: GastoCaja[] }) {
  if (gastos.length === 0) return null;
  const total = gastos.reduce((acc, g) => acc + g.monto, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gastos pagados desde esta caja</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {gastos.map((gasto) => (
            <li
              key={gasto.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
            >
              {gasto.rubro ? <Codigo codigo={gasto.rubro.codigo} /> : null}
              <span className="min-w-0 flex-1 truncate font-medium">
                {gasto.descripcion}
              </span>
              <span className="text-sm text-muted-foreground">
                {labelMedio(gasto.medio_pago)}
              </span>
              <Money monto={gasto.monto} className="font-semibold" />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Los pagados en efectivo se descuentan del arqueo.
          </p>
          <Money monto={total} className="text-lg font-bold" />
        </div>
      </CardContent>
    </Card>
  );
}
