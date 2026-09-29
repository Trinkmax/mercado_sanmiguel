import Link from "next/link";
import type { Rol } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FilaDeslizable } from "@/components/comunicaciones/fila-deslizable";
import {
  ESTADOS_CON_LIDER,
  ESTADOS_EN_CURSO,
  ESTADOS_TERMINADOS,
  type EstadoSolicitud,
  type OrigenSolicitud,
} from "./constantes";

type SolicitudFiltrable = { estado: EstadoSolicitud; origen: OrigenSolicitud };

export type FiltroSolicitud = {
  valor: string;
  label: string;
  /** null = todas las que el rol ve. */
  estados: EstadoSolicitud[] | null;
  /** Solo las de ese origen (además de los estados). Se filtra en la consulta. */
  origen?: OrigenSolicitud;
  vacio: { titulo: string; descripcion: string };
};

/** ¿La solicitud entra en la pestaña? */
export function cumpleFiltro(f: FiltroSolicitud, s: SolicitudFiltrable): boolean {
  if (f.estados && !f.estados.includes(s.estado)) return false;
  return f.origen ? s.origen === f.origen : true;
}

const F = {
  para_resolver: {
    valor: "para_resolver",
    label: "Para resolver",
    estados: ["con_jefe"],
    origen: "porteria",
    vacio: {
      titulo: "No hay solicitudes de Portería esperando",
      descripcion: "Cuando un portero cargue una, aparece acá para que la resuelvas o la eleves al Líder.",
    },
  },
  en_lider: {
    valor: "en_lider",
    label: "En manos del Líder",
    estados: ESTADOS_CON_LIDER,
    vacio: {
      titulo: "Nada en manos del Líder de Procesos",
      descripcion: "Las que elevás y tus avisos sobre puestos aparecen acá mientras el Líder las ve.",
    },
  },
  en_porteria: {
    valor: "en_porteria",
    label: "Con el Jefe de Portería",
    estados: ["con_jefe"],
    vacio: {
      titulo: "No hay solicitudes esperando al Jefe de Portería",
      descripcion: "Las que carga Portería pasan primero por el Jefe. Si hace falta, podés tomarlas vos.",
    },
  },
  nuevas: {
    valor: "nuevas",
    label: "Nuevas",
    estados: ["nueva"],
    vacio: {
      titulo: "No hay solicitudes nuevas",
      descripcion:
        "Cuando entre una desde el portal, el Jefe de Portería, Tesorería o Administración, aparece acá.",
    },
  },
  revision: {
    valor: "revision",
    label: "En revisión",
    estados: ["en_revision"],
    vacio: {
      titulo: "No hay solicitudes en revisión",
      descripcion: "Tomá una de las nuevas para empezar a revisarla.",
    },
  },
  consejo: {
    valor: "consejo",
    label: "En el Consejo",
    estados: ["en_consejo"],
    vacio: {
      titulo: "No hay solicitudes en el Consejo",
      descripcion: "Las que derives al Consejo quedan acá hasta que registres lo que resolvió.",
    },
  },
  resueltas: {
    valor: "resueltas",
    label: "Resueltas (para asignar)",
    estados: ["resuelta"],
    vacio: {
      titulo: "No hay resoluciones para asignar",
      descripcion: "Cuando registres una resolución (tuya o del Consejo), aparece acá para asignarla a Administración.",
    },
  },
  asignadas: {
    valor: "asignadas",
    label: "Asignadas",
    estados: ["asignada"],
    vacio: {
      titulo: "No hay solicitudes asignadas",
      descripcion: "Las resoluciones asignadas a Administración aparecen acá hasta que se ejecuten.",
    },
  },
  asignadas_admin: {
    valor: "asignadas",
    label: "Asignadas a Administración",
    estados: ["asignada"],
    vacio: {
      titulo: "No tenés tareas asignadas",
      descripcion: "Cuando el Líder de Procesos te asigne una resolución, aparece acá.",
    },
  },
  en_curso: {
    valor: "en_curso",
    label: "En curso",
    estados: ESTADOS_EN_CURSO,
    vacio: {
      titulo: "No hay solicitudes en curso",
      descripcion: "Todo lo cargado ya está terminado, o todavía no hay nada.",
    },
  },
  terminadas: {
    valor: "terminadas",
    label: "Terminadas",
    estados: ESTADOS_TERMINADOS,
    vacio: {
      titulo: "Todavía no hay solicitudes terminadas",
      descripcion: "Las resueltas, ejecutadas, rechazadas y cerradas quedan acá como historial.",
    },
  },
  todas: {
    valor: "todas",
    label: "Todas",
    estados: null,
    vacio: {
      titulo: "Todavía no hay solicitudes",
      descripcion: "Cargá la primera con el botón \"Nueva solicitud\".",
    },
  },
  mias_porteria: {
    valor: "todas",
    label: "Mis solicitudes",
    estados: null,
    vacio: {
      titulo: "Todavía no cargaste solicitudes",
      descripcion:
        "Cargá la primera con el botón \"Nueva solicitud\": le llega al Jefe de Portería, que la resuelve o la eleva al Líder.",
    },
  },
  mias_tesoreria: {
    valor: "todas",
    label: "Mis solicitudes",
    estados: null,
    vacio: {
      titulo: "Todavía no cargaste solicitudes",
      descripcion: "Cargá la primera con el botón \"Nueva solicitud\": le llega al Líder de Procesos.",
    },
  },
} satisfies Record<string, FiltroSolicitud>;

