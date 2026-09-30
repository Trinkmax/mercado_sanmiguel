import { TriangleAlert } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { formatARS, formatFecha, formatFechaHora } from "@/lib/format";
import { Money } from "@/components/shared/money";
import { Sello } from "@/components/shared/sello";
import { CuentaCajon } from "@/components/caja/cuenta-cajon";
import { BotonPedirReapertura } from "@/components/caja/pedir-reapertura";
import { BotonReabrirCaja } from "@/components/caja/reabrir-caja";
import { LABEL_EVENTO } from "@/components/caja/historial-caja";
import type { Arqueo } from "@/components/caja/arqueo-tipos";
import type { Caja, DatosCaja, EventoCaja } from "@/components/caja/datos";
import type { PermisosCaja } from "@/components/caja/permisos";
import { montosSinCortar } from "@/components/caja/texto";

/** Eventos que cambian la plata de una caja ya cerrada. */
const TIPOS_CAMBIO = new Set([
  "gasto_imputado",
  "gasto_revertido",
  "ajuste",
  "ajuste_borrado",
  "canon_anulado",
  "cobro_anulado",
  "arqueo_recalculado",
]);

/** "Efectivo: $ 1.000.000 → $ 950.000 · Banco: …" → ["$ 1.000.000", "$ 950.000"]. */
function tramoEfectivo(detalle: string | null): [string, string] | null {
  const m = /Efectivo: (.+?) → (.+?)(?: · |$)/.exec(detalle ?? "");
  return m ? [m[1], m[2]] : null;
}

/**
 * Banner ámbar cuando algo tocó la plata después del cierre (un gasto imputado a un
 * día anterior, un ajuste, un canon o un recibo anulado): qué pasó, quién, cuándo y
 * cómo quedó el efectivo. Así nadie desconfía de un número que cambió.
 */
function CambiosDespuesDelCierre({ caja, eventos }: { caja: Caja; eventos: EventoCaja[] }) {
  if (!caja.cerrada_en) return null;
  const cierre = new Date(caja.cerrada_en).getTime();
  const posteriores = eventos.filter(
    (e) => TIPOS_CAMBIO.has(e.tipo) && new Date(e.creado_en).getTime() > cierre
  );
  if (posteriores.length === 0) return null;

  const hechos = posteriores.filter((e) => e.tipo !== "arqueo_recalculado");
  const tramos = posteriores
    .filter((e) => e.tipo === "arqueo_recalculado")
    .map((e) => tramoEfectivo(e.detalle))
    .filter((t): t is [string, string] => t !== null);
  const efectivo = tramos.length > 0 ? { antes: tramos[0][0], ahora: tramos[tramos.length - 1][1] } : null;

  return (
    <div role="status" className="space-y-2 rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-5 shrink-0 text-parcial" strokeWidth={2} />
        El arqueo cambió después del cierre
      </p>
      <ul className="space-y-1 pl-7">
        {hechos.map((e) => (
          <li key={e.id}>
            <span className="font-medium">{LABEL_EVENTO[e.tipo] ?? e.tipo}</span>
            {e.detalle ? `: ${montosSinCortar(e.detalle)}` : ""}{" "}
            <span className="text-muted-foreground">
              ({[e.usuario, formatFechaHora(e.creado_en)].filter(Boolean).join(", ")})
            </span>
          </li>
        ))}
      </ul>
      {efectivo ? (
        <p className="pl-7 text-base">
          Efectivo: <span className="tabular text-muted-foreground line-through">{efectivo.antes}</span> →{" "}
          <span className="tabular font-bold">{efectivo.ahora}</span>
        </p>
      ) : null}
    </div>
  );
}

function AvisoReapertura({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-parcial bg-parcial-suave px-4 py-3 text-sm">
      <p>{texto}</p>
    </div>
  );
}

/**
 * El arqueo de una caja cerrada (o integrada / validada) como una cuenta de cajón:
 * Juntaste − Gastos ± Ajustes = Tenés que tener. El pie cambia según quién mira y en
 * qué estado está la caja. Marco de etiqueta porque es la superficie protagonista.
 */
