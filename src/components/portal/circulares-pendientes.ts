import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Cuántas circulares obligatorias (activas) le faltan confirmar al socio.
 * Mientras haya alguna, el portal se atenúa en /mi-cuenta y las subpáginas
 * (solicitudes) lo mandan de vuelta a confirmar.
 */
export async function contarCircularesPendientes(
  supabase: Supabase,
  clienteId: string
): Promise<number> {
  const [circularesRes, recepcionesRes] = await Promise.all([
    supabase
      .from("circulares")
      .select("id")
      .eq("activa", true)
      .eq("obligatoria", true),
    supabase
      .from("circular_recepciones")
      .select("circular_id")
      .eq("cliente_id", clienteId),
  ]);
  const recibidas = new Set(
    (recepcionesRes.data ?? []).map((r) => r.circular_id)
  );
  return (circularesRes.data ?? []).filter((c) => !recibidas.has(c.id)).length;
}
