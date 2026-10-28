import type { createClient } from "@/lib/supabase/server";
import { fechaLocal, labelPeriodo, periodoActual, sumarMeses } from "@/lib/format";

/**
 * Deuda pasada (RD, «Reconocimiento de Deuda»): lo que un cliente ya debía antes de empezar
 * con el sistema. Pedido del mercado del 28/10/2026: «algunos traían deuda anterior: poné
 * deuda pasada y que podamos poner un monto, para ya ajustar y después queda al día mes a mes».
 *
 * Se carga UNA vez por cliente, sin fecha: queda en el mes anterior al primero que generó el
 * sistema y vencida el último día de ese mes ("deuda hasta el 30/09/2026"). Es la deuda más
 * vieja de la cuenta, así que el saldo a favor que tenga (pagos que en realidad eran para esa
 * deuda) y los cobros que vengan la cubren primero, como a cualquier deuda vencida.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Lo que dice la descripción de todo cargo de deuda pasada (el resto es el detalle opcional). */
export const TEXTO_DEUDA_PASADA = "Deuda pasada";

/**
 * El primer mes que facturó el sistema ("2026-10-01"): el de los cargos mensuales más viejos.
 * Sin ninguno todavía, el mes actual.
 */
export async function primerMesDelSistema(supabase: Supabase, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("cargos")
    .select("periodo")
    .eq("org_id", orgId)
    .eq("origen", "generacion")
    .order("periodo", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.periodo ?? periodoActual();
}

/** Mes y vencimiento de la deuda pasada: el mes anterior al primero del sistema, vencida su último día. */
export function mesDeudaPasada(primerMes: string): { periodo: string; vencimiento: string } {
  const ultimoDia = fechaLocal(primerMes);
  ultimoDia.setDate(0); // día 0 del mes = último día del mes anterior
  return {
    periodo: sumarMeses(primerMes, -1),
    vencimiento: `${ultimoDia.getFullYear()}-${String(ultimoDia.getMonth() + 1).padStart(2, "0")}-${String(ultimoDia.getDate()).padStart(2, "0")}`,
  };
}

/** "octubre de 2026": el primer mes del sistema, para decir «lo que debía antes de octubre de 2026». */
export function textoPrimerMes(primerMes: string): string {
  return labelPeriodo(primerMes).toLowerCase();
}
