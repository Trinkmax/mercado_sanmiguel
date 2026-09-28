"use client";

import { useState } from "react";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import {
  BotonIntegrarRendicion,
  DesglosePorteria,
  ExitoRecepcion,
  type Recibida,
  type RendicionARecibir,
} from "@/components/caja/integrar-rendicion";

export type FilaRendicion = RendicionARecibir & {
  cerradaEn: string | null;
  cerradaPorNombre: string | null;
  reaperturaSolicitada: boolean;
  reaperturaMotivo: string | null;
};

/**
 * Cajas de portería rendidas que esperan entrar en la caja mayor. Cliente porque el
 * éxito ("Imprimir comprobante de recepción") tiene que seguir en pantalla aunque la
 * fila ya no esté (la página se recarga sola al integrar).
 */
export function RendicionesPorRecibir({
  rendiciones,
  detalleEnImprimible = false,
}: {
  rendiciones: FilaRendicion[];
  /** Administración no tiene la pestaña de portería en /caja: el detalle se abre en el imprimible. */
  detalleEnImprimible?: boolean;
}) {
  const [recibida, setRecibida] = useState<Recibida | null>(null);

  return (
    <>
      {rendiciones.length > 0 ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HandCoins className="size-5 text-primary" strokeWidth={2} />
              Cajas de portería para recibir
            </CardTitle>
            <CardDescription>
              El Jefe de Portería ya rindió. Contá el efectivo que te entrega y dejalo en la caja mayor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rendiciones.map((r) => (
                <li key={r.cajaId} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-[14rem] flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={detalleEnImprimible ? `/cierre-caja/${r.cajaId}?ver=1` : `/caja?fecha=${r.fecha}&tipo=guardia`}
                        className="font-display text-lg font-bold tracking-tight text-primary underline-offset-4 hover:underline"
                      >
                        Caja de portería del {formatFecha(r.fecha)}
                      </Link>
                      <Sello estado="cerrada" texto="Rendida" />
                      {r.reaperturaSolicitada ? <Sello estado="reapertura_pedida" /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <DesglosePorteria quintas={r.quintas} ambulantes={r.ambulantes} canon={r.canon} ajustes={r.ajustes} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rendida{r.cerradaEn ? ` el ${formatFechaHora(r.cerradaEn)}` : ""}
                      {r.cerradaPorNombre ? ` por ${r.cerradaPorNombre}` : ""}
                    </p>
                    {r.reaperturaSolicitada ? (
                      <p className="text-sm text-parcial">
                        Pidió la reapertura{r.reaperturaMotivo ? `: «${r.reaperturaMotivo}»` : ""}. Resolvé el pedido antes
                        de recibirla.
                      </p>
                    ) : null}
                  </div>
                  <dl className="flex shrink-0 gap-6">
                    <div>
                      <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">En mano</dt>
                      <dd>
                        <Money monto={r.efectivo} className="text-2xl font-bold" />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Por transferencia
                      </dt>
                      <dd>
                        <Money monto={r.transferencia} className="text-lg font-semibold" />
                      </dd>
                    </div>
                  </dl>
                  {!r.reaperturaSolicitada ? (
                    <BotonIntegrarRendicion rendicion={r} onRecibida={setRecibida} />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <ExitoRecepcion recibida={recibida} onCerrar={() => setRecibida(null)} />
    </>
  );
}
