/** Tipos compartidos del plano del mercado (server → cliente).
 * Interfaz congelada (FASE3 §6.10): solo se suman campos OPCIONALES. */

import type { AvanceMes, CategoriaCliente } from "@/lib/segmentos";

export type EstadoCobro = "al_dia" | "debe" | "vencido";

/** Espacio físico que se asigna a un cliente (tabla `espacios`). Cochera (EXPC),
 * subgalpón (EXPG) y quinta de la playa (EXPQ) se asignan uno por uno (0032). */
export type TipoEspacio = "puesto" | "bar" | "local" | "contenedor" | "cochera" | "galpon" | "quinta" | "invernadero";

/** Lo fijo del predio (tabla `plano_elementos`). */
export type TipoElemento =
  | "nave"
  | "pasillo"
  | "cocheras"
  | "quinteros"
  | "administracion"
  | "invernadero"
  | "recinto"
  | "rotulo"
  | "galpon";

/** Rectángulo en unidades del plano. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Espacio = Rect & {
  id: string;
  tipo: TipoEspacio;
  /** Número visible; null = sin número (el plano muestra "?"). */
  numero: string | null;
  /** Medio puesto: cuenta 0,5 para la expensa (EXME, o EXPP si es propio). */
  medio: boolean;
  /** Cuántos puestos cuenta (½, 1, 1½, 2, 2½ o 3; 0036). Sin dato: ½ si es medio, si no 1. */
  tamano?: number;
  /** Lo ocupa un inquilino; `duenio` es el nombre del dueño (solo Administración y el Líder). */
  enAlquiler?: boolean;
  duenio?: string | null;
  /** Puesto propio de la cooperativa (C3): paga EXPP en vez de EXME. Solo puestos. */
  propio?: boolean;
  /** Puestos que el plano original dibuja juntos (un mismo puestero). */
  grupo: string | null;
  nota: string | null;
  clienteId: string | null;
};

export type ElementoPlano = Rect & {
  id: string;
  tipo: TipoElemento;
  etiqueta: string | null;
  capacidad: number | null;
};

/** Lo que el cliente tiene facturado (cantidades activas por concepto). */
export type Facturado = {
  puestos: number; // EXME (expensa del puesto común)
  locales: number; // EXPL
  contenedores: number; // EXPE (contéiners)
  quintas: number; // EXPQ
  cocheras: number; // EXPC
  galpones: number; // EXPG
  /** EXPP: expensa de los puestos propios de la cooperativa (C6). */
  propios?: number;
};

/** Códigos que el plano cruza contra la carpeta ("Facturar en la carpeta"). */
export type CodigoPlano = "EXME" | "EXPP" | "EXPL" | "EXPE" | "EXPC" | "EXPG" | "EXPQ";

/** Fila de cliente_conceptos del cliente para un código del plano. */
export type ItemCarpeta = { id: string; cantidad: number; activo: boolean };

export type ClienteMapa = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  deuda: number;
  estado: EstadoCobro;
  facturado: Facturado;
  /** Quién lo gestiona (puestero → Administración; quintero/ambulante → Jefe). */
  categoria?: CategoriaCliente;
  /** Avance del mes (v_avance_mes del período actual): "2 de 4 · Falta $165.000". */
  mes?: AvanceMes | null;
  /** Sus filas de cliente_conceptos de los códigos del plano (para proponer el ajuste). */
  carpeta?: Partial<Record<CodigoPlano, ItemCarpeta>>;
  /** Hay un cambio de conceptos esperando al Líder. */
  cambioPendiente?: boolean;
};

/** "completa": Administración y Líder. "porteria": el Jefe de Portería (G11): puestos
 * sin datos de clientes y solo la zona de quinteros con su estado. */
export type VistaMapa = "completa" | "porteria";

/** Aviso ya hecho sobre un puesto (solicitud con espacio_id), para no repetirlo. */
export type AvisoPuestoPrevio = {
  id: string;
  numero: number;
  asunto: string;
  estado: string;
  creadaEn: string;
};

/** A qué ir al tocar a un cliente: su ficha y/o la pantalla de cobro. */
export type Destinos = {
  ficha: string | null;
  cobro: string | null;
};
