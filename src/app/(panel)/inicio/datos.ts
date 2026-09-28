import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fechaLocal, hoyISO } from "@/lib/format";
import type { Arqueo } from "@/components/caja/arqueo-tipos";
import {
  armarSerieDiaria,
  rangoUltimosDias,
  type PuntoCobranza,
} from "@/components/charts/serie-cobranza";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Fila de `resumen_conceptos(p_periodo)`. */
export type ResumenConcepto = {
  codigo: string;
  nombre: string;
  estimado: number;
  cobrado: number;
  descuentos: number;
  pendiente: number;
};

/**
 * Las claves del arqueo (§4.5, `arqueo_caja`) que usa el Inicio: un subconjunto del
 * tipo `Arqueo` de Cajas (M2, §6.10). Se leen con Number() porque llegan como JSON.
 */
export type ArqueoInicio = Pick<
  Arqueo,
  | "cobros"
  | "cobros_efectivo"
  | "cobros_transferencia"
  | "quintas"
  | "ambulantes"
  | "canon"
  | "rendido"
  | "rendido_quintas"
  | "rendido_ambulantes"
  | "rendido_canon"
  | "juntado"
  | "gastos_pagados"
  | "ajustes"
  | "efectivo"
  | "transferencia"
  | "cheques"
>;

const CLAVES_ARQUEO: (keyof ArqueoInicio)[] = [
  "cobros",
  "cobros_efectivo",
  "cobros_transferencia",
  "quintas",
  "ambulantes",
  "canon",
  "rendido",
  "rendido_quintas",
  "rendido_ambulantes",
  "rendido_canon",
  "juntado",
  "gastos_pagados",
  "ajustes",
  "efectivo",
  "transferencia",
  "cheques",
];

export type CajaHoy = {
  id: string;
  estado: "abierta" | "cerrada" | "integrada" | "validada";
  /** null si la RPC no respondió (se muestra el estado sin números). */
  arqueo: ArqueoInicio | null;
};

/** La caja de hoy de ese tipo con su arqueo (en vivo si está abierta, el del cierre si no). */
export async function cajaDeHoy(
  supabase: Supabase,
  org: string,
  tipo: "administracion" | "guardia"
): Promise<CajaHoy | null> {
  const { data: caja } = await supabase
    .from("cajas")
    .select("id, estado")
    .eq("org_id", org)
    .eq("tipo", tipo)
    .eq("fecha", hoyISO())
    .maybeSingle();
  if (!caja) return null;
  const { data, error } = await supabase.rpc("arqueo_caja", { p_caja: caja.id });
  let arqueo: ArqueoInicio | null = null;
  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    const crudo = data as Record<string, unknown>;
    arqueo = Object.fromEntries(
      CLAVES_ARQUEO.map((k) => [k, Number(crudo[k] ?? 0) || 0])
    ) as ArqueoInicio;
  }
  return { id: caja.id, estado: caja.estado, arqueo };
}

/** Resumen por concepto del mes (estimado, cobrado, beneficios, pendiente). */
export async function resumenDelMes(supabase: Supabase, periodo: string): Promise<ResumenConcepto[]> {
  const { data } = await supabase.rpc("resumen_conceptos", { p_periodo: periodo });
  return ((data ?? []) as ResumenConcepto[]).map((f) => ({
    codigo: f.codigo,
    nombre: f.nombre,
    estimado: Number(f.estimado ?? 0),
    cobrado: Number(f.cobrado ?? 0),
    descuentos: Number(f.descuentos ?? 0),
    pendiente: Number(f.pendiente ?? 0),
  }));
}

/** Cobranza por día de los últimos 14 días (cobros + bono camioneros, sin anulados). */
export async function serieUltimos14(supabase: Supabase, org: string): Promise<PuntoCobranza[]> {
  const rango = rangoUltimosDias(14);
  const [pagosRes, canonRes] = await Promise.all([
    supabase
      .from("pagos")
      .select("fecha, monto")
      .eq("org_id", org)
      .eq("anulado", false)
      .gte("fecha", `${rango.desde}T00:00:00-03:00`),
    supabase
      .from("canon_camiones")
      .select("fecha, monto")
      .eq("org_id", org)
      .eq("anulado", false)
      .gte("fecha", rango.desde),
  ]);
  return armarSerieDiaria(rango.desde, rango.hasta, pagosRes.data ?? [], canonRes.data ?? []);
}

/** Inicio del día argentino de hace `dias` días, como timestamptz ("2026-09-21T00:00:00-03:00"). */
export function desdeHaceDias(dias: number): string {
  const d = fechaLocal(hoyISO());
  d.setDate(d.getDate() - dias);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${iso}T00:00:00-03:00`;
}

/** count con head: cuántas filas, sin traerlas. */
export async function contar(q: PromiseLike<{ count: number | null }>): Promise<number> {
  return (await q).count ?? 0;
}
