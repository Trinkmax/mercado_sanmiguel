import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFechaTS } from "@/lib/format";
import { pasosRegistro } from "./constantes";

/** Fechas del último ciclo del hilo: último mensaje del socio y la respuesta del staff posterior. */
export function fechasDelHilo(
  mensajes: { autor_rol: string; creado_en: string }[]
): { descargoEn: string | null; respondidoEn: string | null } {
  let descargoEn: string | null = null;
  let respondidoEn: string | null = null;
  for (const m of mensajes) {
    if (m.autor_rol === "socio") {
      descargoEn = m.creado_en;
      respondidoEn = null;
    } else if (descargoEn && !respondidoEn) {
      respondidoEn = m.creado_en;
    }
  }
  return { descargoEn, respondidoEn };
}

/**
 * Recorrido del registro: Notificado → Descargo presentado (o "Respondió") → Respondido.
 * Mismo lenguaje visual que la línea de estado de solicitudes (sin importar sus archivos).
 * Las fechas salen del hilo: primer mensaje del socio y primera respuesta posterior del staff.
 */
export function LineaEstadoRegistro({
  tipo,
  estado,
  notificadoEn,
  descargoEn,
  respondidoEn,
  paraSocio = false,
  className,
}: {
  tipo: string;
  estado: string;
  notificadoEn: string;
  descargoEn: string | null;
  respondidoEn: string | null;
  paraSocio?: boolean;
  className?: string;
}) {
  const [l1, l2, l3] = pasosRegistro(tipo, paraSocio);
  const indiceActual = estado === "respondido" ? 2 : estado === "descargo" ? 1 : 0;
  const pasos = [
    { label: l1, fecha: notificadoEn as string | null },
    { label: l2, fecha: descargoEn },
    { label: l3, fecha: respondidoEn },
  ];

  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Recorrido del registro">
      {pasos.map((p, i) => {
        const hecho = i <= indiceActual;
        const actual = i === indiceActual;
        return (
          <li
            key={p.label}
            className="flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={actual ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={cn("h-0.5 flex-1", i === 0 ? "invisible" : hecho ? "bg-primary" : "bg-border")}
              />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  hecho
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                  actual && "ring-4 ring-primary/25"
                )}
              >
                {hecho ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === pasos.length - 1 ? "invisible" : i < indiceActual ? "bg-primary" : "bg-border"
                )}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 px-1 text-sm leading-tight",
                actual ? "font-semibold text-foreground" : hecho ? "text-foreground/80" : "text-muted-foreground"
              )}
            >
              {p.label}
            </p>
            {p.fecha && hecho ? (
              <p className="tabular text-xs text-muted-foreground">{formatFechaTS(p.fecha)}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
