import { Wallet } from "lucide-react";
import type { Rol } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import { Sello } from "@/components/shared/sello";
import { BotonAbrirCaja } from "@/components/caja/abrir-caja";
import { ArqueoCaja } from "@/components/caja/arqueo";
import { BandaTotales } from "@/components/caja/banda-totales";
import { CanonCamiones } from "@/components/caja/canon-camiones";
import { BotonCerrarCaja } from "@/components/caja/cerrar-caja";
import { CobrosDia } from "@/components/caja/cobros-dia";
import { GastosCaja } from "@/components/caja/gastos-caja";
import { UltimosDias } from "@/components/caja/ultimos-dias";
import type { DatosCaja } from "@/components/caja/datos";

const TITULO_TIPO = {
  administracion: "Caja de administración",
  guardia: "Caja de guardia",
} as const;

/**
 * La caja completa de un tipo: totales, cobros, canon, gastos, cierre y
 * arqueo. `conEncabezado` la usa tesorería dentro de las pestañas.
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
  const { caja, tipo } = datos;
  const esDuena =
    rol === "tesoreria" ||
    (rol === "admin" && tipo === "administracion") ||
    (rol === "guardia" && tipo === "guardia");

  const encabezado = conEncabezado ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold tracking-tight">
        {TITULO_TIPO[tipo]}
      </h2>
      {caja ? <Sello estado={caja.estado} /> : null}
    </div>
  ) : null;

  if (!caja) {
    return (
      <div className="space-y-8">
        {encabezado}
        <EmptyState
          icono={Wallet}
          titulo="Todavía no se abrió la caja de hoy"
          descripcion="Abrila para empezar a registrar los cobros del día."
        >
          {esDuena ? <BotonAbrirCaja tipo={tipo} /> : null}
        </EmptyState>
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
          validadaPorNombre={datos.validadaPorNombre}
        />
      )}

      <CobrosDia cobros={datos.cobros} cajaAbierta={abierta} />

      {tipo === "guardia" ? (
        <CanonCamiones
          cajaId={caja.id}
          cajaAbierta={abierta}
          entradas={datos.canon}
          precioCanon={datos.precioCanon}
        />
      ) : null}

      <GastosCaja gastos={datos.gastos} />

      {abierta && esDuena ? <BotonCerrarCaja cajaId={caja.id} /> : null}

      <UltimosDias previas={datos.previas} />
    </div>
  );
}
