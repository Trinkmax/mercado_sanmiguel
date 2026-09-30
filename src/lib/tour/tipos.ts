import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { Rol } from "@/lib/auth";

/**
 * Tour guiado (docs/GUIA-TOUR.md). Un **capítulo** enseña una pantalla (Cobrar, Caja del
 * día…); el **recorrido** de un rol es la lista de capítulos en el orden de su trabajo.
 * Cada **paso** señala un elemento real de la pantalla (su `data-tour`) o, si no está
 * (lista vacía, sin datos todavía), muestra una pantalla de ejemplo.
 */

export type IdCapitulo =
  | "bienvenida"
  | "bienvenida-socio"
  | "inicio"
  | "mapa"
  | "cobrar"
  | "caja"
  | "cheques"
  | "tesoreria"
  | "gastos"
  | "clientes"
  | "aprobaciones"
  | "porteria"
  | "personal"
  | "comunicaciones"
  | "novedades"
  | "solicitudes"
  | "facturacion"
  | "energia"
  | "reportes"
  | "configuracion"
  | "socio-cuenta"
  | "socio-comunicaciones"
  | "socio-solicitudes";

/** Qué hace la persona en el paso. */
export type AccionPaso =
  /** Solo mira: el elemento se ilumina pero no se puede tocar (nada se guarda por error). */
  | "mirar"
  /** Puede tocar el elemento señalado y el tour sigue solo. SOLO para lo que no guarda
   * nada: links del menú, pestañas, filtros, buscar, abrir una ficha. */
  | "tocar";

/** Lo que puede cambiar de un paso según qué ancla apareció o si no apareció ninguna. */
export type AjustePaso = {
  titulo?: string;
  texto?: string;
  pantalla?: ComponentType;
  consejo?: string;
  accion?: AccionPaso;
};

export type Paso = {
  /** Único dentro del capítulo (kebab-case). */
  id: string;
  /**
   * Pantalla donde ocurre, si no es la del capítulo. Admite un segmento `[id]`
   * ("/clientes/[id]"): para llegar se sigue el link `entrar` de la pantalla anterior.
   */
  ruta?: string;
  /** Ancla (`data-tour`) de un link visible que lleva a `ruta` (p. ej. la primera fila de
   * la lista). Si no hay ninguno (lista vacía), el paso se muestra con su pantalla de ejemplo. */
  entrar?: string;
  /** `data-tour` del elemento a señalar; con varias, la primera que esté visible. Sin
   * ancla: la tarjeta va al centro (sirve para explicar algo general). */
  ancla?: string | string[];
  titulo: string;
  /** 1 a 3 oraciones cortas, con voseo. Los botones se nombran como en pantalla: «Cobrar». */
  texto: string;
  /** Por defecto "mirar". */
  accion?: AccionPaso;
  /** Pantalla de ejemplo (dibujo quieto) que acompaña el paso: lo que se abre al tocar,
   * cómo queda, o la pantalla entera cuando todavía no hay datos. */
  pantalla?: ComponentType;
  /** Un consejo o un "ojo" corto, destacado. */
  consejo?: string;
  /** Ajustes según qué ancla se encontró (clave = nombre del ancla). */
  variantes?: Record<string, AjustePaso>;
  /** Ajustes si no aparece ninguna ancla (sin datos todavía, estado distinto…). */
  sinAncla?: AjustePaso;
  /** Si su ancla no aparece, el paso se saltea (en vez de mostrarse con su ejemplo):
   * para lo que solo existe a veces (saldo a favor, avisos pendientes). */
  opcional?: boolean;
};

/** Lo que escribe cada área (src/lib/tour/contenido/*). */
export type ContenidoCapitulo = {
  /** Pasos para ese rol (el capítulo solo se ofrece a los roles de su metadato). */
  pasos: (rol: Rol) => Paso[];
  /** Pantalla de ejemplo chica para la portada del capítulo en la Guía. */
  portada?: ComponentType;
  /** Portada distinta según el rol (si devuelve undefined, se usa `portada`). */
  portadaPorRol?: (rol: Rol) => ComponentType | undefined;
};

/** Metadatos del capítulo (src/lib/tour/indice.ts): livianos, sin pasos ni dibujos. */
export type MetaCapitulo = {
  id: IdCapitulo;
  /** Pantalla principal del capítulo. Sin ruta: se hace donde la persona está. */
  ruta?: string;
  /** Otras rutas (prefijos) que el botón «Ayuda» asocia a este capítulo. */
  cubre?: string[];
  roles: Rol[];
  icono: LucideIcon;
  titulo: (rol: Rol) => string;
  /** Para qué sirve, en una línea. */
  resumen: (rol: Rol) => string;
};

export type Capitulo = MetaCapitulo & ContenidoCapitulo;
