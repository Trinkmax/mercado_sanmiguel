import type { Rol } from "@/lib/auth";
import type { IdCapitulo } from "@/lib/tour/tipos";

/**
 * Lo que el tour recuerda en el dispositivo (comodidades, no datos del negocio):
 * - el tour en curso (sessionStorage: sobrevive a recargar la página, no a cerrar la pestaña);
 * - dónde quedó un recorrido que se cerró a la mitad, los capítulos vistos y si ya se
 *   ofreció la bienvenida (localStorage, por usuario y rol).
 * En modo privado o sin almacenamiento, el tour funciona igual sin memoria.
 */

export type EstadoGuardado = {
  rol: Rol;
  /** De quién es (tablet compartida: otra persona con el mismo rol no lo hereda). */
  usuario: string;
  caps: IdCapitulo[];
  /** Por capítulo, si empezó con "Vamos a…" (cambia la cuenta de pasos). */
  conIr: boolean[];
  modo: "capitulo" | "recorrido";
  iCap: number;
  iPaso: number;
};

export type Retomar = { caps: IdCapitulo[]; iCap: number };

const CLAVE_ACTIVO = "msm-tour-activo";

function leer<T>(almacen: "local" | "session", clave: string): T | null {
  try {
    const s = almacen === "local" ? window.localStorage : window.sessionStorage;
    const crudo = s.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribir(almacen: "local" | "session", clave: string, valor: unknown) {
  try {
    const s = almacen === "local" ? window.localStorage : window.sessionStorage;
    if (valor === null) s.removeItem(clave);
    else s.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: se vive sin memoria */
  }
}

export const memoria = {
  activo: () => leer<EstadoGuardado>("session", CLAVE_ACTIVO),
  guardarActivo: (e: EstadoGuardado | null) => escribir("session", CLAVE_ACTIVO, e),

  retomar: (usuario: string, rol: Rol) => leer<Retomar>("local", `msm-tour-retomar:${usuario}:${rol}`),
  guardarRetomar: (usuario: string, rol: Rol, r: Retomar | null) =>
    escribir("local", `msm-tour-retomar:${usuario}:${rol}`, r),

  vistos: (usuario: string, rol: Rol) => leer<IdCapitulo[]>("local", `msm-tour-vistos:${usuario}:${rol}`) ?? [],
  marcarVisto: (usuario: string, rol: Rol, id: IdCapitulo) => {
    const vistos = memoria.vistos(usuario, rol);
    if (!vistos.includes(id)) escribir("local", `msm-tour-vistos:${usuario}:${rol}`, [...vistos, id]);
  },

  bienvenidaVista: (usuario: string, rol: Rol) =>
    leer<boolean>("local", `msm-tour-bienvenida:${usuario}:${rol}`) === true,
  marcarBienvenida: (usuario: string, rol: Rol) =>
    escribir("local", `msm-tour-bienvenida:${usuario}:${rol}`, true),
};
