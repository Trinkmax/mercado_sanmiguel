import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/auth";
import {
  etiquetaGasto,
  type CajaElegible,
  type GastoPendiente,
} from "@/components/gastos/tipos";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Cajas de administración donde se puede imputar un gasto: las últimas 10 no
 * validadas (abiertas o cerradas), con cuánto efectivo tienen que tener. Si la
 * de hoy no existe, Administración y el Líder la ven como "se abre al pagar";
 * Tesorería no abre cajas (§4.9).
 */
export async function cargarCajasElegibles(
  supabase: Supabase,
  rol: Rol,
  hoy: string
): Promise<CajaElegible[]> {
  const { data } = await supabase
    .from("cajas")
    .select("id, fecha, estado, total_efectivo")
    .eq("tipo", "administracion")
    .in("estado", ["abierta", "cerrada"])
    .order("fecha", { ascending: false })
    .limit(10);

  const cajas = await Promise.all(
    (data ?? []).map(async (c): Promise<CajaElegible> => {
      let efectivo: number | null =
        c.total_efectivo === null ? null : Number(c.total_efectivo);
      if (c.estado === "abierta") {
        // Caja abierta: el arqueo es en vivo (la única fórmula vive en SQL, M2).
        const { data: arqueo, error } = await supabase.rpc("arqueo_caja", { p_caja: c.id });
        const valor =
          !error && arqueo && typeof arqueo === "object" && !Array.isArray(arqueo)
            ? (arqueo as Record<string, unknown>).efectivo
            : null;
        efectivo = valor === null || valor === undefined ? null : Number(valor);
      }
      return {
        id: c.id,
        fecha: c.fecha,
        estado: c.estado === "abierta" ? "abierta" : "cerrada",
        efectivo,
      };
    })
  );

  const hayHoy = cajas.some((c) => c.fecha === hoy);
  if (!hayHoy && (rol === "admin" || rol === "lider")) {
    cajas.unshift({ id: null, fecha: hoy, estado: "nueva", efectivo: 0 });
  }
  return cajas;
}

/** Gastos pendientes (de cualquier mes) para pagar con un cheque o vincular. */
export async function cargarGastosPendientes(supabase: Supabase): Promise<GastoPendiente[]> {
  const { data } = await supabase
    .from("gastos")
    .select("id, descripcion, monto, vencimiento, periodo, rubro:rubros_gasto(codigo, nombre)")
    .eq("estado", "pendiente")
    .order("vencimiento", { ascending: true, nullsFirst: false })
    .limit(300);
  return (data ?? []).map((g) => ({
    id: g.id,
    etiqueta: etiquetaGasto(g.descripcion, g.rubro?.nombre),
    rubroCodigo: g.rubro?.codigo ?? null,
    monto: Number(g.monto),
    vencimiento: g.vencimiento,
    periodo: g.periodo,
  }));
}
