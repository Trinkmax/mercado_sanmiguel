"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Stamp } from "lucide-react";
import { validarCaja } from "@/lib/actions/tesoreria";
import { formatARS, formatFecha, parseMonto, sanitizarMonto } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import type { Arqueo } from "@/components/caja/arqueo-tipos";
import { llamarAccion } from "@/lib/llamar-accion";

type CajaValidar = {
  id: string;
  tipo: "administracion" | "guardia";
  fecha: string;
  estado: string;
};

type AjusteCaja = {
  id: string;
  cuenta: "efectivo" | "banco";
  monto: number;
  descripcion: string | null;
};

function Linea({
  signo,
  label,
  monto,
  detalle,
  fuerte = false,
}: {
  signo: string;
  label: string;
  monto: number;
  detalle?: React.ReactNode;
  fuerte?: boolean;
}) {
  return (
    <div className={cn("py-2.5", fuerte && "border-t-2 border-foreground/70 pt-3")}>
      <div className="flex items-baseline justify-between gap-4">
        <span className={cn("flex items-baseline gap-2", fuerte ? "text-base font-semibold" : "text-base")}>
          <span className="w-4 text-center font-bold text-muted-foreground" aria-hidden>
            {signo}
          </span>
          {label}
        </span>
        <Money monto={monto} className={fuerte ? "text-2xl font-bold" : "text-base font-semibold"} />
      </div>
      {detalle ? <div className="pl-6 text-sm text-muted-foreground">{detalle}</div> : null}
    </div>
  );
}

/**
 * "Contar y validar" (§6 M6-7, lo monta M2 en /caja): la cuenta del arqueo
 * (Juntó − Gastos ± Ajustes = Tiene que haber), cuánto efectivo contó Tesorería
 * con la diferencia en vivo, y un solo botón que registra el faltante/sobrante y
 * valida (validar_caja con p_efectivo_contado).
 */
