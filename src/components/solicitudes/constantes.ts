/** Constantes de Solicitudes (ex "Peticiones"), compartidas server/client.
 *  Interfaz congelada (contrato fase 3 §6.10): los nombres exportados de fase 2 no cambian. */
import type { Enums } from "@/lib/database.types";

export type TipoSolicitud = Enums<"tipo_solicitud">;
export type EstadoSolicitud = Enums<"estado_solicitud">;
export type OrigenSolicitud = Enums<"origen_solicitud">;
/** Quién decidió la resolución (solicitudes.resolucion_de). */
export type ResolucionDe = "jefe" | "lider" | "consejo";

export const TIPOS_SOLICITUD: {
  valor: TipoSolicitud;
  label: string;
  ayuda: string;
}[] = [
  {
    valor: "solicitud",
    label: "Solicitud",
    ayuda: "Pedís algo: un cambio, un permiso, un espacio",
  },
  {
    valor: "informe",
    label: "Informe",
    ayuda: "Contás algo que pasó para que quede registrado",
  },
  {
    valor: "reclamo",
    label: "Reclamo",
    ayuda: "Algo no está bien y hay que arreglarlo",
  },
  {
    valor: "consulta",
    label: "Consulta",
    ayuda: "Una pregunta que necesita respuesta",
  },
];

export const LABEL_TIPO: Record<TipoSolicitud, string> = {
  solicitud: "Solicitud",
  informe: "Informe",
  reclamo: "Reclamo",
  consulta: "Consulta",
};

export const LABEL_ORIGEN: Record<OrigenSolicitud, string> = {
  portal: "Portal del socio",
  porteria: "Portería",
  administracion: "Administración",
  tesoreria: "Tesorería",
  lider: "Líder de Procesos",
};

export const ORIGENES_SOLICITUD: OrigenSolicitud[] = [
  "portal",
  "porteria",
  "administracion",
  "tesoreria",
  "lider",
];

/** Estados que ya no piden nada de nadie. */
export const ESTADOS_TERMINADOS: EstadoSolicitud[] = [
  "ejecutada",
  "rechazada",
  "cerrada",
];

/** Estados "vivos": todavía hay algo que hacer. */
export const ESTADOS_EN_CURSO: EstadoSolicitud[] = [
  "con_jefe",
  "nueva",
  "en_revision",
  "en_consejo",
  "resuelta",
  "asignada",
];

/** Estados en manos del Líder de Procesos (o de Administración, por encargo suyo). */
export const ESTADOS_CON_LIDER: EstadoSolicitud[] = [
  "nueva",
  "en_revision",
  "en_consejo",
  "resuelta",
  "asignada",
];

/** El sello de "cerrada" de solicitudes no es el de cajas. */
export function selloEstado(estado: EstadoSolicitud): string {
  return estado === "cerrada" ? "cerrada_solicitud" : estado;
}

/**
 * Sello completo de una solicitud: una cerrada por el Jefe de Portería se ve como
 * "Resuelta por el Jefe" (verde), no como una cerrada cualquiera.
 */
export function selloSolicitud(s: {
  estado: EstadoSolicitud;
  resolucion_de?: string | null;
}): string {
  if (s.estado === "cerrada" && s.resolucion_de === "jefe") return "resuelta_jefe";
  return selloEstado(s.estado);
}

/** Texto visible del estado (mismo que el sello, para frases). */
export const LABEL_ESTADO: Record<EstadoSolicitud, string> = {
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

export const LABEL_RESOLUCION_DE: Record<ResolucionDe, string> = {
  jefe: "Jefe de Portería",
  lider: "Líder de Procesos",
  consejo: "Consejo",
};

/** "Ahora la tiene: …" — a quién le toca moverla. Null si ya terminó. */
export function quienLaTiene(s: { estado: EstadoSolicitud }): string | null {
  switch (s.estado) {
    case "con_jefe":
      return "el Jefe de Portería";
    case "nueva":
    case "en_revision":
    case "resuelta":
      return "el Líder de Procesos";
    case "en_consejo":
      return "el Consejo (lo registra el Líder de Procesos)";
    case "asignada":
      return "Administración";
    default:
      return null;
  }
}

/** Acepta pdf/jpg/png/webp (input de archivo de adjuntos). */
export const ACCEPT_ADJUNTO =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/**
 * Los mensajes automáticos los inserta la RPC `avanzar_solicitud` con un
 * texto fijo al cambiar de estado. Se detectan por el comienzo del texto
 * para mostrarlos con estilo sutil (no son un mensaje de una persona).
 */
const PREFIJOS_AUTOMATICOS = [
  "Tomó la solicitud",
  "Derivó la solicitud",
  "Elevó la solicitud",
  "Resolución:",
  "Resolución del Jefe de Portería:",
  "Asignó la resolución",
  "Ejecutó la resolución",
  "Rechazó la solicitud",
  "Cerró la solicitud",
  "Reabrió la solicitud",
];

export function esMensajeAutomatico(mensaje: string): boolean {
  return PREFIJOS_AUTOMATICOS.some((p) => mensaje.startsWith(p));
}
