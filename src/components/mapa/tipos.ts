/** Tipos compartidos del plano del mercado (server → cliente). */

export type EstadoCobro = "al_dia" | "debe" | "vencido";

/** Espacio físico que se asigna a un cliente (tabla `espacios`). */
export type TipoEspacio = "puesto" | "bar" | "local" | "contenedor";

/** Lo fijo del predio (tabla `plano_elementos`). */
export type TipoElemento =
  | "nave"
  | "pasillo"
  | "cocheras"
  | "quinteros"
  | "administracion"
  | "invernadero"
  | "recinto"
  | "rotulo";

/** Rectángulo en unidades del plano. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Espacio = Rect & {
  id: string;
  tipo: TipoEspacio;
  /** Número visible; null = sin número (el plano muestra "?"). */
  numero: string | null;
  /** Medio puesto: cuenta 0,5 para la expensa de puestos. */
  medio: boolean;
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
  puestos: number; // EXPP
  locales: number; // EXPL
  contenedores: number; // EXPE
  quintas: number; // EXPQ
  cocheras: number; // EXPC
  galpones: number; // EXPG
};

export type ClienteMapa = {
  id: string;
  codigo: number;
  nombre: string;
  apodo: string | null;
  deuda: number;
  estado: EstadoCobro;
  facturado: Facturado;
};

/** A qué ir al tocar a un cliente: su ficha y/o la pantalla de cobro. */
export type Destinos = {
  ficha: string | null;
  cobro: string | null;
};
