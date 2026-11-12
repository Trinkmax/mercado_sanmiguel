import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { saldoCargo, sumarMeses } from "@/lib/format";
import { textoEspacios } from "@/components/mapa/geometria";
import type { TipoEspacio } from "@/components/mapa/tipos";
import type { CategoriaCliente } from "@/lib/segmentos";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Quiénes aparecen en «Libres deuda» (los que pagan por mes): puesteros y quinteros. Los
 * ambulantes pagan por día y los empleados solo la cochera; su libre deuda sigue saliendo
 * desde la ficha.
 */
export const CATEGORIAS_LIBRES_DEUDA: CategoriaCliente[] = ["puestero", "quintero"];

/** Un concepto del libre deuda: «Expensas Cobradas × 2», o la energía con sus medidores. */
export type RenglonLibreDeuda = { codigo: string; nombre: string; detalle: string[] };

export type LibreDeuda = {
  clienteId: string;
  codigo: number;
  nombre: string;
  cuit: string | null;
  categoria: CategoriaCliente;
  lugares: string;
  /** Mes de los conceptos listados ("2026-11-01"). Null: no tiene cargos y se listan los
   * conceptos que tiene asignados (como era el libre deuda antes del 12/11/2026). */
  periodo: string | null;
  renglones: RenglonLibreDeuda[];
};

export type ClienteConDeuda = { clienteId: string; codigo: number; nombre: string; deuda: number };

type CargoMes = {
  cliente_id: string;
  periodo: string;
  codigo: string;
  descripcion: string | null;
  cantidad: number;
  conceptos: { nombre: string; orden_imputacion: number } | null;
};

const SELECT_CARGO = "cliente_id, periodo, codigo, descripcion, cantidad, conceptos(nombre, orden_imputacion)";

/** Los cargos de un mes como renglones: la energía (un cargo por medidor) va en uno solo. */
function renglonesDe(cargos: CargoMes[]): RenglonLibreDeuda[] {
  const orden = (c: CargoMes) => c.conceptos?.orden_imputacion ?? 999;
  const ordenados = [...cargos].sort((a, b) => orden(a) - orden(b) || a.codigo.localeCompare(b.codigo));
  const renglones: RenglonLibreDeuda[] = [];
  const energia = ordenados.filter((c) => c.codigo === "ENER");
  for (const c of ordenados) {
    if (c.codigo === "ENER") {
      if (c !== energia[0]) continue;
      // «Energía de octubre · Medidor N° 25T (599 kWh)»: el mes una vez, y cada medidor abajo.
      const [titulo] = (c.descripcion ?? "").split(" · ");
      renglones.push({
        codigo: "ENER",
        nombre: titulo || c.conceptos?.nombre || "Energía",
        detalle: energia
          .map((e) => (e.descripcion ?? "").split(" · ").slice(1).join(" · "))
          .filter(Boolean),
      });
      continue;
    }
    renglones.push({ codigo: c.codigo, nombre: c.descripcion || c.conceptos?.nombre || c.codigo, detalle: [] });
  }
  // Lo diario (ambulantes) son decenas de cargos del mismo concepto: uno solo, con la cuenta.
  const porCodigo = new Map<string, RenglonLibreDeuda[]>();
  for (const r of renglones) porCodigo.set(r.codigo, [...(porCodigo.get(r.codigo) ?? []), r]);
  return renglones.flatMap((r) => {
    const mismos = porCodigo.get(r.codigo) ?? [];
    if (r.codigo === "ENER" || mismos.length <= 3) return [r];
    if (r !== mismos[0]) return [];
    const nombre = cargos.find((c) => c.codigo === r.codigo)?.conceptos?.nombre ?? r.codigo;
    return [{ codigo: r.codigo, nombre, detalle: [`${mismos.length} cargos en el mes`] }];
  });
}

/**
 * Los libres deuda de esos clientes (en ese orden), con lo que pagaron del mes. Los que deben
 * algo (de cualquier mes, vencido o no) no tienen libre deuda: vuelven aparte.
 */
