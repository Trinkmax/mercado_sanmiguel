import Link from "next/link";
import { ChevronRight, Printer } from "lucide-react";
import { formatFecha } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type { CajaPrevia, TipoCaja } from "@/components/caja/datos";

/** Cajas anteriores de este tipo: cada fila abre ese día; la impresora, su cierre. */
export function UltimosDias({ previas, tipo }: { previas: CajaPrevia[]; tipo: TipoCaja }) {
  if (previas.length === 0) return null;
  const porteria = tipo === "guardia";

  return (
    <Card data-tour="caja-ultimos">
      <CardHeader>
        <CardTitle className="text-lg">Últimos días</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Transferencias</TableHead>
              {porteria ? null : <TableHead className="hidden text-right md:table-cell">Cheques</TableHead>}
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Imprimir y ver</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previas.map((caja) => {
              const href = `/caja?fecha=${caja.fecha}&tipo=${tipo}`;
              const abierta = caja.estado === "abierta";
              return (
                <TableRow key={caja.id}>
                  <TableCell className="font-medium tabular">
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                      data-tour="caja-ultimos-dia"
                    >
                      {formatFecha(caja.fecha)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {abierta ? <span className="text-muted-foreground">—</span> : <Money monto={caja.total_efectivo ?? 0} />}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {abierta ? <span className="text-muted-foreground">—</span> : <Money monto={caja.total_transferencia ?? 0} />}
                  </TableCell>
                  {porteria ? null : (
                    <TableCell className="hidden text-right md:table-cell">
                      {abierta ? <span className="text-muted-foreground">—</span> : <Money monto={caja.total_cheques ?? 0} />}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <span className="inline-flex flex-wrap items-center justify-end gap-1">
                      {caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
                      <Sello estado={caja.estado} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center">
                      <Link
                        href={`/cierre-caja/${caja.id}`}
                        aria-label={`Imprimir el cierre del ${formatFecha(caja.fecha)}`}
                        title="Imprimir el cierre"
                        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Printer className="size-5" strokeWidth={2} />
                      </Link>
                      <Link
                        href={href}
                        aria-label={`Ver la caja del ${formatFecha(caja.fecha)}`}
                        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <ChevronRight className="size-5" strokeWidth={2} />
                      </Link>
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
