import { Truck } from "lucide-react";
import { formatFechaHora, formatNumero } from "@/lib/format";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Codigo } from "@/components/shared/codigo";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { labelMedio } from "@/components/caja/medios";
import { FormCanon } from "@/components/caja/form-canon";
import { BotonBorrarCanon } from "@/components/caja/borrar-canon";
import type { CanonDia } from "@/components/caja/datos";

/** Canon de camiones del día: entradas + carga inline (solo caja de guardia). */
export function CanonCamiones({
  cajaId,
  cajaAbierta,
  entradas,
  precioCanon,
}: {
  cajaId: string;
  cajaAbierta: boolean;
  entradas: CanonDia[];
  precioCanon: number;
}) {
  const totalCamiones = entradas.reduce((acc, e) => acc + e.cantidad, 0);
  const totalMonto = entradas.reduce((acc, e) => acc + e.monto, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Canon de camiones</CardTitle>
        <CardAction>
          <Codigo codigo="BC" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        {cajaAbierta ? (
          <FormCanon cajaId={cajaId} precioCanon={precioCanon} />
        ) : null}

        {entradas.length === 0 ? (
          <EmptyState
            icono={Truck}
            titulo="Todavía no se cargó canon hoy"
            descripcion={
              cajaAbierta
                ? "Cargá cada entrada de camiones con el formulario de arriba."
                : "No hubo entradas de canon en esta caja."
            }
            className="py-8"
          />
        ) : (
          <>
            <ul className="divide-y">
              {entradas.map((entrada) => (
                <li
                  key={entrada.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="text-sm text-muted-foreground tabular">
                    {formatFechaHora(entrada.creado_en)}
                  </span>
                  <span className="font-medium">
                    {formatNumero(entrada.cantidad)}{" "}
                    {entrada.cantidad === 1 ? "camión" : "camiones"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {labelMedio(entrada.medio)}
                  </span>
                  {entrada.notas ? (
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {entrada.notas}
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-1">
                    <Money monto={entrada.monto} className="font-semibold" />
                    {cajaAbierta ? (
                      <BotonBorrarCanon
                        id={entrada.id}
                        cantidad={entrada.cantidad}
                        monto={entrada.monto}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
              <p className="text-muted-foreground">
                {formatNumero(totalCamiones)}{" "}
                {totalCamiones === 1 ? "camión" : "camiones"} en el día
              </p>
              <Money monto={totalMonto} className="text-lg font-bold" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
