import { ArrowDownLeft, ArrowUpRight, FileText, Landmark, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatARS, formatFecha, formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonTransferenciaBanco } from "@/components/tesoreria/boton-transferencia-banco";
import type { TransferenciaCaja } from "@/components/caja/datos";

type Grupo = {
  clave: string;
  titulo: string;
  icono: LucideIcon;
  filas: TransferenciaCaja[];
};

/** Los grupos en el orden en que se leen: lo que entró (esta caja, portería) y lo que salió. */
function agrupar(transferencias: TransferenciaCaja[], porteria: boolean): Grupo[] {
  const propias = transferencias.filter((t) => t.sentido === "entra" && !t.porteriaFecha);
  const cobros = propias.filter((t) => t.clase === "cobro");
  const canon = propias.filter((t) => t.clase === "canon");
  const ingresos = propias.filter((t) => t.clase === "ingreso");
  const fechasPorteria = [
    ...new Set(transferencias.map((t) => t.porteriaFecha).filter((f): f is string => Boolean(f))),
  ].sort();
  const gastos = transferencias.filter((t) => t.sentido === "sale");

  return [
    {
      clave: "cobros",
      titulo: porteria ? "Cobros a quinteros, ambulantes y cocheras" : "Cobros por transferencia",
      icono: ArrowDownLeft,
      filas: cobros,
    },
    { clave: "canon", titulo: "Bono camioneros por transferencia", icono: ArrowDownLeft, filas: canon },
    { clave: "ingresos", titulo: "Ventas y otros ingresos por transferencia", icono: ArrowDownLeft, filas: ingresos },
    ...fechasPorteria.map((f) => ({
      clave: `porteria-${f}`,
      titulo: `Caja de portería del ${formatFecha(f).slice(0, 5)}`,
      icono: ArrowDownLeft,
      filas: transferencias.filter((t) => t.porteriaFecha === f),
    })),
    { clave: "gastos", titulo: "Gastos pagados por transferencia", icono: ArrowUpRight, filas: gastos },
  ].filter((g) => g.filas.length > 0);
}

/** "Recibo N° 12" · "Bono camioneros N° 4" · "Cobro N° 3" · la descripción del gasto. */
function nombreCorto(t: TransferenciaCaja): string {
  if (t.clase === "gasto") return t.titulo;
  return t.detalle?.split(" · ").find((p) => p.includes("N°")) ?? t.titulo;
}

/**
 * Las transferencias de la caja, una por una, para chequearlas contra el banco (0049):
 * lo que entró (cobros, bono camioneros, ventas y lo de las cajas de portería recibidas) y lo que
 * salió (gastos pagados por banco ese día). Tesorería y el Líder marcan cada una con
 * "Está en el banco"; el resto ve cómo está. Es la misma marca de Tesorería → Conciliar.
 */
export function TransferenciasCaja({
  transferencias,
  puedeConciliar,
  porteria,
}: {
  transferencias: TransferenciaCaja[];
  puedeConciliar: boolean;
  porteria: boolean;
}) {
  if (transferencias.length === 0) return null;

  const grupos = agrupar(transferencias, porteria);
  const faltan = transferencias.filter((t) => !t.conciliada);
  const entraron = transferencias.filter((t) => t.sentido === "entra").reduce((acc, t) => acc + t.monto, 0);
  const salieron = transferencias.filter((t) => t.sentido === "sale").reduce((acc, t) => acc + t.monto, 0);

  return (
    <Card data-tour="caja-transferencias">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Landmark className="size-5 text-muted-foreground" strokeWidth={2} />
          Transferencias: chequealas con el banco
        </CardTitle>
        {faltan.length === 0 ? (
          <Sello estado="conciliado" texto="Todas conciliadas" />
        ) : (
          <p className="rounded-lg bg-parcial-suave px-3 py-1.5 text-sm font-semibold text-parcial tabular">
            {faltan.length === 1
              ? `Falta 1 de ${transferencias.length}`
              : `Faltan ${faltan.length} de ${transferencias.length}`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {puedeConciliar
            ? "Buscá cada una en el resumen del banco y tocá «Está en el banco». Es lo mismo que Tesorería → Conciliar: lo que marques acá queda marcado allá."
            : "Tesorería marca cada transferencia cuando la ve en el resumen del banco."}
        </p>

        {grupos.map((g) => {
          const total = g.filas.reduce((acc, t) => acc + t.monto, 0);
          return (
            <section key={g.clave} aria-label={g.titulo} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="flex items-center gap-1.5 text-base font-semibold">
                  <g.icono className="size-4 text-muted-foreground" strokeWidth={2.2} />
                  {g.titulo}
                </h3>
                <span className="text-sm text-muted-foreground tabular">
                  {g.filas.length} · {g.clave === "gastos" ? "− " : ""}
                  {formatARS(total)}
                </span>
              </div>
              <ul className="divide-y">
                {g.filas.map((t) => (
                  <li
                    key={`${t.clase}-${t.id}`}
                    data-tour="caja-transferencia"
                    className="grid items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-base leading-snug font-medium break-words">{t.titulo}</p>
                      {t.detalle ? (
                        <p className="text-sm break-words text-muted-foreground tabular">{t.detalle}</p>
                      ) : null}
                      {t.conciliada ? (
                        <p className="text-sm break-words text-pagado">
                          La vio en el banco {t.conciliadaPorNombre ?? "Tesorería"}
                          {t.conciliadaEn ? ` · ${formatFechaHora(t.conciliadaEn)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:justify-end">
                      {t.comprobanteUrl ? (
                        <a
                          href={t.comprobanteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                          <FileText className="size-4" strokeWidth={2} />
                          Ver comprobante
                        </a>
                      ) : null}
                      <span className={cn("text-base font-semibold tabular", t.sentido === "sale" && "text-pendiente")}>
                        {t.sentido === "sale" ? "− " : ""}
                        <Money monto={t.monto} />
                      </span>
                      {t.conciliada ? <Sello estado="conciliado" /> : null}
                      {puedeConciliar ? (
                        <BotonTransferenciaBanco
                          clase={t.clase}
                          id={t.id}
                          conciliada={t.conciliada}
                          nombre={nombreCorto(t)}
                        />
                      ) : t.conciliada ? null : (
                        <Sello estado="sin_conciliar" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">
            Entraron al banco <Money monto={entraron} className="font-semibold text-foreground" />
          </span>
          {salieron > 0 ? (
            <span className="whitespace-nowrap">
              Salieron por gastos <Money monto={salieron} className="font-semibold text-foreground" />
            </span>
          ) : null}
          {faltan.length > 0 ? (
            <span className="whitespace-nowrap">
              Sin conciliar{" "}
              <Money
                monto={faltan.reduce((acc, t) => acc + t.monto, 0)}
                className="font-semibold text-parcial"
              />
            </span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
