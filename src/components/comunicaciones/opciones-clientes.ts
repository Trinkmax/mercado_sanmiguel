import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CategoriaCliente } from "@/lib/segmentos";
import { etiquetaLugar } from "./constantes";
import type { ClienteOpcion } from "./form-registro";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Clientes activos que el rol puede notificar (Administración: puesteros; Líder: todos), con sus
 * lugares del plano, la deuda de hoy y si ven el portal. Para el buscador de "Nuevo registro".
 */
export async function opcionesClientes(
  supabase: Supabase,
  categorias: CategoriaCliente[],
  soloClienteId?: string
): Promise<ClienteOpcion[]> {
  let qClientes = supabase
    .from("clientes")
    .select("id, codigo, nombre, apodo")
    .eq("activo", true)
    .in("categoria", categorias)
    .order("codigo");
  if (soloClienteId) qClientes = qClientes.eq("id", soloClienteId);

  let qEspacios = supabase
    .from("espacios")
    .select("id, tipo, numero, medio, cliente_id")
    .not("cliente_id", "is", null)
    .order("tipo")
    .order("numero");
  if (soloClienteId) qEspacios = qEspacios.eq("cliente_id", soloClienteId);

  let qDeuda = supabase.from("v_deuda_clientes").select("cliente_id, deuda");
  if (soloClienteId) qDeuda = qDeuda.eq("cliente_id", soloClienteId);

  let qPortal = supabase.from("v_clientes_segmentos").select("cliente_id, tiene_portal");
  if (soloClienteId) qPortal = qPortal.eq("cliente_id", soloClienteId);

  const [clientesRes, espaciosRes, deudaRes, portalRes] = await Promise.all([
    qClientes,
    qEspacios,
    qDeuda,
    qPortal,
  ]);

  const lugares = new Map<string, ClienteOpcion["lugares"]>();
  for (const e of espaciosRes.data ?? []) {
    if (!e.cliente_id) continue;
    const lista = lugares.get(e.cliente_id) ?? [];
    lista.push({ id: e.id, etiqueta: etiquetaLugar(e), numero: e.numero });
    lugares.set(e.cliente_id, lista);
  }
  const deuda = new Map<string, number>();
  for (const d of deudaRes.data ?? []) if (d.cliente_id) deuda.set(d.cliente_id, Number(d.deuda ?? 0));
  const portal = new Set(
    (portalRes.data ?? []).filter((p) => p.tiene_portal && p.cliente_id).map((p) => p.cliente_id as string)
  );

  return (clientesRes.data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    apodo: c.apodo,
    lugares: lugares.get(c.id) ?? [],
    deuda: Math.max(deuda.get(c.id) ?? 0, 0),
    tienePortal: portal.has(c.id),
  }));
}
