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
  guardia: "Portería",
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
  en_cartera: "En cartera",
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
  caja: "Caja",
  tesoreria: "Tesorería",
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
};

export const LABEL_ESTADO_SOLICITUD: Record<string, string> = {
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
  juridica: "Jurídica",
};

/** Etiqueta o el valor crudo si no la conocemos (nunca vacío). */
export function etiqueta(mapa: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return "";
  return mapa[valor] ?? valor;
}
