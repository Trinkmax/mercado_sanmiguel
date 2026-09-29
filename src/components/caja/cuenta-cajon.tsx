import { Footprints, Tractor, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { otrosCobrosPorteria, totalTenesQueTener, type Arqueo } from "@/components/caja/arqueo-tipos";

type Variante = "pantalla" | "compacta" | "papel";

const CENTAVO = 0.009;

/** "Efectivo $600.000 · Transferencia $200.000" (solo lo que no es cero). */
function detallePorMedio(partes: [string, number][]): string | null {
  const conMonto = partes.filter(([, m]) => Math.abs(m) > CENTAVO);
  if (conMonto.length < 2) return null;
  return conMonto.map(([l, m]) => `${l} ${formatARS(m)}`).join(" · ");
}

/** Monto con signo explícito: "+$ 300" · "−$ 500". */
function MontoConSigno({ monto, className }: { monto: number; className?: string }) {
  const negativo = monto < -CENTAVO;
  return (
    <span className={cn("tabular", className)}>
      {negativo ? "−" : monto > CENTAVO ? "+" : ""}
      {formatARS(Math.abs(monto))}
    </span>
  );
}

const TEXTO_SIGNO: Record<string, string> = { "−": "menos", "±": "más o menos", "=": "igual", "": "" };

/** Renglón de la cuenta: signo en el margen, etiqueta y monto alineado a la derecha. */
function Renglon({
  signo,
  etiqueta,
  children,
  detalle,
  variante,
  apagado = false,
}: {
  signo: "" | "−" | "±" | "=";
  etiqueta: string;
  children: React.ReactNode;
  detalle?: React.ReactNode;
  variante: Variante;
  apagado?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2",
        variante === "compacta" ? "py-1" : "py-1.5",
        apagado && "opacity-60"
      )}
    >
      <span aria-hidden className="text-center font-display text-lg leading-none font-bold text-muted-foreground">
        {signo}
      </span>
      <span
        className={cn(
          "font-semibold tracking-wider text-muted-foreground uppercase",
          variante === "papel" ? "text-[0.7rem] text-foreground" : "text-xs"
        )}
      >
        {TEXTO_SIGNO[signo] ? <span className="sr-only">{TEXTO_SIGNO[signo]} </span> : null}
        {etiqueta}
      </span>
      <span className={cn("text-right", variante === "compacta" ? "text-base" : "text-lg", "font-semibold")}>
        {children}
      </span>
      {detalle ? <div className="col-start-2 col-end-4 mt-0.5 space-y-0.5 text-sm">{detalle}</div> : null}
    </div>
  );
}

/** Sub-renglón dentro de "Juntaste" (cobros, caja de portería, quintas…). */
function Parte({
  icono: Icono,
  etiqueta,
  monto,
  nota,
  variante,
}: {
  icono?: LucideIcon;
  etiqueta: string;
  monto: number;
  nota?: string | null;
  variante: Variante;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="flex min-w-0 items-baseline gap-1.5">
        {Icono && variante !== "papel" ? (
          <Icono className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
        ) : null}
        <span>{etiqueta}</span>
      </span>
      <Money monto={monto} className="font-medium" />
      {nota ? <span className="w-full text-xs text-muted-foreground">{nota}</span> : null}
    </div>
  );
}

/**
 * La cuenta del arqueo como se hace en papel, con los signos en el margen:
 *
 *     JUNTASTE                              $ 1.250.000
 *   − GASTOS PAGADOS DESDE ESTA CAJA           $ 50.000
 *   − CHEQUES ENTREGADOS EN EL ACTO            $ 20.000
 *   ± AJUSTES DE TESORERÍA                       −$ 500
 *   ═════════════════════════════════════════════════
 *   = TENÉS QUE TENER                     $ 1.179.500
 *     En el cajón $ 999.500 · En el banco · Cheques
 *
 * Los números salen tal cual de `arqueo_caja` (la fórmula vive solo en SQL).
 */