export function ValidarCajaDialog({
  caja,
  arqueo,
  ajustes,
}: {
  caja: CajaValidar;
  arqueo: Arqueo;
  ajustes: AjusteCaja[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const esPorteria = caja.tipo === "guardia";
  const dia = formatFecha(caja.fecha).slice(0, 5);
  const tieneQueHaber = Number(arqueo.efectivo ?? 0);
  const gastos = Number(arqueo.gastos_pagados ?? 0);
  const ajustesEfectivo = Number(arqueo.ajustes_efectivo ?? 0);
  // Juntó en efectivo = lo que tiene que haber + gastos − ajustes (misma fórmula que el arqueo).
  const juntoEfectivo = tieneQueHaber + gastos - ajustesEfectivo;
  const ajustesDeEfectivo = ajustes.filter((a) => a.cuenta === "efectivo");

  // Estados que no se validan acá (la base igual lo frena).
  const bloqueo =
    caja.estado === "validada"
      ? "Esta caja ya está validada."
      : caja.estado === "abierta"
        ? "Primero hay que cerrar la caja."
        : esPorteria && caja.estado === "cerrada"
          ? "Primero hay que recibir la caja de portería en la caja de administración."
          : null;
  // Una caja de portería integrada ya se contó dentro de la de administración.
  const pideConteo = !(esPorteria && caja.estado === "integrada");

  // Acepta centavos con coma: si el arqueo tiene centavos, se puede cargar "Coincide".
  const contadoNum = contado === "" ? null : parseMonto(contado);
  const diferencia = contadoNum === null ? null : Math.round((contadoNum - tieneQueHaber) * 100) / 100;

  function validar() {
    setError(null);
    startTransition(async () => {
      const res = await llamarAccion(() => validarCaja(
        caja.id,
        observaciones.trim() || undefined,
        pideConteo && contadoNum !== null ? contadoNum : undefined
      ));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      toast.success(
        diferencia && diferencia !== 0
          ? `Caja del ${dia} validada, con un ${diferencia < 0 ? "faltante" : "sobrante"} de ${formatARS(Math.abs(diferencia))} anotado.`
          : `Caja del ${dia} validada.`
      );
    });
  }

  const textoBoton =
    !pideConteo
      ? "Validar la caja de portería"
      : diferencia === null
        ? "Poné cuánto contaste"
        : diferencia === 0
          ? "Coincide: validar la caja"
          : diferencia < 0
            ? `Registrar faltante de ${formatARS(-diferencia)} y validar`
            : `Registrar sobrante de ${formatARS(diferencia)} y validar`;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        if (pendiente) return;
        setAbierto(v);
        if (!v) {
          setContado("");
          setObservaciones("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="h-12 px-6 text-base font-semibold">
          <Stamp className="size-5" strokeWidth={2} />
          Contar y validar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Contar y validar la caja del {dia}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {esPorteria ? "Caja de portería" : "Administración"} · Validar es el cierre
            definitivo: después ya no se reabre.
          </DialogDescription>
        </DialogHeader>

        {bloqueo ? (
          <p className="rounded-lg bg-parcial-suave px-4 py-3 text-base font-medium text-parcial">
            {bloqueo}
          </p>
        ) : (
          <>
            <div className="rounded-xl border px-4 py-1">
              <Linea
                signo="+"
                label="Juntó en efectivo"
                monto={juntoEfectivo}
                detalle={
                  Number(arqueo.rendido_efectivo ?? 0) > 0 || Number(arqueo.canon_efectivo ?? 0) > 0 ? (
                    <>
                      Cobros {formatARS(arqueo.cobros_efectivo ?? 0)}
                      {Number(arqueo.canon_efectivo ?? 0) > 0
                        ? ` · Bono camioneros ${formatARS(arqueo.canon_efectivo)}`
                        : ""}
                      {Number(arqueo.rendido_efectivo ?? 0) > 0
                        ? ` · Caja de portería ${formatARS(arqueo.rendido_efectivo)}`
                        : ""}
                    </>
                  ) : undefined
                }
              />
              {gastos > 0 ? (
                <Linea signo="−" label="Gastos pagados desde la caja" monto={-gastos} />
              ) : null}
              {ajustesEfectivo !== 0 || ajustesDeEfectivo.length > 0 ? (
                <Linea
                  signo="±"
                  label="Ajustes de tesorería"
                  monto={ajustesEfectivo}
                  detalle={
                    ajustesDeEfectivo.length > 0 ? (
                      <ul>
                        {ajustesDeEfectivo.map((a) => (
                          <li key={a.id} className="tabular">
                            {a.descripcion || "Ajuste"}: {a.monto < 0 ? "−" : "+"}
                            {formatARS(Math.abs(a.monto))}
                          </li>
                        ))}
                      </ul>
                    ) : undefined
                  }
                />
              ) : null}
              <Linea signo="=" label="Tiene que haber en efectivo" monto={tieneQueHaber} fuerte />
              {Number(arqueo.transferencia ?? 0) !== 0 || Number(arqueo.cheques ?? 0) !== 0 ? (
                <p className="pb-2.5 text-sm text-muted-foreground">
                  Además: en el banco {formatARS(arqueo.transferencia ?? 0)} · cheques por cobrar{" "}
                  {formatARS(arqueo.cheques ?? 0)}
                </p>
              ) : null}
            </div>

            {pideConteo ? (
              <div className="space-y-2">
                <Label htmlFor={`contado-${caja.id}`} className="text-base font-semibold">
                  ¿Cuánto efectivo contaste?
                </Label>
                <Input
                  id={`contado-${caja.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={contado}
                  onChange={(e) => {
                    setContado(sanitizarMonto(e.target.value).slice(0, 15));
                    setError(null);
                  }}
                  className="h-14 text-2xl font-bold tabular"
                />
                <div className="flex min-h-8 flex-wrap items-center gap-2" aria-live="polite">
                  {contadoNum === null ? (
                    <span className="text-sm text-muted-foreground">
                      Contá los billetes y poné el total: la diferencia aparece acá.
                    </span>
                  ) : diferencia === 0 ? (
                    <>
                      <Sello estado="pagado" texto="Coincide" />
                      <span className="text-sm text-muted-foreground tabular">{formatARS(contadoNum)}</span>
                    </>
                  ) : diferencia !== null && diferencia < 0 ? (
                    <span className="text-lg font-bold text-pendiente tabular">
                      Faltan {formatARS(-diferencia)}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-parcial tabular">
                      Sobran {formatARS(diferencia ?? 0)}
                    </span>
                  )}
                </div>
                {diferencia !== null && diferencia !== 0 ? (
                  <p className="text-sm text-muted-foreground">
                    La diferencia queda anotada como ajuste de la caja, con tu nombre.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
                Esta caja ya entró en la de administración: su efectivo se cuenta ahí.
              </p>
            )}

            <Collapsible>
              <CollapsibleTrigger className="group flex min-h-11 items-center gap-1.5 text-base font-medium text-primary">
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  strokeWidth={2}
                />
                Agregar una observación
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Label htmlFor={`obs-${caja.id}`} className="sr-only">
                  Observación
                </Label>
                <Textarea
                  id={`obs-${caja.id}`}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Por ejemplo: faltó un comprobante de transferencia"
                  className="min-h-20 text-base"
                  maxLength={500}
                />
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {error ? (
          <p role="alert" className="rounded-lg bg-pendiente-suave px-4 py-3 text-sm font-medium text-pendiente">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            size="lg"
            className={cn(
              "h-13 w-full text-base font-semibold",
              diferencia !== null && diferencia < 0 && "bg-pendiente hover:bg-pendiente/85"
            )}
            disabled={pendiente || bloqueo !== null || (pideConteo && contadoNum === null)}
            onClick={validar}
          >
            {pendiente ? <Spinner className="size-5" /> : <Stamp className="size-5" strokeWidth={2} />}
            {textoBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
