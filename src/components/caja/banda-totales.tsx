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
      {/* Un monto nunca se corta con "…": si no entra, baja de renglón entero. */}
      <Money
        monto={monto}
        className={
          destacado
            ? "mt-1 block text-3xl font-bold [overflow-wrap:anywhere]"
            : "mt-1 block text-lg font-semibold [overflow-wrap:anywhere] sm:text-2xl"
        }
      />
    </div>
  );
}

/**
 * "🚜 Quintas $92.500" como pieza del desglose (ícono + etiqueta + monto), sin partirse. Las
 * piezas van separadas por espacio, no por "·": al bajar de renglón en un celular no queda un
 * separador suelto al final de la línea.
 */
function Pieza({ icono: Icono, etiqueta, monto }: { icono?: LucideIcon; etiqueta: string; monto: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      {Icono ? <Icono className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} /> : null}
      <span className="text-muted-foreground">{etiqueta}</span>
      <Money monto={monto} className="font-semibold text-foreground" />
    </span>
  );
}

/** Renglón de la cuenta: etiqueta a la izquierda, monto con su signo a la derecha. */
function Renglon({
  etiqueta,
  monto,
  signo,
  total = false,
}: {
  etiqueta: string;
  monto: number;
  signo?: "−" | "±";
  total?: boolean;
}) {
  const texto =
    signo === "−"
      ? `−${formatARS(Math.abs(monto))}`
      : signo === "±"
        ? `${monto < 0 ? "−" : "+"}${formatARS(Math.abs(monto))}`
        : formatARS(monto);
  return (
    <p
      className={cn(
        "flex items-baseline justify-between gap-3",
        total && "border-t border-foreground/20 pt-1.5 text-base"
      )}
    >
      <span className={cn("min-w-0", total && "font-semibold")}>{etiqueta}</span>
      <span className={cn("shrink-0 tabular", total ? "text-xl font-bold" : "font-semibold")}>{texto}</span>
    </p>
  );
}

