import { Skeleton } from "@/components/ui/skeleton";

/** Silueta de Configuración: título, pestañas grandes y una lista de filas. */
export default function LoadingConfiguracion() {
  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-12 w-32 shrink-0 rounded-lg" />
        <Skeleton className="h-12 w-28 shrink-0 rounded-lg" />
        <Skeleton className="h-12 w-48 shrink-0 rounded-lg" />
        <Skeleton className="h-12 w-44 shrink-0 rounded-lg max-sm:hidden" />
        <Skeleton className="h-12 w-32 shrink-0 rounded-lg max-md:hidden" />
      </div>

      {/* Encabezado de sección */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {/* Filas */}
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-8 w-28 max-sm:hidden" />
          </div>
        ))}
      </div>
    </div>
  );
}
