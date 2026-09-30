"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, FileText, ImageOff } from "lucide-react";
import { conciliarTransferencias } from "@/lib/actions/tesoreria";
import { formatARS, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { llamarAccion } from "@/lib/llamar-accion";

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
      <span className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-parcial">
        <ImageOff className="size-4 shrink-0" strokeWidth={2} />
        Sin comprobante
      </span>
    );
  }
  return (
    <a
      href={fila.comprobanteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex min-h-11 items-center gap-2.5 font-medium text-primary hover:underline pointer-coarse:min-h-[44px]"
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
 * Transferencias sin conciliar. Tesorería marca cada una cuando la ve acreditada en
 * el resumen del banco (de a una, o varias con los casilleros). Tesorería y el Líder
 * de Procesos concilian (§1.3).
 *
 * Es una lista y no una tabla: con nombres largos la tabla se salía de su caja y el
 * botón "Conciliar" quedaba escondido a la derecha. Cada fila tiene columnas de ancho
 * fijo desde 1024 px (todo alineado); más angosto, el comprobante y el monto van abajo.
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
      const res = await llamarAccion(() => conciliarTransferencias(ids));
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
  // Con casillero: una columna más, fija, a la izquierda (el resto de la fila se corre igual en todas).
  const columnas = mostrarCasilleros
    ? "grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_12rem_17rem]"
    : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_12rem_17rem]";
  // Lo que va abajo en celular y tablet empieza bajo el texto, no bajo el casillero.
  const bajoElTexto = mostrarCasilleros ? "col-start-2 lg:col-start-auto" : "";

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {mostrarCasilleros ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b bg-muted/40 px-4 py-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-4 text-sm font-medium pointer-coarse:min-h-[44px]">
            {/* Mismo lugar que el casillero de cada fila. */}
            <span className="inline-flex size-11 shrink-0 items-center justify-center pointer-coarse:size-[44px]">
              <Checkbox
                checked={todasSeleccionadas}
                onCheckedChange={(v) => alternarTodas(v === true)}
                aria-label="Seleccionar todas las transferencias"
                className="size-6 [&_svg]:size-4"
                disabled={pendiente}
              />
            </span>
            {seleccionadas.length === 0
              ? "Seleccioná las que ya viste en el banco"
              : seleccionadas.length === 1
                ? `1 seleccionada · ${formatARS(totalSeleccion)}`
                : `${seleccionadas.length} seleccionadas · ${formatARS(totalSeleccion)}`}
          </label>
          <Button
            className="h-auto min-h-11 px-5 py-2 text-base font-semibold whitespace-normal"
            disabled={pendiente || seleccionadas.length === 0}
            onClick={() => conciliar(seleccionadas.map((f) => f.id))}
          >
            {pendiente && enCurso.length > 1 ? (
              <Spinner className="size-5" />
            ) : (
              <CheckCheck className="size-5" strokeWidth={2} />
            )}
            Conciliar las seleccionadas
            {seleccionadas.length > 0 ? ` (${seleccionadas.length})` : ""}
          </Button>
        </div>
      ) : null}

      <ul className="divide-y" aria-label="Transferencias sin conciliar">
        {filas.map((f) => {
          const marcada = seleccion.has(f.id);
          const estaEnCurso = enCurso.includes(f.id);
          return (
            <li
              key={f.id}
              className={cn(
                "grid items-center gap-x-4 gap-y-2 px-4 py-3",
                columnas,
                marcada && "bg-accent/50"
              )}
            >
              {mostrarCasilleros ? (
                <label className="inline-flex size-11 cursor-pointer items-center justify-center self-start pointer-coarse:size-[44px] lg:self-center">
                  <Checkbox
                    checked={marcada}
                    onCheckedChange={(v) => alternar(f.id, v === true)}
                    aria-label={`Seleccionar recibo N° ${f.numero}`}
                    className="size-6 [&_svg]:size-4"
                    disabled={pendiente}
                  />
                </label>
              ) : null}

              <div className="min-w-0 space-y-0.5">
                <p className="text-base font-medium break-words">{f.clienteNombre}</p>
                <p className="text-sm text-muted-foreground tabular">
                  {f.clienteCodigo !== null ? `Carpeta N° ${f.clienteCodigo} · ` : ""}
                  Recibo N° {f.numero} · {formatFechaHora(f.fecha)}
                </p>
                <p className="text-sm break-words">
                  <span className="text-muted-foreground">Titular: </span>
                  {f.titular ? f.titular : <span className="text-muted-foreground">sin dato</span>}
                </p>
              </div>

              <div className={cn("min-w-0", bajoElTexto)}>
                <Comprobante fila={f} />
              </div>

              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:justify-end",
                  bajoElTexto
                )}
              >
                <Money monto={f.monto} className="text-base font-semibold" />
                {puedeOperar ? (
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm font-semibold"
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
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
