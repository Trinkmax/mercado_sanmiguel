import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Moneda } from "@/lib/format";
import { normalizarFlujo, type Cuenta, type Flujo, type Movimiento, type TipoMovimiento } from "@/components/tesoreria/tipos";
import type { CajaPendiente } from "@/components/tesoreria/cajas-para-validar";
import type { SaldoInicial } from "@/components/tesoreria/saldos-iniciales";
import type { SaldosCuentas } from "@/components/tesoreria/nuevo-movimiento";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const n = (v: unknown) => Number(v ?? 0);

export async function cargarFlujo(supabase: Supabase): Promise<{ flujo: Flujo; error: string | null }> {
  const { data, error } = await supabase.rpc("flujo_caja");
  return { flujo: normalizarFlujo(data), error: error ? error.message : null };
}

/** Saldos por moneda y cuenta para la vista previa de un movimiento. */
export function saldosDesdeFlujo(f: Flujo): SaldosCuentas {
  return {
    ARS: { efectivo: f.pesos.efectivo, banco: f.pesos.banco },
    USD: { efectivo: f.dolares.efectivo, banco: f.dolares.banco },
  };
}

export async function cargarSaldosIniciales(supabase: Supabase): Promise<SaldoInicial[]> {
  const { data } = await supabase.from("saldos_iniciales").select("medio, moneda, monto, fecha, notas");
  return (data ?? [])
    .filter((s) => s.medio === "efectivo" || s.medio === "transferencia")
    .map((s) => ({
      medio: s.medio as "efectivo" | "transferencia",
      moneda: s.moneda as Moneda,
      monto: n(s.monto),
      fecha: s.fecha,
      notas: s.notas,
    }));
}

/** Cajas cerradas o integradas, con el arqueo persistido y el desglose de portería. */
export async function cargarCajasPendientes(supabase: Supabase): Promise<CajaPendiente[]> {
  const { data } = await supabase
    .from("cajas")
    .select(
      "id, fecha, tipo, estado, cerrada_por, total_efectivo, total_transferencia, total_cheques, total_canon, total_gastos, total_ajustes, total_quintas, total_ambulantes, total_rendido_efectivo, total_rendido_transferencia, total_rendido_quintas, total_rendido_ambulantes, total_rendido_canon, reapertura_solicitada_en, reapertura_motivo, caja_destino_id"
    )
    .in("estado", ["cerrada", "integrada"])
    .order("fecha", { ascending: true })
    .order("tipo", { ascending: true });
  const cajas = data ?? [];

  const usuarios = [...new Set(cajas.map((c) => c.cerrada_por).filter((x): x is string => Boolean(x)))];
  const destinos = [...new Set(cajas.map((c) => c.caja_destino_id).filter((x): x is string => Boolean(x)))];
  const [perfilesRes, destinosRes] = await Promise.all([
    usuarios.length
      ? supabase.from("perfiles").select("user_id, nombre").in("user_id", usuarios)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string }[] }),
    destinos.length
      ? supabase.from("cajas").select("id, fecha").in("id", destinos)
      : Promise.resolve({ data: [] as { id: string; fecha: string }[] }),
  ]);
  const nombre = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));
  const fechaDestino = new Map((destinosRes.data ?? []).map((d) => [d.id, d.fecha]));

  return cajas.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    tipo: c.tipo,
    estado: c.estado === "integrada" ? "integrada" : "cerrada",
    cerradaPor: c.cerrada_por ? nombre.get(c.cerrada_por) ?? null : null,
    efectivo: n(c.total_efectivo),
    transferencia: n(c.total_transferencia),
    cheques: n(c.total_cheques),
    gastos: n(c.total_gastos),
    ajustes: n(c.total_ajustes),
    quintas: n(c.total_quintas),
    ambulantes: n(c.total_ambulantes),
    canon: n(c.total_canon),
    rendidoEfectivo: n(c.total_rendido_efectivo),
    rendidoTransferencia: n(c.total_rendido_transferencia),
    rendidoQuintas: n(c.total_rendido_quintas),
    rendidoAmbulantes: n(c.total_rendido_ambulantes),
    rendidoCanon: n(c.total_rendido_canon),
    destinoFecha: c.caja_destino_id ? fechaDestino.get(c.caja_destino_id) ?? null : null,
    reaperturaMotivo: c.reapertura_motivo,
    pideReapertura: Boolean(c.reapertura_solicitada_en),
  }));
}

export async function cargarMovimientos(supabase: Supabase, mes: string, mesSiguiente: string): Promise<Movimiento[]> {
  const { data } = await supabase
    .from("movimientos_tesoreria")
    .select("id, fecha, tipo, descripcion, monto, moneda, cuenta, cuenta_destino, grupo_id, caja:cajas(fecha)")
    .gte("fecha", mes)
    .lt("fecha", mesSiguiente)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });
  return (data ?? []).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo as TipoMovimiento,
    descripcion: m.descripcion,
    monto: n(m.monto),
    moneda: m.moneda as Moneda,
    cuenta: m.cuenta as Cuenta,
    cuentaDestino: (m.cuenta_destino as Cuenta | null) ?? null,
    grupoId: m.grupo_id,
    cajaFecha: m.caja?.fecha ?? null,
  }));
}
