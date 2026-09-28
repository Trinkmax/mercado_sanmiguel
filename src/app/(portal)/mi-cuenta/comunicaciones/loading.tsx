import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingComunicacionesSocio() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      {/* Pestañas 2×2 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>

      {/* Filas */}
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
