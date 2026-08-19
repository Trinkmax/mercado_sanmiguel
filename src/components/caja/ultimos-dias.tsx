import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
import type { CajaPrevia } from "@/components/caja/datos";

/** Tabla compacta de las cajas anteriores de este tipo; cada fila abre ese día. */
export function UltimosDias({ previas }: { previas: CajaPrevia[] }) {
  if (previas.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Últimos días</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="text-right">Transferencias</TableHead>
              <TableHead className="text-right">Cheques</TableHead>
              <TableHead className="text-right">Estado</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Ver</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previas.map((caja) => (
              <TableRow key={caja.id}>
                <TableCell className="font-medium tabular">
                  <Link
                    href={`/caja?fecha=${caja.fecha}`}
                    className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                  >
                    {formatFecha(caja.fecha)}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Money monto={caja.total_efectivo ?? 0} />
                </TableCell>
                <TableCell className="text-right">
                  <Money monto={caja.total_transferencia ?? 0} />
                </TableCell>
                <TableCell className="text-right">
                  <Money monto={caja.total_cheques ?? 0} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex flex-wrap items-center justify-end gap-1">
                    {caja.reapertura_solicitada_en ? (
                      <Sello estado="reapertura_pedida" />
                    ) : null}
                    <Sello estado={caja.estado} />
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/caja?fecha=${caja.fecha}`}
                    aria-label={`Ver la caja del ${formatFecha(caja.fecha)}`}
                    className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="size-5" strokeWidth={2} />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