export function ArqueoCaja({
  caja,
  arqueo,
  rol,
  nombres,
  eventos,
  permisos,
}: {
  caja: Caja;
  arqueo: Arqueo;
  rol: Rol;
  nombres: DatosCaja["nombres"];
  eventos: EventoCaja[];
  permisos: PermisosCaja;
}) {
  const porteria = caja.tipo === "guardia";
  const jefeRinde = rol === "guardia" && porteria;
  const pedido = caja.reapertura_solicitada_en
    ? `${caja.reapertura_motivo ? ` — «${caja.reapertura_motivo}»` : ""}`
    : null;
  const titulo = porteria ? (jefeRinde ? "Rendición" : "Caja de portería") : "Arqueo";

  return (
    <section aria-label="Arqueo de la caja" className="etiqueta" data-tour="caja-arqueo">
      <div className="etiqueta-interior space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {titulo} — {formatFecha(caja.fecha)}
            </h2>
            {caja.cerrada_en ? (
              <p className="text-sm text-muted-foreground">
                {porteria ? "Rendida" : "Cerrada"} el {formatFechaHora(caja.cerrada_en)}
                {nombres.cerrada ? ` por ${nombres.cerrada}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
            <Sello grande estado={caja.estado} />
          </div>
        </div>

        {jefeRinde && caja.estado === "cerrada" ? (
          <div className="rounded-lg bg-muted/60 px-4 py-3">
            <p className="text-lg">
              Entregá en Administración{" "}
              <Money monto={arqueo.efectivo} className="text-3xl font-bold" /> en efectivo.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quintas {formatARS(arqueo.quintas)} · Ambulantes {formatARS(arqueo.ambulantes)} · Bono
              camioneros {formatARS(arqueo.canon)}
              {arqueo.transferencia > 0.009
                ? ` (+${formatARS(arqueo.transferencia)} ya están en el banco)`
                : ""}
            </p>
          </div>
        ) : null}

        <CambiosDespuesDelCierre caja={caja} eventos={eventos} />

        <CuentaCajon arqueo={arqueo} tipo={caja.tipo} />

        <div className="space-y-3 border-t pt-4">
          {caja.estado === "validada" ? (
            <p className="text-sm text-muted-foreground">
              Validada por {nombres.validada ?? "Tesorería"} el {formatFechaHora(caja.validada_en)}
              {caja.observaciones ? ` · ${caja.observaciones}` : ""}. El cierre es definitivo.
            </p>
          ) : caja.estado === "integrada" ? (
            <>
              <p className="font-medium">
                Ya entró en la caja mayor: Administración la recibió el {formatFechaHora(caja.integrada_en)}
                {nombres.integrada ? ` (${nombres.integrada})` : ""}.
              </p>
              <p className="text-sm text-muted-foreground">Tesorería la valida junto con la caja de administración.</p>
              {pedido !== null ? (
                <AvisoReapertura
                  texto={`${jefeRinde ? "Pediste" : `${nombres.reapertura ?? "El Jefe de Portería"} pidió`} la reapertura el ${formatFechaHora(caja.reapertura_solicitada_en)}${pedido}. Como ya está en la caja mayor, la resuelve Tesorería.`}
                />
              ) : permisos.pedirReapertura ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Hubo un error en los cobros? Pedí la reapertura: como ya está en la caja mayor, la autoriza
                    Tesorería.
                  </p>
                  <BotonPedirReapertura cajaId={caja.id} destino="tesorería" />
                </div>
              ) : null}
              {permisos.reabrir ? (
                <BotonReabrirCaja
                  data-tour="caja-reabrir"
                  cajaId={caja.id}
                  descripcion="La caja de portería vuelve a quedar abierta y se desengancha de la caja mayor. Queda registrado en la bitácora."
                  motivoObligatorio={pedido === null}
                />
              ) : null}
            </>
          ) : porteria ? (
            <>
              <p className="font-medium">
                {jefeRinde
                  ? "Contá el efectivo y llevalo a Administración. Cuando lo reciban, entra en la caja mayor."
                  : "Rendida por el Jefe de Portería: falta que Administración la reciba en la caja mayor."}
              </p>
              {pedido !== null ? (
                <AvisoReapertura
                  texto={`${jefeRinde ? "Pediste" : `${nombres.reapertura ?? "El Jefe de Portería"} pidió`} la reapertura el ${formatFechaHora(caja.reapertura_solicitada_en)}${pedido}.${jefeRinde ? " Esperá que Administración la autorice." : ""}`}
                />
              ) : permisos.pedirReapertura ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Hubo un error en los cobros? Pedí la reapertura a Administración.
                  </p>
                  <BotonPedirReapertura cajaId={caja.id} />
                </div>
              ) : null}
              {permisos.reabrir ? (
                <BotonReabrirCaja
                  data-tour="caja-reabrir"
                  cajaId={caja.id}
                  descripcion="La caja de portería vuelve a quedar abierta para corregir cobros. Después la rinden de nuevo. Queda registrado en la bitácora."
                  motivoObligatorio={pedido === null}
                />
              ) : null}
            </>
          ) : (
            <>
              <p className="font-medium">
                {rol === "admin"
                  ? "Contá la plata y verificá que coincida con la cuenta. Después Tesorería la controla y la valida."
                  : "Cerrada. Contá la plata y validala: si no coincide, el faltante o sobrante queda anotado."}
              </p>
              {pedido !== null ? (
                <AvisoReapertura
                  texto={`${nombres.reapertura ?? "Administración"} pidió la reapertura el ${formatFechaHora(caja.reapertura_solicitada_en)}${pedido}.`}
                />
              ) : null}
              {permisos.reabrir ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Faltó cargar algo? Reabrila mientras Tesorería no la valide.
                  </p>
                  <BotonReabrirCaja
                    data-tour="caja-reabrir"
                    cajaId={caja.id}
                    descripcion="La caja vuelve a quedar abierta para corregir cobros o gastos. Después la cerrás de nuevo. Queda registrado en la bitácora."
                    motivoObligatorio={pedido === null}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
