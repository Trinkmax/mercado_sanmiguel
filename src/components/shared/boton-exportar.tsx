import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Datasets exportables a Excel (.xlsx). La autorización por rol vive en
 * `src/app/api/exportar/route.ts`; acá solo se arma el link. */
export type DatasetExportable =
  | "clientes"
  | "cuenta_corriente"
  | "pagos"
  | "cheques"
  | "gastos"
  | "cajas"
  | "canon"
  | "lecturas"
  | "movimientos_tesoreria"
  | "solicitudes"
  | "empleados"
  | "ingresos_personal"
  | "circulares"
  | "balance_mensual";

/**
 * Botón "Exportar a Excel": un link al route handler de exportación (el server
 * responde Content-Disposition: attachment; sin `download` para que un 400/403
 * se muestre como texto en vez de bajarse como archivo).
 * Uso: <BotonExportar dataset="clientes" /> ·
 *      <BotonExportar dataset="balance_mensual" periodo="2026-08-01" label="Balance del mes (.xlsx)" />
 */
export function BotonExportar({
  dataset,
  periodo,
  extra,
  label = "Exportar a Excel",
  variant = "outline",
  size = "default",
  className,
}: {
  dataset: DatasetExportable;
  /** "YYYY-MM-01" para datasets mensuales (cuenta corriente, pagos, balance…). */
  periodo?: string;
  /** Filtros extra que entiende el route handler (p. ej. `{ cliente: id }` para la
   * cuenta corriente / pagos de una sola carpeta). */
  extra?: Record<string, string>;
  label?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const params = new URLSearchParams({ dataset });
  if (periodo) params.set("periodo", periodo);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return (
    <Button asChild variant={variant} size={size} className={cn("min-h-11 text-sm", className)}>
      <a href={`/api/exportar?${params.toString()}`}>
        <FileSpreadsheet className="size-4" strokeWidth={1.9} />
        {label}
      </a>
    </Button>
  );
}
