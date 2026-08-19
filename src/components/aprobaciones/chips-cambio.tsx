import { cn } from "@/lib/utils";
import {
  LABEL_ACCION,
  LABEL_ENTIDAD,
  type AccionCambio,
  type EntidadCambio,
} from "@/components/aprobaciones/tipos";

/**
 * "Cliente · Modificación": qué entidad y qué acción. No es un estado (eso es
 * el Sello): son dos chips neutros, legibles a distancia.
 */
export function ChipsCambio({
  entidad,
  accion,
  className,
}: {
  entidad: EntidadCambio;
  accion: AccionCambio;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground",
        className
      )}
    >
      <span>{LABEL_ENTIDAD[entidad]}</span>
      <span aria-hidden="true">·</span>
      <span
        className={cn(
          accion === "baja" && "text-pendiente",
          accion === "alta" && "text-pagado"
        )}
      >
        {LABEL_ACCION[accion]}
      </span>
    </span>
  );
}
