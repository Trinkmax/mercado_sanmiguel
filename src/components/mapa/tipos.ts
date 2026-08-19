/** Tipos compartidos del mapa del mercado (server → cliente). */

export type EstadoEspacio = "al_dia" | "debe" | "vencido";

/** Tipo de espacio en el plano (coincide con el check de `mapa_posiciones.tipo`). */
export type TipoEspacio = "puesto" | "quinta" | "local" | "deposito";

export type EspacioMapa = {
  id: string;
  codigo: number;
  nombre: string;
  /** Apodo del puesto ("Don Pedro"): va debajo del número en la celda. */
  apodo: string | null;
  deuda: number;
  estado: EstadoEspacio;
};

export type DepositoMapa = EspacioMapa & {
  galpones: number;
  contenedores: number;
};

/** Posición persistida de una celda (coordenadas del viewBox 1000×640 del plano).
 * Sin fila → la celda se reparte sola en su zona. */
export type PosicionMapa = {
  cliente_id: string;
  tipo: TipoEspacio;
  x: number;
  y: number;
};
