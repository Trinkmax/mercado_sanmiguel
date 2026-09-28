import Link from "next/link";
import { ArrowUpRight, ReceiptText } from "lucide-react";
import { formatARS, formatFechaHora } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { EmptyState } from "@/components/shared/empty-state";
import { LABEL_MEDIO } from "@/components/clientes/constantes";

export type PagoFicha = {
  id: string;
  numero: number;
  lote_id: string;
  linea: number;
  fecha: string;
  medio: string;
  monto: number;
  recibido_por: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  titular_transferencia: string | null;
  imputado: number;
};

/**
 * "Pagos recibidos" de la ficha: una fila por RECIBO (lote), con sus medios apilados
 * ("Efectivo $100.000 + Transferencia de Juan Pérez $100.000"), el total y "Ver recibo".
 * La ruta /recibos/{pagoId} acepta cualquier línea del lote (M1).
 */
export function PagosRecibidos({
  pagos,
  nombreUsuario,
}: {
  pagos: PagoFicha[];
  nombreUsuario: (userId: string | null) => string;
}) {
  // Los pagos vienen del más nuevo al más viejo: el orden de los lotes se conserva.
  const lotes = new Map<string, PagoFicha[]>();
  for (const p of pagos) {
    const lista = lotes.get(p.lote_id) ?? [];
    lista.push(p);
    lotes.set(p.lote_id, lista);
  }
  const recibos = [...lotes.values()].map((lineas) => {
    const ordenadas = [...lineas].sort((a, b) => a.linea - b.linea);
    const vigentes = ordenadas.filter((l) => !l.anulado);
    const total = vigentes.reduce((acc, l) => acc + Number(l.monto), 0);
    const sobrante = vigentes.reduce((acc, l) => acc + (Number(l.monto) - l.imputado), 0);
    return {
      primera: ordenadas[0],
      lineas: ordenadas,
      total: vigentes.length > 0 ? total : ordenadas.reduce((a, l) => a + Number(l.monto), 0),
      anulado: vigentes.length === 0,
      algunaAnulada: vigentes.length > 0 && vigentes.length < ordenadas.length,
      sobrante: Math.round(sobrante * 100) / 100,
    };
  });

  return (
    <Card className="text-base">
      <CardHeader>
        <CardTitle className="text-lg">Pagos recibidos</CardTitle>
      </CardHeader>
      <CardContent>
        {recibos.length === 0 ? (
          <EmptyState
            icono={ReceiptText}
            titulo="Todavía no pagó nada"
            descripcion="Cuando le cobren, cada recibo aparece acá con cómo pagó."
          />
        ) : (
          <div className="divide-y">
            {recibos.map((r) => (
              <div key={r.primera.lote_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className={cn("font-medium", r.anulado && "text-muted-foreground line-through")}>
                    Recibo N° {r.primera.numero}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.lineas.map((l, i) => (
                      <span key={l.id} className={cn(l.anulado && "line-through")}>
                        {i > 0 ? " + " : ""}
                        {l.medio === "transferencia" && l.titular_transferencia
                          ? `Transferencia de ${l.titular_transferencia}`
                          : (LABEL_MEDIO[l.medio] ?? l.medio)}
                        {r.lineas.length > 1 ? ` ${formatARS(l.monto)}` : ""}
                      </span>
                    ))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFechaHora(r.primera.fecha)} · Cobró {nombreUsuario(r.primera.recibido_por)}
                  </p>
                  {r.anulado ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Sello estado="anulado" />
                      {r.primera.motivo_anulacion ?? ""}
                    </p>
                  ) : r.sobrante > 0.009 ? (
                    <p className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                      <Sello estado="saldo_favor" />
                      <Money monto={r.sobrante} className="font-semibold text-pagado" />
                      <span className="text-muted-foreground">quedó a favor</span>
                    </p>
                  ) : r.algunaAnulada ? (
                    <p className="text-sm text-muted-foreground">Una parte del recibo se anuló.</p>
                  ) : null}
                </div>
                <Money
                  monto={r.total}
                  className={cn("text-lg font-semibold", r.anulado && "text-muted-foreground line-through")}
                />
                <Link
                  href={`/recibos/${r.primera.id}`}
                  className="flex min-h-11 items-center gap-0.5 px-2 text-sm font-medium text-primary hover:underline"
                >
                  Ver recibo
                  <ArrowUpRight className="size-4" strokeWidth={2} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
