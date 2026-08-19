import Link from "next/link";
import type { Rol } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ESTADOS_EN_CURSO,
  ESTADOS_TERMINADOS,
  type EstadoSolicitud,
} from "./constantes";

export type FiltroSolicitud = {
  valor: string;
  label: string;
  /** null = todas las que el rol ve. */
  estados: EstadoSolicitud[] | null;
  vacio: { titulo: string; descripcion: string };
};

const F = {
  nuevas: {
    valor: "nuevas",
    label: "Nuevas",
    estados: ["nueva"],
    vacio: {
      titulo: "No hay solicitudes nuevas",
      descripcion: "Cuando entre una desde el portal, portería o administración, aparece acá.",
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
      descripcion: "Las que el Líder de Procesos derive al Consejo aparecen acá.",
    },
  },
  resueltas: {
    valor: "resueltas",
    label: "Resueltas (para asignar)",
    estados: ["resuelta"],
    vacio: {
      titulo: "No hay resoluciones para asignar",
      descripcion: "Cuando el Consejo o vos registren una resolución, aparece acá para asignarla a Administración.",
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
      descripcion: "Las ejecutadas, rechazadas y cerradas quedan acá como historial.",
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
  mias: {
    valor: "todas",
    label: "Mis solicitudes",
    estados: null,
    vacio: {
      titulo: "Todavía no cargaste solicitudes",
      descripcion: "Cargá la primera con el botón \"Nueva solicitud\": se imprime para derivar a Administración.",
    },
  },
} satisfies Record<string, FiltroSolicitud>;

/** Pestañas por rol: cada uno ve primero lo que le toca hacer. */
export function filtrosParaRol(rol: Rol): FiltroSolicitud[] {
  switch (rol) {
    case "lider":
      return [F.nuevas, F.revision, F.consejo, F.resueltas, F.asignadas, F.terminadas, F.todas];
    case "admin":
      return [F.asignadas_admin, F.nuevas, F.en_curso, F.terminadas, F.todas];
    case "consejo":
      return [F.consejo, F.nuevas, F.en_curso, F.terminadas, F.todas];
    case "tesoreria":
      return [F.nuevas, F.en_curso, F.terminadas, F.todas];
    case "porteria":
    case "guardia":
      return [F.mias, F.en_curso, F.terminadas];
    default:
      return [F.todas];
  }
}

/** Pestañas grandes (targets ≥ 44 px) con el conteo de cada una. */
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
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
      {filtros.map((f, i) => {
        const esActivo = activo === f.valor;
        return (
          <Link
            key={f.valor}
            role="tab"
            aria-selected={esActivo}
            href={i === 0 ? "/solicitudes" : `/solicitudes?estado=${f.valor}`}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
              esActivo
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {f.label}
            <span
              className={cn(
                "tabular text-xs font-semibold",
                esActivo ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {conteos[f.valor] ?? 0}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
