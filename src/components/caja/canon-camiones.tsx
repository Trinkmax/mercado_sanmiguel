import { Truck } from "lucide-react";
import { formatFecha, formatNumero, formatSoloHora, hoyISO } from "@/lib/format";
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
import { Sello } from "@/components/shared/sello";
import { labelMedio } from "@/components/caja/medios";
import { FormCanon } from "@/components/caja/form-canon";
import { BotonBorrarCanon } from "@/components/caja/borrar-canon";
import type { CanonDia, PreciosCanon, TipoCanon } from "@/components/caja/datos";

const PLURAL: Record<TipoCanon, [string, string]> = {
  camion: ["camión", "camiones"],
  ambulante: ["ambulante", "ambulantes"],
  quintero: ["quintero", "quinteros"],
};

/** "2 camiones · 1 ambulante" */
function resumenTipos(entradas: CanonDia[]): string {
  const cuenta = new Map<TipoCanon, number>();
  for (const e of entradas) cuenta.set(e.tipo, (cuenta.get(e.tipo) ?? 0) + e.cantidad);
  return (["camion", "ambulante", "quintero"] as TipoCanon[])
    .filter((t) => (cuenta.get(t) ?? 0) > 0)
    .map((t) => {
      const n = cuenta.get(t) ?? 0;
      return `${formatNumero(n)} ${PLURAL[t][n === 1 ? 0 : 1]}`;
    })
    .join(" · ");
}

/** Canon del día: entradas + carga inline (solo caja de portería). */
export function CanonCamiones({
  cajaId,
  cajaAbierta,
  fechaCaja,
  entradas,
  precios,
}: {
  cajaId: string;
  cajaAbierta: boolean;
  fechaCaja: string;
  entradas: CanonDia[];
  precios: PreciosCanon;
}) {
  const totalMonto = entradas.reduce((acc, e) => acc + e.monto, 0);
  const hoy = hoyISO();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Canon del día{" "}
          <span className="font-normal text-muted-foreground">
            (camiones, ambulantes, quinteros)
          </span>
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            <Codigo codigo="BC" />
            <Codigo codigo="BA" />
            <Codigo codigo="BQ" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        {cajaAbierta ? (
          <FormCanon cajaId={cajaId} fechaCaja={fechaCaja} precios={precios} />
        ) : null}

        {entradas.length === 0 ? (
          <EmptyState
            icono={Truck}
            titulo="Todavía no se cargó canon hoy"
            descripcion={
              cajaAbierta
                ? "Elegí qué entró y cargá el monto con el formulario de arriba."
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
                  <Sello estado={entrada.tipo} />
                  <span className="text-sm text-muted-foreground tabular">
                    {formatFecha(entrada.fecha)}
                    {entrada.fecha === hoy ? ` · ${formatSoloHora(entrada.creado_en)}` : ""}
                  </span>
                  {entrada.cantidad !== 1 ? (
                    <span className="text-sm font-medium tabular">
                      × {formatNumero(entrada.cantidad)}
                    </span>
                  ) : null}
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
                        tipo={entrada.tipo}
                        fecha={entrada.fecha}
                        monto={entrada.monto}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-4">
              <p className="text-muted-foreground">{resumenTipos(entradas)} en el día</p>
              <Money monto={totalMonto} className="text-lg font-bold" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
