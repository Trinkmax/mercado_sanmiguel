import type { Rol } from "@/lib/auth";
import { CAPITULOS_META, RECORRIDOS } from "@/lib/tour/indice";
import type { Capitulo, ContenidoCapitulo, IdCapitulo } from "@/lib/tour/tipos";
import { BIENVENIDA, BIENVENIDA_SOCIO } from "@/lib/tour/contenido/general";
import { INICIO, MAPA } from "@/lib/tour/contenido/inicio-mapa";
import { COBRAR } from "@/lib/tour/contenido/cobranza";
import { CAJA, CHEQUES } from "@/lib/tour/contenido/caja-cheques";
import { GASTOS, TESORERIA } from "@/lib/tour/contenido/tesoreria-gastos";
import { APROBACIONES, CLIENTES } from "@/lib/tour/contenido/clientes-aprobaciones";
import { PERSONAL, PORTERIA } from "@/lib/tour/contenido/porteria-personal";
import {
  COMUNICACIONES,
  NOVEDADES,
  SOCIO_COMUNICACIONES,
} from "@/lib/tour/contenido/comunicaciones-novedades";
import { SOCIO_SOLICITUDES, SOLICITUDES } from "@/lib/tour/contenido/solicitudes";
import { CONFIGURACION, ENERGIA, FACTURACION, REPORTES } from "@/lib/tour/contenido/mes";
import { SOCIO_CUENTA } from "@/lib/tour/contenido/portal";

/**
 * Registro completo del tour: metadatos + pasos + pantallas de ejemplo. Es pesado (todos
 * los dibujos): el proveedor lo carga recién al empezar un tour; la Guía lo importa directo.
 */
const CONTENIDO: Record<IdCapitulo, ContenidoCapitulo> = {
  bienvenida: BIENVENIDA,
  "bienvenida-socio": BIENVENIDA_SOCIO,
  inicio: INICIO,
  mapa: MAPA,
  cobrar: COBRAR,
  caja: CAJA,
  cheques: CHEQUES,
  tesoreria: TESORERIA,
  gastos: GASTOS,
  clientes: CLIENTES,
  aprobaciones: APROBACIONES,
  porteria: PORTERIA,
  personal: PERSONAL,
  comunicaciones: COMUNICACIONES,
  novedades: NOVEDADES,
  solicitudes: SOLICITUDES,
  facturacion: FACTURACION,
  energia: ENERGIA,
  reportes: REPORTES,
  configuracion: CONFIGURACION,
  "socio-cuenta": SOCIO_CUENTA,
  "socio-comunicaciones": SOCIO_COMUNICACIONES,
  "socio-solicitudes": SOCIO_SOLICITUDES,
};

export function capitulo(id: IdCapitulo): Capitulo {
  return { ...CAPITULOS_META[id], ...CONTENIDO[id] };
}

/** Los capítulos del recorrido del rol, con sus pasos para ese rol (los vacíos no cuentan). */
export function capitulosDeRol(rol: Rol): Capitulo[] {
  return (RECORRIDOS[rol] ?? []).map(capitulo).filter((c) => c.pasos(rol).length > 0);
}
