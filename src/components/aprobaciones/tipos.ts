/** Tipos compartidos del módulo de aprobaciones (página, cards, historial). */

export type EntidadCambio = "cliente" | "cliente_concepto" | "concepto";
export type AccionCambio = "alta" | "modificacion" | "baja";
export type EstadoCambio = "pendiente" | "aprobado" | "rechazado";

export type Datos = Record<string, unknown>;

export type ReferenciaCliente = {
  id: string;
  codigo: number;
  nombre: string;
};

export type ReferenciaConcepto = {
  codigo: string;
  nombre: string;
};

/** Un cambio propuesto, ya "traducido" para mostrar (nombres en vez de uuids). */
export type CambioFila = {
  id: string;
  entidad: EntidadCambio;
  accion: AccionCambio;
  entidad_id: string | null;
  resumen: string;
  estado: EstadoCambio;
  datos: Datos;
  datos_anteriores: Datos | null;
  /** Cliente al que afecta (alta de cliente: null hasta que se apruebe). */
  cliente: ReferenciaCliente | null;
  /** Concepto al que afecta (concepto o ítem de cliente). */
  concepto: ReferenciaConcepto | null;
  solicitadoPor: string | null;
  solicitadoRol: string | null;
  solicitadoEn: string;
  revisadoPor: string | null;
  revisadoEn: string | null;
  motivoRechazo: string | null;
  resultadoId: string | null;
};

export const LABEL_ENTIDAD: Record<EntidadCambio, string> = {
  cliente: "Cliente",
  cliente_concepto: "Concepto del cliente",
  concepto: "Concepto",
};

export const LABEL_ACCION: Record<AccionCambio, string> = {
  alta: "Alta",
  modificacion: "Modificación",
  baja: "Baja",
};