/** Una cuenta por medio (efectivo, cheques, banco): lo juntado, lo que salió y lo que queda. */
function Cuenta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 px-4 py-3 sm:px-6">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{titulo}</p>
      {children}
    </div>
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
  // Cada descuento sale de SU medio (misma fórmula que calcular_arqueo): gastos y ajustes en
  // efectivo, del cajón; cheques entregados en el acto, de los cheques; ajustes del banco, del banco.
  const cuentaEfectivo = a.gastos_pagados > CENTAVO || Math.abs(a.ajustes_efectivo) > CENTAVO;
  const cuentaCheques = a.cheques_entregados > CENTAVO;
  const cuentaBanco = Math.abs(a.ajustes_transferencia) > CENTAVO;
  const hayDescuentos = cuentaEfectivo || cuentaCheques || cuentaBanco;
  const otros = porteria ? otrosCobrosPorteria(a) : 0;
  // Lo rendido ya viene neto de los ajustes de la caja de portería (faltantes al recibirla o de
  // Tesorería); las piezas son brutas. Sin esta pieza "Caja de portería $X" no daría la suma.
  const ajustesPorteria = a.rendido - a.rendido_quintas - a.rendido_ambulantes - a.rendido_canon;

  return (
    <section
      aria-label="Lo juntado en la caja"
      className="overflow-hidden rounded-lg border-2 border-foreground/70 bg-card"
      data-tour="caja-totales"
    >
      {/* El total del día con su propio tamaño: no es lo más chico de la banda. Si no entra al
          lado del rótulo (celular, fecha de otro día), baja de renglón entero. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-dashed border-foreground/30 px-4 py-2 sm:px-6">
        <p className="font-display text-xs tracking-widest text-muted-foreground uppercase">
          {esHoy ? "Juntado hoy — en vivo" : `Juntado el ${formatFecha(fecha)} — caja abierta`}
        </p>
        <p className="text-sm whitespace-nowrap text-muted-foreground">
          Total <Money monto={a.juntado} className="text-base font-bold text-foreground" />
        </p>
      </div>

      {/* En celular el efectivo (el número grande) va solo en su renglón: en media columna no
          entraba y se cortaba. */}
      <div className={cn("grid border-foreground/30", porteria ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        <Bloque
          label="Efectivo"
          monto={juntadoEfectivo}
          destacado
          className={
            porteria
              ? "border-b border-dashed border-foreground/30 sm:border-b-0"
              : "col-span-2 border-b border-dashed border-foreground/30 sm:col-span-1 sm:border-b-0"
          }
        />
        <Bloque
          label="Transferencias"
          monto={juntadoTransferencia}
          className={
            porteria
              ? "border-dashed border-foreground/30 sm:border-l"
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
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 border-t border-dashed border-foreground/30 px-4 py-3 text-sm sm:px-6">
          <Pieza icono={Tractor} etiqueta="Quintas (tus cobros)" monto={a.quintas} />
          <Pieza icono={Footprints} etiqueta="Ambulantes" monto={a.ambulantes} />
          <Pieza icono={Truck} etiqueta="Bono camioneros (Portería)" monto={a.canon} />
          {Math.abs(otros) > CENTAVO ? <Pieza etiqueta="Otros cobros" monto={otros} /> : null}
        </div>
      ) : hayRendido ? (
        <div className="space-y-1.5 border-t border-dashed border-foreground/30 px-4 py-3 text-sm sm:px-6">
          <p className="font-medium">
            Caja de portería <Money monto={a.rendido} className="font-bold" />
          </p>
          <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
            <Pieza icono={Tractor} etiqueta="Quintas" monto={a.rendido_quintas} />
            <Pieza icono={Footprints} etiqueta="Ambulantes" monto={a.rendido_ambulantes} />
            <Pieza icono={Truck} etiqueta="Bono camioneros" monto={a.rendido_canon} />
            {Math.abs(ajustesPorteria) > CENTAVO ? (
              <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                <span className="text-muted-foreground">Ajustes</span>
                <span className="tabular font-semibold text-foreground">
                  {ajustesPorteria < 0 ? "−" : "+"}
                  {formatARS(Math.abs(ajustesPorteria))}
                </span>
              </span>
            ) : null}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <Pieza etiqueta="En mano" monto={a.rendido_efectivo} />
            <Pieza etiqueta="Por transferencia" monto={a.rendido_transferencia} />
          </p>
        </div>
      ) : null}

      {hayDescuentos ? (
        <div className="divide-y divide-dashed divide-foreground/20 border-t border-dashed border-foreground/30 bg-muted/40 text-sm">
          {cuentaEfectivo ? (
            <Cuenta titulo="En efectivo">
              <Renglon etiqueta="Juntado en efectivo" monto={juntadoEfectivo} />
              {a.gastos_pagados > CENTAVO ? (
                <Renglon etiqueta="Gastos pagados desde esta caja" monto={a.gastos_pagados} signo="−" />
              ) : null}
              {Math.abs(a.ajustes_efectivo) > CENTAVO ? (
                <Renglon etiqueta="Ajustes de tesorería" monto={a.ajustes_efectivo} signo="±" />
              ) : null}
              <Renglon etiqueta="= Tenés que tener en el cajón" monto={a.efectivo} total />
            </Cuenta>
          ) : null}
          {cuentaCheques ? (
            <Cuenta titulo="En cheques">
              <Renglon etiqueta="Cheques recibidos" monto={a.cobros_cheques} />
              <Renglon etiqueta="Entregados a proveedores en el acto" monto={a.cheques_entregados} signo="−" />
              <Renglon etiqueta="= Quedan en la caja" monto={a.cheques} total />
            </Cuenta>
          ) : null}
          {cuentaBanco ? (
            <Cuenta titulo="En el banco">
              <Renglon etiqueta="Juntado por transferencia" monto={juntadoTransferencia} />
              <Renglon etiqueta="Ajustes de tesorería" monto={a.ajustes_transferencia} signo="±" />
              <Renglon etiqueta="= Tiene que haber en el banco" monto={a.transferencia} total />
            </Cuenta>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
