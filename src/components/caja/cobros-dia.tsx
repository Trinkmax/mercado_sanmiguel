import Link from "next/link";
import { HandCoins } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { labelMedio } from "@/components/caja/medios";
import { BotonAnularCobro } from "@/components/caja/anular-cobro";
import type { CobroDia } from "@/components/caja/datos";

/** Lista cronológica de los cobros de la caja. Anular solo con caja abierta. */
export function CobrosDia({
  cobros,
  cajaAbierta,
}: {
  cobros: CobroDia[];
  cajaAbierta: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cobros del día</CardTitle>
      </CardHeader>
      <CardContent>
        {cobros.length === 0 ? (
          <EmptyState
            icono={HandCoins}
            titulo="Todavía no hay cobros hoy"
            descripcion="Los cobros que registres desde la pantalla Cobrar van a aparecer acá."
            className="py-10"
          />
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Recibo</TableHead>
                {cajaAbierta ? (
                  <TableHead className="w-12">
                    <span className="sr-only">Anular</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cobros.map((cobro) => {
                const tachado = cobro.anulado
                  ? "text-muted-foreground line-through"
                  : "";
                return (
                  <TableRow key={cobro.id}>
                    <TableCell className={`${tachado} tabular`}>
                      {formatFechaHora(cobro.fecha)}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className={`truncate font-medium ${tachado}`}>
                        {cobro.cliente?.nombre ?? "—"}
                      </p>
                      {cobro.anulado ? (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs whitespace-normal no-underline">
                          <Sello estado="anulado" />
                          {cobro.motivo_anulacion ? (
                            <span className="text-muted-foreground">
                              {cobro.motivo_anulacion}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className={tachado}>
                      {labelMedio(cobro.medio)}
                    </TableCell>
                    <TableCell className={`${tachado} text-right`}>
                      <Money monto={cobro.monto} className="font-semibold" />
                    </TableCell>
                    <TableCell>
                      <span className={`${tachado} tabular`}>
                        N° {cobro.numero}
                      </span>
                      {!cobro.anulado ? (
                        <Link
                          href={`/recibos/${cobro.id}`}
                          className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Recibo
                        </Link>
                      ) : null}
                    </TableCell>
                    {cajaAbierta ? (
                      <TableCell className="text-right">
                        {!cobro.anulado ? (
                          <BotonAnularCobro
                            pagoId={cobro.id}
                            numero={cobro.numero}
                            cliente={cobro.cliente?.nombre ?? "el cliente"}
                            monto={cobro.monto}
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
