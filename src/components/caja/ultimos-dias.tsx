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

/** Tabla compacta de las cajas anteriores de este tipo. */
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {previas.map((caja) => (
              <TableRow key={caja.id}>
                <TableCell className="font-medium tabular">
                  {formatFecha(caja.fecha)}
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
                  <Sello estado={caja.estado} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
