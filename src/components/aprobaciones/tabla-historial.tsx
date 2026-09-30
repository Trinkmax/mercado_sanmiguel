import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/**
 * Historial de cambios ya revisados (aprobados o rechazados). En el celular y la tablet chica,
 * una tarjeta por cambio (la tabla de 4 columnas se deslizaba de costado y el motivo quedaba
 * afuera); desde md, la tabla.
 */
export function TablaHistorial({ cambios }: { cambios: CambioFila[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <ul className="divide-y md:hidden">
        {cambios.map((c) => (
          <li key={c.id} className="space-y-2 px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <ChipsCambio entidad={c.entidad} accion={c.accion} />
              {c.concepto ? <Codigo codigo={c.concepto.codigo} /> : null}
              <SelloRevision cambio={c} />
            </div>
            <p className="text-base leading-snug font-medium break-words">{c.resumen}</p>
            {c.cliente ? <LinkFicha cliente={c.cliente} /> : null}
            <dl className="space-y-0.5 text-sm">
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-muted-foreground">Lo pidió:</dt>
                <dd className="min-w-0 break-words">
                  {c.solicitadoPor ?? "—"}
                  <span className="text-muted-foreground tabular"> · {formatFechaHora(c.solicitadoEn)}</span>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-1.5">
                <dt className="text-muted-foreground">
                  {c.revisarDespues ? "Lo revisó:" : c.estado === "aprobado" ? "Lo aprobó:" : "Lo rechazó:"}
                </dt>
                <dd className="min-w-0 break-words">
                  {c.revisadoPor ?? "—"}
                  {c.revisadoEn ? (
                    <span className="text-muted-foreground tabular"> · {formatFechaHora(c.revisadoEn)}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
            {c.revisarDespues ? (
              <p className="text-sm text-muted-foreground">Aplicada en el acto por el Jefe</p>
            ) : null}
            {c.motivoRechazo ? (
              <p className="rounded-md bg-pendiente-suave px-3 py-2 text-sm break-words">
                <span className="font-semibold">Motivo:</span> {c.motivoRechazo}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <Table className="text-sm max-md:hidden">
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
                {c.cliente ? <LinkFicha cliente={c.cliente} className="mt-0.5" /> : null}
              </TableCell>
              <TableCell className="whitespace-normal py-3">
                <p className="font-medium">{c.solicitadoPor ?? "—"}</p>
                <p className="text-muted-foreground">{formatFechaHora(c.solicitadoEn)}</p>
              </TableCell>
              <TableCell className="whitespace-normal py-3">
                <SelloRevision cambio={c} />
                {c.revisarDespues ? (
                  <p className="mt-1 text-xs text-muted-foreground">Aplicada en el acto por el Jefe</p>
                ) : null}
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

function SelloRevision({ cambio }: { cambio: CambioFila }) {
  return (
    <Sello
      estado={cambio.estado === "aprobado" ? "aprobado" : "rechazado"}
      texto={cambio.revisarDespues ? "Revisada" : undefined}
    />
  );
}

function LinkFicha({
  cliente,
  className,
}: {
  cliente: NonNullable<CambioFila["cliente"]>;
  className?: string;
}) {
  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className={cn(
        "inline-flex min-h-11 items-center gap-0.5 text-sm break-words text-primary underline-offset-4 hover:underline",
        className
      )}
    >
      <span className="min-w-0">Ver ficha de {cliente.nombre}</span>
      <ArrowUpRight className="size-4 shrink-0" strokeWidth={2} />
    </Link>
  );
}
