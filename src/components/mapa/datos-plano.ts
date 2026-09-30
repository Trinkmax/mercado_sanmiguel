import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/auth";
import type { ElementoPlano, Espacio, TipoElemento, TipoEspacio } from "./tipos";

/**
 * Carga del plano (server). Una sola fuente para /mapa y el selector de lugar
 * (`planoParaSelector`). Quién ve qué (G11, 0022):
 *  · Administración y el Líder leen la tabla `espacios` (con cliente y nota).
 *  · El Jefe de Portería, Portería y Tesorería NO: usan `espacios_del_plano()` (número,
 *    tipo, medio, propio y geometría) y reciben clienteId/nota en null. Nada de quién
 *    ocupa un puesto sale al navegador para ellos.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const TIPOS_ESPACIO: TipoEspacio[] = ["puesto", "bar", "local", "contenedor", "cochera", "galpon", "quinta", "invernadero"];
const TIPOS_ELEMENTO: TipoElemento[] = [
  "nave",
  "pasillo",
  "cocheras",
  "quinteros",
  "administracion",
  "invernadero",
  "recinto",
  "rotulo",
  "galpon",
];

/** Roles que pueden ver quién ocupa cada espacio. */
export function veOcupacion(rol: Rol): boolean {
  return rol === "admin" || rol === "lider";
}

export type Plano = { espacios: Espacio[]; elementos: ElementoPlano[]; error: string | null };

export async function cargarPlano(
  supabase: Supabase,
  perfil: { org_id: string; rol: Rol },
  opciones: { conClientes: boolean }
): Promise<Plano> {
  const conClientes = opciones.conClientes && veOcupacion(perfil.rol);

  const [espaciosRes, elementosRes] = await Promise.all([
    conClientes
      ? supabase
          .from("espacios")
          .select("id, tipo, numero, medio, propio, grupo, nota, cliente_id, x, y, w, h, tamano, en_alquiler, duenio")
          .eq("org_id", perfil.org_id)
      : supabase.rpc("espacios_del_plano"),
    supabase
      .from("plano_elementos")
      .select("id, tipo, etiqueta, capacidad, x, y, w, h, orden")
      .eq("org_id", perfil.org_id)
      .order("orden"),
  ]);

  type FilaEspacio = {
    id: string;
    tipo: string;
    numero: string | null;
    medio: boolean;
    propio: boolean | null;
    grupo: string | null;
    nota?: string | null;
    cliente_id?: string | null;
    tamano?: number | string | null;
    en_alquiler?: boolean | null;
    duenio?: string | null;
    x: number | string;
    y: number | string;
    w: number | string;
    h: number | string;
  };
  const filas = (espaciosRes.data ?? []) as FilaEspacio[];

  const espacios: Espacio[] = filas
    .filter((e) => TIPOS_ESPACIO.includes(e.tipo as TipoEspacio))
    .map((e) => ({
      id: e.id,
      tipo: e.tipo as TipoEspacio,
      numero: e.numero,
      medio: Boolean(e.medio),
      // El Jefe y Portería no reciben el tamaño (espacios_del_plano): sale de "medio".
      tamano: e.tamano !== undefined && e.tamano !== null ? Number(e.tamano) : e.medio ? 0.5 : 1,
      enAlquiler: conClientes ? Boolean(e.en_alquiler) : false,
      duenio: conClientes ? (e.duenio ?? null) : null,
      propio: Boolean(e.propio),
      grupo: e.grupo,
      nota: conClientes ? (e.nota ?? null) : null,
      clienteId: conClientes ? (e.cliente_id ?? null) : null,
      x: Number(e.x),
      y: Number(e.y),
      w: Number(e.w),
      h: Number(e.h),
    }));

  const elementos: ElementoPlano[] = (elementosRes.data ?? [])
    .filter((e): e is typeof e & { tipo: TipoElemento } => TIPOS_ELEMENTO.includes(e.tipo as TipoElemento))
    .map((e) => ({
      id: e.id,
      tipo: e.tipo,
      // C2: en pantalla es "Contéiners" aunque el dibujo viejo diga "Contenedores".
      etiqueta: e.etiqueta ? e.etiqueta.replace(/contenedor(es)?/gi, (m) => (m.length > 10 ? "Contéiners" : "Contéiner")) : null,
      capacidad: e.capacidad,
      x: Number(e.x),
      y: Number(e.y),
      w: Number(e.w),
      h: Number(e.h),
    }));

  const error = espaciosRes.error?.message ?? elementosRes.error?.message ?? null;
  return { espacios, elementos, error };
}
