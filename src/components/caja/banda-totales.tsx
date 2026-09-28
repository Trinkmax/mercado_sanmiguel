import { Footprints, Tractor, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS, formatFecha } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { otrosCobrosPorteria, type Arqueo } from "@/components/caja/arqueo-tipos";

const CENTAVO = 0.009;

function Bloque({
  label,
  monto,
  destacado = false,
  className,
}: {
  label: string;
  monto: number;
  destacado?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-4 sm:px-6 sm:py-5", className)}>
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>
      <Money
        monto={monto}
        className={
          destacado
            ? "mt-1 block truncate text-3xl font-bold"
            : "mt-1 block truncate text-xl font-semibold sm:text-2xl"
        }
      />
    </div>
  );
}

/** "🚜 Quintas $92.500" como pieza del desglose (ícono + etiqueta + monto). */
function Pieza({ icono: Icono, etiqueta, monto }: { icono: LucideIcon; etiqueta: string; monto: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <Icono className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
      <span className="text-muted-foreground">{etiqueta}</span>
      <Money monto={monto} className="font-semibold text-foreground" />
    </span>
  );
}

function Separador() {
  return (
    <span aria-hidden className="text-muted-foreground/60">
      ·
    </span>
  );
}

/**
 * Banda horizontal estilo talonario para la caja ABIERTA: lo juntado en vivo por
 * medio, el desglose de la caja de portería y, si hubo gastos o ajustes, la cuenta
 * hasta "Tenés que tener ahora". Los números salen de arqueo_caja (fuente "vivo").
 */
export function BandaTotales({
  arqueo: a,
  tipo,
  fecha,
  esHoy = true,
}: {
  arqueo: Arqueo;
  tipo: "administracion" | "guardia";
  fecha: string;
  esHoy?: boolean;
}) {
  const porteria = tipo === "guardia";
  const juntadoEfectivo = a.cobros_efectivo + a.canon_efectivo + a.rendido_efectivo;
  const juntadoTransferencia = a.cobros_transferencia + a.canon_transferencia + a.rendido_transferencia;
  const hayRendido = Math.abs(a.rendido) > CENTAVO;
  const hayDescuentos =
    a.gastos_pagados > CENTAVO || Math.abs(a.ajustes) > CENTAVO || a.cheques_entregados > CENTAVO;
  const otros = porteria ? otrosCobrosPorteria(a) : 0;
  // Lo rendido ya viene neto de los ajustes de la caja de portería (faltantes al recibirla o de
  // Tesorería); las piezas son brutas. Sin esta pieza "Caja de portería $X" no daría la suma.
  const ajustesPorteria = a.rendido - a.rendido_quintas - a.rendido_ambulantes - a.rendido_canon;

  return (
    <section
      aria-label="Lo juntado en la caja"
      className="overflow-hidden rounded-lg border-2 border-foreground/70 bg-card"
    >
      <p className="font-display flex items-center justify-between gap-3 border-b border-dashed border-foreground/30 px-4 py-2 text-xs tracking-widest text-muted-foreground uppercase sm:px-6">
        <span>{esHoy ? "Juntado hoy — en vivo" : `Juntado el ${formatFecha(fecha)} — caja abierta`}</span>
        <span className="font-sans normal-case tracking-normal">
          Total <Money monto={a.juntado} className="font-semibold text-foreground" />
        </span>
      </p>

      <div className={cn("grid border-foreground/30", porteria ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        <Bloque
          label="Efectivo"
          monto={juntadoEfectivo}
          destacado
          className={
            porteria
              ? undefined
              : "col-span-2 border-b border-dashed border-foreground/30 sm:col-span-1 sm:border-b-0"
          }
        />
        <Bloque
          label="Transferencias"
          monto={juntadoTransferencia}
          className={
            porteria
              ? "border-l border-dashed border-foreground/30"
              : "border-r border-dashed border-foreground/30 sm:border-r-0 sm:border-l"
          }
        />
        {porteria ? null : (
          <Bloque
            label="Cheques"
            monto={a.cobros_cheques}
            className="sm:border-l sm:border-dashed sm:border-foreground/30"
          />
        )}
      </div>

      {porteria ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t border-dashed border-foreground/30 px-4 py-3 text-sm sm:px-6">
          <Pieza icono={Tractor} etiqueta="Quintas (tus cobros)" monto={a.quintas} />
          <Separador />
          <Pieza icono={Footprints} etiqueta="Ambulantes" monto={a.ambulantes} />
          <Separador />
          <Pieza icono={Truck} etiqueta="Bono camioneros (Portería)" monto={a.canon} />
          {Math.abs(otros) > CENTAVO ? (
            <>
              <Separador />
              <span className="text-muted-foreground">
                Otros cobros <Money monto={otros} className="font-semibold text-foreground" />
              </span>
            </>
          ) : null}
        </div>
      ) : hayRendido ? (
        <div className="space-y-1 border-t border-dashed border-foreground/30 px-4 py-3 text-sm sm:px-6">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
            <span className="font-medium">
              Caja de portería <Money monto={a.rendido} className="font-bold" />
            </span>
            <span aria-hidden className="text-muted-foreground">
              —
            </span>
            <Pieza icono={Tractor} etiqueta="Quintas" monto={a.rendido_quintas} />
            <Separador />
            <Pieza icono={Footprints} etiqueta="Ambulantes" monto={a.rendido_ambulantes} />
            <Separador />
            <Pieza icono={Truck} etiqueta="Bono camioneros" monto={a.rendido_canon} />
            {Math.abs(ajustesPorteria) > CENTAVO ? (
              <>
                <Separador />
                <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-muted-foreground">Ajustes</span>
                  <span className="tabular font-semibold text-foreground">
                    {ajustesPorteria < 0 ? "−" : "+"}
                    {formatARS(Math.abs(ajustesPorteria))}
                  </span>
                </span>
              </>
            ) : null}
          </p>
          <p className="text-muted-foreground">
            En mano <Money monto={a.rendido_efectivo} className="font-medium text-foreground" /> · Por
            transferencia <Money monto={a.rendido_transferencia} className="font-medium text-foreground" />
          </p>
        </div>
      ) : null}

      {hayDescuentos ? (
        <div className="space-y-1 border-t border-dashed border-foreground/30 bg-muted/40 px-4 py-3 text-sm sm:px-6">
          {a.gastos_pagados > CENTAVO ? (
            <p className="flex items-baseline justify-between gap-3">
              <span>− Gastos pagados desde esta caja</span>
              <Money monto={a.gastos_pagados} className="font-semibold text-pendiente" />
            </p>
          ) : null}
          {a.cheques_entregados > CENTAVO ? (
            <p className="flex items-baseline justify-between gap-3">
              <span>− Cheques entregados a proveedores en el acto</span>
              <Money monto={a.cheques_entregados} className="font-semibold" />
            </p>
          ) : null}
          {Math.abs(a.ajustes) > CENTAVO ? (
            <p className="flex items-baseline justify-between gap-3">
              <span>± Ajustes de tesorería</span>
              <span className="tabular font-semibold">
                {a.ajustes < 0 ? "−" : "+"}
                {formatARS(Math.abs(a.ajustes))}
              </span>
            </p>
          ) : null}
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-foreground/20 pt-1.5 text-base">
            <span className="font-semibold">= Tenés que tener ahora</span>
            <span>
              <Money monto={a.efectivo} className="text-xl font-bold" />{" "}
              <span className="text-muted-foreground">en efectivo</span>
            </span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
