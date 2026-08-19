import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSolicitudes() {
  return (
    <div className="space-y-8">
      {/* PageHeader: título + descripción + botones */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-[28rem] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-md" />
          <Skeleton className="h-12 w-44 rounded-md" />
        </div>
      </div>

      {/* Pestañas por estado */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-32 rounded-md" />
        ))}
      </div>

      {/* Filas de la bandeja */}
      <div className="divide-y overflow-hidden rounded-lg border bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-6 w-9" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
