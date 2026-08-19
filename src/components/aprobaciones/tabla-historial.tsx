import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Codigo } from "@/components/shared/codigo";
import { Sello } from "@/components/shared/sello";
import { ChipsCambio } from "@/components/aprobaciones/chips-cambio";
import type { CambioFila } from "@/components/aprobaciones/tipos";

/** Historial de cambios ya revisados (aprobados o rechazados). */
export function TablaHistorial({ cambios }: { cambios: CambioFila[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Cambio</TableHead>
            <TableHead>Lo pidió</TableHead>
            <TableHead>Revisión</TableHead>
            <TableHead className="pr-4">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cambios.map((c) => (
            <TableRow key={c.id} className="align-top">
              <TableCell className="max-w-md whitespace-normal py-3 pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ChipsCambio entidad={c.entidad} accion={c.accion} />
                  {c.concepto ? <Codigo codigo={c.concepto.codigo} /> : null}
                </div>
                <p className="mt-1.5 font-medium">{c.resumen}</p>
                {c.cliente ? (
                  <Link
                    href={`/clientes/${c.cliente.id}`}
                    className="mt-0.5 inline-flex min-h-8 items-center gap-0.5 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Ver ficha de {c.cliente.nombre}
                    <ArrowUpRight className="size-4" strokeWidth={2} />
                  </Link>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-normal py-3">
                <p className="font-medium">{c.solicitadoPor ?? "—"}</p>
                <p className="text-muted-foreground">{formatFechaHora(c.solicitadoEn)}</p>
              </TableCell>
              <TableCell className="whitespace-normal py-3">
                <Sello estado={c.estado === "aprobado" ? "aprobado" : "rechazado"} />
                <p className="mt-1.5 text-muted-foreground">
                  {c.revisadoPor ?? "—"}
                  {c.revisadoEn ? ` · ${formatFechaHora(c.revisadoEn)}` : ""}
                </p>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal py-3 pr-4">
                {c.motivoRechazo ? (
                  <p className="text-pendiente">{c.motivoRechazo}</p>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
