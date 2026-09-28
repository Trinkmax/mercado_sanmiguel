import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CategoriaCliente } from "@/lib/segmentos";
import { aClientePublico, type ClientePublico } from "./publico";
import { etiquetaLugar, type TipoRegistro } from "./constantes";
import type { RegistroStaff } from "./lista-registros";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** PostgREST corta cada respuesta en 1000 filas (igual que en lib/exportar). */
const TANDA = 1000;

type PedirTanda<T, E> = (
  desde: number,
  hasta: number
) => PromiseLike<{ data: T[] | null; error: E | null }>;

/**
 * Trae TODAS las filas de una consulta, en tandas de 1000. La consulta tiene que venir
 * ordenada por una columna única (si no, las tandas se pisan). Sin esto, "La vieron X de Y"
 * y los públicos se quedaban cortos en silencio cuando la tabla pasaba las 1000 filas.
 * Si una tanda falla, corta y devuelve lo que llegó JUNTO con el error: quien decide algo
 * con el total (ej.: "nadie entra en ese público") tiene que mirar `error` antes de contar.
 */
export async function todasLasFilasOError<T, E>(
  pedir: PedirTanda<T, E>
): Promise<{ filas: T[]; error: E | null }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TANDA) {
    const { data, error } = await pedir(desde, desde + TANDA - 1);
    if (error) return { filas, error };
    if (!data) break;
    filas.push(...data);
    if (data.length < TANDA) break;
  }
  return { filas, error: null };
}

/**
 * Igual que `todasLasFilasOError`, pero ignora el error y devuelve lo que llegó (igual que
 * antes con `data ?? []`). Solo para pantallas de listado, donde mostrar de menos no hace daño.
 */
export async function todasLasFilas<T, E>(pedir: PedirTanda<T, E>): Promise<T[]> {
  return (await todasLasFilasOError(pedir)).filas;
}

/** Filas de v_clientes_segmentos (cada rol ve lo que su RLS le deja). */
export async function cargarClientesPublico(
  supabase: Supabase,
  filtro?: { clienteId?: string }
): Promise<ClientePublico[]> {
  const data = await todasLasFilas((desde, hasta) => {
    let q = supabase
      .from("v_clientes_segmentos")
      .select("cliente_id, codigo, nombre, apodo, categoria, segmentos, tiene_portal, activo")
      .order("codigo")
      .order("cliente_id");
    if (filtro?.clienteId) q = q.eq("cliente_id", filtro.clienteId);
    return q.range(desde, hasta);
  });
  return data.map(aClientePublico).filter((c): c is ClientePublico => c !== null);
}

/** "La vio" de las circulares (todas, o las de una circular), sin el tope de 1000 filas. */
export async function cargarRecepciones(
  supabase: Supabase,
  filtro?: { circularId?: string }
): Promise<{ circular_id: string; cliente_id: string; recibida_en: string }[]> {
  return todasLasFilas((desde, hasta) => {
    let q = supabase
      .from("circular_recepciones")
      .select("circular_id, cliente_id, recibida_en")
      .order("id");
    if (filtro?.circularId) q = q.eq("circular_id", filtro.circularId);
    return q.range(desde, hasta);
  });
}

/**
 * Registros para el panel del staff. Administración ve solo los de SUS clientes (puesteros):
 * la RLS le deja leer todo, pero la UI y las RPC de escritura la limitan (decisiones §1).
 */
export async function cargarRegistros(
  supabase: Supabase,
  opciones: { categorias: CategoriaCliente[]; tipo?: TipoRegistro; clienteId?: string }
): Promise<RegistroStaff[]> {
  let q = supabase
    .from("sanciones")
    .select(
      "id, numero, tipo, titulo, fecha, estado, visto_en, ultimo_mensaje_en, creado_en, multa, multa_sin_efecto_en, clientes!inner(id, codigo, nombre, apodo, categoria, auth_user_id), espacios(tipo, numero, medio), cargos(estado, monto, monto_pagado, vencimiento)"
    )
    .in("clientes.categoria", opciones.categorias)
    .order("creado_en", { ascending: false })
    .limit(500);
  if (opciones.tipo) q = q.eq("tipo", opciones.tipo);
  if (opciones.clienteId) q = q.eq("cliente_id", opciones.clienteId);
  const { data } = await q;
  const filas = data ?? [];
  if (filas.length === 0) return [];

  // "Lo ve en el portal" = usuario vinculado y perfil activo (tiene_portal de la vista).
  const ids = [...new Set(filas.map((f) => (Array.isArray(f.clientes) ? f.clientes[0] : f.clientes)?.id))].filter(
    (x): x is string => Boolean(x)
  );
  const { data: portal } = await supabase
    .from("v_clientes_segmentos")
    .select("cliente_id, tiene_portal")
    .in("cliente_id", ids);
  const conPortal = new Set((portal ?? []).filter((p) => p.tiene_portal).map((p) => p.cliente_id));

  return filas.flatMap((f) => {
    const cliente = Array.isArray(f.clientes) ? f.clientes[0] : f.clientes;
    if (!cliente) return [];
    const espacio = Array.isArray(f.espacios) ? f.espacios[0] : f.espacios;
    const cargo = Array.isArray(f.cargos) ? f.cargos[0] : f.cargos;
    const r: RegistroStaff = {
      id: f.id,
      numero: f.numero,
      tipo: f.tipo as TipoRegistro,
      titulo: f.titulo,
      fecha: f.fecha,
      estado: f.estado,
      visto_en: f.visto_en,
      ultimo_mensaje_en: f.ultimo_mensaje_en,
      creado_en: f.creado_en,
      multa: f.multa === null ? null : Number(f.multa),
      multa_sin_efecto_en: f.multa_sin_efecto_en,
      cargo: cargo
        ? {
            estado: cargo.estado,
            monto: Number(cargo.monto),
            monto_pagado: Number(cargo.monto_pagado),
            vencimiento: cargo.vencimiento,
          }
        : null,
      cliente: { id: cliente.id, codigo: cliente.codigo, nombre: cliente.nombre, apodo: cliente.apodo },
      lugar: espacio ? etiquetaLugar(espacio) : null,
      tienePortal: conPortal.has(cliente.id),
    };
    return [r];
  });
}
