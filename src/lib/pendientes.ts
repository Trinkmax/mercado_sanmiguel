import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/auth";
import type { BadgesNav } from "@/lib/navegacion";
import { hoyISO } from "@/lib/format";
import { categoriasDeRol } from "@/lib/segmentos";

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
 *  - Portería: nada más que lo de abajo (simple).
 *  - Portería, Tesorería, el Jefe y Administración, además: SUS solicitudes con una respuesta
 *    o un cambio que todavía no abrieron (se apaga al abrir el detalle).
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

  // Quien cargó una solicitud se entera de que le respondieron (H3/J5). Arranca ya, en
  // paralelo con las consultas del rol (el layout corre esto en cada navegación).
  const recibeRespuestas =
    perfil.rol === "porteria" || perfil.rol === "tesoreria" || perfil.rol === "guardia" || perfil.rol === "admin";
  const conRespuestaP: Promise<string[]> = recibeRespuestas
    ? Promise.resolve(supabase.rpc("solicitudes_con_respuesta")).then(
        (r) => r.data ?? [],
        () => []
      )
    : Promise.resolve([]);
  // Las que ya suman al badge por otro lado (no se cuentan dos veces).
  const yaContadas = new Set<string>();

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
    const [asignadasRes, rendiciones, reaperturas, novedades, descargos] = await Promise.all([
      // Con los ids: una asignada que cargó Administración y tiene respuesta nueva cuenta una vez.
      supabase
        .from("solicitudes")
        .select("id", { count: "exact" })
        .eq("org_id", org)
        .eq("estado", "asignada")
        .limit(1000),
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
      // Solo los de SUS clientes (puesteros), igual que /comunicaciones: los de quinteros los
      // responde el Líder y Administración no los ve ni los puede resolver.
      cuenta(
        supabase
          .from("sanciones")
          .select("id, clientes!inner(categoria)", { count: "exact", head: true })
          .eq("org_id", org)
          .eq("estado", "descargo")
          .in("clientes.categoria", categoriasDeRol("admin"))
      ),
    ]);
    for (const s of asignadasRes.data ?? []) yaContadas.add(s.id);
    sumar("/solicitudes", asignadasRes.count ?? asignadasRes.data?.length ?? 0);
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
    const [cajas, transferencias, chequesListos, entregadosSinGasto, gastosVencidos, bonoSinConciliar] =
      await Promise.all([
        // Solo lo que Tesorería puede validar: la caja de Administración cerrada (la de
        // portería se valida junto con ella; sin recibir, validar_caja la rechaza).
        cuenta(
          supabase
            .from("cajas")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("tipo", "administracion")
            .eq("estado", "cerrada")
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
        // Bono camioneros por transferencia sin cruzar con el banco (Conciliar, J2).
        cuenta(
          supabase
            .from("canon_camiones")
            .select("id", { count: "exact", head: true })
            .eq("org_id", org)
            .eq("medio", "transferencia")
            .eq("anulado", false)
            .eq("conciliado", false)
        ),
      ]);
    // La lista de cajas para validar (de cualquier día) está en Tesorería → Hoy;
    // "Cajas del día" (/caja) abre en la de hoy, donde no están las pendientes.
    sumar("/tesoreria", cajas + transferencias + bonoSinConciliar);
    sumar("/cheques", chequesListos + entregadosSinGasto);
    sumar("/gastos", gastosVencidos);
  }

  // Ya estaba en vuelo desde el principio: esperarla acá no suma otro viaje a la base.
  const conRespuesta = await conRespuestaP;
  sumar("/solicitudes", conRespuesta.filter((id) => !yaContadas.has(id)).length);

  return badges;
});
