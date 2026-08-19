import { cn } from "@/lib/utils";
import { LABEL_TIPO, type TipoSolicitud } from "./constantes";

/** Chip del tipo de solicitud (Solicitud / Informe / Reclamo / Consulta).
 * No es un estado: no usa sello ni colores de cobro. */
export function ChipTipo({
  tipo,
  className,
}: {
  tipo: TipoSolicitud;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground/80",
        className
      )}
    >
      {LABEL_TIPO[tipo]}
    </span>
  );
}
