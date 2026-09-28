import type { Rol } from "@/lib/auth";
import type { Enums } from "@/lib/database.types";

type TipoCaja = Enums<"tipo_caja">;
type EstadoCaja = Enums<"estado_caja">;

/**
 * Qué puede hacer quien mira una caja. Espejo de las RPC de 0013 (la base es la
 * autoridad final): acá solo se decide qué botones mostrar.
 * El Líder de Procesos opera todo (contrato §1.3 D-P2).
 */
export type PermisosCaja = {
  /** Abrir la caja de hoy (Tesorería nunca: "las abre quien cobra"). */
  abrir: boolean;
  /** Puede cerrar/rendir cajas de este tipo (el botón aparece si además está abierta). */
  cerrarTipo: boolean;
  /** Cierre de Tesorería de una caja de un día anterior que quedó abierta. */
  cierreForzado: boolean;
  /** Anular recibos de esta caja en su estado actual. */
  anularCobros: boolean;
  reabrir: boolean;
  pedirReapertura: boolean;
  /** Recibir (integrar) una caja de portería rendida en la caja mayor. */
  integrarTipo: boolean;
  /** Cargar y borrar ajustes de tesorería. */
  ajustar: boolean;
  /** "Contar y validar". */
  validar: boolean;
  /** Link "Pagar un gasto desde esta caja" (M6). */
  pagarGasto: boolean;
  /** Modo de <CanonDelDia> (M3). */
  modoCanon: "jefe" | "lectura";
  /** Tesorería y el Líder anulan canon también con la caja rendida (anular_canon lo permite). */
  anularCanonConCajaCerrada: boolean;
};

export function permisosCaja(
  rol: Rol,
  tipo: TipoCaja,
  caja: { estado: EstadoCaja; fecha: string; reapertura_solicitada_en: string | null } | null,
  hoy: string
): PermisosCaja {
  const lider = rol === "lider";
  const tesoreria = rol === "tesoreria";
  const duenia = (rol === "admin" && tipo === "administracion") || (rol === "guardia" && tipo === "guardia");
  const estado = caja?.estado ?? null;
  const deDiaAnterior = caja ? caja.fecha < hoy : false;
  const noValidada = estado !== null && estado !== "validada";

  return {
    abrir: !caja && (duenia || lider),
    cerrarTipo: duenia || lider || (tesoreria && deDiaAnterior),
    cierreForzado: tesoreria && deDiaAnterior,
    anularCobros:
      noValidada && ((duenia && estado === "abierta") || ((tesoreria || lider) && estado !== null)),
    reabrir:
      (estado === "cerrada" && ((rol === "admin" && tipo === "administracion") || tesoreria || lider)) ||
      (estado === "integrada" && (tesoreria || lider)),
    pedirReapertura:
      duenia && (estado === "cerrada" || estado === "integrada") && !caja?.reapertura_solicitada_en,
    integrarTipo: tipo === "guardia" && (rol === "admin" || tesoreria || lider),
    ajustar: (tesoreria || lider) && noValidada,
    validar:
      (tesoreria || lider) &&
      ((estado === "cerrada" && tipo === "administracion") || estado === "integrada"),
    pagarGasto: tipo === "administracion" && noValidada && (rol === "admin" || tesoreria || lider),
    modoCanon:
      (rol === "guardia" && estado === "abierta") || ((lider || tesoreria) && noValidada) ? "jefe" : "lectura",
    anularCanonConCajaCerrada: lider || tesoreria,
  };
}
