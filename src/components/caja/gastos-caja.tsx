import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type { GastoCaja } from "@/components/caja/datos";

/**
 * "Gastos pagados desde esta caja": se restan del efectivo que tiene que haber (E4).
 * Si se imputaron con la caja ya cerrada, lo dice el sello "Después del cierre".
 * `pagarHref` (Administración / Tesorería / Líder con la caja sin validar) lleva a
 * Gastos con esta caja preelegida.
 */
export function GastosCaja({ gastos, pagarHref }: { gastos: GastoCaja[]; pagarHref: string | null }) {
  if (gastos.length === 0 && !pagarHref) return null;
  const total = gastos.reduce((acc, g) => acc + g.monto, 0);

  const link = pagarHref ? (
    <Link
      href={pagarHref}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-muted"
    >
      <Plus className="size-4" strokeWidth={2} />
      Pagar un gasto desde esta caja
    </Link>
  ) : null;

  if (gastos.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-card px-5 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="size-5" strokeWidth={1.8} />
          No se pagaron gastos con la plata de esta caja.
        </p>
        {link}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
        <CardTitle className="text-lg">Gastos pagados desde esta caja</CardTitle>
        <span className="tabular text-lg font-bold text-pendiente">
          − <Money monto={total} />
        </span>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {gastos.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              {g.rubro ? <Codigo codigo={g.rubro.codigo} /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{g.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {[g.pagadoPorNombre ? `Pagó ${g.pagadoPorNombre}` : null, g.pagadoEn ? formatFechaHora(g.pagadoEn) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {g.despuesDelCierre ? <Sello estado="despues_cierre" /> : null}
              <Money monto={g.monto} className="font-semibold" />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">Se restan del efectivo que tenés que tener.</p>
          {link}
        </div>
      </CardContent>
    </Card>
  );
}
