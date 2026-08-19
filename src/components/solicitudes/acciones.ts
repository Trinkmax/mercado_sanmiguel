import type { ElementType } from "react";
import {
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
import type { EstadoSolicitud } from "./constantes";

/** Definición de las acciones del panel "Acciones" (pura: sirve en server y client). */
type Accion =
  | "tomar"
  | "derivar_consejo"
  | "resolver"
  | "asignar"
  | "ejecutar"
  | "rechazar"
  | "cerrar"
  | "reabrir";

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
  /** Texto del botón de confirmación del dialog. */
  confirmar?: string;
  exito: string;
};

const DEFS: Record<Accion, Omit<DefAccion, "accion" | "primaria">> = {
  tomar: {
    label: "Tomar para revisar",
    icono: Hand,
    exito: "Solicitud tomada: ahora está en revisión",
  },
  derivar_consejo: {
    label: "Derivar al Consejo",
    icono: ArrowRightLeft,
    conTexto: "opcional",
    titulo: "Derivar al Consejo",
    descripcion:
      "El Consejo la va a ver en su bandeja para registrar la resolución. Si querés, dejale una nota.",
    placeholder: "Nota para el Consejo (opcional)",
    confirmar: "Derivar al Consejo",
    exito: "Derivada al Consejo",
  },
  resolver: {
    label: "Registrar resolución",
    icono: Gavel,
    conTexto: "obligatorio",
    titulo: "Registrar la resolución",
    descripcion:
      "Escribí qué se decidió. Queda en el hilo y el socio lo va a poder leer.",
    placeholder: "Ej.: Se aprueba el medio puesto adicional a partir de septiembre.",
    confirmar: "Registrar resolución",
    exito: "Resolución registrada",
  },
  asignar: {
    label: "Asignar a Administración",
    icono: Send,
    conTexto: "opcional",
    titulo: "Asignar a Administración",
    descripcion:
      "Administración la va a ver como tarea pendiente y la marca ejecutada cuando esté hecha.",
    placeholder: "Qué tiene que hacer Administración (si no hay resolución escrita, es obligatorio)",
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
    descripcion:
      "Contá por qué se rechaza. El motivo queda en el hilo y lo ve quien la pidió.",
    placeholder: "Motivo del rechazo",
    confirmar: "Rechazar solicitud",
    exito: "Solicitud rechazada",
  },
  cerrar: {
    label: "Cerrar",
    icono: CheckCheck,
    conTexto: "opcional",
    titulo: "Cerrar la solicitud",
    descripcion:
      "Se da por terminada. El Líder de Procesos la puede reabrir si hace falta.",
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
};

/** Qué puede hacer cada rol en cada estado (espejo de la RPC avanzar_solicitud). */
export function accionesPara(rol: Rol, estado: EstadoSolicitud): DefAccion[] {
  const d = (accion: Accion, primaria = false): DefAccion => ({
    ...DEFS[accion],
    accion,
    primaria,
  });

  if (rol === "lider") {
    switch (estado) {
      case "nueva":
        return [d("tomar", true), d("derivar_consejo"), d("resolver"), d("asignar"), d("rechazar")];
      case "en_revision":
        return [d("resolver", true), d("derivar_consejo"), d("asignar"), d("rechazar"), d("cerrar")];
      case "en_consejo":
        return [d("resolver", true), d("asignar"), d("rechazar"), d("cerrar")];
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

  if (rol === "admin") {
    switch (estado) {
      case "nueva":
        return [d("tomar", true)];
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

