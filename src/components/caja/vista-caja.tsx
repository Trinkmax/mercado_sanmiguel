import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarX2, Stamp, TriangleAlert, Truck } from "lucide-react";
import { CajaRegistradora } from "@/components/shared/iconos";
import type { Rol } from "@/lib/auth";
import { formatFecha, hoyISO } from "@/lib/format";
import { diaAnteriorValido } from "@/lib/dia-caja";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CanonDelDia } from "@/components/porteria/canon-del-dia";
import { ValidarCajaDialog } from "@/components/tesoreria/validar-caja-dialog";
import { BotonAbrirCaja } from "@/components/caja/abrir-caja";
import { ArqueoCaja } from "@/components/caja/arqueo";
import { AjustesCaja } from "@/components/caja/ajustes-caja";
import { BandaTotales } from "@/components/caja/banda-totales";
import { BotonCerrarCaja } from "@/components/caja/cerrar-caja";
import { BotonImprimirCaja } from "@/components/caja/boton-imprimir-caja";
import { CobrosDia } from "@/components/caja/cobros-dia";
import { GastosCaja } from "@/components/caja/gastos-caja";
import { HistorialCaja } from "@/components/caja/historial-caja";
import { RecibirCajaPorteria } from "@/components/caja/integrar-rendicion";
import { UltimosDias } from "@/components/caja/ultimos-dias";
import { permisosCaja } from "@/components/caja/permisos";
import type { DatosCaja } from "@/components/caja/datos";

export const TITULO_TIPO = {
  administracion: "Caja de administración",
  guardia: "Caja de portería",
} as const;

/**
 * La caja completa de un tipo: lo juntado (o el arqueo), la acción del momento
 * (cerrar / recibir / contar y validar), cobros, bono camioneros, gastos, ajustes,
 * historial y últimos días. `conEncabezado` = vista en pestañas (Tesorería y Líder).
 *
 * Las acciones con estado de éxito (cerrar, recibir) se montan siempre que el rol
 * puede usarlas, con `key` estable: así el éxito sobrevive a la recarga de la página.
 */
