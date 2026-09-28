import Link from "next/link";
import { LockOpen } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sello } from "@/components/shared/sello";
import { BotonReabrirCaja } from "@/components/caja/reabrir-caja";
import { BotonRechazarReapertura } from "@/components/caja/rechazar-reapertura";
import { RendicionesPorRecibir } from "@/components/caja/rendiciones-por-recibir";
import type { BandejaAdmin } from "@/components/caja/datos";

const LABEL_TIPO = {
  administracion: "Caja de administración",
  guardia: "Caja de portería",
} as const;

/**
 * Lo que Administración (y Tesorería o el Líder) tiene que resolver antes de su
 * propia caja: cajas de portería para recibir y pedidos de reapertura.
 * La lista de cajas para recibir se monta siempre (aunque esté vacía) para que el
 * éxito de la recepción siga en pantalla después de recargar.
 */
export function BandejaAdministracion({ bandeja, rol }: { bandeja: BandejaAdmin; rol: Rol }) {
  const { rendiciones, pedidos } = bandeja;
  const reabreIntegradas = rol === "tesoreria" || rol === "lider";

  return (
    <div className="space-y-6 empty:hidden">
      <RendicionesPorRecibir
        detalleEnImprimible={!reabreIntegradas}
        rendiciones={rendiciones.map((r) => ({
          cajaId: r.id,
          fecha: r.fecha,
          efectivo: r.total_efectivo,
          transferencia: r.total_transferencia,
          quintas: r.total_quintas,
          ambulantes: r.total_ambulantes,
          canon: r.total_canon,
          ajustes: r.total_ajustes,
          cerradaEn: r.cerrada_en,
          cerradaPorNombre: r.cerradaPorNombre,
          reaperturaSolicitada: Boolean(r.reapertura_solicitada_en),
          reaperturaMotivo: r.reapertura_motivo,
        }))}
      />

      {pedidos.length > 0 ? (
        <Card className="border-parcial/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LockOpen className="size-5 text-parcial" strokeWidth={2} />
              Pedidos de reapertura
            </CardTitle>
            <CardDescription>Una caja ya cerrada necesita corregirse. Autorizala o rechazá el pedido.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pedidos.map((p) => {
                const soloTesoreria = p.estado === "integrada" && !reabreIntegradas;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-[14rem] flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={
                            p.tipo === "guardia" && !reabreIntegradas
                              ? `/cierre-caja/${p.id}?ver=1`
                              : `/caja?fecha=${p.fecha}&tipo=${p.tipo}`
                          }
                          className="font-display text-lg font-bold tracking-tight text-primary underline-offset-4 hover:underline"
                        >
                          {LABEL_TIPO[p.tipo]} — {formatFecha(p.fecha)}
                        </Link>
                        <Sello estado={p.estado} />
                      </div>
                      <p className="text-base">«{p.motivo ?? "Sin motivo"}»</p>
                      <p className="text-sm text-muted-foreground">
                        Pedido el {formatFechaHora(p.solicitada_en)}
                        {p.solicitadaPorNombre ? ` por ${p.solicitadaPorNombre}` : ""}
                        {soloTesoreria ? " · Ya entró en la caja mayor: solo Tesorería puede reabrirla." : ""}
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
