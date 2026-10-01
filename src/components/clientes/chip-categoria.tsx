import { CarFront, Footprints, Store, Tractor, type LucideIcon } from "lucide-react";
import { LABEL_CATEGORIA, type CategoriaCliente } from "@/lib/segmentos";
import { cn } from "@/lib/utils";

/** Ícono de cada categoría: el puesto, el tractor de la quinta, los pasos del ambulante y el
 * auto del empleado (alquila cochera). */
export const ICONO_CATEGORIA: Record<CategoriaCliente, LucideIcon> = {
  puestero: Store,
  quintero: Tractor,
  ambulante: Footprints,
  empleado: CarFront,
};

/**
 * Categoría del cliente (quién lo gestiona). No es un estado —eso es el Sello—:
 * es una etiqueta neutra con su ícono, legible a distancia.
 */
export function ChipCategoria({
  categoria,
  className,
}: {
  categoria: CategoriaCliente;
  className?: string;
}) {
  const Icono = ICONO_CATEGORIA[categoria];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      <Icono className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {LABEL_CATEGORIA[categoria]}
    </span>
  );
}
