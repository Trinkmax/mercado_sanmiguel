/** Etiquetas visibles de los enums para las planillas exportadas.
 * Autocontenido a propósito: la exportación no depende de constantes de otros
 * módulos. Los valores de enum NO cambian (ver FASE2-CONTRATO). */

export const LABEL_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  cheque: "Cheque",
};

export const LABEL_TIPO_CAJA: Record<string, string> = {
  administracion: "Administración",
  guardia: "Caja de portería",
};

export const LABEL_ESTADO_CAJA: Record<string, string> = {
  abierta: "Abierta",
  cerrada: "Cerrada",
  integrada: "En caja mayor",
  validada: "Validada",
};

export const LABEL_ESTADO_CARGO: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
  anulado: "Anulado",
};

export const LABEL_ESTADO_CHEQUE: Record<string, string> = {
  en_cartera: "Por cobrar",
  entregado: "Entregado a proveedor",
  depositado: "Depositado",
  acreditado: "Acreditado",
  rechazado: "Rechazado",
};

export const LABEL_ESTADO_GASTO: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  anulado: "Anulado",
};

export const LABEL_TIPO_GASTO: Record<string, string> = {
  fijo: "Fijo",
  variable: "Variable",
};

export const LABEL_ORIGEN_PAGO_GASTO: Record<string, string> = {
  caja: "Caja del día",
  tesoreria: "Tesorería",
  cheque: "Cheque",
};

export const LABEL_TIPO_CANON: Record<string, string> = {
  camion: "Camión",
  ambulante: "Ambulante",
  quintero: "Quintero",
};

export const LABEL_TIPO_MOVIMIENTO: Record<string, string> = {
  impuesto: "Impuesto",
  debito_fiscal: "Débito fiscal",
  comision: "Comisión",
  ajuste: "Ajuste",
  deposito: "Depósito",
  extraccion: "Extracción",
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const LABEL_MONEDA: Record<string, string> = { ARS: "Pesos", USD: "Dólares" };

export const LABEL_CUENTA: Record<string, string> = { efectivo: "Efectivo", banco: "Banco" };

/** Bono camioneros (H1, H2). */
export const LABEL_UNIDAD_TARIFA: Record<string, string> = { vehiculo: "por vehículo", dia: "por día" };
export const LABEL_DESTINO_CANON: Record<string, string> = {
  puesto: "Puesto",
  verdulero: "Verdulero",
  ambulante: "Ambulante",
};

export const LABEL_CATEGORIA: Record<string, string> = {
  puestero: "Puestero",
  quintero: "Quintero",
  ambulante: "Ambulante",
};

export const LABEL_SECTOR: Record<string, string> = {
  porteria: "Portería",
  limpieza: "Limpieza",
  mantenimiento: "Mantenimiento",
  administracion: "Administración",
  otro: "Otro",
};

export const LABEL_TIPO_NOVEDAD: Record<string, string> = {
  falta: "Falta",
  llegada_tarde: "Llegada tarde",
  feriado_trabajado: "Feriado trabajado",
  vacaciones: "Vacaciones",
  licencia: "Licencia",
  horas_extra: "Horas extra",
  otra: "Otra",
};

export const LABEL_ESTADO_NOVEDAD: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  anulada: "Anulada",
};

export const LABEL_ESTADO_REGISTRO: Record<string, string> = {
  notificado: "Notificado",
  descargo: "Descargo presentado",
  respondido: "Respondido",
};

export const LABEL_RESOLUCION_DE: Record<string, string> = {
  jefe: "Jefe de Portería",
  lider: "Líder de Procesos",
  consejo: "Consejo",
};

export const LABEL_TIPO_SOLICITUD: Record<string, string> = {
  solicitud: "Solicitud",
  informe: "Informe",
  reclamo: "Reclamo",
  consulta: "Consulta",
};

export const LABEL_ORIGEN_SOLICITUD: Record<string, string> = {
  portal: "Portal del socio",
  porteria: "Portería",
  administracion: "Administración",
  lider: "Líder de Procesos",
  tesoreria: "Tesorería",
};

export const LABEL_ESTADO_SOLICITUD: Record<string, string> = {
  con_jefe: "Con el Jefe de Portería",
  nueva: "Nueva",
  en_revision: "En revisión",
  en_consejo: "En el Consejo",
  resuelta: "Resuelta",
  asignada: "Asignada a Administración",
  ejecutada: "Ejecutada",
  rechazada: "Rechazada",
  cerrada: "Cerrada",
};

export const LABEL_TIPO_CONTRATO: Record<string, string> = {
  planta_permanente: "Planta permanente",
  contratado: "Contratado",
  eventual: "Eventual",
  monotributista: "Monotributista",
  pasantia: "Pasantía",
};

export const LABEL_TIPO_PERSONA: Record<string, string> = {
  fisica: "Física",
  juridica: "Empresa",
};

/** Etiqueta o el valor crudo si no la conocemos (nunca vacío). */
export function etiqueta(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "";
  return mapa[valor] ?? valor;
}
