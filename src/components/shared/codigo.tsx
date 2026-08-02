import { cn } from "@/lib/utils";

/** Código de concepto o rubro, en stencil de etiqueta de cajón (EXPP, AGUA…). */
export function Codigo({
  codigo,
  className,
}: {
  codigo: string;
  className?: string;
}) {
  return <span className={cn("codigo", className)}>{codigo}</span>;
}
