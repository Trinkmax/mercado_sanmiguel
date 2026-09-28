import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import type { BadgesNav } from "@/lib/navegacion";
import { hoyISO } from "@/lib/format";

/**
 * Pendientes por ruta para los badges de la navegación (§6 M8.7). Una sola pasada
 * de consultas chicas (count con head) según lo que le toca a cada rol; la RLS
 * recorta a lo que cada uno ve.
 *  - Líder: cambios a aprobar + altas del Jefe para revisar, solicitudes nuevas /
 *    en revisión / resueltas, registros con descargo esperando respuesta.
 *  - Administración: solicitudes asignadas, rendiciones de portería a integrar y
 *    pedidos de reapertura, novedades del Jefe para aprobar, descargos para responder.
 *  - Jefe de Portería: solicitudes de Portería "Con el Jefe".
 *  - Tesorería: cajas para contar y validar, transferencias sin conciliar,
 *    cheques para depositar + entregados sin gasto, gastos vencidos.
 *  - Portería: nada (simple).
 */
export const pendientesNav = cache(async (perfil: Perfil): Promise<BadgesNav> => {
  const supabase = await createClient();
  const badges: BadgesNav = {};
  const org = perfil.org_id;
  const hoy = hoyISO();

  const cuenta = async (q: PromiseLike<{ count: number | null }>) =>
    (await q).count ?? 0;
  const sumar = (ruta: string, n: number) => {
    if (n > 0) badges[ruta] = (badges[ruta] ?? 0) + n;
  };

  if (perfil.rol === "lider") {
    const [cambios, altasJefe, solicitudes, descargos] = await Promise.all([
      cuenta(
        supabase
          .from("cambios_pendientes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "pendiente")
      ),
      // Altas de ambulantes que el Jefe aplicó en el acto (D-1): el Líder las revisa.
      cuenta(
        supabase
          .from("cambios_pendientes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "aprobado")
          .eq("revisar_despues", true)
          .is("revisado_por", null)
      ),
      cuenta(
        supabase
          .from("solicitudes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .in("estado", ["nueva", "en_revision", "resuelta"])
      ),
      cuenta(
        supabase
          .from("sanciones")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "descargo")
      ),
    ]);
    sumar("/aprobaciones", cambios + altasJefe);
    sumar("/solicitudes", solicitudes);
    sumar("/comunicaciones", descargos);
  }

  if (perfil.rol === "admin") {
    const [asignadas, rendiciones, reaperturas, novedades, descargos] = await Promise.all([
      cuenta(
        supabase
          .from("solicitudes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .in("estado", ["nueva", "asignada"])
      ),
      cuenta(
        supabase
          .from("cajas")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("tipo", "guardia")
          .eq("estado", "cerrada")
      ),
      cuenta(
        supabase
          .from("cajas")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .not("reapertura_solicitada_en", "is", null)
      ),
      cuenta(
        supabase
          .from("novedades_personal")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "pendiente")
      ),
      cuenta(
        supabase
          .from("sanciones")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "descargo")
      ),
    ]);
    sumar("/solicitudes", asignadas);
    sumar("/caja", rendiciones + reaperturas);
    sumar("/novedades", novedades);
    sumar("/comunicaciones", descargos);
  }

  if (perfil.rol === "guardia") {
    const conJefe = await cuenta(
      supabase
        .from("solicitudes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .eq("estado", "con_jefe")
    );
    sumar("/solicitudes", conJefe);
  }

  if (perfil.rol === "tesoreria") {
    const [cajas, transferencias, chequesListos, entregadosSinGasto, gastosVencidos] =
      await Promise.all([
        cuenta(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .in("estado", ["cerrada", "integrada"])
        ),
        cuenta(
          supabase
            .from("pagos")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("medio", "transferencia")
            .eq("anulado", false)
            .eq("conciliado", false)
        ),
        cuenta(
          supabase
            .from("cheques")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "en_cartera")
            .lte("fecha_cobro", hoy)
        ),
        cuenta(
          supabase
            .from("cheques")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "entregado")
            .is("gasto_id", null)
        ),
        cuenta(
          supabase
            .from("gastos")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("estado", "pendiente")
            .lt("vencimiento", hoy)
        ),
      ]);
    // Las cajas se cuentan y validan desde "Cajas del día" (/caja).
    sumar("/caja", cajas);
    sumar("/tesoreria", transferencias);
    sumar("/cheques", chequesListos + entregadosSinGasto);
    sumar("/gastos", gastosVencidos);
  }

  return badges;
});
