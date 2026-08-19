"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, FileText, ImageOff } from "lucide-react";
import { conciliarTransferencias } from "@/lib/actions/tesoreria";
import { formatARS, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";

export type FilaTransferencia = {
  id: string;
  numero: number;
  /** timestamptz del cobro */
  fecha: string;
  monto: number;
  clienteNombre: string;
  clienteCodigo: number | null;
  titular: string | null;
  /** URL firmada (1 h) del comprobante, o null si no se adjuntó. */
  comprobanteUrl: string | null;
  comprobanteEsImagen: boolean;
};

/** Miniatura + link al comprobante de la transferencia (o aviso si falta). */
function Comprobante({ fila }: { fila: FilaTransferencia }) {
  if (!fila.comprobanteUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-parcial">
        <ImageOff className="size-4" strokeWidth={2} />
        Sin comprobante
      </span>
    );
  }
  return (
    <a
      href={fila.comprobanteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex min-h-11 items-center gap-2.5 font-medium text-primary hover:underline"
    >
      {fila.comprobanteEsImagen ? (
        // Firmada por 1 h en el server; no pasa por next/image (dominio de storage).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fila.comprobanteUrl}
          alt=""
          loading="lazy"
          className="size-11 shrink-0 rounded-md border bg-muted object-cover"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
          <FileText className="size-5" strokeWidth={1.9} />
        </span>
      )}
      Ver comprobante
    </a>
  );
}

/**
 * Tabla de transferencias sin conciliar. Tesorería marca cada una cuando la
 * ve acreditada en el resumen del banco (de a una, o varias con los casilleros).
 * Consejo y líder la ven en solo lectura.
 */
export function ConciliacionTransferencias({
  filas,
  puedeOperar,
}: {
  filas: FilaTransferencia[];
  puedeOperar: boolean;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [enCurso, setEnCurso] = useState<string[]>([]);
  const [pendiente, startTransition] = useTransition();

  // Si la lista cambió (se conciliaron filas), la selección se limpia sola.
  const idsVisibles = useMemo(() => new Set(filas.map((f) => f.id)), [filas]);
  const seleccionadas = filas.filter((f) => seleccion.has(f.id));
  const totalSeleccion = seleccionadas.reduce((acc, f) => acc + f.monto, 0);
  const todasSeleccionadas = filas.length > 0 && seleccionadas.length === filas.length;

  function alternar(id: string, marcada: boolean) {
    setSeleccion((prev) => {
      const next = new Set([...prev].filter((x) => idsVisibles.has(x)));
      if (marcada) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function alternarTodas(marcadas: boolean) {
    setSeleccion(marcadas ? new Set(filas.map((f) => f.id)) : new Set());
  }

  function conciliar(ids: string[]) {
    if (ids.length === 0) return;
    setEnCurso(ids);
    startTransition(async () => {
      const res = await conciliarTransferencias(ids);
      setEnCurso([]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const n = res.data.conciliadas;
      toast.success(
        n === 1 ? "Transferencia conciliada." : `${n} transferencias conciliadas.`
      );
      setSeleccion((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    });
  }

  const mostrarCasilleros = puedeOperar && filas.length > 1;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {mostrarCasilleros ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-muted/40 px-4 py-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <Checkbox
              checked={todasSeleccionadas}
              onCheckedChange={(v) => alternarTodas(v === true)}
              aria-label="Seleccionar todas las transferencias"
              className="size-5"
              disabled={pendiente}
            />
            {seleccionadas.length === 0
              ? "Seleccioná las que ya viste en el banco"
              : seleccionadas.length === 1
                ? `1 seleccionada · ${formatARS(totalSeleccion)}`
                : `${seleccionadas.length} seleccionadas · ${formatARS(totalSeleccion)}`}
          </label>
          <Button
            className="h-11 px-5 text-base font-semibold"
            disabled={pendiente || seleccionadas.length === 0}
            onClick={() => conciliar(seleccionadas.map((f) => f.id))}
          >
            {pendiente && enCurso.length > 1 ? (
              <Spinner className="size-5" />
            ) : (
              <CheckCheck className="size-5" strokeWidth={2} />
            )}
            Conciliar todas las seleccionadas
            {seleccionadas.length > 0 ? ` (${seleccionadas.length})` : ""}
          </Button>
        </div>
      ) : null}

      <Table className="text-sm">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {mostrarCasilleros ? (
              <TableHead className="w-12 pl-4">
                <span className="sr-only">Seleccionar</span>
              </TableHead>
            ) : null}
            <TableHead className={cn(!mostrarCasilleros && "pl-4")}>Fecha y hora</TableHead>
            <TableHead>Recibo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Titular de la cuenta</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="pr-4 text-right">
              {puedeOperar ? "Acción" : "Estado"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => {
            const marcada = seleccion.has(f.id);
            const estaEnCurso = enCurso.includes(f.id);
            return (
              <TableRow
                key={f.id}
                data-state={marcada ? "selected" : undefined}
                className={cn(marcada && "bg-accent/50")}
              >
                {mostrarCasilleros ? (
                  <TableCell className="pl-4">
                    <label className="inline-flex size-11 cursor-pointer items-center justify-center">
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={(v) => alternar(f.id, v === true)}
                        aria-label={`Seleccionar recibo N° ${f.numero}`}
                        className="size-5"
                        disabled={pendiente}
                      />
                    </label>
                  </TableCell>
                ) : null}
                <TableCell className={cn("tabular", !mostrarCasilleros && "pl-4")}>
                  {formatFechaHora(f.fecha)}
                </TableCell>
                <TableCell className="tabular font-medium">N° {f.numero}</TableCell>
                <TableCell>
                  <p className="font-medium">{f.clienteNombre}</p>
                  {f.clienteCodigo !== null ? (
                    <p className="text-xs text-muted-foreground tabular">
                      Carpeta N° {f.clienteCodigo}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {f.titular ? (
                    f.titular
                  ) : (
                    <span className="text-muted-foreground">Sin titular</span>
                  )}
                </TableCell>
                <TableCell>
                  <Comprobante fila={f} />
                </TableCell>
                <TableCell className="text-right">
                  <Money monto={f.monto} className="font-semibold" />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {puedeOperar ? (
                    <Button
                      variant="outline"
                      className="h-10 px-4 font-semibold"
                      disabled={pendiente}
                      onClick={() => conciliar([f.id])}
                      aria-label={`Conciliar recibo N° ${f.numero}`}
                    >
                      {estaEnCurso && enCurso.length === 1 ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Check className="size-4" strokeWidth={2.2} />
                      )}
                      Conciliar
                    </Button>
                  ) : (
                    <Sello estado="sin_conciliar" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