export async function armarLibresDeuda(
  supabase: Supabase,
  orgId: string,
  ids: string[],
  periodo: string
): Promise<{ libres: LibreDeuda[]; conDeuda: ClienteConDeuda[] }> {
  if (ids.length === 0) return { libres: [], conDeuda: [] };

  const [clientesRes, pendientesRes, delMesRes, espaciosRes] = await Promise.all([
    supabase.from("clientes").select("id, codigo, nombre, cuit, categoria").eq("org_id", orgId).in("id", ids),
    supabase
      .from("cargos")
      .select("cliente_id, estado, monto, monto_pagado, descuento_pronto_pago, vencimiento")
      .eq("org_id", orgId)
      .in("cliente_id", ids)
      .in("estado", ["pendiente", "parcial"]),
    supabase
      .from("cargos")
      .select(SELECT_CARGO)
      .eq("org_id", orgId)
      .in("cliente_id", ids)
      .eq("periodo", periodo)
      .neq("estado", "anulado"),
    // Sus lugares en el plano ("Puesto 58 · Puesto propio 12"). El Jefe no lee espacios
    // (0022) y sus quinteros no tienen puesto: le vuelve vacío.
    supabase
      .from("espacios")
      .select("cliente_id, tipo, numero, medio, propio, x, y")
      .eq("org_id", orgId)
      .in("cliente_id", ids),
  ]);
  if (clientesRes.error) throw clientesRes.error;
  if (pendientesRes.error) throw pendientesRes.error;
  if (delMesRes.error) throw delMesRes.error;

  const deudaDe = new Map<string, number>();
  for (const c of pendientesRes.data ?? []) {
    deudaDe.set(c.cliente_id, (deudaDe.get(c.cliente_id) ?? 0) + saldoCargo(c));
  }

  const cargosDe = new Map<string, CargoMes[]>();
  const anotar = (c: CargoMes) => cargosDe.set(c.cliente_id, [...(cargosDe.get(c.cliente_id) ?? []), c]);
  for (const c of (delMesRes.data ?? []) as CargoMes[]) anotar(c);

  // Sin cargos este mes (todavía no se generó, o es nuevo): su último mes, de los tres anteriores.
  const sinMes = ids.filter((id) => !cargosDe.has(id) && !deudaDe.get(id));
  if (sinMes.length > 0) {
    const { data, error } = await supabase
      .from("cargos")
      .select(SELECT_CARGO)
      .eq("org_id", orgId)
      .in("cliente_id", sinMes)
      .lt("periodo", periodo)
      .gte("periodo", sumarMeses(periodo, -3))
      .neq("estado", "anulado")
      .order("periodo", { ascending: false });
    if (error) throw error;
    const ultimo = new Map<string, string>();
    for (const c of (data ?? []) as CargoMes[]) {
      const p = ultimo.get(c.cliente_id) ?? c.periodo;
      ultimo.set(c.cliente_id, p);
      if (c.periodo === p) anotar(c);
    }
  }

  // Ni eso: los conceptos que tiene asignados, sin mes (como era antes).
  const sinCargos = sinMes.filter((id) => !cargosDe.has(id));
  const asignados = new Map<string, RenglonLibreDeuda[]>();
  if (sinCargos.length > 0) {
    const { data } = await supabase
      .from("cliente_conceptos")
      .select("cliente_id, cantidad, conceptos(codigo, nombre)")
      .in("cliente_id", sinCargos)
      .eq("activo", true);
    for (const i of data ?? []) {
      const cantidad = Number(i.cantidad);
      const nombre = i.conceptos?.nombre ?? "Concepto";
      asignados.set(i.cliente_id, [
        ...(asignados.get(i.cliente_id) ?? []),
        { codigo: i.conceptos?.codigo ?? "?", nombre: cantidad > 1 ? `${nombre} × ${cantidad}` : nombre, detalle: [] },
      ]);
    }
    for (const r of asignados.values()) r.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  const porId = new Map((clientesRes.data ?? []).map((c) => [c.id, c]));
  const libres: LibreDeuda[] = [];
  const conDeuda: ClienteConDeuda[] = [];
  for (const id of ids) {
    const c = porId.get(id);
    if (!c) continue;
    const deuda = deudaDe.get(id) ?? 0;
    if (deuda > 0) {
      conDeuda.push({ clienteId: id, codigo: c.codigo, nombre: c.nombre, deuda });
      continue;
    }
    const cargos = cargosDe.get(id) ?? [];
    libres.push({
      clienteId: id,
      codigo: c.codigo,
      nombre: c.nombre,
      cuit: c.cuit,
      categoria: c.categoria as CategoriaCliente,
      lugares: textoEspacios(
        (espaciosRes.data ?? [])
          .filter((e) => e.cliente_id === id)
          .map((e) => ({
            tipo: e.tipo as TipoEspacio,
            numero: e.numero,
            medio: e.medio,
            propio: e.propio,
            x: Number(e.x),
            y: Number(e.y),
          }))
      ),
      periodo: cargos[0]?.periodo ?? null,
      renglones: cargos.length > 0 ? renglonesDe(cargos) : (asignados.get(id) ?? []),
    });
  }
  return { libres, conDeuda };
}
