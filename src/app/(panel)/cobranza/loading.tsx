import { Skeleton } from "@/components/ui/skeleton";

export default function CobranzaLoading() {
  return (
    <div className="space-y-8">
      {/* PageHeader + acción */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-12 w-44 rounded-md" />
      </div>

      {/* "Hoy cobraste" */}
      <Skeleton className="-mt-4 h-14 w-full rounded-lg" />

      <div className="space-y-4">
        {/* Control segmentado por categoría */}
        <Skeleton className="h-12 w-full rounded-md" />
        {/* Buscador grande */}
        <Skeleton className="h-12 w-full rounded-md" />

        {/* Lista de clientes */}
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2">
              <Skeleton className="h-6 w-10 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
