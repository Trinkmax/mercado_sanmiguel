import { cn } from "@/lib/utils";

/** Encabezado estándar de página del panel: título Nunito + descripción. */
export function PageHeader({
  titulo,
  descripcion,
  children,
  className,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-5",
        className
      )}
    >
      <div className="space-y-0.5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="text-sm text-muted-foreground max-w-prose">
            {descripcion}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
