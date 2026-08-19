import { CalendarX2, Wallet } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { formatFecha } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BotonAbrirCaja } from "@/components/caja/abrir-caja";
import { ArqueoCaja } from "@/components/caja/arqueo";
import { BandaTotales } from "@/components/caja/banda-totales";
import { CanonCamiones } from "@/components/caja/canon-camiones";
import { BotonCerrarCaja } from "@/components/caja/cerrar-caja";
import { CobrosDia } from "@/components/caja/cobros-dia";
import { GastosCaja } from "@/components/caja/gastos-caja";
import { HistorialCaja } from "@/components/caja/historial-caja";
import { UltimosDias } from "@/components/caja/ultimos-dias";
import type { DatosCaja } from "@/components/caja/datos";

const TITULO_TIPO = {
  administracion: "Caja de administración",
  guardia: "Caja de portería",
} as const;

/**
 * La caja completa de un tipo: totales, cobros, canon, gastos, cierre,
 * arqueo e historial. `conEncabezado` la usa tesorería dentro de las pestañas.
 */
export function VistaCaja({
  datos,
  rol,
  conEncabezado = false,
}: {
  datos: DatosCaja;
  rol: Rol;
  conEncabezado?: boolean;
}) {
  const { caja, tipo, esHoy, fecha } = datos;
  const esDuena =
    rol === "tesoreria" ||
    (rol === "admin" && tipo === "administracion") ||
    (rol === "guardia" && tipo === "guardia");

  const encabezado = conEncabezado ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">
        {TITULO_TIPO[tipo]}
      </h2>
      {caja ? (
        <span className="inline-flex items-center gap-2">
          {caja.reapertura_solicitada_en ? <Sello estado="reapertura_pedida" /> : null}
          <Sello estado={caja.estado} />
        </span>
      ) : null}
    </div>
  ) : null;

  if (!caja) {
    return (
      <div className="space-y-8">
        {encabezado}
        {esHoy ? (
          <EmptyState
            icono={Wallet}
            titulo="Todavía no se abrió la caja de hoy"
            descripcion="Abrila para empezar a registrar los cobros del día."
          >
            {esDuena ? <BotonAbrirCaja tipo={tipo} /> : null}
          </EmptyState>
        ) : (
          <EmptyState
            icono={CalendarX2}
            titulo={`No hubo caja el ${formatFecha(fecha)}`}
            descripcion="Ese día no se abrió esta caja. Elegí otro día de la lista de abajo."
          />
        )}
        <UltimosDias previas={datos.previas} />
      </div>
    );
  }

  const abierta = caja.estado === "abierta";

  return (
    <div className="space-y-8">
      {encabezado}

      {abierta ? (
        <BandaTotales totales={datos.totales} />
      ) : (
        <ArqueoCaja
          caja={caja}
          totales={datos.totales}
          rol={rol}
          validadaPorNombre={datos.validadaPorNombre}
          cerradaPorNombre={datos.cerradaPorNombre}
          reaperturaPorNombre={datos.reaperturaPorNombre}
        />
      )}

      <CobrosDia cobros={datos.cobros} cajaAbierta={abierta} />

      {tipo === "guardia" ? (
        <CanonCamiones
          cajaId={caja.id}
          cajaAbierta={abierta}
          fechaCaja={caja.fecha}
          entradas={datos.canon}
          precios={datos.preciosCanon}
        />
      ) : null}

      <GastosCaja gastos={datos.gastos} />

      {abierta && esDuena ? (
        <BotonCerrarCaja cajaId={caja.id} rinde={rol === "guardia"} />
      ) : null}

      <HistorialCaja eventos={datos.eventos} />

      <UltimosDias previas={datos.previas} />
    </div>
  );
}
