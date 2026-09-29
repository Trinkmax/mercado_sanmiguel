import type { ElementType } from "react";
import {
  ArrowBigUpDash,
  ArrowRightLeft,
  CheckCheck,
  CircleCheckBig,
  Gavel,
  Hand,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import type { Rol } from "@/lib/auth";
import type { EstadoSolicitud, OrigenSolicitud } from "./constantes";

/** Definición de las acciones del panel "Acciones" (pura: sirve en server y client). */
export type Accion =
  | "tomar"
  | "derivar_consejo"
  | "resolver"
  | "asignar"
  | "ejecutar"
  | "rechazar"
  | "cerrar"
  | "reabrir"
  | "elevar"
  | "resolver_jefe";

export type DefAccion = {
  accion: Accion;
  label: string;
  icono: ElementType;
  /** primaria = botón lleno grande; el resto outline. */
  primaria?: boolean;
  /** Pide texto en un Dialog. */
  conTexto?: "obligatorio" | "opcional";
  destructiva?: boolean;
  titulo?: string;
  descripcion?: string;
  placeholder?: string;
  /** Mensaje si falta el texto obligatorio. */
  faltaTexto?: string;
  /** Sugerencias de un toque para el texto. */
  sugerencias?: string[];
  /** Texto del botón de confirmación del dialog. */
  confirmar?: string;
  exito: string;
};

const DEFS: Record<Accion, Omit<DefAccion, "accion" | "primaria">> = {
  // Mismo nombre esté con el Jefe o recién llegada: es la misma acción (antes era "Tomarla yo"
  // en una y "Tomar para revisar" en otra).
  tomar: {
    label: "Tomarla para revisar",
    icono: Hand,
    exito: "La tomaste: ahora está en revisión",
  },
  derivar_consejo: {
    label: "Derivar al Consejo",
    icono: ArrowRightLeft,
    conTexto: "opcional",
    titulo: "Derivar al Consejo",
    descripcion:
      "Queda en espera de lo que decida el Consejo; cuando decida, registrá acá la resolución.",
    placeholder: "Nota para tratar en la reunión (opcional)",
    confirmar: "Derivar al Consejo",
    exito: "Derivada al Consejo",
  },
  resolver: {
    label: "Registrar resolución",
    icono: Gavel,
    conTexto: "obligatorio",
    titulo: "Registrar la resolución",
    descripcion: "Escribí qué se decidió. Queda en el hilo y lo lee quien la pidió.",
    placeholder: "Ej.: Se aprueba el medio puesto adicional a partir de septiembre.",
    faltaTexto: "Escribí la resolución.",
    confirmar: "Registrar resolución",
    exito: "Resolución registrada",
  },
  asignar: {
    label: "Asignar a Administración",
    icono: Send,
    conTexto: "opcional",
    titulo: "Asignar a Administración",
    descripcion:
      "Administración la ve como tarea pendiente y la marca ejecutada cuando esté hecha.",
    placeholder: "Qué tiene que hacer Administración (si no hay resolución escrita, es obligatorio)",
    faltaTexto: "Escribí qué tiene que hacer Administración.",
    confirmar: "Asignar a Administración",
    exito: "Asignada a Administración",
  },
  ejecutar: {
    label: "Marcar ejecutada",
    icono: CircleCheckBig,
    conTexto: "opcional",
    titulo: "Marcar como ejecutada",
    descripcion: "Contá brevemente qué se hizo (opcional).",
    placeholder: "Ej.: Se cambió la luminaria el 20/08.",
    confirmar: "Marcar ejecutada",
    exito: "Solicitud ejecutada",
  },
  rechazar: {
    label: "Rechazar",
    icono: XCircle,
    conTexto: "obligatorio",
    destructiva: true,
    titulo: "Rechazar la solicitud",
    descripcion: "Contá por qué se rechaza. El motivo queda en el hilo y lo ve quien la pidió.",
    placeholder: "Motivo del rechazo",
    faltaTexto: "Contá por qué se rechaza.",
    confirmar: "Rechazar solicitud",
    exito: "Solicitud rechazada",
  },
  cerrar: {
    label: "Cerrar",
    icono: CheckCheck,
    conTexto: "opcional",
    titulo: "Cerrar la solicitud",
    descripcion: "Se da por terminada. El Líder de Procesos la puede reabrir si hace falta.",
    placeholder: "Comentario de cierre (opcional)",
    confirmar: "Cerrar solicitud",
    exito: "Solicitud cerrada",
  },
  reabrir: {
    label: "Reabrir",
    icono: RotateCcw,
    conTexto: "opcional",
    titulo: "Reabrir la solicitud",
    descripcion: "Vuelve a revisión. Contá por qué se reabre (opcional).",
    placeholder: "Motivo de la reapertura (opcional)",
    confirmar: "Reabrir solicitud",
    exito: "Solicitud reabierta",
  },
  elevar: {
    label: "Elevar al Líder de Procesos",
    icono: ArrowBigUpDash,
    conTexto: "opcional",
    titulo: "Elevar al Líder de Procesos",
    descripcion:
      "Pasa a la bandeja del Líder de Procesos, que decide. Contale por qué se la pasás (opcional).",
    placeholder: "Ej.: Hace falta comprar el repuesto del portón.",
    confirmar: "Elevar al Líder",
    exito: "Elevada al Líder de Procesos",
  },
  resolver_jefe: {
    label: "Resolver",
    icono: Gavel,
    conTexto: "obligatorio",
    titulo: "Resolver la solicitud",
    descripcion: "Contá qué decidiste. Le llega a quien la cargó y queda cerrada.",
    placeholder: "Ej.: Aprobado el cambio de turno con Gómez para el sábado.",
    faltaTexto: "Contá cómo la resolviste.",
    sugerencias: ["Aprobado", "Ya está solucionado", "Lo hablé con el portero"],
    confirmar: "Resolver y cerrar",
    exito: "Resuelta y cerrada",
  },
};

export type SolicitudAcciones = {
  estado: EstadoSolicitud;
  origen?: OrigenSolicitud | null;
  resolucion_de?: string | null;
};

/**
 * Qué puede hacer cada rol en cada estado (espejo de la RPC avanzar_solicitud). Acepta el
 * estado solo (compatibilidad) o la solicitud con su origen: el Jefe de Portería actúa solo
 * sobre las de Portería que están con él.
 */
export function accionesPara(rol: Rol, s: EstadoSolicitud | SolicitudAcciones): DefAccion[] {
  const { estado, origen } = typeof s === "string" ? { estado: s, origen: null } : s;
  const d = (accion: Accion, primaria = false, cambios?: Partial<DefAccion>): DefAccion => ({
    ...DEFS[accion],
    accion,
    primaria,
    ...cambios,
  });

  if (rol === "guardia") {
    if (origen !== "porteria" || estado !== "con_jefe") return [];
    return [d("resolver_jefe", true), d("elevar"), d("rechazar")];
  }

  if (rol === "lider") {
    switch (estado) {
      case "con_jefe":
        return [
          d("tomar", true),
          d("resolver"),
          d("rechazar"),
        ];
      case "nueva":
        return [d("tomar", true), d("derivar_consejo"), d("resolver"), d("asignar"), d("rechazar")];
      case "en_revision":
        return [d("resolver", true), d("derivar_consejo"), d("asignar"), d("rechazar"), d("cerrar")];
      case "en_consejo":
        return [
          d("resolver", true, {
            label: "Registrar lo que resolvió el Consejo",
            titulo: "Registrar lo que resolvió el Consejo",
            descripcion: "Escribí lo que decidió el Consejo en su reunión. Queda como resolución del Consejo.",
            confirmar: "Registrar la resolución del Consejo",
          }),
          d("asignar"),
          d("rechazar"),
          d("cerrar"),
        ];
      case "resuelta":
        return [d("asignar", true), d("cerrar")];
      case "asignada":
        return [d("ejecutar", true), d("cerrar")];
      case "ejecutada":
        return [d("cerrar", true), d("reabrir")];
      case "rechazada":
      case "cerrada":
        return [d("reabrir", true)];
    }
  }

  if (rol === "consejo") {
    switch (estado) {
      case "nueva":
        return [d("tomar", true), d("resolver"), d("rechazar")];
      case "en_revision":
      case "en_consejo":
        return [d("resolver", true), d("rechazar")];
      default:
        return [];
    }
  }

  // Administración no toma las nuevas: en fase 3 son del Líder de Procesos (si las tomara,
  // quedarían "en revisión" a su nombre sin que pueda hacer nada más). Actúa cuando se las asignan.
  if (rol === "admin") {
    switch (estado) {
      case "asignada":
        return [d("ejecutar", true)];
      case "ejecutada":
        return [d("cerrar", true)];
      default:
        return [];
    }
  }

  return [];
}
