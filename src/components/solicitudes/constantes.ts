/** Constantes de Solicitudes (ex "Peticiones"), compartidas server/client. */
import type { Enums } from "@/lib/database.types";

export type TipoSolicitud = Enums<"tipo_solicitud">;
export type EstadoSolicitud = Enums<"estado_solicitud">;
export type OrigenSolicitud = Enums<"origen_solicitud">;

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
    ayuda: "Una pregunta para administración",
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
  lider: "Líder de Procesos",
};

export const ORIGENES_SOLICITUD: OrigenSolicitud[] = [
  "portal",
  "porteria",
  "administracion",
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

/** Texto visible del estado (mismo que el sello, para frases). */
export const LABEL_ESTADO: Record<EstadoSolicitud, string> = {
  nueva: "Nueva",
  en_revision: "En revisión",
  en_consejo: "En el Consejo",
  resuelta: "Resuelta",
  asignada: "Asignada a Administración",
  ejecutada: "Ejecutada",
  rechazada: "Rechazada",
  cerrada: "Cerrada",
};

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
  "Resolución:",
  "Asignó la resolución",
  "Ejecutó la resolución",
  "Rechazó la solicitud",
  "Cerró la solicitud",
  "Reabrió la solicitud",
];

export function esMensajeAutomatico(mensaje: string): boolean {
  return PREFIJOS_AUTOMATICOS.some((p) => mensaje.startsWith(p));
}