export function CuentaCajon({
  arqueo: a,
  tipo,
  variante = "pantalla",
  tituloResultado = "Tenés que tener",
}: {
  arqueo: Arqueo;
  tipo: "administracion" | "guardia";
  variante?: Variante;
  tituloResultado?: string;
}) {
  const porteria = tipo === "guardia";
  const otros = porteria ? otrosCobrosPorteria(a) : 0;
  const ajustesPorteria = a.rendido - a.rendido_quintas - a.rendido_ambulantes - a.rendido_canon;
  const hayRendido = Math.abs(a.rendido) > CENTAVO;
  const hayCheques = Math.abs(a.cobros_cheques) > CENTAVO || Math.abs(a.cheques) > CENTAVO;
  const total = totalTenesQueTener(a);
  // La caja de portería no recibe cheques: dos columnas (cajón y banco).
  const dosColumnas = porteria && !hayCheques;

  const juntaste = porteria ? (
    <>
      <Parte icono={Tractor} etiqueta="Quintas" monto={a.quintas} variante={variante} />
      <Parte icono={Footprints} etiqueta="Ambulantes" monto={a.ambulantes} variante={variante} />
      <Parte icono={Truck} etiqueta="Bono camioneros" monto={a.canon} variante={variante} />
      {Math.abs(otros) > CENTAVO ? (
        <Parte etiqueta="Otros cobros" monto={otros} variante={variante} />
      ) : null}
    </>
  ) : (
    <>
      <Parte
        etiqueta="Cobros"
        monto={a.cobros}
        variante={variante}
        nota={detallePorMedio([
          ["Efectivo", a.cobros_efectivo],
          ["Transferencia", a.cobros_transferencia],
          ["Cheques", a.cobros_cheques],
        ])}
      />
      {hayRendido ? (
        <Parte
          etiqueta="Caja de portería"
          monto={a.rendido}
          variante={variante}
          nota={[
            `Quintas ${formatARS(a.rendido_quintas)} · Ambulantes ${formatARS(a.rendido_ambulantes)} · Bono camioneros ${formatARS(a.rendido_canon)}`,
            Math.abs(ajustesPorteria) > CENTAVO
              ? ` · Ajustes ${ajustesPorteria < 0 ? "−" : "+"}${formatARS(Math.abs(ajustesPorteria))}`
              : "",
            ` — en mano ${formatARS(a.rendido_efectivo)} · por transferencia ${formatARS(a.rendido_transferencia)}`,
          ].join("")}
        />
      ) : null}
      {Math.abs(a.canon) > CENTAVO ? (
        <Parte icono={Truck} etiqueta="Bono camioneros" monto={a.canon} variante={variante} />
      ) : null}
    </>
  );

  return (
    <div className={cn(variante === "papel" && "text-sm")}>
      <div className={cn("divide-y divide-dashed", variante === "papel" && "divide-foreground/30")}>
        <Renglon signo="" etiqueta="Juntaste" variante={variante} detalle={variante === "compacta" ? null : juntaste}>
          <Money monto={a.juntado} />
        </Renglon>

        {!porteria || a.gastos_pagados > CENTAVO ? (
          <Renglon
            signo="−"
            etiqueta="Gastos pagados desde esta caja"
            variante={variante}
            apagado={a.gastos_pagados <= CENTAVO}
          >
            <Money monto={a.gastos_pagados} className={a.gastos_pagados > CENTAVO && variante !== "papel" ? "text-pendiente" : undefined} />
          </Renglon>
        ) : null}

        {a.cheques_entregados > CENTAVO ? (
          <Renglon
            signo="−"
            etiqueta="Cheques entregados a proveedores en el acto"
            variante={variante}
            detalle={
              variante === "compacta" || a.cheques_entregados_detalle.length === 0 ? null : (
                <ul className="text-muted-foreground">
                  {a.cheques_entregados_detalle.map((c, i) => (
                    <li key={`${c.numero}-${i}`}>
                      Cheque N° {c.numero}
                      {c.proveedor ? ` a ${c.proveedor}` : ""} · {formatARS(c.monto)}
                    </li>
                  ))}
                </ul>
              )
            }
          >
            <Money monto={a.cheques_entregados} />
          </Renglon>
        ) : null}

        {!porteria || Math.abs(a.ajustes) > CENTAVO ? (
          <Renglon
            signo="±"
            etiqueta="Ajustes de tesorería"
            variante={variante}
            apagado={Math.abs(a.ajustes) <= CENTAVO}
            detalle={
              variante !== "compacta" && Math.abs(a.ajustes) > CENTAVO ? (
                <p className="text-muted-foreground">
                  {[
                    Math.abs(a.ajustes_efectivo) > CENTAVO
                      ? `En efectivo ${a.ajustes_efectivo < 0 ? "−" : "+"}${formatARS(Math.abs(a.ajustes_efectivo))}`
                      : null,
                    Math.abs(a.ajustes_transferencia) > CENTAVO
                      ? `En el banco ${a.ajustes_transferencia < 0 ? "−" : "+"}${formatARS(Math.abs(a.ajustes_transferencia))}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null
            }
          >
            <MontoConSigno monto={a.ajustes} />
          </Renglon>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-1 border-t-4 border-double pt-2",
          variante === "papel" ? "border-foreground" : "border-foreground/60"
        )}
      >
        <Renglon signo="=" etiqueta={tituloResultado} variante={variante}>
          <Money monto={total} className="font-bold" />
        </Renglon>
        {/* En un celular el cajón va solo en su renglón (es el número que se cuenta) y banco y
            cheques abajo, de a dos: tres columnas de ~100 px pisaban un monto con el otro. En
            tablet, escritorio y en la hoja impresa, las tres en fila. */}
        <dl
          className={cn(
            "mt-2 grid gap-x-4 gap-y-3",
            dosColumnas ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 print:grid-cols-3"
          )}
        >
          <div className="col-span-2 min-w-0 sm:col-span-1 print:col-span-1">
            <dt className="text-sm text-muted-foreground">En el cajón (efectivo)</dt>
            <dd>
              <Money
                monto={a.efectivo}
                className={cn(
                  "block font-bold [overflow-wrap:anywhere]",
                  variante === "pantalla" ? "text-3xl" : variante === "compacta" ? "text-2xl" : "text-xl",
                  a.efectivo < -CENTAVO && variante !== "papel" && "text-pendiente"
                )}
              />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">En el banco (transferencias)</dt>
            <dd>
              <Money
                monto={a.transferencia}
                className={cn("block font-semibold [overflow-wrap:anywhere]", variante === "papel" ? "text-base" : "text-xl")}
              />
            </dd>
          </div>
          {hayCheques || !porteria ? (
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">Cheques en cartera</dt>
              <dd>
                <Money
                  monto={a.cheques}
                  className={cn("block font-semibold [overflow-wrap:anywhere]", variante === "papel" ? "text-base" : "text-xl")}
                />
              </dd>
            </div>
          ) : null}
        </dl>
        {a.efectivo < -CENTAVO && variante !== "papel" ? (
          <p className="mt-2 text-sm text-pendiente">
            Salieron más gastos que el efectivo juntado: revisá los gastos pagados desde esta caja.
          </p>
        ) : null}
      </div>
    </div>
  );
}