/** Pestañas por rol: cada uno ve primero lo que le toca hacer. */
export function filtrosParaRol(rol: Rol): FiltroSolicitud[] {
  switch (rol) {
    case "lider":
      return [F.nuevas, F.revision, F.consejo, F.resueltas, F.asignadas, F.en_porteria, F.terminadas, F.todas];
    case "admin":
      return [F.asignadas_admin, F.nuevas, F.en_curso, F.terminadas, F.todas];
    case "consejo":
      return [F.consejo, F.nuevas, F.en_curso, F.terminadas, F.todas];
    case "guardia":
      return [F.para_resolver, F.en_lider, F.terminadas, F.todas];
    case "tesoreria":
      return [F.mias_tesoreria, F.en_curso, F.terminadas];
    case "porteria":
      return [F.mias_porteria, F.en_curso, F.terminadas];
    default:
      return [F.todas];
  }
}

/**
 * Pestañas grandes (targets ≥ 44 px) con el conteo de cada una. En el celular van en un solo
 * renglón que se desliza (antes los 8 filtros del Líder ocupaban 4 renglones antes de la lista).
 */
export function FiltrosSolicitudes({
  filtros,
  activo,
  conteos,
}: {
  filtros: FiltroSolicitud[];
  activo: string;
  conteos: Record<string, number>;
}) {
  return (
    <FilaDeslizable role="tablist" aria-label="Filtrar por estado">
      {filtros.map((f, i) => {
        const esActivo = activo === f.valor;
        const cantidad = conteos[f.valor] ?? 0;
        // "Para resolver (N)": lo que espera acción se nota aunque no sea la pestaña abierta.
        const urgente = f.valor === "para_resolver" && cantidad > 0 && !esActivo;
        return (
          <Link
            key={f.valor}
            role="tab"
            aria-selected={esActivo}
            href={i === 0 ? "/solicitudes" : `/solicitudes?estado=${f.valor}`}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-4 text-sm font-medium whitespace-nowrap transition-colors",
              esActivo
                ? "border-primary bg-primary text-primary-foreground"
                : urgente
                  ? "border-parcial/50 bg-parcial-suave text-foreground hover:bg-accent"
                  : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {f.label}
            <span
              className={cn(
                "tabular text-xs font-semibold",
                esActivo ? "text-primary-foreground/80" : urgente ? "text-parcial" : "text-muted-foreground"
              )}
            >
              {cantidad}
            </span>
          </Link>
        );
      })}
    </FilaDeslizable>
  );
}
