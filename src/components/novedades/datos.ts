import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { finDeMes, type NovedadVista } from "./constantes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Columnas de novedades_personal que usa la UI. */
export const COLUMNAS_NOVEDAD =
  "id, empleado_id, tipo, estado, fecha_desde, fecha_hasta, horas, justificada, detalle, adjunto_path, motivo_rechazo, motivo_anulacion, cargada_por, cargada_en, revisada_por, revisada_en, anulada_por, anulada_en";

export type FilaNovedadBD = Pick<
  Tables<"novedades_personal">,
  | "id"
  | "empleado_id"
  | "tipo"
  | "estado"
  | "fecha_desde"
  | "fecha_hasta"
  | "horas"
  | "justificada"
  | "detalle"
  | "adjunto_path"
  | "motivo_rechazo"
  | "motivo_anulacion"
  | "cargada_por"
  | "cargada_en"
  | "revisada_por"
  | "revisada_en"
  | "anulada_por"
  | "anulada_en"
>;

/** Novedades (de cualquier estado) que tocan el mes: `desde ≤ fin` y `hasta ≥ inicio`. */
export async function novedadesDelMes(
  supabase: Supabase,
  periodo: string,
  empleadoId?: string
): Promise<FilaNovedadBD[]> {
  let q = supabase
    .from("novedades_personal")
    .select(COLUMNAS_NOVEDAD)
    .lte("fecha_desde", finDeMes(periodo))
    .or(`fecha_hasta.gte.${periodo},fecha_desde.gte.${periodo}`)
    .order("fecha_desde")
    .order("cargada_en");
  if (empleadoId) q = q.eq("empleado_id", empleadoId);
  const { data } = await q;
  return (data ?? []) as FilaNovedadBD[];
}

/**
 * Arma las vistas: nombres de quién cargó / revisó / anuló (perfiles del equipo) y links
 * firmados (1 h) de los certificados. Si un link no se puede firmar, queda sin link.
 */
export async function armarVistas(supabase: Supabase, filas: FilaNovedadBD[]): Promise<NovedadVista[]> {
  if (filas.length === 0) return [];
  const usuarios = Array.from(
    new Set(
      filas.flatMap((f) => [f.cargada_por, f.revisada_por, f.anulada_por]).filter((u): u is string => Boolean(u))
    )
  );
  const paths = Array.from(new Set(filas.map((f) => f.adjunto_path).filter((p): p is string => Boolean(p))));

  const [perfilesRes, firmadasRes] = await Promise.all([
    usuarios.length
      ? supabase.from("perfiles").select("user_id, nombre").in("user_id", usuarios)
      : Promise.resolve({ data: [] as { user_id: string; nombre: string }[] }),
    paths.length
      ? supabase.storage.from("documentos").createSignedUrls(paths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);

  const nombres = new Map((perfilesRes.data ?? []).map((p) => [p.user_id, p.nombre]));
  const urls = new Map<string, string>();
  for (const f of firmadasRes.data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl);
  const nombre = (u: string | null) => (u ? (nombres.get(u) ?? null) : null);

  return filas.map((f) => ({
    id: f.id,
    empleado_id: f.empleado_id,
    tipo: f.tipo,
    estado: f.estado,
    fecha_desde: f.fecha_desde,
    fecha_hasta: f.fecha_hasta,
    horas: f.horas === null ? null : Number(f.horas),
    justificada: f.justificada,
    detalle: f.detalle,
    adjuntoUrl: f.adjunto_path ? (urls.get(f.adjunto_path) ?? null) : null,
    tieneAdjunto: Boolean(f.adjunto_path),
    motivo_rechazo: f.motivo_rechazo,
    motivo_anulacion: f.motivo_anulacion,
    cargada_por: f.cargada_por,
    cargadaPor: nombre(f.cargada_por),
    cargada_en: f.cargada_en,
    revisadaPor: nombre(f.revisada_por),
    revisada_en: f.revisada_en,
    anuladaPor: nombre(f.anulada_por),
    anulada_en: f.anulada_en,
  }));
}
