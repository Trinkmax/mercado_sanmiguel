import type { Rol } from "@/lib/auth";
import { formatFecha, formatFechaHora } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { BotonPedirReapertura } from "@/components/caja/pedir-reapertura";
import { BotonReabrirCaja } from "@/components/caja/reabrir-caja";
import type { Caja, TotalesCaja } from "@/components/caja/datos";

/**
 * El arqueo automático: lo que reemplaza la suma a mano al final del día.
 * Marco de etiqueta de cajón porque es la superficie protagonista.
 * El pie cambia según quién mira: el Jefe de Portería rinde a administración;
 * administración cuenta y espera a tesorería; tesorería valida desde su módulo.
 */
export function ArqueoCaja({
  caja,
  totales,
  rol,
  validadaPorNombre,
  cerradaPorNombre,
  reaperturaPorNombre,
}: {
  caja: Caja;
  totales: TotalesCaja;
  rol: Rol;
  validadaPorNombre: string | null;
  cerradaPorNombre: string | null;
  reaperturaPorNombre: string | null;
}) {
  const esPorteria = caja.tipo === "guardia";
  const duenaPorteria = rol === "guardia" && esPorteria;
  const duenaAdmin = rol === "admin" && caja.tipo === "administracion";
  const pideReapertura = Boolean(caja.reapertura_solicitada_en);

  return (
    <div className="etiqueta">
      <div className="etiqueta-interior space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {duenaPorteria ? "Rendición" : "Arqueo"} — {formatFecha(caja.fecha)}
          </h2>
          <div className="flex items-center gap-2">
            {pideReapertura ? <Sello estado="reapertura_pedida" /> : null}
            <Sello grande estado={caja.estado} />
          </div>
        </div>

        <div>
          {duenaPorteria ? (
            <p className="text-lg font-medium">
              Rendí esta caja a administración: entregá{" "}
              <Money monto={totales.efectivo} className="text-2xl font-bold" /> en
              efectivo.
            </p>
          ) : (
            <p className="text-lg font-medium">Tenés que tener:</p>
          )}
          <div className="mt-3 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Efectivo
              </p>
              <Money
                monto={totales.efectivo}
                className="mt-1 block text-3xl font-bold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Transferencias
              </p>
              <Money
                monto={totales.transferencia}
                className="mt-1 block text-2xl font-semibold"
              />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Cheques
              </p>
              <Money
                monto={totales.cheques}
                className="mt-1 block text-2xl font-semibold"
              />
            </div>
          </div>
        </div>

        {totales.canon > 0 ||
        totales.gastos > 0 ||
        totales.rendidoEfectivo > 0 ||
        totales.rendidoTransferencia > 0 ? (
          <div className="space-y-1 border-t border-dashed pt-4 text-sm text-muted-foreground">
            {totales.canon > 0 ? (
              <p>
                Incluye <Money monto={totales.canon} className="font-medium text-foreground" /> de
                canon del día (camiones, ambulantes, quinteros).
              </p>
            ) : null}
            {totales.rendidoEfectivo > 0 || totales.rendidoTransferencia > 0 ? (
              <p>
                Incluye{" "}
                <Money
                  monto={totales.rendidoEfectivo}
                  className="font-medium text-foreground"
                />{" "}
                en efectivo
                {totales.rendidoTransferencia > 0 ? (
                  <>
                    {" "}
                    y{" "}
                    <Money
                      monto={totales.rendidoTransferencia}
                      className="font-medium text-foreground"
                    />{" "}
                    en transferencias
                  </>
                ) : null}{" "}
                rendidos por portería.
              </p>
            ) : null}
            {totales.gastos > 0 ? (
              <p>
                Ya se restaron{" "}
                <Money monto={totales.gastos} className="font-medium text-foreground" /> de gastos
                pagados en efectivo desde esta caja.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3 border-t pt-4">
          {caja.estado === "validada" ? (
            <p className="text-sm text-muted-foreground">
              Validada por {validadaPorNombre ?? "tesorería"} el{" "}
              {formatFechaHora(caja.validada_en)}
            </p>
          ) : caja.estado === "integrada" ? (
            <>
              <p className="font-medium">
                Ya entró en la caja mayor: administración la recibió el{" "}
                {formatFechaHora(caja.integrada_en)}
              </p>
              <p className="text-sm text-muted-foreground">
                Tesorería la valida junto con la caja de administración.
              </p>
              {pideReapertura ? (
                <div className="rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
                  <p>
                    {duenaPorteria
                      ? "Pediste"
                      : `${reaperturaPorNombre ?? "Portería"} pidió`}{" "}
                    la reapertura el {formatFechaHora(caja.reapertura_solicitada_en)}
                    {caja.reapertura_motivo ? ` — «${caja.reapertura_motivo}»` : ""}.
                    Como ya está en la caja mayor, la resuelve tesorería.
                  </p>
                </div>
              ) : duenaPorteria ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Hubo un error en los cobros? Pedí la reapertura: como ya
                    está en la caja mayor, la autoriza tesorería.
                  </p>
                  <BotonPedirReapertura cajaId={caja.id} destino="tesorería" />
                </div>
              ) : null}
              {rol === "tesoreria" ? (
                <BotonReabrirCaja
                  cajaId={caja.id}
                  descripcion="La rendición vuelve a quedar abierta y se desengancha de la caja mayor. Queda registrado en la bitácora."
                  motivoObligatorio={!pideReapertura}
                />
              ) : null}
            </>
          ) : duenaPorteria ? (
            <>
              <p className="font-medium">
                Contá el efectivo y llevalo a administración. Cuando lo reciban,
                entra en la caja mayor.
              </p>
              {caja.cerrada_en ? (
                <p className="text-sm text-muted-foreground">
                  Rendida el {formatFechaHora(caja.cerrada_en)}
                </p>
              ) : null}
              {pideReapertura ? (
                <div className="rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
                  <p>
                    Pediste la reapertura el{" "}
                    {formatFechaHora(caja.reapertura_solicitada_en)}
                    {caja.reapertura_motivo ? ` — «${caja.reapertura_motivo}»` : ""}
                    . Esperá que administración la autorice.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Hubo un error en los cobros? Pedí la reapertura a
                    administración.
                  </p>
                  <BotonPedirReapertura cajaId={caja.id} />
                </div>
              )}
            </>
          ) : duenaAdmin ? (
            <>
              <p className="font-medium">
                Contá la plata y verificá que coincida. Mañana tesorería la
                controla y valida.
              </p>
              {caja.cerrada_en ? (
                <p className="text-sm text-muted-foreground">
                  Cerrada el {formatFechaHora(caja.cerrada_en)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  ¿Te olvidaste de cargar algo? Reabrila mientras tesorería no
                  la valide.
                </p>
                <BotonReabrirCaja
                  cajaId={caja.id}
                  descripcion="La caja vuelve a quedar abierta para corregir cobros o gastos. Después la cerrás de nuevo. Queda registrado en la bitácora."
                />
              </div>
            </>
          ) : (
            <>
              <p className="font-medium">
                {esPorteria
                  ? "Rendida por portería: administración la recibe e integra en la caja mayor."
                  : "Cerrada. Pendiente de validación de tesorería."}
              </p>
              {caja.cerrada_en ? (
                <p className="text-sm text-muted-foreground">
                  Cerrada el {formatFechaHora(caja.cerrada_en)}
                  {cerradaPorNombre ? ` por ${cerradaPorNombre}` : ""}
                </p>
              ) : null}
              {pideReapertura ? (
                <div className="rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
                  <p>
                    {reaperturaPorNombre ?? "El dueño de la caja"} pidió la
                    reapertura el {formatFechaHora(caja.reapertura_solicitada_en)}
                    {caja.reapertura_motivo ? ` — «${caja.reapertura_motivo}»` : ""}
                  </p>
                </div>
              ) : null}
              {rol === "tesoreria" ? (
                <BotonReabrirCaja
                  cajaId={caja.id}
                  descripcion="La caja vuelve a quedar abierta para corregir movimientos. Queda registrado en la bitácora."
                  motivoObligatorio={!pideReapertura}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
