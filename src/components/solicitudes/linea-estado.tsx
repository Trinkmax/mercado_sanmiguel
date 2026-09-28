import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFechaTS } from "@/lib/format";
import type { EstadoSolicitud, OrigenSolicitud } from "./constantes";

export type FechasSolicitud = {
  estado: EstadoSolicitud;
  creada_en: string;
  revisada_en: string | null;
  derivada_consejo_en: string | null;
  resuelta_en: string | null;
  asignada_en: string | null;
  ejecutada_en: string | null;
  cerrada_en: string | null;
  /** Fase 3 (opcionales: el portal no los manda). */
  origen?: OrigenSolicitud | null;
  elevada_en?: string | null;
  resolucion_de?: string | null;
};

type Paso = {
  clave: EstadoSolicitud | "cargada";
  label: string;
  fecha: string | null;
  sub?: string;
};

/**
 * Línea de tiempo del estado: nueva → revisión → Consejo → resuelta → asignada → ejecutada.
 * Las de Portería que pasan por el Jefe suman el paso "Jefe de Portería"; si el Jefe la
 * resolvió, termina en verde "Resuelta por el Jefe". Los pasos hechos llevan su fecha; el
 * actual se resalta; los salteados se marcan. Si terminó rechazada o cerrada, se muestran
 * solo los pasos recorridos y el cierre al final.
 */
export function LineaEstado({
  solicitud,
  className,
}: {
  solicitud: FechasSolicitud;
  className?: string;
}) {
  const s = solicitud;
  const rechazada = s.estado === "rechazada";
  const cerrada = s.estado === "cerrada";
  const terminal = rechazada || cerrada;
  const delJefe = s.resolucion_de === "jefe";
  const pasoPorJefe =
    s.origen === "porteria" && (s.estado === "con_jefe" || Boolean(s.elevada_en) || delJefe);

  let pasos: Paso[] = [
    pasoPorJefe
      ? { clave: "cargada", label: "Cargada", fecha: s.creada_en }
      : { clave: "nueva", label: "Nueva", fecha: s.creada_en },
  ];
  if (pasoPorJefe) {
    pasos.push({
      clave: "con_jefe",
      label: "Jefe de Portería",
      fecha: s.elevada_en ?? (delJefe ? s.resuelta_en : null),
      sub: s.elevada_en ? "la elevó" : undefined,
    });
  }
  if (!delJefe) {
    pasos.push(
      { clave: "en_revision", label: "En revisión", fecha: s.revisada_en },
      {
        clave: "en_consejo",
        label: "En el Consejo",
        fecha: s.derivada_consejo_en,
        sub: s.resolucion_de === "consejo" || s.estado === "en_consejo" ? "lo registra el Líder" : undefined,
      },
      // Rechazar también graba resuelta_en, pero no es una resolución.
      { clave: "resuelta", label: "Resuelta", fecha: rechazada ? null : s.resuelta_en },
      { clave: "asignada", label: "Asignada", fecha: s.asignada_en },
      { clave: "ejecutada", label: "Ejecutada", fecha: s.ejecutada_en }
    );
  }

  const ultimoHecho = pasos.reduce((max, p, i) => (p.fecha ? i : max), 0);
  if (terminal) pasos = pasos.slice(0, ultimoHecho + 1);
  // Elevada y esperando al Líder: el paso que sigue es la revisión.
  const claveActual = s.estado === "nueva" && pasoPorJefe ? "en_revision" : s.estado;
  const indiceActual = terminal ? -1 : pasos.findIndex((p) => p.clave === claveActual);
  const total = pasos.length + (terminal ? 1 : 0);
  const terminalVerde = cerrada && delJefe;

  return (
    <ol
      className={cn("flex w-full items-start overflow-x-auto pb-1", className)}
      aria-label="Recorrido de la solicitud"
    >
      {pasos.map((p, i) => {
        const hecho = Boolean(p.fecha);
        const actual = i === indiceActual;
        const salteado = !hecho && i < ultimoHecho;
        const lineaIzq = i > 0 && (hecho || salteado);
        const lineaDer = i < total - 1 && (i < ultimoHecho || terminal);
        return (
          <li
            key={p.clave}
            className="flex min-w-[5.5rem] flex-1 flex-col items-center text-center"
            aria-current={actual ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <Linea pintada={lineaIzq} oculta={i === 0} />
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-shadow",
                  hecho && "border-primary bg-primary text-primary-foreground",
                  !hecho && !salteado && "border-border bg-card text-muted-foreground",
                  salteado && "border-dashed border-muted-foreground/50 bg-card text-muted-foreground",
                  actual && "ring-4 ring-primary/15"
                )}
              >
                {hecho ? <Check className="size-4" strokeWidth={2.5} /> : salteado ? "–" : i + 1}
              </span>
              <Linea pintada={lineaDer} oculta={i === total - 1} />
            </div>
            <p
              className={cn(
                "mt-1.5 px-1 text-xs leading-tight",
                actual ? "font-semibold text-foreground" : hecho ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {p.label}
            </p>
            {p.fecha ? (
              <p className="tabular text-[0.68rem] text-muted-foreground">{formatFechaTS(p.fecha)}</p>
            ) : salteado ? (
              <p className="text-[0.68rem] text-muted-foreground">salteado</p>
            ) : null}
            {p.sub ? <p className="text-[0.68rem] text-muted-foreground">{p.sub}</p> : null}
          </li>
        );
      })}

      {terminal ? (
        <li className="flex min-w-[5.5rem] flex-1 flex-col items-center text-center" aria-current="step">
          <div className="flex w-full items-center">
            <Linea pintada />
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2 ring-4",
                rechazada
                  ? "border-pendiente bg-pendiente-suave text-pendiente ring-pendiente/10"
                  : terminalVerde
                    ? "border-pagado bg-pagado-suave text-pagado ring-pagado/10"
                    : "border-foreground/60 bg-muted text-foreground ring-foreground/5"
              )}
            >
              {rechazada ? <X className="size-4" strokeWidth={2.5} /> : <Check className="size-4" strokeWidth={2.5} />}
            </span>
            <Linea oculta />
          </div>
          <p className="mt-1.5 px-1 text-xs font-semibold leading-tight">
            {rechazada ? (delJefe ? "Rechazada por el Jefe" : "Rechazada") : terminalVerde ? "Resuelta por el Jefe" : "Cerrada"}
          </p>
          {s.cerrada_en ? (
            <p className="tabular text-[0.68rem] text-muted-foreground">{formatFechaTS(s.cerrada_en)}</p>
          ) : null}
        </li>
      ) : null}
    </ol>
  );
}

function Linea({ pintada = false, oculta = false }: { pintada?: boolean; oculta?: boolean }) {
  return (
    <span
      className={cn("h-0.5 flex-1", oculta ? "bg-transparent" : pintada ? "bg-primary/60" : "bg-border")}
    />
  );
}
