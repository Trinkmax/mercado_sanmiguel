import Link from "next/link";
import { Banknote, HandCoins, ReceiptText, ScrollText, Smartphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFecha, formatSoloHora } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { labelMedio } from "@/components/caja/medios";
import { BotonAnularCobro } from "@/components/caja/anular-cobro";
import type { LineaCobro, ReciboDia } from "@/components/caja/datos";

const ICONO_MEDIO: Record<string, LucideIcon> = {
  efectivo: Banknote,
  transferencia: Smartphone,
  cheque: ScrollText,
};

function Linea({ linea }: { linea: LineaCobro }) {
  const Icono = ICONO_MEDIO[linea.medio] ?? Banknote;
  return (
    <li className={cn("flex flex-wrap items-baseline gap-x-2", linea.anulado && "text-muted-foreground line-through")}>
      <Icono className="size-4 shrink-0 translate-y-0.5 text-muted-foreground" strokeWidth={2} />
      <span>{labelMedio(linea.medio)}</span>
      <Money monto={linea.monto} className="font-medium" />
      {linea.medio === "transferencia" && linea.titularTransferencia ? (
        <span className="text-muted-foreground">de {linea.titularTransferencia}</span>
      ) : null}
      {linea.cheque ? (
        <span className="text-muted-foreground">
          N° {linea.cheque.numero}
          {linea.cheque.entregadoEnCobro && linea.cheque.proveedor
            ? ` · entregado a ${linea.cheque.proveedor}`
            : ` · se cobra desde ${formatFecha(linea.cheque.fechaCobro)}`}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Los cobros de la caja, uno por recibo (un cobro mixto es UN recibo con varias
 * líneas). Anular es por recibo completo y solo cuando el rol y el estado lo permiten.
 */
export function CobrosDia({
  recibos,
  puedeAnular,
  porteria,
  esHoy,
}: {
  recibos: ReciboDia[];
  puedeAnular: boolean;
  porteria: boolean;
  esHoy: boolean;
}) {
  const vigentes = recibos.filter((r) => !r.anulado);
  const total = vigentes.reduce((acc, r) => acc + r.total, 0);
  const porMedio = { efectivo: 0, transferencia: 0, cheque: 0 } as Record<string, number>;
  for (const r of recibos) {
    for (const l of r.lineas) if (!l.anulado) porMedio[l.medio] = (porMedio[l.medio] ?? 0) + l.monto;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
        <CardTitle className="text-lg">{porteria ? "Cobros a quinteros y ambulantes" : "Cobros del día"}</CardTitle>
        {recibos.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {vigentes.length} {vigentes.length === 1 ? "recibo" : "recibos"} ·{" "}
            <Money monto={total} className="font-semibold text-foreground" />
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {recibos.length === 0 ? (
          <EmptyState
            icono={HandCoins}
            titulo={esHoy ? "Todavía no hay cobros hoy" : "Ese día no hubo cobros en esta caja"}
            descripcion={
              esHoy
                ? porteria
                  ? "Lo que cobres a quinteros y ambulantes desde Cobrar aparece acá."
                  : "Los cobros que registres desde Cobrar van a aparecer acá."
                : undefined
            }
            className="py-10"
          />
        ) : (
          <>
            <ul className="divide-y">
              {recibos.map((r) => {
                const medios = r.lineas.map((l) => labelMedio(l.medio).toLowerCase()).join(" + ");
                return (
                  <li key={r.loteId} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
                    <span className="w-12 shrink-0 pt-0.5 text-sm text-muted-foreground tabular">
                      {formatSoloHora(r.fecha)}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn("font-semibold", r.anulado && "text-muted-foreground line-through")}>
                          {r.cliente?.nombre ?? "—"}
                        </span>
                        {r.cliente ? (
                          <span className="text-sm text-muted-foreground">Carpeta {r.cliente.codigo}</span>
                        ) : null}
                        {r.cliente?.categoria && r.cliente.categoria !== "puestero" ? (
                          <Sello estado={r.cliente.categoria} />
                        ) : null}
                        {r.anulado ? <Sello estado="anulado" /> : null}
                      </div>
                      <ul className="space-y-0.5 text-sm">
                        {r.lineas.map((l) => (
                          <Linea key={l.pagoId} linea={l} />
                        ))}
                      </ul>
                      {r.anulado || r.lineas.some((l) => l.anulado) ? (
                        <p className="text-xs text-muted-foreground">
                          {r.anulado ? "Anulado" : "Una línea se anuló"}
                          {r.motivoAnulacion ? `: ${r.motivoAnulacion}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:items-end sm:gap-0.5">
                      <Money
                        monto={r.anulado ? r.totalOriginal : r.total}
                        className={cn("text-lg font-bold", r.anulado && "text-muted-foreground line-through")}
                      />
                      <span className="text-xs text-muted-foreground tabular">Recibo N° {r.numero}</span>
                    </div>
                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                      <Link
                        href={`/recibos/${r.pagoId}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-muted"
                      >
                        <ReceiptText className="size-4" strokeWidth={2} />
                        Ver recibo
                      </Link>
                      {puedeAnular && !r.anulado ? (
                        <BotonAnularCobro
                          pagoId={r.pagoId}
                          numero={r.numero}
                          cliente={r.cliente?.nombre ?? "el cliente"}
                          total={r.total}
                          medios={medios}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>
                Efectivo <Money monto={porMedio.efectivo} className="font-semibold text-foreground" />
              </span>
              <span>
                Transferencia <Money monto={porMedio.transferencia} className="font-semibold text-foreground" />
              </span>
              {!porteria || porMedio.cheque > 0 ? (
                <span>
                  Cheques <Money monto={porMedio.cheque} className="font-semibold text-foreground" />
                </span>
              ) : null}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
