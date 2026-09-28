import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCircular() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-md" />
          <Skeleton className="h-11 w-32 rounded-md" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </div>
      </div>

      {/* "La vieron X de Y" + barra */}
      <div className="space-y-3 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Skeleton className="h-9 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Buscador + filtros */}
      <Skeleton className="h-12 w-full rounded-md" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>

      {/* Dos listas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, j) => (
          <div key={j} className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
