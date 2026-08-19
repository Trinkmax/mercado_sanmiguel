import Link from "next/link";
import { HandCoins, LockOpen } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonIntegrarRendicion } from "@/components/caja/integrar-rendicion";
import { BotonReabrirCaja } from "@/components/caja/reabrir-caja";
import { BotonRechazarReapertura } from "@/components/caja/rechazar-reapertura";
import type { BandejaAdmin } from "@/components/caja/datos";

const LABEL_TIPO = {
  administracion: "Caja de administración",
  guardia: "Caja de portería",
} as const;

/**
 * Lo que administración tiene que resolver antes de su propia caja:
 * rendiciones de portería para integrar y pedidos de reapertura.
 * Si no hay nada pendiente, no ocupa lugar.
 */
export function BandejaAdministracion({
  bandeja,
  rol,
}: {
  bandeja: BandejaAdmin;
  rol: Rol;
}) {
  const { rendiciones, pedidos } = bandeja;
  if (rendiciones.length === 0 && pedidos.length === 0) return null;

  return (
    <div className="space-y-6">
      {rendiciones.length > 0 ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HandCoins className="size-5 text-primary" strokeWidth={2} />
              Rendiciones de portería
            </CardTitle>
            <CardDescription>
              Portería ya cerró su caja. Recibí la plata y dejala en la caja mayor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rendiciones.map((r) => {
                const conPedido = Boolean(r.reapertura_solicitada_en);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-[15rem] flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/caja?fecha=${r.fecha}`}
                          className="font-display text-lg font-bold tracking-tight text-primary underline-offset-4 hover:underline"
                        >
                          {formatFecha(r.fecha)}
                        </Link>
                        <Sello estado="cerrada" />
                        {conPedido ? <Sello estado="reapertura_pedida" /> : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Rendida
                        {r.cerrada_en ? ` el ${formatFechaHora(r.cerrada_en)}` : ""}
                        {r.cerradaPorNombre ? ` por ${r.cerradaPorNombre}` : ""}
                        {r.total_canon > 0 ? (
                          <>
                            {" "}
                            · incluye{" "}
                            <Money monto={r.total_canon} className="font-medium text-foreground" />{" "}
                            de canon
                          </>
                        ) : null}
                      </p>
                      {conPedido ? (
                        <p className="text-sm text-parcial">
                          Pidió la reapertura
                          {r.reapertura_motivo ? `: «${r.reapertura_motivo}»` : ""}.
                          Resolvé el pedido antes de integrarla.
                        </p>
                      ) : null}
                    </div>
                    <dl className="flex shrink-0 gap-6">
                      <div>
                        <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                          Efectivo
                        </dt>
                        <dd>
                          <Money monto={r.total_efectivo} className="text-2xl font-bold" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                          Transferencias
                        </dt>
                        <dd>
                          <Money monto={r.total_transferencia} className="text-lg font-semibold" />
                        </dd>
                      </div>
                    </dl>
                    {!conPedido ? (
                      <BotonIntegrarRendicion
                        cajaId={r.id}
                        fecha={r.fecha}
                        efectivo={r.total_efectivo}
                        transferencia={r.total_transferencia}
                        canon={r.total_canon}
                        cheques={r.total_cheques}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {pedidos.length > 0 ? (
        <Card className="border-parcial/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LockOpen className="size-5 text-parcial" strokeWidth={2} />
              Pedidos de reapertura
            </CardTitle>
            <CardDescription>
              Una caja ya cerrada necesita corregirse. Autorizala o rechazá el pedido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pedidos.map((p) => {
                const integrada = p.estado === "integrada";
                const soloTesoreria = integrada && rol !== "tesoreria";
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-[15rem] flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/caja?fecha=${p.fecha}`}
                          className="font-display text-lg font-bold tracking-tight text-primary underline-offset-4 hover:underline"
                        >
                          {LABEL_TIPO[p.tipo]} — {formatFecha(p.fecha)}
                        </Link>
                        <Sello estado={p.estado} />
                      </div>
                      <p className="text-base">
                        «{p.motivo ?? "Sin motivo"}»
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pedido el {formatFechaHora(p.solicitada_en)}
                        {p.solicitadaPorNombre ? ` por ${p.solicitadaPorNombre}` : ""}
                        {soloTesoreria
                          ? " · Ya entró en la caja mayor: solo tesorería puede reabrirla."
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <BotonRechazarReapertura
                        cajaId={p.id}
                        descripcion={`${LABEL_TIPO[p.tipo]} del ${formatFecha(p.fecha)}: la caja sigue cerrada y el pedido se archiva.`}
                      />
                      {!soloTesoreria ? (
                        <BotonReabrirCaja
                          cajaId={p.id}
                          etiqueta="Autorizar y reabrir"
                          descripcion={`${LABEL_TIPO[p.tipo]} del ${formatFecha(p.fecha)} vuelve a quedar abierta para que corrijan lo que haga falta. Después la cierran de nuevo.`}
                          motivoObligatorio={false}
                          variant="default"
                          className="h-12 px-5 text-base font-semibold"
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
