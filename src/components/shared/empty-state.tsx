import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Estado vacío estándar: qué no hay y qué hacer al respecto. */
export function EmptyState({
  icono: Icono,
  titulo,
  descripcion,
  children,
  className,
}: {
  icono?: LucideIcon;
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-14 text-center",
        className
      )}
    >
      {Icono ? (
        <Icono className="size-8 text-muted-foreground" strokeWidth={1.5} />
      ) : null}
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        {descripcion ? (
          <p className="text-sm text-muted-foreground max-w-sm">{descripcion}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
