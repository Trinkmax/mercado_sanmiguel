/** Tipos compartidos del mapa del mercado (server → cliente). */

export type EstadoEspacio = "al_dia" | "debe" | "vencido";

export type EspacioMapa = {
  id: string;
  codigo: number;
  nombre: string;
  deuda: number;
  estado: EstadoEspacio;
};

export type DepositoMapa = EspacioMapa & {
  galpones: number;
  contenedores: number;
};