export function VistaCaja({
  datos,
  rol,
  miUserId,
  conEncabezado = false,
}: {
  datos: DatosCaja;
  rol: Rol;
  miUserId: string;
  conEncabezado?: boolean;
}) {
  const { caja, tipo, esHoy, fecha, arqueo } = datos;
  const porteria = tipo === "guardia";
  const permisos = permisosCaja(rol, tipo, caja, hoyISO());
  // Carga atrasada (0048): la caja de un día anterior se puede abrir y cargar después.
  const diaCargable = !esHoy && diaAnteriorValido(fecha) !== null;

  // Sin sello acá: el estado ya lo dice la pestaña y, con la caja cerrada, el sello grande del
  // arqueo (tres "CERRADA" seguidos no suman nada).
  const encabezado = conEncabezado ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">{TITULO_TIPO[tipo]}</h2>
      {caja ? <BotonImprimirCaja cajaId={caja.id} abierta={caja.estado === "abierta"} /> : null}
    </div>
  ) : null;

  if (!caja) {
    const quienAbre = porteria
      ? "Se abre sola con el primer cobro a un quintero o ambulante, o cuando Portería cobra el primer canon."
      : "Se abre sola con el primer cobro.";
    return (
      <div className="space-y-8">
        {encabezado}
        {/* El div solo lleva el ancla del tour (EmptyState no pasa atributos al DOM). */}
        <div data-tour="caja-sin-abrir">
          {esHoy ? (
            <EmptyState
              icono={CajaRegistradora}
              titulo={porteria ? "Todavía no hay caja de portería hoy" : "Todavía no se abrió la caja de hoy"}
              descripcion={
                permisos.abrir
                  ? `${quienAbre} Si querés, abrila ahora.`
                  : `${quienAbre} La abre quien cobra: Tesorería no abre cajas.`
              }
            >
              {permisos.abrir ? <BotonAbrirCaja tipo={tipo} /> : null}
            </EmptyState>
          ) : (
            <EmptyState
              icono={CalendarX2}
              titulo={`No hubo ${porteria ? "caja de portería" : "caja"} el ${formatFecha(fecha)}`}
              descripcion={
                permisos.abrir && diaCargable
                  ? "Ese día no se abrió esta caja. Si se cobró y quedó sin registrar, abrila ahora y cargalo: todo queda con la fecha de ese día."
                  : "Ese día no se abrió esta caja. Elegí otro día de la lista de abajo."
              }
            >
              {permisos.abrir && diaCargable ? <BotonAbrirCaja tipo={tipo} fecha={fecha} /> : null}
            </EmptyState>
          )}
        </div>
        <UltimosDias previas={datos.previas} tipo={tipo} />
      </div>
    );
  }

  const abierta = caja.estado === "abierta";
  const pideReapertura = Boolean(caja.reapertura_solicitada_en);
  // Quién carga qué en una caja de un día anterior: los cobros, quien cobra en esta caja (el
  // Líder cobra en la de administración, §1.3); el canon de portería, el Líder.
  const cobraAca =
    (rol === "admin" && !porteria) || (rol === "guardia" && porteria) || (rol === "lider" && !porteria);
  const cargaCanon = rol === "lider" && porteria;

  return (
    <div className="space-y-8">
      {encabezado}

      {datos.arqueoError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-pendiente bg-pendiente-suave px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-pendiente" strokeWidth={2} />
          <p>
            No pudimos calcular la cuenta de esta caja ({datos.arqueoError}). Recargá la página; si sigue igual,
            avisale al Líder de Procesos.
          </p>
        </div>
      ) : null}

      {abierta ? (
        <BandaTotales key="totales-abierta" arqueo={arqueo} tipo={tipo} fecha={caja.fecha} esHoy={esHoy} />
      ) : (
        <ArqueoCaja
          key="totales-cerrada"
          caja={caja}
          arqueo={arqueo}
          rol={rol}
          nombres={datos.nombres}
          eventos={datos.eventos}
          permisos={permisos}
        />
      )}

      {abierta && !esHoy && (cobraAca || cargaCanon) ? (
        <div
          key="carga-atrasada"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/30 bg-card p-5 sm:p-6"
          data-tour="caja-carga-atrasada"
        >
          <div className="min-w-0 flex-1 basis-64 space-y-1">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CalendarClock className="size-5 shrink-0 text-primary" strokeWidth={2} />
              Cargá lo del {formatFecha(caja.fecha)}
            </p>
            <p className="text-sm text-muted-foreground">
              {cargaCanon
                ? "El canon que cargues entra en esta caja con la fecha de ese día. Los cobros a quinteros y ambulantes los carga el Jefe de Portería."
                : "Los cobros que cargues entran en esta caja y el recibo sale con la fecha de ese día."}{" "}
              Cuando termines, cerrala.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 px-5 text-base font-semibold">
            <Link href={cargaCanon ? `/porteria?fecha=${caja.fecha}` : `/cobranza?fecha=${caja.fecha}`}>
              {cargaCanon ? "Cargar el canon de ese día" : "Cobrar en esta caja"}
              <ArrowRight className="size-5" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      ) : null}

      {permisos.cerrarTipo ? (
        <BotonCerrarCaja
          key="accion-cerrar"
          cajaId={caja.id}
          tipo={tipo}
          fecha={caja.fecha}
          arqueo={arqueo}
          mostrar={abierta}
          forzado={permisos.cierreForzado}
        />
      ) : null}

      {porteria && permisos.integrarTipo ? (
        <RecibirCajaPorteria
          key="accion-recibir"
          mostrar={caja.estado === "cerrada" && !pideReapertura}
          rendicion={{
            cajaId: caja.id,
            fecha: caja.fecha,
            efectivo: arqueo.efectivo,
            transferencia: arqueo.transferencia,
            quintas: arqueo.quintas,
            ambulantes: arqueo.ambulantes,
            canon: arqueo.canon,
            ajustes: arqueo.ajustes,
            adminMismoDia: datos.adminMismoDia,
          }}
        />
      ) : null}

      {permisos.validar ? (
        <div
          key="accion-validar"
          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/30 bg-card p-5 sm:p-6"
          data-tour="caja-validar"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Stamp className="size-5 text-primary" strokeWidth={2} />
              ¿Ya contaste la plata?
            </p>
            <p className="text-sm text-muted-foreground">
              Contá el efectivo y validá la caja. Si no coincide, el faltante o sobrante queda anotado en el mismo paso.
            </p>
          </div>
          <ValidarCajaDialog
            caja={{ id: caja.id, tipo: caja.tipo, fecha: caja.fecha, estado: caja.estado }}
            arqueo={arqueo}
            ajustes={datos.ajustes.map((a) => ({
              id: a.id,
              cuenta: a.cuenta,
              monto: a.monto,
              descripcion: a.descripcion,
            }))}
          />
        </div>
      ) : null}

      <CobrosDia key="cobros" recibos={datos.recibos} puedeAnular={permisos.anularCobros} porteria={porteria} esHoy={esHoy} />

      {porteria ? (
        <section key="canon" aria-labelledby={`canon-${caja.id}`} className="space-y-3" data-tour="caja-canon">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`canon-${caja.id}`} className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <Truck className="size-5 text-muted-foreground" strokeWidth={2} />
              Bono camioneros — canon de transporte
            </h2>
            <p className="text-sm text-muted-foreground">Lo cobra Portería en la garita.</p>
          </div>
          <CanonDelDia
            entradas={datos.canon}
            modo={permisos.modoCanon}
            cajaAbierta={abierta}
            cajaValidada={caja.estado === "validada"}
            miUserId={miUserId}
            anularConCajaCerrada={permisos.anularCanonConCajaCerrada}
            esHoy={esHoy}
            tarifas={datos.tarifas}
          />
        </section>
      ) : null}

      {!porteria && rol !== "guardia" ? (
        <GastosCaja
          key="gastos"
          gastos={datos.gastos}
          pagarHref={permisos.pagarGasto ? `/gastos?caja=${caja.id}` : null}
        />
      ) : null}

      <AjustesCaja
        key="ajustes"
        cajaId={caja.id}
        ajustes={datos.ajustes}
        arqueo={arqueo}
        puedeAjustar={permisos.ajustar}
      />

      <HistorialCaja key="historial" eventos={datos.eventos} />

      <UltimosDias key="ultimos" previas={datos.previas} tipo={tipo} />
    </div>
  );
}
