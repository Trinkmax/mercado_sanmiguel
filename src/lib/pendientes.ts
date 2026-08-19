import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import type { BadgesNav } from "@/lib/navegacion";

/**
 * Pendientes por ruta para los badges de la navegación. Una sola pasada
 * de consultas chicas (count con head) según lo que le toca a cada rol:
 *  - líder: cambios a aprobar, solicitudes nuevas/en revisión/resueltas.
 *  - admin: solicitudes asignadas a ejecutar, rendiciones de portería a integrar
 *    y pedidos de reapertura.
 *  - tesorería: cajas a validar y transferencias sin conciliar.
 *  - consejo: solicitudes derivadas.
 *  - portería / jefe: solicitudes propias con novedades no se cuentan (simple).
 */
export const pendientesNav = cache(async (perfil: Perfil): Promise<BadgesNav> => {
  const supabase = await createClient();
  const badges: BadgesNav = {};
  const org = perfil.org_id;

  const cuenta = async (q: PromiseLike<{ count: number | null }>) =>
    (await q).count ?? 0;

  if (perfil.rol === "lider") {
    const [cambios, solicitudes] = await Promise.all([
      cuenta(
        supabase
          .from("cambios_pendientes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "pendiente")
      ),
      cuenta(
        supabase
          .from("solicitudes")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org)
          .in("estado", ["nueva", "en_revision", "resuelta"])
      ),
    ]);
    if (cambios) badges["/aprobaciones"] = cambios;
    if (solicitudes) badges["/solicitudes"] = solicitudes;
  }

  if (perfil.rol === "admin") {
    const [asignadas, rendiciones, reaperturas] = await Promise.all([
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
    ]);
    if (asignadas) badges["/solicitudes"] = asignadas;
    if (rendiciones + reaperturas) badges["/caja"] = rendiciones + reaperturas;
  }

  if (perfil.rol === "tesoreria") {
    const [cajas, transferencias] = await Promise.all([
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
    ]);
    if (cajas + transferencias) badges["/tesoreria"] = cajas + transferencias;
  }

  if (perfil.rol === "consejo") {
    const enConsejo = await cuenta(
      supabase
        .from("solicitudes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org)
        .eq("estado", "en_consejo")
    );
    if (enConsejo) badges["/solicitudes"] = enConsejo;
  }

  return badges;
});
